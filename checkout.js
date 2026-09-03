// Square Web Payments SDK Production Configuration
const appId = 'sq0idp-jw760RR9HEUoeIUXosaCxw';         // Production App ID
const locationId = 'BGW0EEK56YNKC';                    // Production Location ID
const sdkUrl = 'https://web.squarecdn.com/v1/square.js';

// Google Apps Script Web App endpoint for order data logging
// TODO: Replace this URL with your deployed Apps Script Web App URL
const HW_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxul-XR3SRjaVqu-l74E7k7vZxWq0yB3nTmr6_oMP5MhatSluB7FDGWSELqNXfpQQ6oeg/exec';

let card;

// Dynamically load Square SDK to prevent race conditions
function loadSquareSDK() {
  return new Promise((resolve, reject) => {
    if (window.Square) { resolve(); return; }
    const script = document.createElement('script');
    script.src = sdkUrl;
    script.defer = true;
    script.onload = () => { if (window.Square) { resolve(); } else { reject(new Error('Square SDK loaded but global not found.')); } };
    script.onerror = () => { reject(new Error('Failed to load Square SDK from CDN.')); };
    document.head.appendChild(script);
  });
}

document.addEventListener('DOMContentLoaded', async () => {
  trackCheckoutJourney('checkout_page_load', 'page_load', { referrer: document.referrer });
  try {
    await loadSquareSDK();
  } catch (e) {
    console.error('Square SDK loading error:', e);
    showStatus('Square Payment SDK failed to load. Please check your network connection.', 'error');
    return;
  }

  let payments;
  try {
    payments = window.Square.payments(appId, locationId);
  } catch (e) {
    console.error('Failed to initialize Square Payments:', e);
    showStatus(`Payment engine initialization failed: ${e.message || e}`, 'error');
    return;
  }

  try {
    card = await payments.card({
      style: {
        'input': {
          backgroundColor: '#FFFFFF',
          color: '#482C6A',
          fontFamily: 'sans-serif',
          fontSize: '14px',
        },
        'input::placeholder': {
          color: '#7C8D7C'
        }
      }
    });
    await card.attach('#card-container');
    const payButton = document.getElementById('card-button');
    if (payButton) {
      payButton.disabled = false;
      payButton.addEventListener('click', handlePaymentSubmission);
    }
  } catch (e) {
    console.error('Failed to attach card element:', e);
    showStatus(`Failed to load secure payment inputs: ${e.message || e}. Please try again.`, 'error');
  }
});

