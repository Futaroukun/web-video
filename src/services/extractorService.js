import axios from 'axios';
import * as cheerio from 'cheerio';
import { CONFIG } from '../config/constants.js';
import { decodeGuploadCfg, cleanText } from '../utils/cryptoDecoder.js';

const detailCache = new Map();
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes cache

/**
 * Extract streaming source from GUpload embed
 */
async function resolveGuploadStream(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        ...CONFIG.DEFAULT_HEADERS,
        'Referer': CONFIG.TARGET_BASE
      },
      timeout: 5000
    });

    const match = res.data.match(/_dp\('([^']+)'\)/);
    if (match) {
      const cfg = decodeGuploadCfg(match[1]);
      if (cfg && cfg.videoUrl) {
        return {
          type: 'hls',
          streamUrl: cfg.videoUrl,
          poster: cfg.posterUrl || null
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Extract direct HLS stream from DoodStream / Playmogo
 */
async function resolveDoodStream(embedUrl) {
  try {
    const filecode = embedUrl.split('/').filter(Boolean).pop();
    const origin = new URL(embedUrl).origin;
    const res = await axios.post(`${origin}/api/stream`, {
      filecode,
      device: 'web',
      codecs: ['h264']
    }, {
      headers: {
        'Referer': embedUrl,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 4500
    });
    if (res.data && res.data.streaming_url) {
      return {
        type: 'hls',
        streamUrl: res.data.streaming_url,
        poster: res.data.thumbnail || null
      };
    }
  } catch {}
  return null;
}

/**
 * Extract direct HLS stream from Playmate
 */
async function resolvePlaymateStream(embedUrl) {
  try {
    const filecode = embedUrl.split('/').filter(Boolean).pop();
    const res = await axios.post('https://playmate.to/api/s', {
      c: filecode,
      d: 'web'
    }, {
      headers: {
        'Referer': embedUrl,
        'Origin': 'https://playmate.to',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      },
      timeout: 4500
    });
    if (res.data && res.data.sx) {
      return {
        type: 'hls',
        streamUrl: res.data.sx,
        poster: res.data.ix || null
      };
    }
  } catch {}
  return null;
}

/**
 * Extract direct HLS stream from Vixeo
 */
async function resolveVixeoStream(embedUrl) {
  try {
    const res = await axios.get(embedUrl, {
      headers: {
        ...CONFIG.DEFAULT_HEADERS,
        'Referer': CONFIG.TARGET_BASE
      },
      timeout: 4500
    });
    const match = res.data.match(/data-config="([^"]+)"/);
    if (match) {
      const cfg = JSON.parse(Buffer.from(match[1], 'base64').toString('utf-8'));
      if (cfg && cfg.source) {
        const parts = cfg.source.split('|').reverse();
        const streamUrl = parts
          .map(p => Buffer.from(p, 'hex').toString('utf-8').split('').reverse().join(''))
          .join('');
        return {
          type: 'hls',
          streamUrl,
          poster: cfg.poster ? (cfg.poster.startsWith('http') ? cfg.poster : new URL(cfg.poster, embedUrl).href) : null
        };
      }
    }
  } catch {}
  return null;
}

/**
 * Parse single post page and extract all servers & rich metadata in PARALLEL
 */
export async function extractVideoDetails(postUrl) {
  const cached = detailCache.get(postUrl);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return cached.data;
  }

  // 1. Fetch main post HTML
  const { data: html } = await axios.get(postUrl, {
    headers: CONFIG.DEFAULT_HEADERS,
    timeout: 8000
  });

  const $ = cheerio.load(html);

  // Metadata
  const title = cleanText($('h1.entry-title').first().text() || $('title').text());
  const thumbnail = $('meta[property="og:image"]').attr('content') || $('.gmr-movie-data figure img').attr('src') || '';
  const synopsis = cleanText($('.entry-content.entry-content-single p').first().text());

  const genres = [];
  $('.gmr-moviedata a[rel="category tag"]').each((_, el) => {
    genres.push($(el).text().trim());
  });

  const cast = [];
  $('.gmr-moviedata span[itemprop="actors"] a').each((_, el) => {
    cast.push($(el).text().trim());
  });

  const director = $('.gmr-moviedata span[itemprop="director"] a').text().trim() || null;
  const year = $('.gmr-moviedata a[href*="/year/"]').text().trim() || null;
  const country = $('.gmr-moviedata span[itemprop="contentLocation"] a').text().trim() || null;

  // 2. Discover all server tabs
  const tabLinks = [];
  $('.muvipro-player-tabs li a').each((_, el) => {
    const href = $(el).attr('href');
    const label = $(el).text().trim() || `Server ${tabLinks.length + 1}`;
    if (href) {
      const fullUrl = href.startsWith('http') ? href : new URL(href, CONFIG.TARGET_BASE).href;
      tabLinks.push({ label, url: fullUrl });
    }
  });

  if (tabLinks.length === 0) {
    tabLinks.push({ label: 'Server 1', url: postUrl });
  }

  // 3. Fast Parallel Fetch of other server tabs & resolvers
  const serverPromises = tabLinks.map(async (tab, index) => {
    try {
      let pageHtml = html;
      if (tab.url !== postUrl) {
        const tabRes = await axios.get(tab.url, {
          headers: CONFIG.DEFAULT_HEADERS,
          timeout: 4500
        });
        pageHtml = tabRes.data;
      }

      const $tab = cheerio.load(pageHtml);
      const iframeSrc = $tab('.gmr-server-wrap iframe, .player-wrap iframe').first().attr('src');
      if (!iframeSrc) return null;

      const embedUrl = iframeSrc.startsWith('//') ? `https:${iframeSrc}` : iframeSrc;

      // 1. Direct HLS Check (GUpload)
      if (embedUrl.includes('gupload.site')) {
        const directHls = await resolveGuploadStream(embedUrl);
        if (directHls) {
          return {
            id: `server-${index + 1}`,
            name: `${tab.label} (Direct HD)`,
            type: 'hls',
            streamUrl: directHls.streamUrl,
            poster: directHls.poster || thumbnail,
            isDirect: true,
            provider: 'GUpload',
            recommended: true
          };
        }
      }

      // 2. Direct HLS Check (DoodStream / Playmogo)
      if (embedUrl.includes('dood') || embedUrl.includes('playmogo')) {
        const doodHls = await resolveDoodStream(embedUrl);
        if (doodHls) {
          return {
            id: `server-${index + 1}`,
            name: `${tab.label} (Direct Dood)`,
            type: 'hls',
            streamUrl: doodHls.streamUrl,
            poster: doodHls.poster || thumbnail,
            isDirect: true,
            provider: 'DoodStream',
            recommended: false
          };
        }
      }

      // 3. Direct HLS Check (Playmate)
      if (embedUrl.includes('playmate.to')) {
        const pmHls = await resolvePlaymateStream(embedUrl);
        if (pmHls) {
          return {
            id: `server-${index + 1}`,
            name: `${tab.label} (Direct Playmate)`,
            type: 'hls',
            streamUrl: pmHls.streamUrl,
            poster: pmHls.poster || thumbnail,
            isDirect: true,
            provider: 'Playmate',
            recommended: false
          };
        }
      }

      // 4. Direct HLS Check (Vixeo)
      if (embedUrl.includes('vixeo.io')) {
        const vixeoHls = await resolveVixeoStream(embedUrl);
        if (vixeoHls) {
          return {
            id: `server-${index + 1}`,
            name: `${tab.label} (Direct Vixeo)`,
            type: 'hls',
            streamUrl: vixeoHls.streamUrl,
            poster: vixeoHls.poster || thumbnail,
            isDirect: true,
            provider: 'Vixeo',
            recommended: false
          };
        }
      }

      // 5. External Providers Fallback (Sandboxed anti-redirect proxy)
      let providerName = 'External';
      if (embedUrl.includes('playmogo') || embedUrl.includes('dood')) providerName = 'DoodStream';
      else if (embedUrl.includes('bysejikuar')) providerName = 'Byse';
      else if (embedUrl.includes('playmate')) providerName = 'Playmate';
      else if (embedUrl.includes('vixeo')) providerName = 'Vixeo';

      return {
        id: `server-${index + 1}`,
        name: `${tab.label} (${providerName})`,
        type: 'embed',
        embedUrl,
        isDirect: false,
        provider: providerName,
        recommended: false
      };
    } catch {
      return null;
    }
  });

  const settledServers = await Promise.allSettled(serverPromises);
  const servers = settledServers
    .filter(s => s.status === 'fulfilled' && s.value !== null)
    .map(s => s.value);

  // Sort so direct HLS servers come first
  servers.sort((a, b) => {
    if (a.isDirect && !b.isDirect) return -1;
    if (!a.isDirect && b.isDirect) return 1;
    if (a.recommended && !b.recommended) return -1;
    if (!a.recommended && b.recommended) return 1;
    return 0;
  });

  const result = {
    title,
    thumbnail,
    synopsis,
    genres,
    cast,
    director,
    year,
    country,
    servers,
    totalServers: servers.length
  };

  detailCache.set(postUrl, { data: result, time: Date.now() });
  return result;
}
