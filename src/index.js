// ============================================================================
// Cats Gallery - Media Browser with Batch/Individual View Modes
// Read-only cats display with search, category filtering, and media modal
// ============================================================================

import Database from './connection/database.js';

// Initialize database connection (use `cats` table)
const db = new Database('cats');

// ─── State Management ────────────────────────────────────────────────────────
let allCats = [];
let selectedCategories = new Set();
let allCategoriesWithCounts = [];
let videoObserver = null;
let currentViewMode = 'batch'; // 'batch' or 'individual'

// ─── DOM Elements ────────────────────────────────────────────────────────────
const searchInput = document.getElementById('searchInput');
const categoryFilters = document.getElementById('categoryFilters');
const categorySearchInput = document.getElementById('categorySearchInput');
const catsGrid = document.getElementById('catsGrid');
const recentCats = document.getElementById('recentCats');
const popularCats = document.getElementById('popularCats');
const catCount = document.getElementById('catCount');
const catModal = document.getElementById('catModal');
const modalBody = document.getElementById('modalBody');

// ─── Initialize ──────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    setupVideoAutoplay();
    await loadCats();
    await loadCategories();
    setupSearchListener();
    setupKeyboardListener();
    setupSwipeToClose();
    setupBackButtonHandler();
});

// ─── View Mode Switching ─────────────────────────────────────────────────────
window.switchViewMode = function() {
    const selectedMode = document.querySelector('input[name="viewMode"]:checked').value;
    currentViewMode = selectedMode;
    filterCats();
};

// ─── Swipe-to-close on touch devices ─────────────────────────────────────────
function setupSwipeToClose() {
    let startX = 0, startY = 0, tracking = false;

    catModal.addEventListener('touchstart', (e) => {
        if (e.touches?.length !== 1) return;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        tracking = true;
    }, { passive: true });

    catModal.addEventListener('touchend', (e) => {
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

// ─── Back Button Handler for Android/Samsung devices ────────────────────────
function setupBackButtonHandler() {
    // Listen for browser back button (hardware back on Android)
    window.addEventListener('popstate', (e) => {
        if (catModal.classList.contains('active')) {
            e.preventDefault();
            closeModal();
        }
    });
}

// ─── Helper: Check if URL is video ───────────────────────────────────────────
function isVideoUrl(url) {
    if (!url) return false;
    const lower = url.toLowerCase();
    return lower.includes('.mp4') || lower.includes('.webm') || lower.includes('.mov') || lower.includes('/video/');
}

// ─── Helper: Get cat media (supports both old image_urls and new image_data) ─
function getCatMedia(cat) {
    // New format: image_data JSONB array
    if (cat.image_data && Array.isArray(cat.image_data) && cat.image_data.length > 0) {
        return cat.image_data;
    }
    // Old format: image_urls text array (backward compatibility)
    if (cat.image_urls && Array.isArray(cat.image_urls) && cat.image_urls.length > 0) {
        return cat.image_urls.map(url => ({ url, type: isVideoUrl(url) ? 'video' : 'image' }));
    }
    return [];
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
    document.querySelectorAll('.cat-card video').forEach(v => videoObserver.observe(v));
}

// ─── Load Categories ─────────────────────────────────────────────────────────
async function loadCategories() {
    try {
        const categoryCounts = {};
        
        // Count cats per category (handles both batch and individual modes)
        allCats.forEach(cat => {
            if (cat.categories && Array.isArray(cat.categories)) {
                cat.categories.forEach(c => {
                    categoryCounts[c] = (categoryCounts[c] || 0) + 1;
                });
            }
            // Also count individual image categories
            if (cat.image_data && Array.isArray(cat.image_data)) {
                cat.image_data.forEach(img => {
                    if (img.categories && Array.isArray(img.categories)) {
                        img.categories.forEach(c => {
                            categoryCounts[c] = (categoryCounts[c] || 0) + 1;
                        });
                    }
                });
            }
        });
        
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

    categoryFilters.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
        checkbox.addEventListener('change', handleCategoryChange);
    });
}

// ─── Category Search Handler ─────────────────────────────────────────────────
function setupCategorySearchListener() {
    categorySearchInput.addEventListener('input', () => {
        const searchTerm = categorySearchInput.value.toLowerCase().trim();
        
        if (!searchTerm) {
            renderCategories(allCategoriesWithCounts);
            return;
        }
        
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

// ─── Load Cats ───────────────────────────────────────────────────────────────
async function loadCats() {
    catsGrid.innerHTML = '<p class="loading">🐱 Loading cats...</p>';
    recentCats.innerHTML = '<p class="loading">Loading...</p>';
    popularCats.innerHTML = '<p class="loading">Loading...</p>';
    
    try {
        allCats = await db.selectAll();
        renderRecentCats();
        renderPopularCats();
        renderCats(allCats);
    } catch (err) {
        catsGrid.innerHTML = `<p class="error">Failed to load cats: ${err.message}</p>`;
        recentCats.innerHTML = `<p class="error">Failed to load</p>`;
        popularCats.innerHTML = `<p class="error">Failed to load</p>`;
    }
}

// ─── Render Recent Cats (last 8 within a week) ───────────────────────────────
function renderRecentCats() {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const recentWithinWeek = [...allCats]
        .filter(c => c.created_at && new Date(c.created_at) >= oneWeekAgo)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 8);
    
    const recentSection = document.getElementById('recentSection');
    
    if (recentWithinWeek.length === 0) {
        recentSection.style.display = 'none';
        return;
    }
    
    recentSection.style.display = 'block';
    recentCats.innerHTML = recentWithinWeek.map(c => renderCatCard(c, true)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Render Popular Cats (featured) ──────────────────────────────────────────
function renderPopularCats() {
    const popular = allCats.filter(c => c.is_featured === true);
    const popularSection = document.getElementById('popularSection');
    
    if (popular.length === 0) {
        popularSection.style.display = 'none';
        return;
    }
    
    popularSection.style.display = 'block';
    popularCats.innerHTML = popular.map(c => renderCatCard(c, true)).join('');
    setTimeout(observeVideos, 100);
}

// ─── Category Filter Handler ─────────────────────────────────────────────────
function handleCategoryChange(e) {
    const category = e.target.value;
    
    if (e.target.checked) {
        selectedCategories.add(category);
    } else {
        selectedCategories.delete(category);
    }
    
    filterCats();
}

// ─── Search Handler ──────────────────────────────────────────────────────────
function setupSearchListener() {
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => filterCats(), 300);
    });
}

// ─── Keyboard Handler (ESC to close modal) ───────────────────────────────────
function setupKeyboardListener() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && catModal.classList.contains('active')) {
            closeModal();
        }
    });
}

