import { getVideos, getCategories } from '../services/wpService.js';
import { extractVideoDetails } from '../services/extractorService.js';

export async function getVideoList(req, res) {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const perPage = parseInt(req.query.perPage || '18', 10);
    const category = req.query.category || '';
    const search = req.query.search || '';

    const data = await getVideos({ page, perPage, category, search });
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar video',
      error: err.message
    });
  }
}

export async function getVideoDetail(req, res) {
  try {
    const { url } = req.query;
    if (!url) {
      return res.status(400).json({ success: false, message: 'URL parameter is required' });
    }

    const detail = await extractVideoDetails(url);
    res.json({ success: true, data: detail });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengekstrak player video',
      error: err.message
    });
  }
}

export async function getCategoriesList(req, res) {
  try {
    const categories = await getCategories();
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil kategori',
      error: err.message
    });
  }
}
