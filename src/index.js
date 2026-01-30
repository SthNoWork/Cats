// ============================================================================
// Cats Gallery - Media Browser
// Read-only cats display with search, category filtering, and media modal
// ============================================================================

import Database from './connection/database.js';

// Initialize database connection (use `cats` table)
const db = new Database('cats');

// ─── State Management ────────────────────────────────────────────────────────
let allProducts = [];
let selectedCategories = new Set();
let allCategoriesWithCounts = [];
let videoObserver = null;

// ─── DOM Elements ────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const categorySearchInput = document.getElementById('categorySearchInput');
const productsGrid = document.getElementById('productsGrid');
const recentProducts = document.getElementById('recentProducts');
const popularProducts = document.getElementById('popularProducts');
const promotionSection = document.getElementById('promotionSection');
const promotionProducts = document.getElementById('promotionProducts');
const productCount = document.getElementById('productCount');
const productModal = document.getElementById('productModal');
const modalBody = document.getElementById('modalBody');

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupVideoAutoplay();
    await loadProducts();
    await loadCategories();
    setupSearchListener();
    setupKeyboardListener();
    setupSwipeToClose();
    // this project is a gallery — hide shop-specific promotion UI if present
    try { if (promotionSection) promotionSection.style.display = 'none'; } catch (e) {}
});

// ─── Swipe-to-close on touch devices ─────────────────────────────────────────
function setupSwipeToClose() {
    let startX = 0, startY = 0, tracking = false;

    productModal.addEventListener('touchstart', (e) => {
        if (e.touches?.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
    }, { passive: true });

    productModal.addEventListener('touchend', (e) => {
        if (!tracking || !e.changedTouches?.[0]) return;
        tracking = false;
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;
        const threshold = window.innerWidth * 0.20;
        if (Math.abs(dx) > Math.abs(dy) * 1.5 && dx > threshold) {
            closeModal();
        }
    }, { passive: true });
}

// ─── Helper: Check if URL is video ───────────────────────────────────────────
function isVideoUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov');
}

// ─── Helper: Get Cloudinary video poster thumbnail ───────────────────────────
function getVideoPoster(videoUrl) {
    if (!videoUrl || !videoUrl.includes('cloudinary.com')) return '';
    return videoUrl
        .replace('/video/upload/', '/video/upload/so_0.5,f_jpg,w_100,h_100,c_fill/')
        .replace(/\.(mp4|webm|mov)$/i, '.jpg');
}

// ─── Helper: Get product media array ─────────────────────────────────────────
function getProductMedia(product) {
    if (Array.isArray(product.image_urls) && product.image_urls.length > 0) {
        return product.image_urls;
    }
    return product.image_url ? [product.image_url] : [];
}

// ─── Helper: Format price HTML ───────────────────────────────────────────────
function formatPriceHtml() {
    // Pricing UI removed for the cats gallery
    return '';
}

// ─── Video Autoplay Observer ─────────────────────────────────────────────────
function setupVideoAutoplay() {
    videoObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            entry.isIntersecting ? video.play().catch(() => {}) : video.pause();
        });
    }, { threshold: 0.5 });
}

function observeVideos() {
    if (!videoObserver) return;
    document.querySelectorAll('.product-card video').forEach(v => videoObserver.observe(v));
}

// ─── Load Categories ─────────────────────────────────────────────────────────
async function loadCategories() {
    try {
        // Wait for products to load first so we can count them
        const categoryCounts = {};
        
        // Count products per category
        allProducts.forEach(product => {
            if (product.categories && Array.isArray(product.categories)) {
                product.categories.forEach(cat => {
                    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
                });
            }
        });
        
        // Convert to array and sort by count (descending)
        allCategoriesWithCounts = Object.entries(categoryCounts)
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => b.count - a.count);
        
        if (allCategoriesWithCounts.length === 0) {
            categoryFilters.innerHTML = '<p class="no-data">No categories available</p>';
            return;
        }

        renderCategories(allCategoriesWithCounts);
        setupCategorySearchListener();

    } catch (err) {
        categoryFilters.innerHTML = `<p class="error">Failed to load categories: ${err.message}</p>`;
    }
}

