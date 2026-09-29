// app.js
document.addEventListener('DOMContentLoaded', async () => {
    const userRole = localStorage.getItem('hw_role');
    const isWholesale = userRole === 'wholesale';
    
    // UI elements
    const loginBtn = document.getElementById('login-btn');
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
        if (!isWholesale) {
            logoutBtn.style.display = 'none';
            if (loginBtn) loginBtn.style.display = 'block';
        } else {
            logoutBtn.style.display = 'block';
            if (loginBtn) loginBtn.style.display = 'none';
            logoutBtn.addEventListener('click', () => {
                localStorage.removeItem('hw_role');
                window.location.href = 'login.html';
            });
        }
    }

    const grid = document.getElementById('product-grid');
    if (grid) {
        if (!isWholesale) {
            grid.innerHTML = '<p class="p-8 text-center text-red-600">Access Restricted: You must log in as a verified Wholesale Partner to view the catalog.</p>';
            return;
        }

        try {
            // Fetch static catalog generated earlier or from data_ingestion.php in prod
            const response = await fetch('/wholesale/catalog.json?t=' + new Date().getTime());
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.data) {
                    renderProducts(data.data, grid);
                }
            } else {
                 grid.innerHTML = '<p class="p-8 text-center text-red-600">Failed to load catalog. Please ensure data_ingestion is configured.</p>';
            }
        } catch (error) {
            console.error("Error fetching wholesale catalog:", error);
        }
    }
});

function generateSlug(title) {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
}

function resolveImage(product) {
    // Replace default fallbacks with actual webp based on title slug
    if (product.image_link && product.image_link.includes('product-default')) {
        return `https://www.herbalisticwellness.com/assets/images/products/${generateSlug(product.title)}.webp`;
    }
    return product.image_link || `https://www.herbalisticwellness.com/assets/images/products/${generateSlug(product.title)}.webp`;
}

function deduplicateProducts(products) {
    const unique = new Map();
    products.forEach(p => {
        const slug = generateSlug(p.title);
        // Only keep the first variation of a duplicate title
        if (!unique.has(slug)) {
            p.slug = slug;
            unique.set(slug, p);
        }
    });
    return Array.from(unique.values());}

function showToast(message) {
    let toast = document.getElementById('wholesale-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'wholesale-toast';
        toast.className = 'fixed bottom-4 right-4 bg-[#482C6A] text-[#FAF9F6] px-6 py-3 rounded shadow-lg transition-opacity duration-300 opacity-0 z-50 pointer-events-none';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.remove('opacity-0');
    setTimeout(() => toast.classList.add('opacity-0'), 3000);
}
window.showToast = showToast;

function renderProducts(rawProducts, container) {
    container.innerHTML = '';
    const products = deduplicateProducts(rawProducts);

    products.forEach(p => {
        const imgUrl = resolveImage(p);
        const moq = parseInt(p.min_order_qty) || 24; // Dynamic MOQ from catalog
        const inStock = p.availability !== 'out of stock';

        const card = document.createElement('div');
        card.className = 'bg-white border border-[#482C6A] rounded-lg shadow-sm overflow-hidden flex flex-col transition hover:shadow-md';
        card.innerHTML = `
            <a href="/wholesale/product/${p.slug}" class="block overflow-hidden bg-gray-100 flex items-center justify-center">
                <img src="${imgUrl}" alt="${p.title}" class="w-full h-48 object-cover hover:scale-105 transition-transform duration-300" onerror="this.onerror=null; this.src='https://www.herbalisticwellness.com/assets/images/placeholder-product.png';">
            </a>
            <div class="p-4 flex flex-col flex-grow">
                <a href="/wholesale/product/${p.slug}" class="text-[#482C6A] no-underline hover:underline">
                    <h3 class="font-heading text-xl font-semibold mb-2 leading-tight">${p.title}</h3>
                </a>
                
                <div class="space-y-1 mb-4 flex-grow text-sm">
                    <div class="flex justify-between text-gray-500">
                        <span>Retail MSRP:</span> <span>${p.retail_msrp}</span>
                    </div>
                    <div class="flex justify-between font-medium text-[#482C6A]">
                        <span>Tier 1 (55%):</span> <span>${p.tier1_wholesale_55_percent || '$0.00'}</span>
                    </div>
                    <div class="flex justify-between font-medium text-[#D88C43]">
                        <span>Tier 2 (50%):</span> <span>${p.tier2_volume_50_percent || '$0.00'}</span>
                    </div>
                    <div class="flex justify-between text-sm text-gray-600 border-t pt-1 mt-1">
                        <span>White Label IP:</span> <span>${p.white_label_ip_80_percent || '$0.00'}</span>
                    </div>
                </div>

                <div class="text-xs text-center text-gray-500 mb-3 bg-gray-50 py-1 rounded">Strict MOQ: ${moq} Units</div>
                
                <div class="flex items-center gap-2 mt-auto">
                    <select class="border border-gray-300 rounded p-2 text-xs flex-grow" aria-label="Variant">
                        <option>Standard Variant</option>
                    </select>
                </div>
                <div class="flex items-center gap-2 mt-2">
                    ${inStock ? (() => {
                        const safeTitle = p.title.replace(/'/g, "\\'");
                        return `
                        <input type="number" id="qty-${p.slug}" value="${moq}" min="${moq}" class="w-16 border border-gray-300 rounded p-2 text-center" aria-label="Quantity">
                        <button class="bg-[#D88C43] text-[#FAF9F6] font-semibold py-2 px-4 rounded hover:bg-opacity-90 transition flex-grow" onclick="addToCart('${safeTitle}', ${p.tier1_wholesale_55_percent ? p.tier1_wholesale_55_percent.replace('$', '') : '0'}, document.getElementById('qty-${p.slug}').value)">Quick Add</button>
                        `;
                    })() : `
                        <button class="bg-gray-400 text-white font-semibold py-2 px-4 rounded cursor-not-allowed flex-grow" disabled>Temporarily Out of Stock</button>
                    `}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Real Shopping Cart Logic
window.addToCart = function(name, price, qty) {
    let cart = JSON.parse(localStorage.getItem('hw_wholesale_cart')) || [];
    let existingItem = cart.find(item => item.name === name);
    if (existingItem) {
        existingItem.qty = parseInt(existingItem.qty) + parseInt(qty);
    } else {
        cart.push({ name: name, price: parseFloat(price), qty: parseInt(qty) });
    }
    localStorage.setItem('hw_wholesale_cart', JSON.stringify(cart));
    
    // Update toast UI
    let toast = document.createElement('div');
    toast.className = 'fixed bottom-4 right-4 bg-green-600 text-white px-6 py-3 rounded shadow-lg z-50 transition-opacity duration-300';
    toast.innerHTML = `Added ${qty} units to your Wholesale Pipeline. <a href="/wholesale/checkout" class="underline font-bold ml-2">View Cart</a>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.style.opacity = '0', 3000);
    setTimeout(() => toast.remove(), 3300);
}
