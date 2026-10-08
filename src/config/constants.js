export const CONFIG = {
  PORT: process.env.PORT || process.env.SERVER_PORT || 3000,
  TARGET_BASE: 'https://tv.kimcilonly.de',
  WP_API: 'https://tv.kimcilonly.de/wp-json/wp/v2',
  XOR_KEY: 'G7#kP!2qZxV9mRwL',
  DEFAULT_HEADERS: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept-Language': 'en-US,en;q=0.9,id;q=0.8'
  }
};