// ─── Render Categories ───────────────────────────────────────────────────────
function renderCategories(categories) {
    categoryFilters.innerHTML = categories.map(({ name, count }) => `
        <label class="category-checkbox" data-category-name="${escapeHtml(name.toLowerCase())}">
            <input 
                type="checkbox" 
                value="${escapeHtml(name)}" 
                data-category="${escapeHtml(name)}"
                ${selectedCategories.has(name) ? 'checked' : ''}
            >
            <span>${escapeHtml(name)}</span>
            <span class="category-count">(${count})</span>
        </label>
    `).join('');

    // Add event listeners to checkboxes
    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCategoryChange);
    });
}

// ─── Category Search Handler ─────────────────────────────────────────────────
function setupCategorySearchListener() {
    categorySearchInput.addEventListener('input', () => {
        const searchTerm = categorySearchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            // Show all categories
            renderCategories(allCategoriesWithCounts);
            return;
        }
        
        // Filter categories by search term
        const filtered = allCategoriesWithCounts.filter(({ name }) => 
            name.toLowerCase().includes(searchTerm)
        );
        
        if (filtered.length === 0) {
            categoryFilters.innerHTML = '<p class="no-data">No matching categories</p>';
            return;
        }
        
        renderCategories(filtered);
    });
}

// ─── Load Products ───────────────────────────────────────────────────────────
async function loadProducts() {
    productsGrid.innerHTML = '<p class="loading">Loading products...</p>';
    recentProducts.innerHTML = '<p class="loading">Loading...</p>';
    popularProducts.innerHTML = '<p class="loading">Loading...</p>';
    
    try {
        allProducts = await db.selectAll();
        
        // Render all sections (promotion section not used for gallery)
        renderRecentProducts();
        renderPopularProducts();
        renderProducts(allProducts);
    } catch (err) {
        productsGrid.innerHTML = `<p class="error">Failed to load products: ${err.message}</p>`;
        recentProducts.innerHTML = `<p class="error">Failed to load</p>`;
        popularProducts.innerHTML = `<p class="error">Failed to load</p>`;
    }
}

// ─── Check if product has active promotion ───────────────────────────────────
function hasActivePromotion(product) {
    if (!product.discount_percent || product.discount_percent <= 0) return false;
    if (!product.promotion_end) return false;
    
    const now = new Date();
    const start = product.promotion_start ? new Date(product.promotion_start) : new Date(0);
    const end = new Date(product.promotion_end);
    
    return now >= start && now <= end;
}

// ─── Get discounted price ────────────────────────────────────────────────────
function getDiscountedPrice(product) {
    if (!product.price || !hasActivePromotion(product)) return null;
    return product.price * (1 - product.discount_percent / 100);
}

// ─── Render Promotion Products ───────────────────────────────────────────────
function renderPromotionProducts() {
    const promos = allProducts.filter(hasActivePromotion);
    
    if (promos.length === 0) {
        promotionSection.style.display = 'none';
        return;
    }
    
    promotionSection.style.display = 'block';
    promotionProducts.innerHTML = promos.map(p => renderProductCard(p, true)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Render Recent Products (last 8 by created_at, only if within a week) ────
function renderRecentProducts() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    // Filter products added within the last week
    const recentWithinWeek = [...allProducts]
        .filter(p => p.created_at && new Date(p.created_at) >= oneWeekAgo)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);
    
    const recentSection = document.getElementById('recentSection');
    
    // Hide entire section if no products within a week
    if (recentWithinWeek.length === 0) {
        recentSection.style.display = 'none';
        return;
    }
    
    recentSection.style.display = 'block';
    recentProducts.innerHTML = recentWithinWeek.map(p => renderProductCard(p, true)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Render Popular Products (admin marked as featured) ──────────────────────
function renderPopularProducts() {
    const popular = allProducts.filter(p => p.is_featured === true);
    
    // Hide section if no featured products
    const popularSection = document.getElementById('popularSection');
    if (popular.length === 0) {
        popularSection.style.display = 'none';
        return;
    }
    
    popularSection.style.display = 'block';
    popularProducts.innerHTML = popular.map(p => renderProductCard(p, true)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Category Filter Handler ────────────────────────────────────────────────
function handleCategoryChange(e) {
    const category = e.target.value;
    
    if (e.target.checked) {
        selectedCategories.add(category);
    } else {
        selectedCategories.delete(category);
    }
    
    filterProducts();
}

// ─── Search Handler ──────────────────────────────────────────────────────────
function setupSearchListener() {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            filterProducts();
        }, 300);
    });
}

