/**
 * ═══════════════════════════════════════════════════════════════════════
 * HERBALISTIC WELLNESS — CENTRAL APPLICATION COORDINATOR (app.js)
 *
 * ARCHITECTURE:
 *   This ES module is the single entry point. It orchestrates:
 *   1. WebGL pipeline initialisation (deferred until Three.js CDN loads)
 *   2. Audio gate modal — unlocks AudioEngine on user gesture
 *   3. SPA Router — CSS-class-based view switching with GSAP transitions
 *   4. Dynamic content rendering from APOTHECARY_DATABASE
 *   5. Shopping cart state machine
 *   6. Podcast player simulation (progress ticker, episode switching)
 *   7. Blog category filter & staggered row reveals
 *   8. Contact form validation & submission feedback
 *   9. Formulators Collective external portal iframe integration
 *  10. Cursor glow follower & micro-interaction event wiring
 *
 * RENDER STRATEGY:
 *   Products, blog rows, and podcast episodes are rendered via
 *   template-literal factories into innerHTML. This avoids a framework
 *   dependency while keeping HTML in the JS layer where it belongs.
 *   All user-visible text derives exclusively from APOTHECARY_DATABASE.
 *
 * CART STATE MACHINE:
 *   cartItems = Map<productId, { ...product, quantity: number }>
 *   Operations: addItem(id), removeItem(id), clearCart()
 *   Derived state: totalCount = Σ quantities, totalPrice = Σ price*qty
 *   All mutations call renderCart() → DOM reconciliation (no VDOM needed
 *   at this scale — full innerHTML replacement is fast for <20 items).
 *
 * PODCAST PLAYER SIMULATION:
 *   Since no real audio file is loaded, progress advances via
 *   setInterval at a 1-second tick. Progress % = elapsed / durationSeconds.
 *   Elapsed time is stored in playerState.elapsed (seconds).
 *   Interval is cleared on pause, view change, or episode switch.
 * ═══════════════════════════════════════════════════════════════════════
 */

import { APOTHECARY_DATABASE } from './data.js';
import { WebGLPipeline }       from './webgl-pipeline.js';
import { AudioEngine }         from './audio-engine.js';

// ─── Module-level singletons ─────────────────────────────────────────────
const pipeline     = new WebGLPipeline();
const audioEngine  = new AudioEngine();

// ─── Cart State ──────────────────────────────────────────────────────────
const cartItems    = new Map(); // Map<id, { id, name, price, quantity }>
try {
  const storedCart = localStorage.getItem('hw_cart');
  if (storedCart) {
    const parsed = JSON.parse(storedCart);
    Object.keys(parsed).forEach(k => {
      const item = parsed[k];
      cartItems.set(item.id || k, {
        id: item.id || k,
        name: item.name,
        price: parseFloat(item.price),
        quantity: parseInt(item.qty || item.quantity || 1)
      });
    });
  }
} catch (e) {
  console.error('Failed to load cart from localStorage in app.js:', e);
}

// ─── Podcast Player State ─────────────────────────────────────────────────
const playerState  = {
  episodeIndex: 0,     // index into APOTHECARY_DATABASE.podcastMetadata.episodes
  elapsed:      756,   // seconds elapsed (starts at ~12:36 into ep 42)
  playing:      true,
  ticker:       null   // setInterval handle
};

// ─── SVG Asset Factories ─────────────────────────────────────────────────
/**
 * Generates inline SVG illustrations for each product type.
 * SVG type is determined by product.svgType field in data layer.
 * Accent colour is passed per-product for palette variation.
 */
function buildProductSVG(product) {
  const acc = product.svgAccent || '#829399';
  const id  = product.id;

  const svgTypes = {
    'tincture': `
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg" aria-hidden="true">
        <defs><linearGradient id="bg-${id}" x1="70" y1="70" x2="130" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${acc}" stop-opacity="0.25"/>
          <stop offset="100%" stop-color="${acc}" stop-opacity="0.06"/>
        </linearGradient></defs>
        <rect x="72" y="72" width="56" height="130" rx="8" fill="url(#bg-${id})" stroke="${acc}" stroke-width="0.8"/>
        <rect x="84" y="50" width="32" height="24" rx="4" fill="#829399" opacity="0.35"/>
        <rect x="89" y="38" width="22" height="14" rx="3" fill="${acc}" opacity="0.75"/>
        <circle cx="100" cy="32" r="7" fill="${acc}" opacity="0.9"/>
        <rect x="74" y="150" width="52" height="50" rx="6" fill="${acc}" opacity="0.12"/>
        <rect x="78" y="92" width="44" height="34" rx="2" fill="#FAF9F6" opacity="0.92"/>
        <text x="100" y="108" text-anchor="middle" font-family="serif" font-size="6" fill="#1A3021" opacity="0.85">TINCTURE</text>
        <text x="100" y="118" text-anchor="middle" font-family="serif" font-size="4.8" fill="${acc}" opacity="0.8">${product.name.toUpperCase().slice(0,14)}</text>
        <line x1="100" y1="82" x2="100" y2="92" stroke="#1A3021" stroke-width="0.7" opacity="0.4"/>
        <ellipse cx="95" cy="86" rx="3.5" ry="6" fill="${acc}" opacity="0.45" transform="rotate(-15 95 86)"/>
        <ellipse cx="105" cy="86" rx="3.5" ry="6" fill="${acc}" opacity="0.45" transform="rotate(15 105 86)"/>
      </svg>`,

    'oil-bottle': `
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg" aria-hidden="true">
        <defs><linearGradient id="bg-${id}" x1="72" y1="88" x2="128" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${acc}" stop-opacity="0.22"/>
          <stop offset="100%" stop-color="${acc}" stop-opacity="0.05"/>
        </linearGradient></defs>
        <rect x="74" y="88" width="52" height="122" rx="7" fill="url(#bg-${id})" stroke="${acc}" stroke-width="0.7"/>
        <ellipse cx="100" cy="52" rx="12" ry="16" fill="${acc}" opacity="0.3" stroke="${acc}" stroke-width="0.6"/>
        <ellipse cx="100" cy="52" rx="7" ry="10" fill="${acc}" opacity="0.5"/>
        <rect x="84" y="64" width="32" height="26" rx="4" fill="#829399" opacity="0.3"/>
        <rect x="76" y="148" width="48" height="60" rx="5" fill="${acc}" opacity="0.14"/>
        <rect x="79" y="100" width="42" height="36" rx="2" fill="#FAF9F6" opacity="0.92"/>
        <text x="100" y="115" text-anchor="middle" font-family="serif" font-size="5.5" fill="#1A3021">INFUSED OIL</text>
        <text x="100" y="126" text-anchor="middle" font-family="serif" font-size="4.5" fill="${acc}" opacity="0.85">${product.name.slice(0,12).toUpperCase()}</text>
      </svg>`,

    'herb-pouch': `
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg" aria-hidden="true">
        <defs><linearGradient id="bg-${id}" x1="40" y1="100" x2="160" y2="210" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${acc}" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="${acc}" stop-opacity="0.1"/>
        </defs>
        <!-- Pouch body -->
        <path d="M55 130 Q52 185 100 195 Q148 185 145 130 L140 90 Q140 78 128 76 L72 76 Q60 78 60 90 Z" fill="url(#bg-${id})" stroke="${acc}" stroke-width="0.8"/>
        <!-- Tie ribbon -->
        <path d="M72 76 Q100 65 128 76" stroke="${acc}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
        <circle cx="100" cy="70" r="4" fill="${acc}" opacity="0.8"/>
        <!-- Label -->
        <rect x="68" y="108" width="64" height="44" rx="2" fill="#FAF9F6" opacity="0.88"/>
        <text x="100" y="124" text-anchor="middle" font-family="serif" font-size="6" fill="#1A3021">DRIED HERB</text>
        <text x="100" y="135" text-anchor="middle" font-family="serif" font-size="4.8" fill="${acc}" opacity="0.85">${product.name.slice(0,10).toUpperCase()}</text>
        <!-- Botanical sprig -->
        <line x1="100" y1="96" x2="100" y2="108" stroke="#1A3021" stroke-width="0.7" opacity="0.4"/>
        <ellipse cx="95" cy="100" rx="3" ry="5.5" fill="${acc}" opacity="0.4" transform="rotate(-18 95 100)"/>
        <ellipse cx="105" cy="100" rx="3" ry="5.5" fill="${acc}" opacity="0.4" transform="rotate(18 105 100)"/>
      </svg>`,

    'soap-bar': `
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg" aria-hidden="true">
        <defs><linearGradient id="bg-${id}" x1="40" y1="120" x2="160" y2="195" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${acc}" stop-opacity="0.35"/>
          <stop offset="100%" stop-color="${acc}" stop-opacity="0.12"/>
        </linearGradient></defs>
        <!-- Bar shadow -->
        <ellipse cx="100" cy="195" rx="60" ry="10" fill="${acc}" opacity="0.15"/>
        <!-- Soap bar body -->
        <rect x="42" y="118" width="116" height="68" rx="18" fill="url(#bg-${id})" stroke="${acc}" stroke-width="0.8"/>
        <!-- Top face -->
        <ellipse cx="100" cy="118" rx="58" ry="14" fill="${acc}" opacity="0.18" stroke="${acc}" stroke-width="0.6"/>
        <!-- Label emboss -->
        <rect x="62" y="132" width="76" height="40" rx="4" fill="#FAF9F6" opacity="0.12" stroke="#FAF9F6" stroke-width="0.4" stroke-dasharray="2 3"/>
        <text x="100" y="149" text-anchor="middle" font-family="serif" font-size="6.5" fill="#FAF9F6" opacity="0.9">BOTANICAL</text>
        <text x="100" y="160" text-anchor="middle" font-family="serif" font-size="5" fill="${acc}" opacity="0.9">SOAP BAR</text>
        <!-- Bubble details -->
        <circle cx="65" cy="108" r="4" fill="#FAF9F6" opacity="0.2"/>
        <circle cx="78" cy="100" r="2.5" fill="#FAF9F6" opacity="0.15"/>
        <circle cx="135" cy="106" r="3.5" fill="#FAF9F6" opacity="0.18"/>
      </svg>`,

    'jar': `
      <svg viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg" class="product-svg" aria-hidden="true">
        <defs><linearGradient id="bg-${id}" x1="42" y1="118" x2="158" y2="185" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="${acc}" stop-opacity="0.28"/>
          <stop offset="100%" stop-color="${acc}" stop-opacity="0.08"/>
        </linearGradient></defs>
        <ellipse cx="100" cy="185" rx="58" ry="12" fill="${acc}" opacity="0.15"/>
        <rect x="42" y="120" width="116" height="66" rx="10" fill="url(#bg-${id})" stroke="${acc}" stroke-width="0.7"/>
        <ellipse cx="100" cy="120" rx="58" ry="13" fill="#FAF9F6" opacity="0.92" stroke="${acc}" stroke-width="0.7"/>
        <ellipse cx="100" cy="116" rx="50" ry="10" fill="#FAF9F6" opacity="0.96"/>
        <circle cx="100" cy="116" r="30" fill="none" stroke="${acc}" stroke-width="0.5" stroke-dasharray="2 4"/>
        <text x="100" y="111" text-anchor="middle" font-family="serif" font-size="7" fill="#1A3021">${product.name.slice(0,8).toUpperCase()}</text>
        <text x="100" y="121" text-anchor="middle" font-family="serif" font-size="5" fill="${acc}">BOTANICAL BLEND</text>
      </svg>`
  };

  return svgTypes[product.svgType] || svgTypes['tincture'];
}

