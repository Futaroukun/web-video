/**
 * Video Player Engine (HLS Direct & Sandboxed Embeds)
 */

let hlsInstance = null;
let currentServers = [];
let activeServerIndex = 0;

export const playerManager = {
  init() {
    this.videoEl = document.getElementById('hlsVideoPlayer');
    this.iframeEl = document.getElementById('sandboxIframe');
    this.loaderEl = document.getElementById('playerLoader');
    this.serverListEl = document.getElementById('serverList');
    this.statusEl = document.getElementById('streamStatusText');
    this.sandboxAlertEl = document.getElementById('sandboxAlert');
    this.watchModeLabel = document.getElementById('watchModeLabel');
  },

  destroy() {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    if (this.videoEl) {
      this.videoEl.pause();
      this.videoEl.removeAttribute('src');
      this.videoEl.load();
      this.videoEl.style.display = 'none';
    }
    if (this.iframeEl) {
      this.iframeEl.removeAttribute('src');
      this.iframeEl.style.display = 'none';
    }
    if (this.sandboxAlertEl) {
      this.sandboxAlertEl.style.display = 'none';
    }
    currentServers = [];
    activeServerIndex = 0;
  },

  loadServers(servers = []) {
    currentServers = servers;
    this.renderServerButtons();

    if (servers.length > 0) {
      // Find recommended server (Direct HLS), default to first server
      const defaultIndex = servers.findIndex(s => s.isDirect);
      this.switchServer(defaultIndex >= 0 ? defaultIndex : 0);
    } else {
      this.showError('Tidak ada server video yang tersedia untuk postingan ini.');
    }
  },

  renderServerButtons() {
    this.serverListEl.innerHTML = '';
    currentServers.forEach((server, index) => {
      const btn = document.createElement('button');
      btn.className = `server-btn ${index === activeServerIndex ? 'active' : ''}`;
      btn.textContent = server.name;
      btn.addEventListener('click', () => this.switchServer(index));
      this.serverListEl.appendChild(btn);
    });
  },

  switchServer(index) {
    if (index < 0 || index >= currentServers.length) return;
    activeServerIndex = index;
    this.renderServerButtons();

    const server = currentServers[index];
    this.showLoader(true);

    if (server.type === 'hls' && server.streamUrl) {
      if (this.sandboxAlertEl) this.sandboxAlertEl.style.display = 'none';
      if (this.watchModeLabel) this.watchModeLabel.textContent = 'Direct Stream';
      this.playDirectHls(server.streamUrl, server.poster);
    } else if (server.embedUrl) {
      if (this.sandboxAlertEl) this.sandboxAlertEl.style.display = 'block';
      if (this.watchModeLabel) this.watchModeLabel.textContent = `Server Luar (${server.provider})`;
      this.playSandboxedEmbed(server.embedUrl);
    }
  },

  playDirectHls(streamUrl, poster) {
    // Hide iframe, show video element
    this.iframeEl.style.display = 'none';
    this.iframeEl.removeAttribute('src');
    this.videoEl.style.display = 'block';

    if (poster) {
      this.videoEl.setAttribute('poster', poster);
    }

    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }

    this.statusEl.textContent = 'Direct HLS';

    if (window.Hls && window.Hls.isSupported()) {
      hlsInstance = new window.Hls({
        debug: false,
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90
      });

      hlsInstance.loadSource(streamUrl);
      hlsInstance.attachMedia(this.videoEl);

      hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, () => {
        this.showLoader(false);
        this.videoEl.play().catch(() => {});
      });

      hlsInstance.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              hlsInstance.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              hlsInstance.recoverMediaError();
              break;
            default:
              this.showError('Gagal memuat HLS stream. Beralih ke server alternatif...');
              break;
          }
        }
      });
    } else if (this.videoEl.canPlayType('application/vnd.apple.mpegurl')) {
      this.videoEl.src = streamUrl;
      this.videoEl.addEventListener('loadedmetadata', () => {
        this.showLoader(false);
        this.videoEl.play().catch(() => {});
      }, { once: true });
    } else {
      this.showError('Browser tidak mendukung format pemutaran HLS.');
    }
  },

  playSandboxedEmbed(embedUrl) {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    this.videoEl.pause();
    this.videoEl.style.display = 'none';

    // Load via safe anti-redirect proxy
    this.iframeEl.style.display = 'block';
    this.iframeEl.src = `/api/proxy/embed?url=${encodeURIComponent(embedUrl)}`;
    this.statusEl.textContent = 'Server Luar (Anti-Redirect Aktif)';

    this.iframeEl.onload = () => {
      this.showLoader(false);
    };
  },

  showLoader(show) {
    this.loaderEl.style.display = show ? 'flex' : 'none';
  },

  showError(msg) {
    this.showLoader(false);
    this.statusEl.textContent = msg;
  },

  getCurrentStreamUrl() {
    const s = currentServers[activeServerIndex];
    return s?.streamUrl || s?.embedUrl || '';
  }
};
