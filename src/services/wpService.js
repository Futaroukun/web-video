import axios from 'axios';
import { CONFIG } from '../config/constants.js';
import { cleanText } from '../utils/cryptoDecoder.js';

// Simple in-memory cache with TTL (5 minutes)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key) {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() - item.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

/**
 * Fetch video list with pagination, category filter, or search
 */
export async function getVideos({ page = 1, perPage = 18, category = '', search = '' } = {}) {
  const cacheKey = `videos_${page}_${perPage}_${category}_${search}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const params = {
    page,
    per_page: perPage,
    _fields: 'id,date,slug,link,title,excerpt,yoast_head_json,categories'
  };

  if (category) {
    params.categories = category;
  }
  if (search) {
    params.search = search;
  }

  const response = await axios.get(`${CONFIG.WP_API}/posts`, {
    params,
    headers: CONFIG.DEFAULT_HEADERS,
    timeout: 10000
  });

  const totalPosts = parseInt(response.headers['x-wp-total'] || '0', 10);
  const totalPages = parseInt(response.headers['x-wp-totalpages'] || '1', 10);

  const items = response.data.map(item => {
    const rawThumb = item.yoast_head_json?.og_image?.[0]?.url || null;
    return {
      id: item.id,
      title: cleanText(item.title?.rendered || 'Untitled'),
      slug: item.slug,
      link: item.link,
      date: item.date,
      excerpt: cleanText(item.excerpt?.rendered || ''),
      thumbnail: rawThumb,
      categories: item.categories || []
    };
  });

  const result = {
    page: Number(page),
    perPage: Number(perPage),
    totalPosts,
    totalPages,
    hasMore: page < totalPages,
    items
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Fetch list of categories
 */
export async function getCategories() {
  const cacheKey = 'categories_list';
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const response = await axios.get(`${CONFIG.WP_API}/categories`, {
    params: { per_page: 50, _fields: 'id,name,slug,count' },
    headers: CONFIG.DEFAULT_HEADERS,
    timeout: 10000
  });

  const categories = response.data
    .filter(cat => cat.count > 0 && cat.name.toLowerCase() !== 'uncategorized')
    .map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      count: cat.count
    }));

  setCache(cacheKey, categories);
  return categories;
}
