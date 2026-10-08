import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from './config/constants.js';
import apiRoutes from './routes/apiRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// Static Files
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// API Routes
app.use('/api', apiRoutes);

// Watch Route
app.get('/watch', (req, res) => {
  res.sendFile(path.join(publicPath, 'watch.html'));
});

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

// Start Server
app.listen(CONFIG.PORT, '0.0.0.0', () => {
  console.log(`🚀 Stream Hub Server running on port ${CONFIG.PORT} (bind: 0.0.0.0)`);
});