// ─── Filter & Render Cats ────────────────────────────────────────────────────
function filterCats() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    let filtered = allCats;
    
    // Filter by categories
    if (selectedCategories.size > 0) {
        filtered = filtered.filter(cat => {
            // Check cat-level categories
            const catHasCategories = cat.categories && Array.isArray(cat.categories) &&
                Array.from(selectedCategories).every(c => cat.categories.includes(c));
            
            // Check image-level categories (for individual mode)
            const imageHasCategories = cat.image_data && Array.isArray(cat.image_data) &&
                cat.image_data.some(img => 
                    img.categories && Array.isArray(img.categories) &&
                    Array.from(selectedCategories).every(c => img.categories.includes(c))
                );
            
            return catHasCategories || imageHasCategories;
        });
    }
    
    // Filter by search term
    if (searchTerm) {
        filtered = filtered.filter(cat => {
            const title = (cat.title || '').toLowerCase();
            const description = (cat.description || '').toLowerCase();
            
            // Also search in image_data titles/descriptions
            const imageMatch = cat.image_data && Array.isArray(cat.image_data) &&
                cat.image_data.some(img => 
                    (img.title || '').toLowerCase().includes(searchTerm) ||
                    (img.description || '').toLowerCase().includes(searchTerm)
                );
            
            return title.includes(searchTerm) || description.includes(searchTerm) || imageMatch;
        });
    }
    
    renderCats(filtered);
}

