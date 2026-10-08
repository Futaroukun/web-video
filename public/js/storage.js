/**
 * LocalStorage manager for Favorites and Watch History
 */

const FAVS_KEY = 'streamhub_favorites_v1';
const HIST_KEY = 'streamhub_history_v1';

export const storage = {
  // Favorites
  getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVS_KEY) || '[]');
    } catch {
      return [];
    }
  },

  isFavorite(link) {
    const list = this.getFavorites();
    return list.some(item => item.link === link);
  },

  toggleFavorite(item) {
    let list = this.getFavorites();
    const index = list.findIndex(i => i.link === item.link);
    let added = false;

    if (index >= 0) {
      list.splice(index, 1);
    } else {
      list.unshift({
        title: item.title,
        link: item.link,
        thumbnail: item.thumbnail,
        addedAt: Date.now()
      });
      added = true;
    }

    localStorage.setItem(FAVS_KEY, JSON.stringify(list));
    return added;
  },

  removeFavorite(link) {
    let list = this.getFavorites().filter(i => i.link !== link);
    localStorage.setItem(FAVS_KEY, JSON.stringify(list));
  },

  // Watch History
  getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
    } catch {
      return [];
    }
  },

  addHistory(item) {
    let list = this.getHistory().filter(i => i.link !== item.link);
    list.unshift({
      title: item.title,
      link: item.link,
      thumbnail: item.thumbnail,
      viewedAt: Date.now()
    });
    // Limit to 40 items
    list = list.slice(0, 40);
    localStorage.setItem(HIST_KEY, JSON.stringify(list));
  },

  removeHistory(link) {
    let list = this.getHistory().filter(i => i.link !== link);
    localStorage.setItem(HIST_KEY, JSON.stringify(list));
  }
};
