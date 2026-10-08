/**
 * Main Catalog Application Orchestrator
 */

import { fetchVideos, fetchCategories } from './api.js';
import { storage } from './storage.js';
import { ui } from './ui.js';

let state = {
  page: 1,
  perPage: 18,
  category: '',
  categoryName: '',
  search: '',
  totalPages: 1
};

// DOM References
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const sectionTitle = document.getElementById('sectionTitle');
const filterIndicator = document.getElementById('filterIndicator');
const filterLabel = document.getElementById('filterLabel');
const resetFilterBtn = document.getElementById('resetFilterBtn');
const closeDrawerBtn = document.getElementById('closeDrawerBtn');
const navBookmarksBtn = document.getElementById('navBookmarksBtn');
const navHistoryBtn = document.getElementById('navHistoryBtn');
const brandBtn = document.getElementById('brandBtn');

// Mobile Nav
const mobHomeBtn = document.getElementById('mobHomeBtn');
const mobSearchBtn = document.getElementById('mobSearchBtn');
const mobFavBtn = document.getElementById('mobFavBtn');
const mobHistBtn = document.getElementById('mobHistBtn');

/**
 * Synchronize current state to browser URL search params
 */
function syncUrl(push = true) {
  const params = new URLSearchParams();
  if (state.page > 1) params.set('page', state.page);
  if (state.category) params.set('cat', state.category);
  if (state.search) params.set('q', state.search);

  const query = params.toString();
  const newUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;

  if (push) {
    window.history.pushState({ ...state }, '', newUrl);
  } else {
    window.history.replaceState({ ...state }, '', newUrl);
  }

  sessionStorage.setItem('streamhub_last_page', String(state.page));
  sessionStorage.setItem('streamhub_last_catalog', window.location.href);
}

/**
 * Parse URL params on page load or browser Back/Forward
 */
function parseUrlParams() {
  const params = new URLSearchParams(window.location.search);
  
  // If no params in URL, check if returning from watch page in this session
  if (!params.has('page') && !params.has('cat') && !params.has('q')) {
    const savedPage = sessionStorage.getItem('streamhub_last_page');
    if (savedPage && parseInt(savedPage, 10) > 1) {
      state.page = parseInt(savedPage, 10);
      syncUrl(false);
    } else {
      state.page = 1;
    }
  } else {
    state.page = parseInt(params.get('page') || '1', 10);
    if (isNaN(state.page) || state.page < 1) state.page = 1;
    sessionStorage.setItem('streamhub_last_page', String(state.page));
  }

  state.category = params.get('cat') || '';
  state.search = params.get('q') || '';

  if (searchInput) {
    if (state.search) {
      searchInput.value = state.search;
      if (clearSearchBtn) clearSearchBtn.style.display = 'block';
    } else {
      searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.style.display = 'none';
    }
  }

  sessionStorage.setItem('streamhub_last_catalog', window.location.href);
  updateFilterStatus();
}