// ─── PRODUCT CARD TEMPLATE ────────────────────────────────────────────────
function buildProductCard(product) {
  const sizeLabel = product.size ? ` · ${product.size}` : '';
  const catDisplay = APOTHECARY_DATABASE.categories
    .find(c => c.id === product.category)?.name || product.category;
  const isOutOfStock = product.inStock === false;
  const cardClass = isOutOfStock ? 'product-card product-card--outofstock' : 'product-card';

  const mediaContent = product.image 
    ? `<img src="${product.image}" alt="${product.name}" class="product-card-img" loading="lazy" />`
    : buildProductSVG(product);

  return `
    <article class="${cardClass}" data-category="${product.category}"
             role="listitem" id="prod-${product.id}" tabindex="0"
             aria-label="${product.name}, ${catDisplay}, $${product.price.toFixed(2)}${isOutOfStock ? ', Out of stock' : ''}">
      <div class="product-card-media">
        ${mediaContent}
        ${isOutOfStock ? `<div class="outofstock-badge">Out of Stock</div>` : `
        <div class="product-hover-overlay">
          <button class="btn-quick-add"
                  data-id="${product.id}"
                  data-name="${product.name}"
                  data-price="${product.price}"
                  aria-label="Quick add ${product.name} to cart">
            Quick Add
          </button>
        </div>`}
      </div>
      <div class="product-card-info">
        <span class="product-category-tag">${catDisplay}${sizeLabel}</span>
        <h3 class="product-name">${product.name}</h3>
        <p class="product-desc">${product.desc}</p>
        <div class="product-price-row">
          <span class="product-price">$${product.price.toFixed(2)}</span>
          <button class="btn-add-cart"
                  ${isOutOfStock ? 'disabled' : ''}
                  data-id="${product.id}"
                  data-name="${product.name}"
                  data-price="${product.price}"
                  aria-label="${isOutOfStock ? 'Out of stock' : `Add ${product.name} to cart`}">
            <span>${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}</span>
            ${isOutOfStock ? '' : `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M12 5v14M5 12h14"/>
            </svg>`}
          </button>
        </div>
      </div>
    </article>`;
}

// ─── BLOG ROW TEMPLATE ─────────────────────────────────────────────────────
function buildBlogRow(article) {
  return `
    <article class="blog-row"
             data-tags="${article.category.toLowerCase().replace(/\s+/g,'-')}"
             data-slug="${article.slug}"
             role="listitem"
             id="blog-${article.id}"
             tabindex="0"
             aria-label="Blog article: ${article.title}">
      <div class="blog-row-meta">
        <span class="blog-date">${article.date}</span>
        <span class="blog-tag-inline">${article.category}</span>
      </div>
      <div class="blog-row-content">
        <h3 class="blog-title"><em>${article.title}</em></h3>
        <p class="blog-excerpt">${article.excerpt}</p>
      </div>
      <div class="blog-row-action">
        <span class="blog-read-more">Read →</span>
      </div>
    </article>`;
}