// ─── Render Single Cat Card ──────────────────────────────────────────────────
function renderCatCard(cat, compact = false) {
    const media = getCatMedia(cat);
    const mainMedia = media[0] || { url: 'https://via.placeholder.com/400x400?text=🐱', type: 'image' };
    const mainUrl = mainMedia.url || mainMedia;
    const isVideo = mainMedia.type === 'video' || isVideoUrl(mainUrl);
    
    const mediaCount = media.length > 1 ? `<span class="image-count-badge">+${media.length - 1}</span>` : '';
    
    const mediaElement = isVideo 
        ? `<video src="${escapeHtml(mainUrl)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(mainUrl)}" alt="${escapeHtml(cat.title || 'Cat')}" onerror="this.src='https://via.placeholder.com/400x400?text=🐱'">`;
    
    const title = cat.title || (mainMedia.title ? mainMedia.title : '');
    const description = cat.description || '';
    
    // Categories with truncation - show max 2, then "..." if more
    let categoriesHtml = '';
    if (cat.categories && Array.isArray(cat.categories) && cat.categories.length > 0) {
        const maxShow = 2;
        const visibleCats = cat.categories.slice(0, maxShow);
        const hasMore = cat.categories.length > maxShow;
        categoriesHtml = `<div class="card-categories">
            ${visibleCats.map(c => `<span class="mini-tag">${escapeHtml(c)}</span>`).join('')}
            ${hasMore ? `<span class="mini-tag more-tag">+${cat.categories.length - maxShow}</span>` : ''}
        </div>`;
    }

    return `
        <div class="cat-card ${compact ? 'compact' : ''}" onclick="openCatModal('${cat.id}')" data-id="${cat.id}">
            <div class="cat-image">
                ${mediaElement}
                ${mediaCount}
            </div>
            <div class="cat-info">
                ${title ? `<h3 class="cat-title">${escapeHtml(title)}</h3>` : ''}
                ${description ? `<p class="cat-description">${escapeHtml(description.substring(0, 80))}${description.length > 80 ? '...' : ''}</p>` : ''}
                ${categoriesHtml}
            </div>
        </div>
    `;
}

// ─── Render Individual Image Card ────────────────────────────────────────────
function renderIndividualCard(cat, imgData, imgIndex) {
    const url = imgData.url || imgData;
    const isVideo = imgData.type === 'video' || isVideoUrl(url);
    const title = imgData.title || cat.title || '';
    const description = imgData.description || cat.description || '';
    
    const mediaElement = isVideo 
        ? `<video src="${escapeHtml(url)}" muted loop playsinline preload="metadata"></video>`
        : `<img src="${escapeHtml(url)}" alt="${escapeHtml(title || 'Cat')}" onerror="this.src='https://via.placeholder.com/400x400?text=🐱'">`;

    // Categories with truncation - show max 2, then "..." if more
    let categoriesHtml = '';
    if (cat.categories && Array.isArray(cat.categories) && cat.categories.length > 0) {
        const maxShow = 2;
        const visibleCats = cat.categories.slice(0, maxShow);
        const hasMore = cat.categories.length > maxShow;
        categoriesHtml = `<div class="card-categories">
            ${visibleCats.map(c => `<span class="mini-tag">${escapeHtml(c)}</span>`).join('')}
            ${hasMore ? `<span class="mini-tag more-tag">+${cat.categories.length - maxShow}</span>` : ''}
        </div>`;
    }

    return `
        <div class="cat-card individual-card" onclick="openCatModal('${cat.id}', ${imgIndex})" data-id="${cat.id}" data-img="${imgIndex}">
            <div class="cat-image">
                ${mediaElement}
            </div>
            <div class="cat-info">
                ${title ? `<h3 class="cat-title">${escapeHtml(title)}</h3>` : ''}
                ${description ? `<p class="cat-description">${escapeHtml(description.substring(0, 60))}${description.length > 60 ? '...' : ''}</p>` : ''}
                ${categoriesHtml}
            </div>
        </div>
    `;
}

// ─── Render Cats Grid ────────────────────────────────────────────────────────
function renderCats(cats) {
    if (currentViewMode === 'batch') {
        // Gallery mode: one card per cat entry
        catCount.textContent = `${cats.length} cat${cats.length !== 1 ? 's' : ''}`;
        
        if (cats.length === 0) {
            catsGrid.innerHTML = '<p class="no-data">🐱 No cats found</p>';
            return;
        }
        
        catsGrid.innerHTML = cats.map(cat => renderCatCard(cat)).join('');
    } else {
        // Individual mode: one card per image
        let totalImages = 0;
        let cardsHtml = '';
        
        cats.forEach(cat => {
            const media = getCatMedia(cat);
            if (media.length > 0) {
                media.forEach((imgData, idx) => {
                    cardsHtml += renderIndividualCard(cat, imgData, idx);
                    totalImages++;
                });
            }
        });
        
        catCount.textContent = `${totalImages} photo${totalImages !== 1 ? 's' : ''}`;
        
        if (totalImages === 0) {
            catsGrid.innerHTML = '<p class="no-data">🐱 No photos found</p>';
            return;
        }
        
        catsGrid.innerHTML = cardsHtml;
    }
    
    setTimeout(observeVideos, 100);
}

