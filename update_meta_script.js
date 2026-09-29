const fs = require('fs');

let html = fs.readFileSync('checkout.html', 'utf8');

const startMarker = '<!-- Facebook/Meta Commerce Manager Checkout URL Hook -->';
const endMarker = '  </script>';

if (html.includes(startMarker)) {
    const startIndex = html.indexOf(startMarker);
    const scriptTagIndex = html.indexOf('<script>', startIndex);
    const closeTagIndex = html.indexOf('</script>', scriptTagIndex);
    if (closeTagIndex !== -1) {
        html = html.substring(0, startIndex) + html.substring(closeTagIndex + 9);
    }
}

const mapContent = fs.readFileSync('feed_map.json', 'utf8').trim();

const newScript = \  <!-- Facebook/Meta Commerce Manager Checkout URL Hook -->
  <script>
  (async function initMetaCommerce() {
    const params = new URLSearchParams(window.location.search);
    const productsParam = params.get('products');
    const couponParam = params.get('coupon');
    
    if (productsParam) {
      try {
        const feedMap = \;
        
        const response = await fetch('products.json');
        const catalog = await response.json();
        
        // As per Meta best practices: clear cart if handling a Meta checkout
        let newCart = {};
        
        const productEntries = productsParam.split(',');
        for (const entry of productEntries) {
          const parts = entry.split(':');
          if (parts.length >= 2) {
            const rawFeedId = parts[0];
            const qty = parseInt(parts[1], 10);
            
            // Map the Meta feed ID to the internal slug ID
            const internalId = feedMap[rawFeedId] || rawFeedId;
            const product = catalog.find(p => p.id === internalId || p.sku === internalId || p.id === rawFeedId || p.sku === rawFeedId);
            
            if (product) {
              newCart[product.id] = {
                id: product.id,
                name: product.name,
                price: product.price,
                qty: qty,
                img: product.image || product.imageSlug || ''
              };
            }
          }
        }
        
        // Always set the cart to whatever Meta passed (even if empty, this clears old cart state)
        localStorage.setItem('hw_cart', JSON.stringify(newCart));
        
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
           if (typeof window.renderCheckoutSummary === 'function') {
             window.renderCheckoutSummary();
           }
        } else {
           window.addEventListener('DOMContentLoaded', () => {
             if (typeof window.renderCheckoutSummary === 'function') {
               window.renderCheckoutSummary();
             }
           });
        }

        if (couponParam) {
          const applyCouponLogic = () => {
            const couponInput = document.getElementById('discount-code');
            if (couponInput) {
              couponInput.value = couponParam;
              if (typeof window.applyDiscount === 'function') {
                window.applyDiscount();
              }
            }
          };
          if (document.readyState === 'complete' || document.readyState === 'interactive') {
            applyCouponLogic();
          } else {
            window.addEventListener('DOMContentLoaded', applyCouponLogic);
          }
        }
      } catch (e) {
        console.error('Meta Commerce integration error:', e);
      }
    }
  })();
  </script>
</head>\;

html = html.replace('</head>', newScript);
fs.writeFileSync('checkout.html', html);
console.log('Successfully updated script in checkout.html');
