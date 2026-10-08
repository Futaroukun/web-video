/**
 * Dedicated Watch Page Orchestrator (Tab Baru - Bersih & Tanpa Emoji)
 */

import { fetchVideoDetail } from './api.js';
import { storage } from './storage.js';
import { playerManager } from './player.js';

const urlParams = new URLSearchParams(window.location.search);
const postUrl = urlParams.get('url');

const titleEl = document.getElementById('watchVideoTitle');
const synopsisEl = document.getElementById('modalSynopsis');
const castEl = document.getElementById('modalCast');
const directorEl = document.getElementById('modalDirector');
const originEl = document.getElementById('modalOrigin');
const genresBox = document.getElementById('modalGenres');
const modalFavBtn = document.getElementById('modalFavBtn');
const favBtnLabel = document.getElementById('favBtnLabel');
const copyStreamBtn = document.getElementById('copyStreamBtn');
const closeTabBtn = document.getElementById('closeTabBtn');
const watchBackBtn = document.getElementById('watchBackBtn');
const watchBrandBtn = document.getElementById('watchBrandBtn');
const downloadVideoBtn = document.getElementById('downloadVideoBtn');
const downloadBtnText = document.getElementById('downloadBtnText');
const toastContainer = document.getElementById('toastContainer');

let currentVideo = null;

function showToast(message) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = '0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 2000);
}

function updateFavoriteButtonState() {
  if (!currentVideo) return;
  const isFav = storage.isFavorite(currentVideo.link);
  if (isFav) {
    favBtnLabel.textContent = 'Tersimpan';
    modalFavBtn.style.borderColor = 'var(--warning)';
  } else {
    favBtnLabel.textContent = 'Favorit';
    modalFavBtn.style.borderColor = 'var(--border-color)';
  }
}

async function initWatchPage() {
  playerManager.init();

  if (!postUrl) {
    titleEl.textContent = 'Error: Parameter URL tidak ditemukan';
    playerManager.showError('URL video tidak valid');
    return;
  }

  playerManager.showLoader(true);

  try {
    const detail = await fetchVideoDetail(postUrl);
    
    currentVideo = {
      title: detail.title,
      link: postUrl,
      thumbnail: detail.thumbnail
    };

    document.title = `${detail.title} • StreamHub`;
    titleEl.textContent = detail.title;
    synopsisEl.textContent = detail.synopsis || '-';
    castEl.textContent = detail.cast?.length ? detail.cast.join(', ') : '-';
    directorEl.textContent = detail.director || '-';
    originEl.textContent = [detail.year, detail.country].filter(Boolean).join(' • ') || '-';

    genresBox.innerHTML = '';
    (detail.genres || []).forEach(genre => {
      const tag = document.createElement('span');
      tag.className = 'meta-tag';
      tag.textContent = genre;
      genresBox.appendChild(tag);
    });

    updateFavoriteButtonState();

    // Load servers (default to Server 1 Direct HD)
    playerManager.loadServers(detail.servers);

    // Configure direct download button
    if (downloadVideoBtn) {
      const downloadEndpoint = `/api/download?url=${encodeURIComponent(postUrl)}&title=${encodeURIComponent(detail.title)}`;
      downloadVideoBtn.href = downloadEndpoint;
      downloadVideoBtn.setAttribute('download', `${detail.title}.mp4`);
      downloadVideoBtn.onclick = () => {
        showToast('Memulai unduhan langsung dari server...');
      };
    }

    // Save to Watch History
    storage.addHistory(currentVideo);
  } catch (err) {
    playerManager.showError('Gagal memuat player video: ' + err.message);
    showToast('Gagal memuat player: ' + err.message);
  }
}

modalFavBtn.addEventListener('click', () => {
  if (!currentVideo) return;
  const added = storage.toggleFavorite(currentVideo);
  updateFavoriteButtonState();
  showToast(added ? 'Ditambahkan ke Favorit' : 'Dihapus dari Favorit');
});

copyStreamBtn.addEventListener('click', () => {
  const url = playerManager.getCurrentStreamUrl();
  if (url) {
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link stream berhasil disalin');
    }).catch(() => {
      showToast('Gagal menyalin link');
    });
  } else {
    showToast('Tidak ada stream aktif');
  }
});

// Determine return URL preserving page and filters
const returnParams = new URLSearchParams();
const fromPage = urlParams.get('page');
const fromCat = urlParams.get('cat');
const fromQ = urlParams.get('q');

if (fromPage && fromPage !== '1') returnParams.set('page', fromPage);
if (fromCat) returnParams.set('cat', fromCat);
if (fromQ) returnParams.set('q', fromQ);

const returnQueryString = returnParams.toString();
const fallbackCatalog = sessionStorage.getItem('streamhub_last_catalog');
const returnUrl = returnQueryString ? `/?${returnQueryString}` : (fallbackCatalog || '/');

if (watchBackBtn) {
  watchBackBtn.href = returnUrl;
  watchBackBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.history.length > 1 && document.referrer && document.referrer.includes(window.location.host)) {
      window.history.back();
    } else {
      window.location.href = returnUrl;
    }
  });
}

if (watchBrandBtn) {
  watchBrandBtn.href = returnUrl;
}

if (closeTabBtn) {
  closeTabBtn.addEventListener('click', () => {
    window.close();
    window.location.href = returnUrl;
  });
}

initWatchPage();
