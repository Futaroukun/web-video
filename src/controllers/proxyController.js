import axios from 'axios';
import { CONFIG } from '../config/constants.js';

/**
 * Proxy and sanitize third-party video embeds:
 * 1. Blocks popup tabs (window.open)
 * 2. Blocks top-window hijacking (top.location / parent.location)
 * 3. Strips aggressive ad networks and popunders
 * 4. Neutralizes anti-sandbox redirects (/sandboxed, /blocked)
 * 5. Prevents external click redirects
 */
export async function proxyEmbed(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) {
      return res.status(400).send('URL target diperlukan');
    }

    const parsed = new URL(targetUrl);
    const origin = parsed.origin;

    const response = await axios.get(targetUrl, {
      headers: {
        ...CONFIG.DEFAULT_HEADERS,
        'Referer': CONFIG.TARGET_BASE
      },
      timeout: 8000,
      responseType: 'text'
    });

    let html = response.data;

    // 1. Inject base tag and security interceptor at top of <head>
    const securityShim = `
      <base href="${origin}/">
      <script>
        // Neutralize popups and redirects
        window.open = function() { return null; };
        window.alert = function() {};
        window.confirm = function() { return false; };

        try {
          Object.defineProperty(window, 'top', { get: function() { return window; }, set: function() {} });
          Object.defineProperty(window, 'parent', { get: function() { return window; }, set: function() {} });
        } catch(e) {}

        // Prevent external ad link clicks
        document.addEventListener('click', function(e) {
          var target = e.target;
          while (target && target !== document.documentElement) {
            if (target.tagName === 'A') {
              var dest = target.href || '';
              if (dest && !dest.startsWith(window.location.origin) && !dest.startsWith('javascript:')) {
                e.preventDefault();
                e.stopPropagation();
                return false;
              }
            }
            target = target.parentElement;
          }
        }, true);
      </script>
    `;

    if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${securityShim}`);
    } else if (html.includes('<html')) {
      html = html.replace(/<html[^>]*>/, `$&<head>${securityShim}</head>`);
    } else {
      html = `<head>${securityShim}</head>${html}`;
    }

    // 2. Neutralize anti-sandbox triggers & mirror redirects
    html = html.replace(/\/sandboxed[a-zA-Z0-9._?#=-]*/g, '#');
    html = html.replace(/\/blocked[a-zA-Z0-9._?#=-]*/g, '#');
    html = html.replace(/detectSandbox\(\)/g, '');
    html = html.replace(/function goMirror\(\)\s*\{[^}]+\}/g, 'function goMirror(){playHere();}');

    // 3. Strip aggressive ad network scripts
    html = html.replace(/<script[^>]+src=["'][^"']*(acscdn|excavate|llvpn|rapidfire|juicy|aarems|popunder|cdn4ads|ouo|shortku|onclick|banner|new100)[^"']*["'][^>]*><\/script>/gi, '');

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    res.status(500).send(`Gagal memuat embed: ${err.message}`);
  }
}