// ─── EPISODE ROW TEMPLATE ──────────────────────────────────────────────────
function buildEpisodeRow(ep, isActive) {
  if (isActive) {
    return `
      <div class="episode-row episode-row--active"
           data-ep="${ep.number}"
           data-duration="${ep.durationSeconds}"
           id="${ep.id}"
           role="listitem"
           tabindex="0"
           aria-label="Currently playing: Episode ${ep.number}: ${ep.title}">
        <div class="ep-number">${ep.number}</div>
        <div class="ep-info">
          <p class="ep-title"><em>${ep.title}</em></p>
          <p class="ep-meta">with ${ep.guest} · ${ep.duration} · ${ep.tag}</p>
        </div>
        <div class="ep-actions">
          <div class="ep-waveform" aria-hidden="true">
            <span></span><span></span><span></span><span></span><span></span>
            <span></span><span></span><span></span><span></span><span></span>
          </div>
          <span class="ep-tag">Playing</span>
        </div>
      </div>`;
  }
  return `
    <div class="episode-row"
         data-ep="${ep.number}"
         data-duration="${ep.durationSeconds}"
         id="${ep.id}"
         role="listitem"
         tabindex="0"
         aria-label="Episode ${ep.number}: ${ep.title}, ${ep.duration}">
      <div class="ep-number">${ep.number}</div>
      <div class="ep-info">
        <p class="ep-title"><em>${ep.title}</em></p>
        <p class="ep-meta">with ${ep.guest} · ${ep.duration} · ${ep.tag}</p>
      </div>
      <div class="ep-actions">
        <button class="ep-play-btn js-ep-play"
                data-index="${APOTHECARY_DATABASE.podcastMetadata.episodes.indexOf(ep)}"
                aria-label="Play episode ${ep.number}">▶</button>
        <span class="ep-duration">${ep.duration}</span>
      </div>
    </div>`;
}

