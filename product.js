import { APOTHECARY_DATABASE } from './data.js';

document.addEventListener('DOMContentLoaded', () => {
  if (typeof APOTHECARY_DATABASE.runProductSlugHydration === 'function') {
     APOTHECARY_DATABASE.runProductSlugHydration();
  }

  const pathParts = window.location.pathname.split('/').filter(Boolean);
  let slug = pathParts[pathParts.length - 1];
  const searchParams = new URLSearchParams(window.location.search);
  if (!slug || slug === 'product' || slug === 'products' || slug.includes('.html')) {
     slug = searchParams.get('slug') || searchParams.get('product') || searchParams.get('id');
  }

  // Helper: generate clean URL slug from product name
  function toUrlSlug(str) {
    return (str || '').toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/, '');
  }

  function findProduct(allProducts) {
    return allProducts.find(function(p) {
      if (!p) return false;
      if (p.slug === slug || p.id === slug || p.square_variation_id === slug) return true;
      return toUrlSlug(p.name) === slug;
    });
  }

  const detailContainer = document.getElementById('product-detail');

  // Try localStorage first (captures admin edits made in-session)
  var lsProducts = [];
  try {
    var stored = localStorage.getItem('hw_products');
    if (stored) lsProducts = JSON.parse(stored) || [];
  } catch(e) {}

  // Merge: localStorage overrides data.js for matching ids
  var staticProducts = (APOTHECARY_DATABASE && APOTHECARY_DATABASE.products) ? APOTHECARY_DATABASE.products : [];
  var mergedStatic = staticProducts.map(function(sp) {
    var lsMatch = lsProducts.find(function(lp) { return lp.id === sp.id; });
    return lsMatch || sp;
  });
  // Add any products in LS that aren't in static (Square catalog items)
  lsProducts.forEach(function(lp) {
    if (!mergedStatic.find(function(mp) { return mp.id === lp.id; })) mergedStatic.push(lp);
  });

  // Attempt to load from live API (most up-to-date: captures server-saved admin edits)
  var apiUrl = '/products.json';
  fetch(apiUrl + '?nocache=' + Date.now())
    .then(function(r) { return r.ok ? r.json() : Promise.reject(r.status); })
    .then(function(liveProducts) {
      // Merge: live API is authoritative for price/image; localStorage overrides for admin edits
      var allProducts = liveProducts.map(function(lp) {
        var lsMatch = lsProducts.find(function(ls) { return ls.id === lp.id; });
        // localStorage wins on admin-edited fields (image, fullDesc, ingredients, gallery)
        if (lsMatch) {
          return Object.assign({}, lp, {
            image: lsMatch.image || lp.image,
            gallery: (lsMatch.gallery && lsMatch.gallery.length > 0) ? lsMatch.gallery : lp.gallery,
            fullDesc: lsMatch.fullDesc || lp.fullDesc,
            ingredients: lsMatch.ingredients || lp.ingredients,
            inclusions: lsMatch.inclusions || lp.inclusions,
          });
        }
        return lp;
      });
      // Also include static-only products not in live API
      mergedStatic.forEach(function(sp) {
        if (!allProducts.find(function(ap) { return ap.id === sp.id; })) allProducts.push(sp);
      });
      renderPage(allProducts);
    })
    .catch(function() {
      // Fallback: use merged static+localStorage
      renderPage(mergedStatic);
    });

  function renderPage(allProducts) {
  var product = findProduct(allProducts);

  if (!product) {
    if (detailContainer) {
      detailContainer.innerHTML = '<div style="text-align:center; padding: 100px 20px; background: #FFFFFF; border-radius: var(--rlg, 20px); border: 1px solid var(--border-subtle, rgba(72,44,106,0.15)); margin-top: 40px;"><h1 style="font-family: var(--fe, serif); font-size: 2.5rem; color: var(--text-primary, #482C6A); margin-bottom: 1rem;">Product Not Found</h1><p style="color: var(--text-secondary, #829399); margin-bottom: 2rem;">The requested botanical formulation could not be located in our apothecary.</p><a href="/shop" class="btn-primary">Return to Shop</a></div>';
    }
    return;
  }

  document.title = `${product.name} — Herbalistic Wellness`;

  if (detailContainer) {
    const catName = product.cat || 'Botanical';
    const mainImgSrc = (product.image && product.image.indexOf('http') === 0) 
      ? product.image 
      : (`assets/images/products/${product.imageSlug || 'product-default'}.webp`);

    // Build gallery thumbnails from product.gallery array (set by admin panel)
    const galImages = (product.gallery && product.gallery.length > 0) ? product.gallery : [];
    const allImgs = [mainImgSrc, ...galImages.filter(g => g && g !== mainImgSrc)].slice(0,5);
    const galleryHtml = allImgs.length > 1 ? `
      <div class="product-gallery-thumbnails" style="display:flex;gap:0.6rem;margin-top:1rem;flex-wrap:wrap;justify-content:center;">
        ${allImgs.map((img, i) => `<img src="${img}" alt="${product.name} view ${i+1}"
          style="width:60px;height:60px;object-fit:cover;border-radius:8px;cursor:pointer;
                 border:2px solid ${i===0?'var(--accent-primary,#D88C43)':'var(--border-subtle)'};
                 transition:border-color 0.2s;flex-shrink:0;"
          onclick="(function(s,el){var m=document.getElementById('main-prod-image');if(m)m.src=s;
                   document.querySelectorAll('.product-gallery-thumbnails img').forEach(function(t){
                     t.style.borderColor='var(--border-subtle)';});
                   el.style.borderColor='var(--accent-primary,#D88C43)';})(this.src,this)"
          onerror="this.style.display='none'" />`
        ).join('')}
      </div>` : '';

    detailContainer.innerHTML = `
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:1rem; margin-bottom: 2rem;">
        <nav class="breadcrumb-trail" style="display:flex; align-items:center; gap: 0.5rem; font-size: 0.85rem; color: var(--text-secondary, #829399);">
          <a href="/" style="color: var(--text-secondary, #829399); text-decoration:none;">Home</a>
          <span>/</span>
          <a href="/shop" style="color: var(--text-secondary, #829399); text-decoration:none;">Shop</a>
          <span>/</span>
          <span style="color: var(--text-primary, #482C6A); font-weight: 500;">${product.name}</span>
        </nav>
        <button onclick="if(document.referrer && document.referrer.includes(location.hostname)){history.back();}else{window.location.href='/shop';}"
          style="display:inline-flex; align-items:center; gap:6px; background:transparent; border:1px solid var(--border-subtle,rgba(72,44,106,0.2)); border-radius:20px; padding:6px 16px; font-size:0.82rem; color:var(--text-secondary,#829399); cursor:pointer; font-family:var(--font-ui,sans-serif); transition:all 0.2s;"
          onmouseover="this.style.background='rgba(72,44,106,0.08)'; this.style.color='#482C6A';"
          onmouseout="this.style.background='transparent'; this.style.color='var(--text-secondary,#829399)';">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          Back
        </button>
      </div>
      <div class="product-page-main" style="display: grid; grid-template-columns: minmax(320px, 1fr) minmax(360px, 1.2fr); gap: 3.5rem; align-items: start;">
        <div class="product-media-card" style="background: #FFFFFF; border: 1px solid var(--border-subtle, rgba(72,44,106,0.15)); border-radius: var(--rxl, 32px); padding: 2rem; box-shadow: 0 15px 45px rgba(72, 44, 106, 0.06); display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <img id="main-prod-image" src="${mainImgSrc}" alt="${product.name}" style="max-width: 100%; max-height: 420px; object-fit: contain; border-radius: var(--rmd, 12px); filter: drop-shadow(0 15px 30px rgba(72,44,106,0.12));" onerror="this.src='assets/images/products/product-default.png'">
        ${galleryHtml}
        </div>
        <div class="product-info-card" style="display: flex; flex-direction: column; gap: 1.25rem;">
          <div>
            <span style="font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.2em; color: var(--accent-primary, #D88C43); font-weight: 600;">${catName}</span>
            <h1 style="font-family: var(--fe, serif); font-size: clamp(2.2rem, 4vw, 3.2rem); font-style: italic; color: var(--text-primary, #482C6A); margin: 0.5rem 0; line-height: 1.15;">${product.name}</h1>
            <div style="font-family: var(--fe, serif); font-size: 2.2rem; color: var(--accent-primary, #D88C43); font-weight: 600;">$${Number(product.price).toFixed(2)}</div>
          </div>
          <div style="background: #FFFFFF; border: 1px solid var(--border-subtle, rgba(72,44,106,0.15)); border-radius: var(--rlg, 20px); padding: 1.75rem; box-shadow: 0 8px 30px rgba(72,44,106,0.04);">
            <h3 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.12em; color: var(--text-primary, #482C6A); margin-bottom: 0.75rem; font-weight: 600;">Formulation Story & Benefits</h3>
            <p style="font-size: 0.95rem; line-height: 1.8; color: var(--text-secondary, #829399); margin: 0;">${product.fullDesc || product.desc || ''}</p>
          </div>
          ${product.ingredients ? `<div style="background: rgba(72,44,106,0.03); border: 1px solid var(--border-subtle, rgba(72,44,106,0.15)); border-radius: var(--rmd, 12px); padding: 1.25rem;"><strong style="font-size: 0.8rem; text-transform: uppercase; color: var(--text-primary, #482C6A); display: block; margin-bottom: 0.5rem;">🌿 Ingredients</strong><p style="font-size: 0.9rem; color: var(--text-secondary, #829399); margin: 0;">${product.ingredients}</p></div>` : ''}
          <button class="btn-primary btn-amber" style="padding: 1rem 2rem; justify-content: center; font-size: 1rem; font-weight: 600;" onclick="if(window.addToCart) window.addToCart('${product.id}', '${product.name.replace(/'/g, "\\'")}', ${product.price});">Add to Cart</button>
        </div>
      </div>
    `;
  }

  } // end renderPage
});
