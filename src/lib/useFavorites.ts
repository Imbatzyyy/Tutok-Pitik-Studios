import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getStoredFavorites, mergeFavorites, saveStoredFavorites } from './favorites';
import { itemMatchesKey, type PortfolioItem } from '../content/portfolio';

/** Favorites live in localStorage first and sync to the favorites table when possible. */
export function useFavorites(user: any) {
  const userId = user && user.role !== 'guest' ? user.id : undefined;
  const [favorites, setFavorites] = useState<string[]>(() => getStoredFavorites(userId));

  useEffect(() => {
    if (!userId) {
      setFavorites([]);
      return;
    }
    const local = getStoredFavorites(userId);
    setFavorites(local);
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.from('favorites').select('image_id').eq('user_id', userId);
        if (error || cancelled) return;
        const merged = mergeFavorites(local, (data || []).map((row: any) => row.image_id).filter(Boolean));
        setFavorites(merged);
        saveStoredFavorites(userId, merged);
      } catch {
        /* offline: keep local favorites */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  /** Returns true when the item was added, false when removed. */
  const toggle = useCallback(
    async (item: PortfolioItem) => {
      if (!userId) return false;
      const matching = favorites.filter((key) => itemMatchesKey(item, key));
      const adding = matching.length === 0;
      const next = adding ? [...favorites, item.id] : favorites.filter((key) => !matching.includes(key));
      setFavorites(next);
      saveStoredFavorites(userId, next);
      try {
        if (adding) {
          await supabase.from('favorites').upsert({ user_id: userId, image_id: item.id }, { onConflict: 'user_id,image_id' });
        } else {
          await supabase.from('favorites').delete().eq('user_id', userId).in('image_id', matching);
        }
      } catch {
        /* local copy already updated */
      }
      return adding;
    },
    [favorites, userId]
  );

  const remove = useCallback(
    async (key: string) => {
      if (!userId) return;
      const next = favorites.filter((entry) => entry !== key);
      setFavorites(next);
      saveStoredFavorites(userId, next);
      try {
        await supabase.from('favorites').delete().eq('user_id', userId).eq('image_id', key);
      } catch {
        /* ignore */
      }
    },
    [favorites, userId]
  );

  return { favorites, toggle, remove };
}
