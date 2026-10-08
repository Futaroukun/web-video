/**
 * API client module for StreamHub
 */

export async function fetchVideos({ page = 1, perPage = 18, category = '', search = '' } = {}) {
  const params = new URLSearchParams({
    page: String(page),
    perPage: String(perPage)
  });

  if (category) params.append('category', category);
  if (search) params.append('search', search);

  const res = await fetch(`/api/videos?${params.toString()}`);
  if (!res.ok) throw new Error('Gagal memuat daftar video');
  const json = await res.json();
  return json.data;
}

export async function fetchVideoDetail(postUrl) {
  const params = new URLSearchParams({ url: postUrl });
  const res = await fetch(`/api/detail?${params.toString()}`);
  if (!res.ok) throw new Error('Gagal mengekstrak player');
  const json = await res.json();
  return json.data;
}

export async function fetchCategories() {
  const res = await fetch('/api/categories');
  if (!res.ok) throw new Error('Gagal memuat kategori');
  const json = await res.json();
  return json.data;
}