// ─── Keyboard Handler (ESC to close modal) ───────────────────────────────────
function setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && productModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ─── Filter & Render Products ────────────────────────────────────────────────
function filterProducts() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    let filtered = allProducts;
    
    // Filter by categories (products must have ALL selected categories)
    if (selectedCategories.size > 0) {
        filtered = filtered.filter(product => {
            if (!product.categories || !Array.isArray(product.categories)) {
                return false;
            }
            return Array.from(selectedCategories).every(cat => 
                product.categories.includes(cat)
            );
        });
    }
    
    // Filter by search term (searches in title and description)
    if (searchTerm) {
        filtered = filtered.filter(product => {
            const title = (product.title || '').toLowerCase();
            const description = (product.description || '').toLowerCase();
            return title.includes(searchTerm) || description.includes(searchTerm);
        });
    }
    
    renderProducts(filtered);
}

// ─── Render Single Product Card ──────────────────────────────────────────────
function renderProductCard(product, compact = false, showPromo = false) {
    // Handle multiple images
    const images = Array.isArray(product.image_urls) && product.image_urls.length > 0
        ? product.image_urls
        : (product.image_url ? [product.image_url] : []);
    
    const mainImage = images.length > 0 ? images[0] : 'https://via.placeholder.com/400x400?text=No+Image';
    
    // Check if first item is video (Cloudinary URLs contain /video/ for videos)
    const isVideo = mainImage.includes('/video/') || mainImage.includes('.mp4') || mainImage.includes('.webm');
    
    // No pricing or promotion fields needed for the cat gallery
    const priceHtml = '';
    const mediaCount = images.length > 1 ? `<span class="image-count-badge">${images.length}</span>` : '';
    const saleBadge = '';
    
    const mediaElement = isVideo 
        ? `<video src="${escapeHtml(mainImage)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(mainImage)}" alt="${escapeHtml(product.title)}" onerror="this.src='https://via.placeholder.com/400x400?text=No+Image'">`;
    const categoriesHtml = product.categories && Array.isArray(product.categories)
        ? `<div class="card-categories">${product.categories.map(c => `<span class="mini-tag">${escapeHtml(c)}</span>`).join(' ')}</div>`
        : '';
    const addedAt = product.created_at ? `<div class="added-at">Added: ${new Date(product.created_at).toLocaleDateString()}</div>` : '';

    return `
        <div class="product-card ${compact ? 'compact' : ''}" onclick="openProductModal('${product.id}')" data-id="${product.id}">
            <div class="product-image">
                ${mediaElement}
                ${mediaCount}
                ${saleBadge}
            </div>
            <div class="product-info">
                <h3 class="product-title">${escapeHtml(product.title)}</h3>
                ${categoriesHtml}
                ${addedAt}
            </div>
        </div>
    `;
}

