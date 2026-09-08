export function getFavoritesStorageKey(userId: string) {
  return `tutok:favorites:${userId}`;
}

export function getStoredFavorites(userId?: string) {
  if (!userId || typeof window === 'undefined') {
    return [] as string[];
  }

  try {
    const raw = window.localStorage.getItem(getFavoritesStorageKey(userId));
    if (!raw) {
      return [] as string[];
    }

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [] as string[];
  }
}

export function saveStoredFavorites(userId: string | undefined, favorites: string[]) {
  if (!userId || typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(getFavoritesStorageKey(userId), JSON.stringify(favorites));
}

export function mergeFavorites(...favoriteLists: Array<string[] | undefined>) {
  const merged = new Set<string>();
  favoriteLists.forEach((favorites) => {
    (favorites || []).forEach((favorite) => merged.add(favorite));
  });
  return Array.from(merged);
}
