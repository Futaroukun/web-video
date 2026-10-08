/**
 * UI Renderer and Interaction Module (Bersih, Kompak, Tanpa Emoji)
 */

export const ui = {
  // Elements
  videoGrid: document.getElementById('videoGrid'),
  categoriesContainer: document.getElementById('categoriesContainer'),
  drawerModal: document.getElementById('drawerModal'),
  drawerTitle: document.getElementById('drawerTitle'),
  drawerBody: document.getElementById('drawerBody'),
  toastContainer: document.getElementById('toastContainer'),
  videoCountBadge: document.getElementById('videoCountBadge'),
  paginationContainer: document.getElementById('paginationContainer'),

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = '0.2s ease';
      setTimeout(() => toast.remove(), 200);
    }, 2000);
  },

  renderSkeletons(count = 12) {
    this.videoGrid.innerHTML = '';
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.className = 'skeleton-card';
      el.innerHTML = '<div class="skeleton-shimmer"></div>';
      this.videoGrid.appendChild(el);
    }
  },

  renderVideos(items) {
    this.videoGrid.innerHTML = '';
    if (!items || items.length === 0) {
      this.videoGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px 14px; color: var(--text-muted);">
          <p>Tidak ada video yang ditemukan.</p>
        </div>
      `;
      return;
    }

    const currentParams = new URLSearchParams(window.location.search);
    const pageSuffix = currentParams.toString() ? `&${currentParams.toString()}` : '';

    items.forEach(item => {
      const card = document.createElement('a');
      card.className = 'video-card';
      card.href = `/watch?url=${encodeURIComponent(item.link)}${pageSuffix}`;
      card.target = '_blank';
      card.rel = 'noopener';
      
      const thumb = item.thumbnail || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200" fill="%23161b22"><rect width="300" height="200"/></svg>';
      const formattedDate = item.date ? new Date(item.date).toLocaleDateString('id-ID', { month: 'short', day: 'numeric', year: 'numeric' }) : '';

      card.innerHTML = `
        <div class="card-thumbnail-wrap">
          <img src="${thumb}" alt="${item.title}" loading="lazy" decoding="async">
          <div class="card-badge-direct">Direct HD</div>
          <div class="play-badge">
            <div class="play-badge-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>
            </div>
          </div>
        </div>
        <div class="card-body">
          <h3 class="card-title" title="${item.title}">${item.title}</h3>
          <div class="card-meta">
            <span>Buka Tab Baru</span>
            <span>${formattedDate}</span>
          </div>
        </div>
      `;

      this.videoGrid.appendChild(card);
    });
  },

  renderPagination(currentPage, totalPages, onPageClick) {
    if (!this.paginationContainer) return;
    this.paginationContainer.innerHTML = '';
    if (totalPages <= 1) return;

    const createBtn = (text, pageNum, isActive = false, isDisabled = false, isNavText = false) => {
      const btn = document.createElement('button');
      btn.className = `page-btn ${isActive ? 'active' : ''} ${isNavText ? 'nav-text' : ''}`;
      btn.textContent = text;
      btn.disabled = isDisabled;
      if (!isDisabled && !isActive) {
        btn.addEventListener('click', () => onPageClick(pageNum));
      }
      return btn;
    };

    const createEllipsis = () => {
      const span = document.createElement('span');
      span.className = 'page-ellipsis';
      span.textContent = '...';
      return span;
    };

    // First button
    this.paginationContainer.appendChild(
      createBtn('« Awal', 1, false, currentPage === 1, true)
    );

    // Prev button
    this.paginationContainer.appendChild(
      createBtn('‹ Prev', currentPage - 1, false, currentPage === 1, true)
    );

    // Dynamic numeric pages
    const pages = [];
    const delta = window.innerWidth <= 640 ? 1 : 2;
    const left = Math.max(1, currentPage - delta);
    const right = Math.min(totalPages, currentPage + delta);

    if (left > 1) {
      pages.push(1);
      if (left > 2) pages.push('...');
    }

    for (let i = left; i <= right; i++) {
      pages.push(i);
    }

    if (right < totalPages) {
      if (right < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    pages.forEach(p => {
      if (p === '...') {
        this.paginationContainer.appendChild(createEllipsis());
      } else {
        this.paginationContainer.appendChild(
          createBtn(String(p), p, p === currentPage, false, false)
        );
      }
    });

    // Next button
    this.paginationContainer.appendChild(
      createBtn('Next ›', currentPage + 1, false, currentPage === totalPages, true)
    );

    // End button
    this.paginationContainer.appendChild(
      createBtn('Akhir »', totalPages, false, currentPage === totalPages, true)
    );
  },

  renderCategories(categories, onSelectCategory) {
    const allBtn = this.categoriesContainer.querySelector('[data-cat=""]');
    this.categoriesContainer.innerHTML = '';
    if (allBtn) this.categoriesContainer.appendChild(allBtn);

    categories.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.dataset.cat = cat.id;
      btn.innerHTML = `${cat.name} <span class="chip-count">(${cat.count})</span>`;
      btn.addEventListener('click', () => {
        this.categoriesContainer.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
        onSelectCategory(cat.id, cat.name);
      });
      this.categoriesContainer.appendChild(btn);
    });
  },

  openDrawer(title, items, onItemClick, onRemoveItem) {
    this.drawerTitle.textContent = title;
    this.drawerBody.innerHTML = '';

    if (!items || items.length === 0) {
      this.drawerBody.innerHTML = `
        <div class="empty-state">
          <p>Belum ada data di daftar ini.</p>
        </div>
      `;
    } else {
      items.forEach(item => {
        const div = document.createElement('div');
        div.className = 'drawer-item';
        div.innerHTML = `
          <img class="drawer-thumb" src="${item.thumbnail || ''}" onerror="this.style.display='none'">
          <div class="drawer-info">
            <span class="drawer-title">${item.title}</span>
            <span class="drawer-sub">Buka video ›</span>
          </div>
          <button class="drawer-delete-btn" title="Hapus">✕</button>
        `;

        div.querySelector('.drawer-info').addEventListener('click', () => {
          this.closeDrawer();
          const currentParams = new URLSearchParams(window.location.search);
          const pageSuffix = currentParams.toString() ? `&${currentParams.toString()}` : '';
          window.open(`/watch?url=${encodeURIComponent(item.link)}${pageSuffix}`, '_blank');
        });

        div.querySelector('.drawer-delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          onRemoveItem(item.link);
          div.remove();
          if (this.drawerBody.children.length === 0) {
            this.openDrawer(title, [], onItemClick, onRemoveItem);
          }
        });

        this.drawerBody.appendChild(div);
      });
    }

    this.drawerModal.classList.add('active');
  },

  closeDrawer() {
    this.drawerModal.classList.remove('active');
  }
};
