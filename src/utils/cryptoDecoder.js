import { CONFIG } from '../config/constants.js';

/**
 * Decode XOR-encrypted base64 string from GUpload player
 * @param {string} payload - format: 'hash~base64str'
 * @returns {object|null}
 */
export function decodeGuploadCfg(payload) {
  try {
    const parts = payload.split('~');
    if (parts.length < 2) return null;
    const rawBinary = Buffer.from(parts[1], 'base64').toString('binary');
    let decoded = '';
    const key = CONFIG.XOR_KEY;

    for (let i = 0; i < rawBinary.length; i++) {
      decoded += String.fromCharCode(rawBinary.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }

    return JSON.parse(decoded);
  } catch (err) {
    return null;
  }
}

/**
 * Sanitize plain HTML text
 * @param {string} html
 * @returns {string}
 */
export function cleanText(html = '') {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&#8211;/g, '-')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .trim();
}