// ─── COURSE CARD TEMPLATE ──────────────────────────────────────────────────
function buildCourseCard(course) {
  return `
    <div class="course-card" id="${course.id}" tabindex="0"
         aria-label="Course ${course.number}: ${course.name}">
      <span class="course-number">${course.number}</span>
      <h4 class="course-name">${course.name}</h4>
      <p class="course-desc">${course.desc}</p>
      <span class="course-tag">${course.tag}</span>
    </div>`;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────
/** Format seconds as MM:SS */
function fmtTime(s) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${String(m).padStart(2,'0')}:${String(r).padStart(2,'0')}`;
}

// ─── RENDER: SHOP ────────────────────────────────────────────────────────
function renderShop(force) {
  // Build filter buttons from categories
  const filterBar = document.getElementById('shop-filter-bar');
  if (filterBar && !filterBar._wired) {
    filterBar._wired = true;
    const allBtn = `<button class="filter-btn filter-btn--active" data-filter="all">All Products</button>`;
    const catBtns = APOTHECARY_DATABASE.categories
      .map(c => `<button class="filter-btn" data-filter="${c.id}">${c.name}</button>`)
      .join('');
    filterBar.innerHTML = allBtn + catBtns;
    wireFilterBar(filterBar);
  }

  const grid = document.getElementById('product-grid');
  if (!grid) return;

  // Insert skeleton cards to prevent CLS
  let skeletonHtml = '';
  for (let i = 0; i < 6; i++) {
    skeletonHtml += `
      <div class="skeleton-card">
        <div class="skeleton-card-media skeleton-shimmer"></div>
        <div class="skeleton-card-info">
          <div class="skeleton-line tag skeleton-shimmer"></div>
          <div class="skeleton-line title skeleton-shimmer"></div>
          <div class="skeleton-line desc skeleton-shimmer"></div>
          <div class="skeleton-line desc-short skeleton-shimmer"></div>
          <div class="skeleton-row">
            <div class="skeleton-line price skeleton-shimmer"></div>
            <div class="skeleton-line button skeleton-shimmer"></div>
          </div>
        </div>
      </div>`;
  }
  grid.innerHTML = skeletonHtml;

  // Fetch dynamic catalog
  fetch('products.php')
    .then(res => {
      if (!res.ok) throw new Error('API response error');
      return res.json();
    })
    .then(dynamicProducts => {
      // Merge dynamic products into APOTHECARY_DATABASE.products
      dynamicProducts.forEach(p => {
        const idx = APOTHECARY_DATABASE.products.findIndex(pr => pr.id === p.id);
        const staticMatch = idx !== -1 ? APOTHECARY_DATABASE.products[idx] : null;
        
        const mapped = {
          id: p.id,
          name: p.name,
          category: p.category,
          price: p.price,
          desc: p.desc || (staticMatch ? staticMatch.desc : ''),
          fullDesc: staticMatch ? staticMatch.fullDesc : (p.desc || ''),
          ingredients: staticMatch ? staticMatch.ingredients : '',
          inclusions: staticMatch ? staticMatch.inclusions : '',
          svg: p.svgType || p.svg || (staticMatch ? staticMatch.svg : 'tincture'),
          acc: p.svgAccent || p.acc || (staticMatch ? staticMatch.acc : '#829399'),
          size: p.size || (staticMatch ? staticMatch.size : ''),
          imageSlug: staticMatch ? staticMatch.imageSlug : 'product-default',
          image: p.image || '',
          visibility: 'visible',
          inStock: p.inStock !== false
        };

        if (idx !== -1) {
          APOTHECARY_DATABASE.products[idx] = mapped;
        } else {
          APOTHECARY_DATABASE.products.push(mapped);
        }
      });

      const publicProducts = APOTHECARY_DATABASE.products.filter(p => {
        if (p.image) return p.visibility === 'visible'; // Bypass AVAILABLE_IMAGES check if dynamic image URL is present
        const hasImage = typeof AVAILABLE_IMAGES !== 'undefined' 
          ? AVAILABLE_IMAGES.includes(p.imageSlug)
          : true;
        return p.visibility === 'visible' && (p.imageSlug === 'product-default' || hasImage);
      });
      renderProductsGrid(publicProducts);
    })
    .catch(err => {
      console.warn('Dynamic product fetch failed, using static fallback:', err);
      const fallbackProducts = APOTHECARY_DATABASE.products.filter(p => {
        const hasImage = typeof AVAILABLE_IMAGES !== 'undefined'
          ? AVAILABLE_IMAGES.includes(p.imageSlug)
          : true;
        return p.visibility === 'visible' && hasImage;
      });
      renderProductsGrid(fallbackProducts);
    });

  function renderProductsGrid(productsList) {
    grid.innerHTML = productsList.map(buildProductCard).join('');

    // Staggered entrance animation
    const cards = grid.querySelectorAll('.product-card');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('card--visible'), i * 65);
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });

    cards.forEach(card => observer.observe(card));

    // Wire add-to-cart buttons
    grid.querySelectorAll('[data-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const { id, name, price } = btn.dataset;
        addToCart(id, name, parseFloat(price));

        // Botanical rustle sound on every add-to-cart interaction
        if (typeof audioEngine !== 'undefined') {
          audioEngine.triggerBotanicalRustle();
        }

        // Visual feedback: animate the button briefly
        const addBtn = document.querySelector(`.btn-add-cart[data-id="${id}"]`);
        if (addBtn) {
          addBtn.classList.add('btn-add-cart--added');
          const sp = addBtn.querySelector('span');
          if (sp) sp.textContent = 'Added ✓';
          setTimeout(() => {
            addBtn.classList.remove('btn-add-cart--added');
            if (sp) sp.textContent = 'Add to Cart';
          }, 1600);
        }
      });

      // Rustle also fires on hover (product interaction)
      btn.closest('.product-card')?.addEventListener('mouseenter', () => {
        if (typeof audioEngine !== 'undefined') {
          audioEngine.triggerBotanicalRustle();
        }
      });
    });
  }
}

// ─── FILTER BAR WIRING ───────────────────────────────────────────────────
function wireFilterBar(filterBar) {
  if (!filterBar) return;

  filterBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;

    // Update active state
    filterBar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('filter-btn--active'));
    btn.classList.add('filter-btn--active');

    const filter = btn.dataset.filter;
    const grid   = document.getElementById('product-grid');
    if (!grid) return;

    // Filter visibility with stagger
    grid.querySelectorAll('.product-card').forEach((card, i) => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.style.transitionDelay = match ? `${i * 40}ms` : '0ms';
      card.style.display = match ? '' : 'none';
      if (match) {
        card.classList.remove('card--visible');
        requestAnimationFrame(() => {
          setTimeout(() => card.classList.add('card--visible'), 10 + i * 40);
        });
      }
    });
  });
}

// ─── RENDER: BLOG ────────────────────────────────────────────────────────
function renderBlog() {
  const list = document.getElementById('blog-list');
  if (!list) return;

  list.innerHTML = APOTHECARY_DATABASE.blogArticles.map(buildBlogRow).join('');

  // Staggered entrance via IntersectionObserver
  const rows = list.querySelectorAll('.blog-row');
  const obs = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('row--visible'), idx * 90);
        obs.unobserve(entry.target);
      }
    });
  }, { threshold: 0.06 });
  rows.forEach(r => obs.observe(r));

  // Blog row hover → mortar grinding synth
  rows.forEach(row => {
    row.addEventListener('mouseenter', () => {
      audioEngine.triggerMortarGrind();
      // Scatter particles slightly on blog hover
      pipeline.setMorph(0.35, 0.3);
      setTimeout(() => pipeline.setMorph(0.0, 1.8), 600);
    });
  });

  // Tag filter
  const tagBar = document.getElementById('blog-tag-bar');
  if (tagBar) {
    tagBar.innerHTML = [
      { id: 'all', label: 'All' },
      { id: 'sourcing-logs',     label: 'Sourcing Logs' },
      { id: 'biomedical-analysis', label: 'Biomedical Analysis' },
      { id: 'extraction-tech',   label: 'Extraction Tech' }
    ].map((t, i) => `
      <button class="tag-pill ${i===0?'tag-pill--active':''}" data-tag="${t.id}">${t.label}</button>
    `).join('');

    tagBar.addEventListener('click', (e) => {
      const pill = e.target.closest('.tag-pill');
      if (!pill) return;
      tagBar.querySelectorAll('.tag-pill').forEach(p => p.classList.remove('tag-pill--active'));
      pill.classList.add('tag-pill--active');

      const tag = pill.dataset.tag;
      list.querySelectorAll('.blog-row').forEach(row => {
        const match = tag === 'all' || row.dataset.tags.includes(tag);
        row.style.display = match ? '' : 'none';
      });
    });
  }
}

// ─── RENDER: PODCAST ─────────────────────────────────────────────────────
function renderPodcast() {
  const { episodes, showTitle, host } = APOTHECARY_DATABASE.podcastMetadata;
  const epList = document.getElementById('episode-list');
  if (!epList) return;

  epList.innerHTML = episodes
    .map((ep, i) => buildEpisodeRow(ep, i === playerState.episodeIndex))
    .join('');

  // Update player header info
  updatePlayerDisplay();

  // Wire episode play buttons
  epList.querySelectorAll('.js-ep-play').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      switchEpisode(idx);
    });
  });

  // Wire episode rows (click to switch)
  epList.querySelectorAll('.episode-row').forEach((row, idx) => {
    row.addEventListener('click', () => switchEpisode(idx));
  });
}

function updatePlayerDisplay() {
  const { episodes }  = APOTHECARY_DATABASE.podcastMetadata;
  const ep            = episodes[playerState.episodeIndex];
  const totalSec      = ep.durationSeconds;
  const pct           = Math.min(100, (playerState.elapsed / totalSec) * 100);

  const titleEl       = document.getElementById('player-episode-title');
  const currentEl     = document.getElementById('player-current-time');
  const totalEl       = document.getElementById('player-total-time');
  const fillEl        = document.getElementById('player-progress-fill');
  const handleEl      = document.getElementById('player-progress-handle');
  const playBtn       = document.getElementById('player-play-btn');

  if (titleEl)   titleEl.innerHTML = `<em>${ep.title}</em>`;
  if (currentEl) currentEl.textContent = fmtTime(playerState.elapsed);
  if (totalEl)   totalEl.textContent   = ep.duration;
  if (fillEl)    fillEl.style.width    = `${pct}%`;
  if (handleEl)  handleEl.style.left   = `${pct}%`;
  if (playBtn) {
    playBtn.textContent = playerState.playing ? '⏸' : '▶';
    playBtn.setAttribute('aria-pressed', playerState.playing ? 'true' : 'false');
    playBtn.setAttribute('aria-label', playerState.playing ? 'Pause episode' : 'Play episode');
  }
}

function switchEpisode(idx) {
  const { episodes } = APOTHECARY_DATABASE.podcastMetadata;
  if (idx < 0 || idx >= episodes.length) return;

  playerState.episodeIndex = idx;
  playerState.elapsed      = 0;
  playerState.playing      = true;

  clearInterval(playerState.ticker);
  startPlayerTicker();
  renderPodcast();
  audioEngine.triggerBotanicalRustle();
}

function startPlayerTicker() {
  clearInterval(playerState.ticker);
  if (!playerState.playing) return;

  playerState.ticker = setInterval(() => {
    const { episodes } = APOTHECARY_DATABASE.podcastMetadata;
    const ep = episodes[playerState.episodeIndex];
    if (playerState.elapsed < ep.durationSeconds) {
      playerState.elapsed++;
      updatePlayerDisplay();
    } else {
      // Auto-advance to next episode
      const nextIdx = (playerState.episodeIndex + 1) % episodes.length;
      switchEpisode(nextIdx);
    }
  }, 1000);
}

// Player controls
function wirePlayerControls() {
  const playBtn = document.getElementById('player-play-btn');
  const prevBtn = document.getElementById('player-prev-btn');
  const nextBtn = document.getElementById('player-next-btn');
  const volSlider = document.getElementById('volume-slider');

  playBtn?.addEventListener('click', () => {
    playerState.playing = !playerState.playing;
    if (playerState.playing) startPlayerTicker();
    else clearInterval(playerState.ticker);
    updatePlayerDisplay();
  });

  prevBtn?.addEventListener('click', () => {
    const idx = Math.max(0, playerState.episodeIndex - 1);
    switchEpisode(idx);
  });

  nextBtn?.addEventListener('click', () => {
    const { episodes } = APOTHECARY_DATABASE.podcastMetadata;
    const idx = Math.min(episodes.length - 1, playerState.episodeIndex + 1);
    switchEpisode(idx);
  });

  // Progress bar click → seek
  const progressBar = document.getElementById('player-progress-bar');
  progressBar?.addEventListener('click', (e) => {
    const rect  = progressBar.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const { episodes } = APOTHECARY_DATABASE.podcastMetadata;
    const ep    = episodes[playerState.episodeIndex];
    playerState.elapsed = Math.floor(ratio * ep.durationSeconds);
    updatePlayerDisplay();
    audioEngine.triggerBotanicalRustle();
  });

  // Volume slider → audio engine master gain
  volSlider?.addEventListener('input', () => {
    audioEngine.setVolume(volSlider.value / 100);
  });
}

// ─── RENDER: EDUCATION ────────────────────────────────────────────────────
function renderEducation() {
  const courseGrid = document.getElementById('course-grid');
  if (!courseGrid) return;
  courseGrid.innerHTML = APOTHECARY_DATABASE.collectiveCourses
    .map(buildCourseCard)
    .join('');

  // Animate course cards in
  courseGrid.querySelectorAll('.course-card').forEach((card, i) => {
    card.style.opacity   = '0';
    card.style.transform = 'translateY(24px)';
    setTimeout(() => {
      card.style.transition = `opacity 0.5s ${i * 80}ms ease, transform 0.5s ${i * 80}ms cubic-bezier(0.16,1,0.3,1)`;
      card.style.opacity    = '1';
      card.style.transform  = 'translateY(0)';
    }, 60);
  });

  // "Apply for Enrollment" → trigger Formulators Collective portal
  const applyBtn = document.getElementById('edu-apply-btn');
  applyBtn?.addEventListener('click', () => {
    openCollectivePortal();
  });
}

// ─── FORMULATORS COLLECTIVE PORTAL ───────────────────────────────────────
/**
 * Builds and injects a full-screen iframe overlay linking to the
 * Formulators Collective external courses application.
 * The overlay has its own close mechanism and a polished glassmorphic frame.
 * This approach keeps the user within the Herbalistic Wellness brand
 * context while surfacing the full external app.
 */
function openCollectivePortal() {
  if (document.getElementById('collective-portal')) return; // prevent duplicate

  const portal = document.createElement('div');
  portal.id = 'collective-portal';
  portal.setAttribute('role', 'dialog');
  portal.setAttribute('aria-modal', 'true');
  portal.setAttribute('aria-label', 'The Formulators Collective — Course Portal');
  portal.innerHTML = `
    <div class="portal-backdrop"></div>
    <div class="portal-frame">
      <div class="portal-chrome">
        <div class="portal-chrome-left">
          <span class="logo-mark" aria-hidden="true">✦</span>
          <span class="portal-title">The Formulators Collective</span>
          <span class="portal-subtitle">Education Portal</span>
        </div>
        <div class="portal-chrome-right">
          <a href="https://herbalisticwellness.com/courses"
             target="_blank" rel="noopener noreferrer"
             class="portal-external-link" aria-label="Open in new tab">
             ↗ Open in New Tab
          </a>
          <button class="portal-close-btn" id="portal-close-btn" aria-label="Close education portal">✕ Close</button>
        </div>
      </div>
      <div class="portal-iframe-wrapper">
        <iframe
          id="collective-iframe"
          src="https://herbalisticwellness.com/courses"
          title="The Formulators Collective — Course Catalog"
          loading="lazy"
          allow="fullscreen"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups">
        </iframe>
        <div class="portal-iframe-fallback" id="portal-fallback">
          <div class="portal-fallback-inner">
            <span class="portal-fallback-sigil" aria-hidden="true">✦</span>
            <h3>The Formulators Collective</h3>
            <p>The full course portal is available at herbalisticwellness.com.</p>
            <a href="https://herbalisticwellness.com/courses"
               target="_blank" rel="noopener noreferrer"
               class="btn-primary">
               Visit the Collective ↗
            </a>
          </div>
        </div>
      </div>
    </div>`;

  document.body.appendChild(portal);
  document.body.classList.add('menu-open'); // prevent background scroll

  // Entrance animation
  requestAnimationFrame(() => {
    portal.classList.add('portal--open');
    // Scatter particles during portal open
    pipeline.setMorph(0.6, 0.5);
    setTimeout(() => pipeline.setMorph(0.0, 2.5), 1200);
  });

  // Handle iframe load error → show fallback
  const iframe = document.getElementById('collective-iframe');
  iframe?.addEventListener('load', () => {
    try {
      // If cross-origin content loads, hide fallback
      const fallback = document.getElementById('portal-fallback');
      if (fallback) fallback.style.display = 'none';
    } catch (e) { /* cross-origin restriction — fallback stays visible */ }
  });

  iframe?.addEventListener('error', () => {
    const fallback = document.getElementById('portal-fallback');
    if (fallback) fallback.style.display = 'flex';
  });

  // Close button
  document.getElementById('portal-close-btn')?.addEventListener('click', () => {
    closeCollectivePortal();
  });

  // Close on backdrop click
  portal.querySelector('.portal-backdrop')?.addEventListener('click', () => {
    closeCollectivePortal();
  });

  // Close on Escape key
  const escHandler = (e) => {
    if (e.key === 'Escape') { closeCollectivePortal(); document.removeEventListener('keydown', escHandler); }
  };
  document.addEventListener('keydown', escHandler);
}

function closeCollectivePortal() {
  const portal = document.getElementById('collective-portal');
  if (!portal) return;
  portal.classList.remove('portal--open');
  portal.classList.add('portal--closing');
  document.body.classList.remove('menu-open');
  setTimeout(() => portal.remove(), 500);
}

// ─── CART STATE MACHINE ───────────────────────────────────────────────────
function addToCart(id, name, price) {
  if (cartItems.has(id)) {
    const item = cartItems.get(id);
    cartItems.set(id, { ...item, quantity: item.quantity + 1 });
  } else {
    cartItems.set(id, { id, name, price, quantity: 1 });
  }
  renderCartCount();
  renderCart();

  // Sync to localStorage
  try {
    const obj = {};
    cartItems.forEach((item, key) => {
      obj[key] = { id: item.id, name: item.name, price: item.price, qty: item.quantity };
    });
    localStorage.setItem('hw_cart', JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save cart to localStorage in app.js:', e);
  }

  // Bounce animation on cart icon
  const cartBtn = document.getElementById('cart-toggle-btn');
  if (cartBtn) {
    cartBtn.style.transform = 'scale(1.25)';
    setTimeout(() => { cartBtn.style.transform = ''; }, 280);
  }
}

function removeFromCart(id) {
  cartItems.delete(id);
  renderCartCount();
  renderCart();

  // Sync to localStorage
  try {
    const obj = {};
    cartItems.forEach((item, key) => {
      obj[key] = { id: item.id, name: item.name, price: item.price, qty: item.quantity };
    });
    localStorage.setItem('hw_cart', JSON.stringify(obj));
  } catch (e) {
    console.error('Failed to save cart to localStorage in app.js:', e);
  }
}

function renderCartCount() {
  const count = Array.from(cartItems.values()).reduce((s, i) => s + i.quantity, 0);
  const el    = document.getElementById('cart-count');
  if (!el) return;
  el.textContent = count;
  el.classList.toggle('cart-count--visible', count > 0);
}

function renderCart() {
  const list = document.getElementById('cart-items-list');
  const total = document.getElementById('cart-total');
  if (!list) return;

  if (cartItems.size === 0) {
    list.innerHTML = '<p class="cart-empty-msg">Your cart is empty. Add some botanical magic.</p>';
    if (total) total.textContent = '$0.00';
    return;
  }

  let totalPrice = 0;
  list.innerHTML = Array.from(cartItems.values()).map(item => {
    const lineTotal = item.price * item.quantity;
    totalPrice += lineTotal;
    return `
      <div class="cart-item">
        <div class="cart-item-name">${item.name}${item.quantity > 1 ? ` ×${item.quantity}` : ''}</div>
        <div class="cart-item-price">$${lineTotal.toFixed(2)}</div>
        <button class="cart-item-remove js-cart-remove"
                data-id="${item.id}"
                aria-label="Remove ${item.name} from cart">✕</button>
      </div>`;
  }).join('');

  if (total) total.textContent = `$${totalPrice.toFixed(2)}`;

  // Wire remove buttons
  list.querySelectorAll('.js-cart-remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCart(btn.dataset.id));
  });
}

// ─── CART DRAWER CONTROLS ─────────────────────────────────────────────────
function wireCartDrawer() {
  const toggleBtn = document.getElementById('cart-toggle-btn');
  const closeBtn  = document.getElementById('cart-close-btn');
  const overlay   = document.getElementById('cart-overlay');
  const drawer    = document.getElementById('cart-drawer');

  const openCart = () => {
    drawer?.classList.add('cart-drawer--open');
    overlay?.classList.add('cart-overlay--visible');
    toggleBtn?.setAttribute('aria-expanded', 'true');
    audioEngine.triggerBotanicalRustle();
  };

  const closeCart = () => {
    drawer?.classList.remove('cart-drawer--open');
    overlay?.classList.remove('cart-overlay--visible');
    toggleBtn?.setAttribute('aria-expanded', 'false');
  };

  toggleBtn?.addEventListener('click', openCart);
  closeBtn?.addEventListener('click', closeCart);
  overlay?.addEventListener('click', closeCart);

  // Wire Proceed to Checkout button
  const checkoutBtn = document.getElementById('cart-checkout-btn');
  checkoutBtn?.addEventListener('click', () => {
    if (cartItems.size === 0) return;
    window.location.href = 'checkout.html';
  });
}

// ─── SPA ROUTER ───────────────────────────────────────────────────────────
/**
 * CLIENT-SIDE ROUTER:
 * State: currentView = one of ['home','shop','blog','podcast','education','contact']
 * Transition: outgoing view fades out (opacity 0 → display:none),
 *             incoming view fades in (display:block → opacity 1).
 * All [data-view] attribute elements anywhere in the DOM are valid navigation nodes.
 * The route is also reflected in window.location.hash for bookmarkability.
 */
let currentView = 'home';

function navigateTo(view) {
  if (view === currentView && document.getElementById(`view-${view}`)?.classList.contains('view--active')) return;

  // Scatter particles during transition
  pipeline.setMorph(0.7, 0.4);
  setTimeout(() => pipeline.setMorph(0.0, 2.0), 900);

  // Deactivate current view
  document.querySelectorAll('.view').forEach(el => {
    el.classList.remove('view--active');
    el.style.display = 'none';
  });

  // Activate target view
  const target = document.getElementById(`view-${view}`);
  if (!target) return;

  target.style.display = 'block';
  // Force reflow before adding class for CSS transition to fire
  target.offsetHeight;
  target.classList.add('view--active');

  // Update nav link active state
  document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
    link.classList.toggle('nav-link--active', link.dataset.view === view);
  });

  currentView = view;
  window.location.hash = view === 'home' ? '' : view;

  // Scroll to top of content
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Lazy-render view content on first visit
  switch (view) {
    case 'shop':      renderShop();      break;
    case 'blog':      renderBlog();      break;
    case 'podcast':   renderPodcast();   startPlayerTicker(); break;
    case 'education': renderEducation(); break;
  }

  // Close mobile menu if open
  closeMobileMenu();
  audioEngine.triggerBotanicalRustle();
}

// ─── MOBILE MENU ──────────────────────────────────────────────────────────
function wireMobileMenu() {
  const menuBtn  = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');

  menuBtn?.addEventListener('click', () => {
    const isOpen = mobileNav?.classList.contains('mobile-nav--open');
    if (isOpen) closeMobileMenu();
    else openMobileMenu();
  });
}

function openMobileMenu() {
  const menuBtn   = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  menuBtn?.classList.add('menu--open');
  menuBtn?.setAttribute('aria-expanded', 'true');
  mobileNav?.classList.add('mobile-nav--open');
  mobileNav?.setAttribute('aria-hidden', 'false');
  document.body.classList.add('menu-open');
}

function closeMobileMenu() {
  const menuBtn   = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  menuBtn?.classList.remove('menu--open');
  menuBtn?.setAttribute('aria-expanded', 'false');
  mobileNav?.classList.remove('mobile-nav--open');
  mobileNav?.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('menu-open');
}

// ─── GOOGLE SHEETS ENDPOINT ───────────────────────────────────────────────
// After deploying herbalistic-wellness-sheets-receiver.gs as a Web App,
// paste your Web App URL here:
const HW_SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxul-XR3SRjaVqu-l74E7k7vZxWq0yB3nTmr6_oMP5MhatSluB7FDGWSELqNXfpQQ6oeg/exec';

// Shared helper: POST any form payload to Google Sheets
function postToSheets(payload) {
  return fetch(HW_SHEETS_ENDPOINT, {
    method: 'POST',
    mode: 'no-cors',
    body: JSON.stringify(payload)
  });
}

// ─── CONTACT FORM ─────────────────────────────────────────────────────────
function wireContactForm() {
  const form      = document.getElementById('contact-form');
  const submitBtn = document.getElementById('contact-submit-btn');
  const successEl = document.getElementById('form-success-msg');

  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name    = document.getElementById('contact-name')?.value.trim();
    const email   = document.getElementById('contact-email')?.value.trim();
    const subject = document.getElementById('contact-subject')?.value.trim();
    const message = document.getElementById('contact-message')?.value.trim();

    let valid = true;

    if (!name) {
      showValidation('contact-name', 'Please enter your name.');
      valid = false;
    } else clearValidation('contact-name');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showValidation('contact-email', 'Please enter a valid email address.');
      valid = false;
    } else clearValidation('contact-email');

    if (!message) {
      showValidation('contact-message', 'Please include a message.');
      valid = false;
    } else clearValidation('contact-message');

    if (!valid) return;

    const btnText = document.getElementById('submit-btn-text');
    if (submitBtn) submitBtn.disabled = true;
    if (btnText)   btnText.textContent = 'Sending…';

    // Send to Google Sheets, always show success to user regardless of network
    postToSheets({ type: 'contact', name, email, subject, message })
      .catch((err) => console.warn('[Sheets] Contact form sync failed:', err))
      .finally(() => {
        if (successEl) successEl.style.display = 'flex';
        form.reset();
        if (submitBtn) submitBtn.disabled = false;
        if (btnText)   btnText.textContent = 'Send Transmission';
        audioEngine.triggerTinctureClink(0.5);
      });
  });
}

function showValidation(fieldId, msg) {
  const field  = document.getElementById(fieldId);
  const valEl  = field?.closest('.form-group')?.querySelector('.form-validation');
  if (field)  field.style.borderColor = '#e05a5a';
  if (valEl)  valEl.textContent = msg;
}

function clearValidation(fieldId) {
  const field  = document.getElementById(fieldId);
  const valEl  = field?.closest('.form-group')?.querySelector('.form-validation');
  if (field)  field.style.borderColor = '';
  if (valEl)  valEl.textContent = '';
}

// ─── CURSOR GLOW FOLLOWER ─────────────────────────────────────────────────
function initCursorGlow() {
  const glow = document.createElement('div');
  glow.id = 'cursor-glow';
  document.body.insertBefore(glow, document.body.firstChild);

  document.addEventListener('mousemove', (e) => {
    glow.style.left = `${e.clientX}px`;
    glow.style.top  = `${e.clientY}px`;
  }, { passive: true });
}

// ─── HEADER SCROLL STATE ──────────────────────────────────────────────────
function initHeaderScroll() {
  const header = document.getElementById('site-header');
  window.addEventListener('scroll', () => {
    header?.classList.toggle('header--scrolled', window.scrollY > 40);
  }, { passive: true });
}

// ─── AUDIO GATE MODAL ─────────────────────────────────────────────────────
function wireAudioGate() {
  const gate         = document.getElementById('audio-gate');
  const enterBtn     = document.getElementById('gate-enter-btn');
  const silentBtn    = document.getElementById('gate-silent-btn');

  const dismissGate = (withSound) => {
    audioEngine.unlock(withSound);
    gate?.classList.add('gate--hidden');
    setTimeout(() => { if (gate) gate.style.display = 'none'; }, 700);

    // Hero view is already active — trigger its entrance
    pipeline.setMorph(0.8, 0.6);
    setTimeout(() => pipeline.setMorph(0.0, 3.0), 1400);
  };

  enterBtn?.addEventListener('click', () => dismissGate(true));
  silentBtn?.addEventListener('click', () => dismissGate(false));
}

// ─── GLOBAL NAVIGATION WIRE ───────────────────────────────────────────────
function wireNavigation() {
  // All elements with [data-view] attribute navigate to that view
  document.addEventListener('click', (e) => {
    const navEl = e.target.closest('[data-view]');
    if (!navEl) return;
    e.preventDefault();
    navigateTo(navEl.dataset.view);
  });

  const handleHashRouting = () => {
    const rawHash = window.location.hash.replace('#', '');
    const [viewPart, queryPart] = rawHash.split('?');
    const validViews = ['home','shop','blog','podcast','education','contact'];
    if (viewPart && validViews.includes(viewPart)) {
      navigateTo(viewPart);
      if (queryPart && queryPart.includes('event=')) {
        const eventId = queryPart.split('event=')[1];
        selectCalendarEventById(eventId);
      }
    }
  };

  // Handle hash-based routing on load
  if (window.location.hash) {
    setTimeout(handleHashRouting, 200);
  }

  // Handle dynamic hash routing changes
  window.addEventListener('hashchange', handleHashRouting);
}

// ─── HERO SECTION PARALLAX ────────────────────────────────────────────────
function initHeroParallax() {
  const svg = document.querySelector('.botanical-hero-svg');
  if (!svg) return;

  window.addEventListener('mousemove', (e) => {
    if (currentView !== 'home') return;
    const cx = window.innerWidth / 2;
    const cy = window.innerHeight / 2;
    const dx = (e.clientX - cx) / cx;
    const dy = (e.clientY - cy) / cy;
    svg.style.transform = `translate(${dx * 14}px, ${dy * 9}px)`;
  }, { passive: true });
}

// ─── PORTAL STYLES (injected dynamically) ────────────────────────────────
function injectPortalStyles() {
  if (document.getElementById('portal-styles')) return;
  const style = document.createElement('style');
  style.id = 'portal-styles';
  style.textContent = `
    #collective-portal {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      flex-direction: column;
      opacity: 0;
      transform: scale(0.97);
      transition: opacity 0.45s cubic-bezier(0.16,1,0.3,1),
                  transform 0.45s cubic-bezier(0.16,1,0.3,1);
      pointer-events: none;
    }
    #collective-portal.portal--open {
      opacity: 1;
      transform: scale(1);
      pointer-events: all;
    }
    #collective-portal.portal--closing {
      opacity: 0;
      transform: scale(0.97);
    }
    .portal-backdrop {
      position: absolute;
      inset: 0;
      background: rgba(14, 22, 16, 0.88);
      backdrop-filter: blur(12px);
      z-index: 0;
    }
    .portal-frame {
      position: relative;
      z-index: 1;
      margin: 32px;
      display: flex;
      flex-direction: column;
      flex: 1;
      background: rgba(14, 22, 16, 0.96);
      border: 1px solid rgba(216, 140, 67, 0.35);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 40px 120px rgba(0,0,0,0.6),
                  0 0 0 1px rgba(216,140,67,0.1) inset;
    }
    .portal-chrome {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 24px;
      background: rgba(26, 48, 33, 0.8);
      border-bottom: 1px solid rgba(216, 140, 67, 0.22);
      gap: 16px;
    }
    .portal-chrome-left {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .portal-title {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.1rem;
      font-style: italic;
      color: #FAF9F6;
    }
    .portal-subtitle {
      font-family: 'Jost', sans-serif;
      font-size: 0.65rem;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      color: #D88C43;
      opacity: 0.7;
    }
    .portal-chrome-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .portal-external-link {
      font-family: 'Jost', sans-serif;
      font-size: 0.72rem;
      letter-spacing: 0.1em;
      color: #829399;
      text-transform: uppercase;
      transition: color 0.2s ease;
      text-decoration: none;
    }
    .portal-external-link:hover { color: #D88C43; }
    .portal-close-btn {
      font-family: 'Jost', sans-serif;
      font-size: 0.72rem;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #829399;
      padding: 6px 14px;
      border: 1px solid rgba(130,147,153,0.25);
      border-radius: 9999px;
      cursor: pointer;
      background: none;
      transition: all 0.2s ease;
    }
    .portal-close-btn:hover {
      color: #FAF9F6;
      border-color: #D88C43;
    }
    .portal-iframe-wrapper {
      flex: 1;
      position: relative;
    }
    #collective-iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    .portal-iframe-fallback {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(14, 22, 16, 0.95);
    }
    .portal-fallback-inner {
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
      max-width: 420px;
      padding: 48px 32px;
    }
    .portal-fallback-sigil {
      font-size: 2.5rem;
      color: #D88C43;
      animation: logo-pulse 3s ease-in-out infinite;
    }
    .portal-fallback-inner h3 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 2rem;
      font-style: italic;
      color: #FAF9F6;
    }
    .portal-fallback-inner p {
      font-family: 'Jost', sans-serif;
      font-size: 0.9rem;
      color: #829399;
      line-height: 1.7;
    }
    @media (max-width: 640px) {
      .portal-frame { margin: 0; border-radius: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ─── EVENTS CALENDAR ──────────────────────────────────────────────────────
let currentCalendarMonth = 5; // June (0-indexed: January = 0, June = 5)
let currentCalendarYear = 2026;

const CALENDAR_EVENTS = {
  "2026-5-9": {
    id: "solstice-tincture",
    title: "Solstice Tincture Crafting Pop-Up",
    tag: "Pop-Up",
    dateStr: "June 9, 2026",
    timeStr: "12:00 PM - 3:00 PM",
    location: "CCBC Catonsville Campus",
    desc: "An immersive, hands-on gathering exploring thermal extraction, double-maceration tinctures, and the energetic properties of summer solstice botanicals. Includes a live demonstration of copper alembic distillation.",
    video: "https://assets.mixkit.co/videos/preview/mixkit-herbs-and-spices-on-a-table-41604-large.mp4"
  },
  "2026-5-18": {
    id: "clinical-formulation",
    title: "Clinical Formulation Workshop",
    tag: "Workshop",
    dateStr: "June 18, 2026",
    timeStr: "6:00 PM - 8:30 PM",
    location: "Clinical Online Portal",
    desc: "An intensive training on formulating lipid-based therapeutic salves and custom oil infusions. We will analyze solubility matrices, stabilization agents, and shelf-life preservation using botanical antioxidants.",
    audio: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
  },
  "2026-5-27": {
    id: "botanical-walk",
    title: "Botanical Walk & Field Study",
    tag: "Field Study",
    dateStr: "June 27, 2026",
    timeStr: "10:00 AM - 1:00 PM",
    location: "Patapsco Valley State Park",
    desc: "An outdoor identification workshop focusing on native Appalachian herbs, sustainable foraging practices, and ecological stewardship. Participants will receive a companion field guide.",
    video: "https://assets.mixkit.co/videos/preview/mixkit-pouring-hot-water-on-herbal-tea-41603-large.mp4"
  }
};

function initCalendar() {
  const prevBtn = document.getElementById('prev-month-btn');
  const nextBtn = document.getElementById('next-month-btn');
  
  if (!prevBtn || !nextBtn) return;
  
  prevBtn.addEventListener('click', () => {
    currentCalendarMonth--;
    if (currentCalendarMonth < 0) {
      currentCalendarMonth = 11;
      currentCalendarYear--;
    }
    renderCalendar();
  });
  
  nextBtn.addEventListener('click', () => {
    currentCalendarMonth++;
    if (currentCalendarMonth > 11) {
      currentCalendarMonth = 0;
      currentCalendarYear++;
    }
    renderCalendar();
  });
  
  // Wire drawer close button
  document.getElementById('drawer-close-btn')?.addEventListener('click', closeCalendarDrawer);
  
  renderCalendar();
  
  // Check for auto-select event parameter on load
  const hash = window.location.hash;
  if (hash.includes('event=')) {
    const eventId = hash.split('event=')[1];
    selectCalendarEventById(eventId);
  }
}

function renderCalendar() {
  const monthYearEl = document.getElementById('calendar-month-year');
  const daysGrid = document.getElementById('calendar-days-grid');
  if (!monthYearEl || !daysGrid) return;
  
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  
  monthYearEl.textContent = `${monthNames[currentCalendarMonth]} ${currentCalendarYear}`;
  daysGrid.innerHTML = '';
  
  const firstDayIndex = new Date(currentCalendarYear, currentCalendarMonth, 1).getDay();
  const totalDays = new Date(currentCalendarYear, currentCalendarMonth + 1, 0).getDate();
  
  // Empty blocks for days before 1st of month
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyNode = document.createElement('div');
    emptyNode.className = 'calendar-day-node empty-day';
    daysGrid.appendChild(emptyNode);
  }
  
  // Populate days of month
  for (let day = 1; day <= totalDays; day++) {
    const dayNode = document.createElement('div');
    dayNode.className = 'calendar-day-node';
    dayNode.textContent = day;
    
    const eventKey = `${currentCalendarYear}-${currentCalendarMonth}-${day}`;
    const event = CALENDAR_EVENTS[eventKey];
    
    if (event) {
      dayNode.classList.add('has-event');
      dayNode.setAttribute('title', event.title);
      dayNode.addEventListener('click', () => {
        // Clear selected class from other nodes
        daysGrid.querySelectorAll('.calendar-day-node').forEach(n => n.classList.remove('selected-day'));
        dayNode.classList.add('selected-day');
        showCalendarEvent(event);
      });
    }
    
    daysGrid.appendChild(dayNode);
  }
}

function showCalendarEvent(event) {
  const placeholder = document.getElementById('drawer-placeholder');
  const activeContent = document.getElementById('drawer-active-content');
  if (!placeholder || !activeContent) return;
  
  placeholder.style.display = 'none';
  activeContent.style.display = 'flex';
  
  // Set details
  document.getElementById('drawer-event-title').textContent = event.title;
  document.getElementById('drawer-event-tag').textContent = event.tag;
  document.getElementById('drawer-event-date').textContent = event.dateStr;
  document.getElementById('drawer-event-time').textContent = event.timeStr;
  document.getElementById('drawer-event-location').textContent = event.location;
  document.getElementById('drawer-event-desc').textContent = event.desc;
  
  // Set share link
  const shareLinkInput = document.getElementById('drawer-share-link');
  const shareUrl = `${window.location.origin}${window.location.pathname}#contact?event=${event.id}`;
  if (shareLinkInput) shareLinkInput.value = shareUrl;
  
  // Render QR Code (API-based, with graceful error fallback)
  const qrContainer = document.getElementById('drawer-qrcode');
  if (qrContainer) {
    qrContainer.innerHTML = '';
    const qrImg = document.createElement('img');
    qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=90x90&color=482c6a&data=${encodeURIComponent(shareUrl)}`;
    qrImg.alt = 'Gathering Sharing QR Code';
    qrImg.style.width = '100%';
    qrImg.style.height = '100%';
    qrImg.style.display = 'block';
    
    // Fallback if image fails to load (offline scenario)
    qrImg.onerror = () => {
      qrContainer.innerHTML = `<div style="font-size: 8px; color: var(--color-purple); text-align: center; font-weight: bold; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; border: 1px dashed var(--border-subtle); padding: 4px; box-sizing: border-box;">[QR SIGNATURE]</div>`;
    };
    qrContainer.appendChild(qrImg);
  }
  
  // Render media gates
  const videoContainer = document.getElementById('drawer-video-container');
  const audioContainer = document.getElementById('drawer-audio-container');
  
  if (videoContainer) {
    if (event.video) {
      videoContainer.style.display = 'block';
      videoContainer.innerHTML = `
        <video controls style="width: 100%; height: auto; display: block; outline: none;">
          <source src="${event.video}" type="video/mp4">
          Your browser does not support the video tag.
        </video>
      `;
    } else {
      videoContainer.style.display = 'none';
      videoContainer.innerHTML = '';
    }
  }
  
  if (audioContainer) {
    if (event.audio) {
      audioContainer.style.display = 'block';
      audioContainer.innerHTML = `
        <span style="font-size: 11px; text-transform: uppercase; color: var(--color-amber); letter-spacing: 0.05em; font-weight: 600; display: block; margin-bottom: 6px;">✦ Audio Study Broadcast</span>
        <audio controls style="width: 100%; outline: none;">
          <source src="${event.audio}" type="audio/mpeg">
          Your browser does not support the audio element.
        </audio>
      `;
    } else {
      audioContainer.style.display = 'none';
      audioContainer.innerHTML = '';
    }
  }
  
  audioEngine.triggerBotanicalRustle();
}

function closeCalendarDrawer() {
  const placeholder = document.getElementById('drawer-placeholder');
  const activeContent = document.getElementById('drawer-active-content');
  if (placeholder && activeContent) {
    placeholder.style.display = 'block';
    activeContent.style.display = 'none';
  }
  // Clear selection
  document.getElementById('calendar-days-grid')?.querySelectorAll('.calendar-day-node').forEach(n => n.classList.remove('selected-day'));
}

function selectCalendarEventById(eventId) {
  // Search for the event in the list
  const foundEntry = Object.entries(CALENDAR_EVENTS).find(([key, ev]) => ev.id === eventId);
  if (foundEntry) {
    const [key, ev] = foundEntry;
    const parts = key.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const day = parseInt(parts[2], 10);
    
    currentCalendarMonth = month;
    currentCalendarYear = year;
    renderCalendar();
    
    // Find the corresponding day element and click it
    setTimeout(() => {
      const daysGrid = document.getElementById('calendar-days-grid');
      if (daysGrid) {
        const nodes = daysGrid.querySelectorAll('.calendar-day-node');
        nodes.forEach(n => {
          if (!n.classList.contains('empty-day') && parseInt(n.textContent, 10) === day) {
            n.click();
          }
        });
      }
    }, 100);
  }
}

// ─── INITIALISATION ───────────────────────────────────────────────────────
/**
 * Boot sequence:
 * 1. Inject cursor glow layer
 * 2. Wire audio gate modal
 * 3. Wire navigation (data-view attributes)
 * 4. Wire cart drawer
 * 5. Wire mobile menu
 * 6. Wire contact form
 * 7. Wire podcast player controls
 * 8. Inject portal styles
 * 9. Init scroll-linked header state
 * 10. Init hero parallax micro-interaction
 * 11. Initialise WebGL pipeline (deferred 50ms to ensure Three.js CDN ready)
 * 12. Pre-render home view (already in HTML, no JS render needed)
 */
function init() {
  initCursorGlow();
  wireAudioGate();
  wireNavigation();
  wireCartDrawer();
  wireMobileMenu();
  wireContactForm();
  wirePlayerControls();
  injectPortalStyles();
  initHeaderScroll();
  initHeroParallax();
  initCalendar();

  // Initialise WebGL — deferred slightly so CDN scripts are guaranteed parsed
  setTimeout(() => pipeline.init(), 80);

  // Page visibility API — suspend audio when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      audioEngine.suspend();
      clearInterval(playerState.ticker);
    } else {
      audioEngine.resume();
      if (playerState.playing) startPlayerTicker();
    }
  });

  console.log('[App] Herbalistic Wellness initialised. ✦');
}

// ─── ENTRY POINT ──────────────────────────────────────────────────────────
// DOMContentLoaded is safe here since this script is type="module"
// (modules are deferred by default in browsers).
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
