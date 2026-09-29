const fs = require('fs');

const metaScript = \
  <!-- Facebook/Meta Commerce Manager Checkout URL Hook -->
  <script>
  (async function initMetaCommerce() {
    const params = new URLSearchParams(window.location.search);
    const productsParam = params.get('products');
    const couponParam = params.get('coupon');
    
    if (productsParam) {
      try {
        const response = await fetch('products.json');
        const catalog = await response.json();
        let newCart = {};
        
        const productEntries = productsParam.split(',');
        for (const entry of productEntries) {
          const parts = entry.split(':');
          if (parts.length >= 2) {
            const productId = parts[0];
            const qty = parseInt(parts[1], 10);
            
            const product = catalog.find(p => p.id === productId || p.sku === productId);
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
        
        if (Object.keys(newCart).length > 0) {
          localStorage.setItem('hw_cart', JSON.stringify(newCart));
        }
        
        // Re-render checkout cart if it already rendered empty
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

        // Apply coupon if present
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
\;

let html = fs.readFileSync('checkout.html', 'utf8');
if (!html.includes('initMetaCommerce')) {
  // Inject right before </head>
  html = html.replace('</head>', metaScript + '\n</head>');
  fs.writeFileSync('checkout.html', html);
  console.log('Injected Meta Commerce script into checkout.html');
} else {
  console.log('Already injected.');
}
