import { Router } from 'express';
import {
  getVideoList,
  getVideoDetail,
  getCategoriesList
} from '../controllers/videoController.js';
import { proxyEmbed } from '../controllers/proxyController.js';
import { downloadVideo } from '../controllers/downloadController.js';

const router = Router();

// Routes
router.get('/videos', getVideoList);
router.get('/detail', getVideoDetail);
router.get('/categories', getCategoriesList);
router.get('/proxy/embed', proxyEmbed);
router.get('/download', downloadVideo);

export default router;