// ─── Open Cat Modal ──────────────────────────────────────────────────────────
window.openCatModal = function(catId, startIndex = 0) {
    const cat = allCats.find(c => c.id === catId);
    if (!cat) return;
    
    const media = getCatMedia(cat);
    const currentMedia = media[startIndex] || media[0] || { url: 'https://via.placeholder.com/400x400?text=🐱', type: 'image' };
    const mainUrl = currentMedia.url || currentMedia;
    const isVideo = currentMedia.type === 'video' || isVideoUrl(mainUrl);
    
    // Get title/description (from image if individual mode, or cat-level)
    const displayTitle = currentMedia.title || cat.title || '';
    const displayDesc = currentMedia.description || cat.description || '';
    
    const categories = cat.categories?.map(c => 
        `<span class="tag">${escapeHtml(c)}</span>`
    ).join('') || '';
    
    const description = displayDesc ? `<p class="modal-description">${escapeHtml(displayDesc)}</p>` : '';
    const addedAtInfo = cat.created_at ? `<div class="modal-added">🗓️ ${new Date(cat.created_at).toLocaleDateString()}</div>` : '';
    
    const mainMediaHtml = isVideo 
        ? `<video id="modalMainMedia" src="${escapeHtml(mainUrl)}" controls autoplay muted loop playsinline class="modal-main-media"></video>`
        : `<img id="modalMainMedia" src="${escapeHtml(mainUrl)}" alt="${escapeHtml(displayTitle)}" class="modal-main-media">`;
    
    // Gallery thumbnails
    const galleryHtml = media.length > 1 
        ? `<div class="modal-gallery">
            ${media.map((m, idx) => {
                const mUrl = m.url || m;
                const isVid = m.type === 'video' || isVideoUrl(mUrl);
                const activeClass = idx === startIndex ? 'active' : '';
                if (isVid) {
                    return `<div class="gallery-thumb ${activeClass}" onclick="changeModalMedia('${escapeHtml(mUrl)}', this, true, '${cat.id}', ${idx})">
                         <video src="${escapeHtml(mUrl)}" muted loop playsinline preload="metadata"></video>
                         <span class="video-indicator">▶</span>
                       </div>`;
                }
                return `<div class="gallery-thumb ${activeClass}" onclick="changeModalMedia('${escapeHtml(mUrl)}', this, false, '${cat.id}', ${idx})">
                    <img src="${escapeHtml(mUrl)}" alt="Thumbnail">
                </div>`;
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
                <h2 class="modal-title">${escapeHtml(displayTitle) || '🐱 Cute Cat'}</h2>
                ${addedAtInfo}
                ${description}
                <div class="modal-categories">${categories}</div>
            </div>
        </div>
    `;
    
    catModal.classList.add('active');
    document.body.style.overflow = 'hidden';
    
    // Push history state for back button support (Android/Samsung)
    history.pushState({ modalOpen: true }, '', window.location.href);
    
    const modalVideo = document.getElementById('modalMainMedia');
    if (modalVideo && modalVideo.tagName === 'VIDEO') {
        modalVideo.muted = false;
        modalVideo.play().catch(() => {});
    }
};

// ─── Change Modal Media ──────────────────────────────────────────────────────
window.changeModalMedia = function(src, thumb, isVideo, catId, imgIndex) {
    const oldMedia = document.getElementById('modalMainMedia');
    
    document.querySelectorAll('.gallery-thumb').forEach(t => t.classList.remove('active'));
    thumb.classList.add('active');
    
    // Update title/description if in individual mode
    const cat = allCats.find(c => c.id === catId);
    if (cat) {
        const media = getCatMedia(cat);
        const imgData = media[imgIndex] || {};
        const displayTitle = imgData.title || cat.title || '';
        const displayDesc = imgData.description || cat.description || '';
        
        const titleEl = document.querySelector('.modal-title');
        const descEl = document.querySelector('.modal-description');
        
        if (titleEl) titleEl.textContent = displayTitle || '🐱 Cute Cat';
        if (descEl) {
            descEl.textContent = displayDesc;
            descEl.style.display = displayDesc ? 'block' : 'none';
        }
    }
    
    if (isVideo) {
        const video = document.createElement('video');
        video.id = 'modalMainMedia';
        video.src = src;
        video.controls = true;
        video.muted = false;
        video.autoplay = true;
        video.loop = true;
        video.playsInline = true;
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
    if (event && event.target !== catModal) return;
    
    // Only call if modal is actually open
    if (!catModal.classList.contains('active')) return;
    
    const modalVideo = document.getElementById('modalMainMedia');
    if (modalVideo && modalVideo.tagName === 'VIDEO') {
        modalVideo.muted = true;
        modalVideo.pause();
    }
    catModal.classList.remove('active');
    document.body.style.overflow = '';
    
    // Clean up history state if it was pushed
    if (history.state?.modalOpen) {
        history.back();
    }
};

// ─── Utility Functions ───────────────────────────────────────────────────────
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}