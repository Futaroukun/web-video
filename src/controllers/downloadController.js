import { spawn } from 'child_process';
import axios from 'axios';
import { extractVideoDetails } from '../services/extractorService.js';
import { CONFIG } from '../config/constants.js';

function getRefererForUrl(url) {
  if (url.includes('gupload.site')) return 'https://gupload.site/';
  if (url.includes('97bf1.com') || url.includes('dood')) return 'https://doodstream.com/';
  if (url.includes('plauymito.live') || url.includes('playmate.to')) return 'https://playmate.to/';
  if (url.includes('vidsonic.net') || url.includes('vixeo.io')) return 'https://vixeo.io/';
  return CONFIG.TARGET_BASE;
}

/**
 * Direct video downloader that converts HLS stream to fragmented MP4 on the fly.
 */
export async function downloadVideo(req, res) {
  let isAborted = false;
  let ffmpeg = null;

  req.on('close', () => {
    isAborted = true;
    if (ffmpeg) {
      try {
        if (ffmpeg.stdin && !ffmpeg.stdin.destroyed) ffmpeg.stdin.destroy();
        if (ffmpeg.stdout && !ffmpeg.stdout.destroyed) ffmpeg.stdout.destroy();
        ffmpeg.kill('SIGKILL');
      } catch {}
    }
  });

  try {
    const { url, title } = req.query;
    if (!url) {
      return res.status(400).send('Parameter URL diperlukan.');
    }

    let streamUrl = url;
    let videoTitle = title || '';

    // If a post URL was passed, resolve video servers
    if (!url.includes('.m3u8') && !url.includes('.txt')) {
      const details = await extractVideoDetails(url);
      if (!details || !details.servers || details.servers.length === 0) {
        return res.status(404).send('Tidak ada server video yang ditemukan untuk post ini.');
      }

      // Find first direct HLS server
      const directServer = details.servers.find(s => s.type === 'hls' && s.streamUrl) || details.servers[0];
      if (!directServer || !directServer.streamUrl) {
        return res.status(400).send('Server video ini tidak mendukung direct download.');
      }

      streamUrl = directServer.streamUrl;
      if (!videoTitle) videoTitle = details.title;
    }

    const safeTitle = (videoTitle || 'video')
      .replace(/[\/\\?%*:|"<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 90) || 'video';

    const filename = `${safeTitle}.mp4`;
    const referer = getRefererForUrl(streamUrl);

    // Fetch M3U8 Playlist
    const m3u8Res = await axios.get(streamUrl, {
      headers: {
        ...CONFIG.DEFAULT_HEADERS,
        'Referer': referer
      },
      timeout: 8000
    });

    let m3u8Content = m3u8Res.data;
    let currentBaseUrl = streamUrl.substring(0, streamUrl.lastIndexOf('/') + 1);

    // If master playlist with variants, pick first/highest stream
    if (m3u8Content.includes('#EXT-X-STREAM-INF')) {
      const lines = m3u8Content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('#EXT-X-STREAM-INF')) {
          for (let j = i + 1; j < lines.length; j++) {
            const nextLine = lines[j].trim();
            if (nextLine && !nextLine.startsWith('#')) {
              const variantUrl = nextLine.startsWith('http') ? nextLine : new URL(nextLine, currentBaseUrl).href;
              const variantRes = await axios.get(variantUrl, {
                headers: {
                  ...CONFIG.DEFAULT_HEADERS,
                  'Referer': referer
                },
                timeout: 8000
              });
              m3u8Content = variantRes.data;
              currentBaseUrl = variantUrl.substring(0, variantUrl.lastIndexOf('/') + 1);
              break;
            }
          }
          break;
        }
      }
    }

    // Extract segments
    const segments = m3u8Content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .map(seg => (seg.startsWith('http') ? seg : new URL(seg, currentBaseUrl).href));

    if (segments.length === 0) {
      return res.status(500).send('Playlist stream kosong.');
    }

    // Response headers for browser download
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.setHeader('Cache-Control', 'no-cache');

    // Spawn FFmpeg to convert TS segments into streamed MP4
    ffmpeg = spawn('ffmpeg', [
      '-y',
      '-f', 'mpegts',
      '-i', 'pipe:0',
      '-c', 'copy',
      '-bsf:a', 'aac_adtstoasc',
      '-movflags', 'frag_keyframe+empty_moov',
      '-f', 'mp4',
      'pipe:1'
    ], { stdio: ['pipe', 'pipe', 'pipe'] });

    // Prevent unhandled errors when client or pipe closes early
    ffmpeg.stdin.on('error', () => {});
    ffmpeg.stdout.on('error', () => {});
    res.on('error', () => {});

    ffmpeg.stdout.pipe(res);
    ffmpeg.stderr.on('data', () => {}); // swallow logs

    ffmpeg.on('error', (err) => {
      if (!res.headersSent) {
        res.status(500).send(`FFmpeg error: ${err.message}`);
      }
    });

    // Download and feed segments sequentially to FFmpeg
    const CONCURRENCY = 3;
    let segIndex = 0;
    const bufferMap = new Map();

    async function downloadWorker() {
      while (segIndex < segments.length && !isAborted) {
        const myIndex = segIndex++;
        const targetUrl = segments[myIndex];
        try {
          const segRes = await axios.get(targetUrl, {
            headers: {
              ...CONFIG.DEFAULT_HEADERS,
              'Referer': referer
            },
            responseType: 'arraybuffer',
            timeout: 12000
          });
          bufferMap.set(myIndex, Buffer.from(segRes.data));
        } catch {
          bufferMap.set(myIndex, Buffer.alloc(0));
        }
      }
    }

    // Start workers
    const workers = [];
    for (let w = 0; w < Math.min(CONCURRENCY, segments.length); w++) {
      workers.push(downloadWorker());
    }

    // Pipe in exact order to ffmpeg stdin
    let writeIndex = 0;
    while (writeIndex < segments.length && !isAborted) {
      if (!ffmpeg || !ffmpeg.stdin || ffmpeg.stdin.destroyed || !ffmpeg.stdin.writable) {
        break;
      }
      if (bufferMap.has(writeIndex)) {
        const buf = bufferMap.get(writeIndex);
        bufferMap.delete(writeIndex);
        if (buf.length > 0 && ffmpeg.stdin.writable) {
          try {
            const ok = ffmpeg.stdin.write(buf);
            if (!ok && !isAborted) {
              await new Promise(resolve => ffmpeg.stdin.once('drain', resolve));
            }
          } catch {
            break;
          }
        }
        writeIndex++;
      } else {
        await new Promise(resolve => setTimeout(resolve, 30));
      }
    }

    await Promise.all(workers);

    if (ffmpeg && ffmpeg.stdin && ffmpeg.stdin.writable && !ffmpeg.stdin.destroyed) {
      try { ffmpeg.stdin.end(); } catch {}
    }
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).send(`Gagal mendownload video: ${err.message}`);
    }
  }
}
