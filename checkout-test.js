// Sandbox Configuration Keys
const appId = 'sandbox-sq0idb-b52wkrEsb0qd_TY61e6l2A';
const locationId = 'L7A22WWQR0Y7B';

async function initializeSquarePayments() {
  const cardContainer = document.getElementById('card-container');
  if (!cardContainer) {
    console.error('Element #card-container not found.');
    return;
  }

  if (!window.Square) {
    cardContainer.innerHTML = '<div style="color: #FF6B6B; border: 1px solid #FF6B6B; padding: 10px; border-radius: 4px; font-weight: bold; background: rgba(255, 107, 107, 0.1);">Error: Square SDK (square.js) failed to load. Please verify your internet connection or check if a browser ad blocker is active.</div>';
    throw new Error('Square SDK failed to load.');
  }

  let payments;
  try {
    payments = window.Square.payments(appId, locationId);
  } catch (e) {
    cardContainer.innerHTML = `<div style="color: #FF6B6B; border: 1px solid #FF6B6B; padding: 10px; border-radius: 4px; font-weight: bold; background: rgba(255, 107, 107, 0.1);">Error initializing Square payments: ${e.message}</div>`;
    console.error('Initialization failed:', e);
    return;
  }

  // Define thematic styles to pass directly into Square secure fields
  const rusticTheme = {
    input: {
      backgroundColor: 'transparent',
      color: '#F9F6F0',         // Cream canvas text
      fontFamily: 'Georgia',
      fontSize: '16px',
    },
    'input::placeholder': {
      color: '#7C8D7C',         // Sage placeholder color
    }
  };

  let card;
  try {
    card = await payments.card({ style: rusticTheme });
    await card.attach('#card-container');
  } catch (e) {
    cardContainer.innerHTML = `<div style="color: #FF6B6B; border: 1px solid #FF6B6B; padding: 10px; border-radius: 4px; font-weight: bold; background: rgba(255, 107, 107, 0.1);">Error attaching card field: ${e.message}</div>`;
    console.error('Failed attaching card component:', e);
    return;
  }

  const payButton = document.getElementById('pay-btn');
  const statusDiv = document.getElementById('payment-status');

  payButton.addEventListener('click', async (event) => {
    event.preventDefault();
    payButton.disabled = true;
    statusDiv.style.display = 'none';

    const name = document.getElementById('customer-name').value.trim();
    const email = document.getElementById('customer-email').value.trim();

    if (!name || !email) {
      showStatus('Please provide both your name and email.', 'error');
      payButton.disabled = false;
      return;
    }

    try {
      // Step 1: Request Secure Token from Square Client SDK
      const result = await card.tokenize();
      if (result.status === 'OK') {
        const token = result.token;
        
        // Mock Cart Payload matching your store database schema
        const mockCart = [
          {
            id: 'the-formulators-collective-full-course-lifetime-pass',
            name: 'The Formulators Collective - Full Course Lifetime Pass',
            price: 499.00,
            quantity: 1
          }
        ];

        // Step 2: POST details down to php processor
        const response = await fetch('https://herbalisticwellness.com/checkout-test.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceId: token,
            customerName: name,
            customerEmail: email,
            cartItems: mockCart,
            tipAmount: 10.00 // Custom Tip value
          })
        });

        const serverResult = await response.json();

        if (serverResult.success) {
          showStatus(`Success! Payment Processed. Transaction ID: ${serverResult.transactionId}`, 'success');
        } else {
          showStatus(`Transaction Failed: ${serverResult.error}`, 'error');
          payButton.disabled = false;
        }
      } else {
        let errorMessage = 'Tokenization error: ';
        if (result.errors) {
          errorMessage += result.errors.map(err => err.message).join(', ');
        }
        showStatus(errorMessage, 'error');
        payButton.disabled = false;
      }
    } catch (e) {
      showStatus(`Critical Processing Error: ${e.message}`, 'error');
      payButton.disabled = false;
    }
  });

  function showStatus(message, className) {
    statusDiv.textContent = message;
    statusDiv.className = `${className}`;
    statusDiv.style.display = 'block';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeSquarePayments);
} else {
  initializeSquarePayments();
}