async function loadVideos(updateHistory = true) {
  ui.renderSkeletons(state.perPage);

  try {
    const data = await fetchVideos({
      page: state.page,
      perPage: state.perPage,
      category: state.category,
      search: state.search
    });

    state.totalPages = data.totalPages || 1;
    if (ui.videoCountBadge) {
      ui.videoCountBadge.textContent = `${data.totalPosts || data.items.length} Video`;
    }
    
    // Render video cards
    ui.renderVideos(data.items);

    // Render full numbered pagination (1, 2, 3... Next, End)
    ui.renderPagination(state.page, state.totalPages, handlePageClick);

    if (updateHistory) {
      syncUrl(true);
    }
  } catch (err) {
    console.error('Error loading videos:', err);
    ui.showToast('Gagal memuat video: ' + err.message);
    if (ui.videoGrid) {
      ui.videoGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 14px; color: var(--text-muted);">
          <p>Gagal memuat data. Silakan coba muat ulang.</p>
          <button id="retryBtn" class="action-btn" style="margin-top: 10px;">Muat Ulang</button>
        </div>
      `;
      document.getElementById('retryBtn')?.addEventListener('click', () => loadVideos(false));
    }
  }
}

/**
 * Handle direct numeric or navigation page click
 */
function handlePageClick(targetPage) {
  if (targetPage < 1 || targetPage > state.totalPages || targetPage === state.page) return;
  state.page = targetPage;
  loadVideos(true);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Browser Back / Forward Button Handling
window.addEventListener('popstate', () => {
  parseUrlParams();
  loadVideos(false);
});

// Mobile bfcache restoration
window.addEventListener('pageshow', (event) => {
  if (event.persisted) {
    parseUrlParams();
    loadVideos(false);
  }
});

// Search debounce (300ms)
let searchTimer = null;
searchInput?.addEventListener('input', (e) => {
  const query = e.target.value.trim();
  if (clearSearchBtn) clearSearchBtn.style.display = query ? 'block' : 'none';

  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    state.search = query;
    state.page = 1;
    updateFilterStatus();
    loadVideos(true);
  }, 300);
});

clearSearchBtn?.addEventListener('click', () => {
  if (searchInput) searchInput.value = '';
  clearSearchBtn.style.display = 'none';
  state.search = '';
  state.page = 1;
  updateFilterStatus();
  loadVideos(true);
});

function updateFilterStatus() {
  if (sectionTitle) {
    if (state.search) {
      sectionTitle.textContent = `Pencarian: "${state.search}"`;
    } else if (state.category) {
      sectionTitle.textContent = `Kategori: ${state.categoryName || 'Filter Aktif'}`;
    } else {
      sectionTitle.textContent = 'Video Terbaru';
    }
  }

  if (filterIndicator) {
    if (state.search || state.category) {
      filterIndicator.style.display = 'flex';
      if (filterLabel) {
        filterLabel.textContent = state.search ? `Pencarian: ${state.search}` : `Kategori: ${state.categoryName || state.category}`;
      }
    } else {
      filterIndicator.style.display = 'none';
    }
  }
}

resetFilterBtn?.addEventListener('click', () => {
  sessionStorage.removeItem('streamhub_last_page');
  sessionStorage.setItem('streamhub_last_catalog', '/');
  state.category = '';
  state.categoryName = '';
  state.search = '';
  state.page = 1;
  if (searchInput) searchInput.value = '';
  if (clearSearchBtn) clearSearchBtn.style.display = 'none';
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  document.querySelector('.chip[data-cat=""]')?.classList.add('active');
  updateFilterStatus();
  loadVideos(true);
});

// Category Click
function handleCategorySelect(catId, catName) {
  state.category = catId;
  state.categoryName = catName;
  state.page = 1;
  updateFilterStatus();
  loadVideos(true);
}

// Drawer Handlers
navBookmarksBtn?.addEventListener('click', () => {
  const favs = storage.getFavorites();
  ui.openDrawer('Daftar Favorit', favs, null, (link) => {
    storage.removeFavorite(link);
    ui.showToast('Dihapus dari Favorit');
  });
});

navHistoryBtn?.addEventListener('click', () => {
  const hist = storage.getHistory();
  ui.openDrawer('Riwayat Tontonan', hist, null, (link) => {
    storage.removeHistory(link);
    ui.showToast('Dihapus dari Riwayat');
  });
});

closeDrawerBtn?.addEventListener('click', () => ui.closeDrawer());
ui.drawerModal?.addEventListener('click', (e) => {
  if (e.target === ui.drawerModal) ui.closeDrawer();
});

brandBtn?.addEventListener('click', (e) => {
  e.preventDefault();
  resetFilterBtn?.click();
});

// Mobile Bottom Nav
mobHomeBtn?.addEventListener('click', () => {
  resetFilterBtn?.click();
  setActiveMob(mobHomeBtn);
});

mobSearchBtn?.addEventListener('click', () => {
  searchInput?.focus();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  setActiveMob(mobSearchBtn);
});

mobFavBtn?.addEventListener('click', () => {
  navBookmarksBtn?.click();
  setActiveMob(mobFavBtn);
});

mobHistBtn?.addEventListener('click', () => {
  navHistoryBtn?.click();
  setActiveMob(mobHistBtn);
});

function setActiveMob(activeBtn) {
  [mobHomeBtn, mobSearchBtn, mobFavBtn, mobHistBtn].forEach(b => b?.classList.remove('active'));
  activeBtn?.classList.add('active');
}

// Category "Semua" chip
document.querySelector('.chip[data-cat=""]')?.addEventListener('click', () => {
  handleCategorySelect('', '');
});

// Escape key closes drawer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    ui.closeDrawer();
  }
});

// Boot Sequence
async function init() {
  parseUrlParams();

  // 1. Load videos FIRST so cards appear immediately
  loadVideos(false);

  // 2. Fetch categories concurrently
  try {
    const cats = await fetchCategories();
    ui.renderCategories(cats, handleCategorySelect);

    if (state.category) {
      const activeChip = document.querySelector(`.chip[data-cat="${state.category}"]`);
      if (activeChip) {
        document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        activeChip.classList.add('active');
        state.categoryName = activeChip.childNodes[0]?.textContent?.trim() || activeChip.textContent.trim();
        updateFilterStatus();
      }
    }
  } catch (err) {
    console.error('Error loading categories:', err);
  }
}

// Ensure DOM is fully parsed
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