async function handlePaymentSubmission(event) {
  event.preventDefault();

  const payButton    = document.getElementById('card-button');
  const nameInput    = document.getElementById('customer-name');
  const emailInput   = document.getElementById('customer-email');

  // Billing address fields (always required)
  const bAddressInput = document.getElementById('billing-address');
  const bCityInput    = document.getElementById('billing-city');
  const bStateInput   = document.getElementById('billing-state');
  const bZipInput     = document.getElementById('billing-zip');

  // Shipping address fields (only when Ship to me and not same-as-billing)
  const addressInput  = document.getElementById('shipping-address');
  const cityInput     = document.getElementById('shipping-city');
  const stateInput    = document.getElementById('shipping-state');
  const zipInput      = document.getElementById('shipping-zip');
  const bSameCheck    = document.getElementById('billing-same');

  const fulfillMethodEl = document.querySelector('input[name="fulfillment_method"]:checked');
  const fulfillMethod   = fulfillMethodEl ? fulfillMethodEl.value : 'shipping';
  const pickupTimeEl    = document.getElementById('pickup-time');

  // --- Validation ---
  if (!nameInput.value.trim() || !emailInput.value.trim()) {
    showStatus('Please fill in your name and email.', 'error');
    return;
  }

  if (!bAddressInput || !bAddressInput.value.trim() || !bCityInput.value.trim() || !bStateInput.value.trim() || !bZipInput.value.trim()) {
    showStatus('Please fill in all required Billing Address fields (Street, City, State, ZIP).', 'error');
    return;
  }

  if (fulfillMethod === 'shipping') {
    if (bSameCheck && !bSameCheck.checked) {
      if (!addressInput || !addressInput.value.trim() || !cityInput.value.trim() || !stateInput.value.trim() || !zipInput.value.trim()) {
        showStatus('Please fill in all required Shipping Address fields (Street, City, State, ZIP).', 'error');
        return;
      }
    }
  } else {
    if (!pickupTimeEl || !pickupTimeEl.value) {
      showStatus('Please select a pickup time.', 'error');
      return;
    }
  }

  // --- Processing ---
  payButton.disabled = true;
  const originalText = payButton.textContent;
  payButton.textContent = 'Processing Payment...';

  try {
    const result = await card.tokenize();
    if (result.status === 'OK') {
      const sourceId = result.token;
      trackCheckoutJourney('tokenization_success', 'square_sdk');

      const cart = JSON.parse(localStorage.getItem('hw_cart') || '{}');
      const cartItemsArray = Object.keys(cart).map(k => cart[k]);

      if (cartItemsArray.length === 0) {
        showStatus('Your cart is empty. Cannot process payment.', 'error');
        payButton.disabled = false;
        payButton.textContent = originalText;
        return;
      }

      const tipVal = window.tipAmount || 0.0;
      const baseSubtotal = cartItemsArray.reduce((acc, item) => acc + (item.price * item.qty), 0);

      let discountAmount = 0.0;
      if (window.appliedDiscount) {
        let restriction = window.appliedDiscount.restriction || 'all';
        if (restriction === 'all' || restriction === fulfillMethod) {
          if (window.appliedDiscount.type === 'percent') {
            discountAmount = baseSubtotal * (window.appliedDiscount.value / 100.0);
          } else {
            discountAmount = window.appliedDiscount.value;
          }
        }
      }

      const subAfterDiscount = Math.max(0, baseSubtotal - discountAmount);
      const totalItemCount   = cartItemsArray.reduce((acc, item) => acc + (item.qty || 1), 0);

      window.shippingFee = 0.00;
      if (fulfillMethod === 'shipping') {
        if (subAfterDiscount >= 45.00) {
          window.shippingFee = 0.00;
        } else {
          if (totalItemCount <= 2) { window.shippingFee = 6.50; }
          else if (totalItemCount <= 5) { window.shippingFee = 10.50; }
          else { window.shippingFee = 14.50; }
        }
      }

      window.taxAmount = subAfterDiscount * 0.06;
      const totalVal = subAfterDiscount + window.taxAmount + window.shippingFee + tipVal;

      // Determine final shipping address for payload
      const useBillingAsShipping = (fulfillMethod === 'shipping' && bSameCheck && bSameCheck.checked);
      const shippingAddr = (fulfillMethod === 'shipping') ? {
        address_line_1: useBillingAsShipping ? bAddressInput.value.trim() : (addressInput ? addressInput.value.trim() : ''),
        locality: useBillingAsShipping ? bCityInput.value.trim() : (cityInput ? cityInput.value.trim() : ''),
        administrative_district_level_1: useBillingAsShipping ? bStateInput.value.trim() : (stateInput ? stateInput.value.trim() : ''),
        postal_code: useBillingAsShipping ? bZipInput.value.trim() : (zipInput ? zipInput.value.trim() : '')
      } : null;

      const billingAddr = {
        address_line_1: bAddressInput.value.trim(),
        locality: bCityInput.value.trim(),
        administrative_district_level_1: bStateInput.value.trim(),
        postal_code: bZipInput.value.trim()
      };

      trackCheckoutJourney('payment_attempt', 'pay_button', {
        itemsCount: cartItemsArray.length,
        tipAmount: tipVal,
        totalAmount: totalVal,
        items: cartItemsArray.map(it => ({ id: it.id, name: it.name, price: it.price, qty: it.qty }))
      });

      const response = await fetch('checkout.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceId: sourceId,
          items: cartItemsArray,
          customerName: nameInput.value.trim(),
          customerEmail: emailInput.value.trim(),
          tipAmount: tipVal,
          fulfillmentMethod: fulfillMethod,
          pickupTime: pickupTimeEl ? pickupTimeEl.value : '',
          discountCode: window.appliedDiscount ? window.appliedDiscount.code : '',
          orderNote: document.getElementById('order-note') ? document.getElementById('order-note').value : '',
          shippingAddress: shippingAddr,
          billingAddress: billingAddr,
          totalAmount: totalVal
        })
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        trackCheckoutJourney('purchase_success', 'checkout_api', {
          transactionId: responseData.transactionId || '',
          totalAmount: totalVal
        });

        // Non-blocking order log to Google Sheets
        try {
          const orderPayload = {
            type:          'shop_order',
            sessionId:     getSessionId(),
            transactionId: responseData.transactionId || '',
            customerName:  nameInput.value.trim(),
            customerEmail: emailInput.value.trim(),
            shippingAddress: shippingAddr,
            billingAddress: billingAddr,
            items:       cartItemsArray.map(it => ({ id: it.id, name: it.name, price: it.price, qty: it.qty })),
            totalAmount: totalVal,
            tipAmount:   tipVal,
            tax:         window.taxAmount || 0.0,
            shippingFee: window.shippingFee || 0.0,
            subtotal:    baseSubtotal || 0.0,
            status:      'Completed',
            fulfillmentMethod: fulfillMethod,
            pickupTime:      pickupTimeEl ? pickupTimeEl.value : '',
            discountCode:    window.appliedDiscount ? window.appliedDiscount.code : '',
            notes:           document.getElementById('order-note') ? document.getElementById('order-note').value : ''
          };
          fetch(HW_SHEETS_ENDPOINT, {
            method:  'POST',
            mode:    'no-cors',
            body:    JSON.stringify(orderPayload)
          }).catch(() => {});
        } catch (e) { /* never block checkout */ }

        localStorage.removeItem('hw_cart');

        const hasCourse = cartItemsArray.some(item =>
          item.id === 'the-formulators-collective-full-course-lifetime-pass' ||
          item.id === 'the-formulators-collective-founder-circle-pass'
        );

        const displayAddress = fulfillMethod === 'pickup'
          ? `Local Pickup — ${pickupTimeEl ? pickupTimeEl.value.replace('T', ' ') : ''}`
          : `${useBillingAsShipping ? bAddressInput.value.trim() : (addressInput ? addressInput.value.trim() : '')}, ${useBillingAsShipping ? bCityInput.value.trim() : (cityInput ? cityInput.value.trim() : '')} ${useBillingAsShipping ? bZipInput.value.trim() : (zipInput ? zipInput.value.trim() : '')}`;

        const container = document.querySelector('.checkout-container');
        if (container) {
          let courseMessageHtml = '';
          let navButtonsHtml = '';

          if (hasCourse) {
            courseMessageHtml = `
              <div style="margin-top:var(--space-6);background:rgba(216,140,67,0.1);border:1px solid rgba(216,140,67,0.2);padding:var(--space-4);border-radius:var(--radius-md);text-align:center;">
                <span style="color:var(--color-amber);font-weight:500;display:block;margin-bottom:4px;">🎓 Lifetime Course Access Activated!</span>
                <p style="font-size:var(--text-sm);color:var(--color-sage);margin:0;">Log in to the Classroom Portal using your email: <strong>${emailInput.value.trim()}</strong></p>
              </div>`;
            navButtonsHtml = `
              <div style="display:flex;gap:var(--space-4);justify-content:center;margin-top:var(--space-6);flex-wrap:wrap;width:100%;">
                <a href="index.html#education" class="btn-submit-payment" style="width:auto;padding:var(--space-3) var(--space-6);margin-top:0;text-decoration:none;display:inline-flex;">Go to Classroom</a>
                <a href="index.html#shop" class="btn-back-shop" style="margin-bottom:0;display:inline-flex;">Back to Shop</a>
              </div>`;
          } else {
            courseMessageHtml = `
              <div style="margin-top:var(--space-6);background:rgba(216,140,67,0.08);border:1px dashed rgba(216,140,67,0.3);padding:var(--space-5);border-radius:var(--radius-md);text-align:center;box-sizing:border-box;width:100%;">
                <span style="color:var(--color-amber);font-weight:500;display:block;margin-bottom:6px;font-size:1.1rem;">🎁 A Gift from LaToya Renee the Herbalist!</span>
                <p style="font-size:var(--text-sm);color:#482C6A;margin-bottom:var(--space-4);line-height:1.5;font-weight:400;">
                  Thank you for your purchase! As a special courtesy, you've received <strong>free access to the first week of The Formulators Collective</strong>.
                  Sign in or create your account to claim your gift and track your order.
                </p>
                ${fulfillMethod === 'pickup' ? `
                <div style="background:rgba(72,44,106,0.1);padding:15px;border-radius:8px;margin-top:15px;">
                   <strong style="color:var(--color-purple);display:block;margin-bottom:5px;">Pickup Instructions</strong>
                   <p style="color:var(--color-purple);font-size:14px;margin:0;">
                      Your order may be picked up at: <strong>4704 Ridgeway Avenue, Baltimore, Maryland 21206</strong>
                      at your selected time: <strong>${pickupTimeEl ? pickupTimeEl.value.replace('T', ' ') : ''}</strong>.
                   </p>
                </div>` : ''}
                <a href="index.html#account" class="btn-submit-payment" style="width:auto;padding:var(--space-2) var(--space-5);margin:0 auto;text-decoration:none;display:inline-flex;font-size:var(--text-xs);background:var(--color-amber);color:var(--color-cream);">Claim Gift &amp; Track Order</a>
              </div>`;
            navButtonsHtml = `
              <div style="display:flex;justify-content:center;margin-top:var(--space-6);width:100%;">
                <a href="index.html#shop" class="btn-back-shop" style="margin-bottom:0;display:inline-flex;">Back to Shop</a>
              </div>`;
          }

          container.innerHTML = `
            <div class="checkout-panel" style="grid-column:span 2;text-align:center;padding:var(--space-12) var(--space-8);max-width:600px;margin:0 auto;width:100%;box-sizing:border-box;">
              <div style="font-size:4rem;margin-bottom:var(--space-4);">🌿</div>
              <h2 class="panel-title" style="border:none;margin-bottom:var(--space-2);font-size:2.5rem;text-align:center;width:100%;">Order <em>Confirmed</em></h2>
              <p style="color:#482C6A;font-size:1.1rem;margin-bottom:var(--space-6);line-height:1.6;">
                Thank you, <strong>${nameInput.value.trim()}</strong>! Your payment was processed successfully.
              </p>
              <div style="background:rgba(255,255,255,0.85);border:1px solid rgba(72,44,106,0.15);border-radius:var(--radius-md);padding:var(--space-6);margin-bottom:var(--space-4);text-align:left;box-sizing:border-box;width:100%;">
                <div style="margin-bottom:var(--space-4);border-bottom:1px solid rgba(72,44,106,0.1);padding-bottom:var(--space-3);">
                  <span style="color:#7C8D7C;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:2px;">Transaction ID</span>
                  <strong style="color:#482C6A;font-family:monospace;font-size:1.05rem;word-break:break-all;">${responseData.transactionId}</strong>
                </div>
                <div style="margin-bottom:var(--space-4);border-bottom:1px solid rgba(72,44,106,0.1);padding-bottom:var(--space-3);">
                  <span style="color:#7C8D7C;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:2px;">Email Receipt Sent To</span>
                  <strong style="color:#482C6A;">${emailInput.value.trim()}</strong>
                </div>
                <div>
                  <span style="color:#7C8D7C;font-size:var(--text-xs);text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:2px;">${fulfillMethod === 'pickup' ? 'Pickup Details' : 'Shipping Address'}</span>
                  <strong style="color:#482C6A;font-weight:500;line-height:1.4;display:block;margin-top:2px;">${displayAddress}</strong>
                </div>
              </div>
              ${courseMessageHtml}
              ${navButtonsHtml}
            </div>
          `;
        }
      } else {
        const errMsg = responseData.error || 'Server processing failed';
        const squareCode = responseData.squareCode || '';
        const squareDetail = responseData.squareDetail || '';
        const debugInfo = squareCode ? ` [Code: ${squareCode}${squareDetail ? ' — ' + squareDetail : ''}]` : '';
        trackCheckoutJourney('purchase_failure', 'checkout_api', { error: errMsg, squareCode });
        showStatus(`Transaction Failed: ${errMsg}${debugInfo}`, 'error');
        payButton.disabled = false;
        payButton.textContent = originalText;
      }
    } else {
      let errorMsg = 'Card verification failed.';
      if (result.errors && result.errors.length > 0) { errorMsg = result.errors[0].message; }
      trackCheckoutJourney('tokenization_failure', 'square_sdk', { errors: result.errors });
      showStatus(errorMsg, 'error');
      payButton.disabled = false;
      payButton.textContent = originalText;
    }
  } catch (e) {
    console.error('Payment submission exception:', e);
    trackCheckoutJourney('purchase_error', 'checkout_api', { message: e.message || e.toString() });
    showStatus('An unexpected network error occurred. Please try again.', 'error');
    payButton.disabled = false;
    payButton.textContent = originalText;
  }
}

function showStatus(message, type) {
  const statusEl = document.getElementById('payment-status-message');
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.className = '';
  statusEl.classList.add(type === 'success' ? 'status-success' : 'status-error');
  statusEl.style.display = 'block';
}

function getSessionId() {
  var sid = sessionStorage.getItem('hw_analytics_session');
  if (!sid) {
    sid = 'sess_' + Math.random().toString(36).substring(2, 15) + '_' + Date.now();
    sessionStorage.setItem('hw_analytics_session', sid);
  }
  return sid;
}

function trackCheckoutJourney(event, target, details) {
  var payload = {
    sessionId: getSessionId(),
    event: event,
    page: 'checkout',
    target: target || '',
    details: details || {}
  };
  try {
    if (navigator.sendBeacon) {
      var blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      navigator.sendBeacon('track.php', blob);
    } else {
      fetch('track.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).catch(function(){});
    }
  } catch(e) {}
}