// ─── Render Products Grid ────────────────────────────────────────────────────
function renderProducts(products) {
    productCount.textContent = `${products.length} cat${products.length !== 1 ? 's' : ''}`;
    
    if (products.length === 0) {
        productsGrid.innerHTML = '<p class="no-data">No products found</p>';
        return;
    }
    
    productsGrid.innerHTML = products.map(product => renderProductCard(product)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Open Product Modal ──────────────────────────────────────────────────────
window.openProductModal = function(productId) {
    const product = allProducts.find(p => p.id === productId);
    if (!product) return;
    
    const media = getProductMedia(product);
    const mainMedia = media[0] || 'https://via.placeholder.com/400x400?text=No+Image';
    const isVideo = isVideoUrl(mainMedia);
    
    const categories = product.categories?.map(cat => 
        `<span class="tag">${escapeHtml(cat)}</span>`
    ).join('') || '';
    
    const description = product.description 
        ? `<p class="modal-description">${escapeHtml(product.description)}</p>` : '';
    
    const adminNotes = product.admin_notes 
        ? `<div class="modal-notes"><strong>Note:</strong> ${escapeHtml(product.admin_notes)}</div>` : '';
    const addedAtInfo = product.created_at ? `<div class="modal-added">Added: ${new Date(product.created_at).toLocaleDateString()}</div>` : '';
    
    // Main media display
    const mainMediaHtml = isVideo 
        ? `<video id="modalMainMedia" src="${escapeHtml(mainMedia)}" controls autoplay muted loop playsinline class="modal-main-media"></video>`
        : `<img id="modalMainMedia" src="${escapeHtml(mainMedia)}" alt="${escapeHtml(product.title)}" class="modal-main-media">`;
    
    // Gallery thumbnails (only if multiple media)
    const galleryHtml = media.length > 1 
        ? `<div class="modal-gallery">
            ${media.map((src, idx) => {
                const isVid = isVideoUrl(src);
                if (isVid) {
                    return `<div class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMedia('${escapeHtml(src)}', this, true)">
                         <video src="${escapeHtml(src)}" autoplay muted loop playsinline preload="auto" style="width:100%;height:100%;object-fit:cover;display:block;"></video>
                       </div>`;
                }
                return `<img src="${escapeHtml(src)}" class="gallery-thumb ${idx === 0 ? 'active' : ''}" onclick="changeModalMedia('${escapeHtml(src)}', this, false)">`;
            }).join('')}
           </div>`
        : '';
    
    modalBody.innerHTML = `
        <div class="modal-grid">
            <div class="modal-media-section">
                ${mainMediaHtml}
                ${galleryHtml}
            </div>
            <div class="modal-info-section">
                <h2 class="modal-title">${escapeHtml(product.title)}</h2>
                ${addedAtInfo}
                ${formatPriceHtml(product, true)}
                ${description}
                <div class="modal-categories">${categories}</div>
                ${adminNotes}
            </div>
        </div>
    `;
    
    productModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    // If main media is a video, unmute it and play (user-initiated open)
    const modalVideo = document.getElementById('modalMainMedia');
    if (modalVideo && modalVideo.tagName === 'VIDEO') {
        try {
            modalVideo.muted = false;
            // play may return a promise; call it and ignore rejections
            modalVideo.play().catch(() => {});
        } catch (e) {
            // ignore
        }
    }
};

// ─── Change Modal Media ──────────────────────────────────────────────────────
window.changeModalMedia = function(src, thumb, isVideo) {
    const container = document.querySelector('.modal-media-section');
    const oldMedia = document.getElementById('modalMainMedia');
    
    // Remove active from all thumbs
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    
    // Replace media element
    if (isVideo) {
        const video = document.createElement('video');
        video.id = 'modalMainMedia';
        video.src = src;
        video.controls = true;
        // User clicked the thumbnail — allow sound
        video.muted = false;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true; // Safari iOS requires this
        video.preload = 'auto';
        video.className = 'modal-main-media';
        oldMedia.replaceWith(video);
    } else {
        const img = document.createElement('img');
        img.id = 'modalMainMedia';
        img.src = src;
        img.className = 'modal-main-media';
        oldMedia.replaceWith(img);
    }
};

// ─── Close Modal ─────────────────────────────────────────────────────────────
window.closeModal = function(event) {
    if (event && event.target !== productModal) return;
    // Mute and pause modal video if present
    const modalVideo = document.getElementById('modalMainMedia');
    if (modalVideo && modalVideo.tagName === 'VIDEO') {
        try {
            modalVideo.muted = true;
            modalVideo.pause();
        } catch (e) {}
    }
    productModal.classList.remove('active');
    document.body.style.overflow = '';
};

// ─── Utility Functions ───────────────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}