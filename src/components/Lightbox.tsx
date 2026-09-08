import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { portfolioImages } from './Portfolio';
import { supabase } from '../lib/supabase';
import { getStoredFavorites, mergeFavorites, saveStoredFavorites } from '../lib/favorites';

interface LightboxProps {
  active: boolean;
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  user: any;
  images?: any[];
}

export default function Lightbox({ active, currentIndex, onClose, onNavigate, user, images = portfolioImages }: LightboxProps) {
  const [favorites, setFavorites] = useState<string[]>([]);

  const galleryImages = images.length > 0 ? images : portfolioImages;

  useEffect(() => {
    if (!active) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') showPrev();
      if (e.key === 'ArrowRight') showNext();
    };

    const handleBodyScroll = () => {
      document.body.style.overflow = active ? 'hidden' : 'auto';
    };

    handleBodyScroll();
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = 'auto';
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [active, currentIndex]);

  useEffect(() => {
    const loadFavorites = async () => {
      if (!user || user.id === 'guest') {
        setFavorites([]);
        return;
      }

      const localFavorites = getStoredFavorites(user.id);
      setFavorites(localFavorites);

      try {
        const { data: loadedFavorites, error } = await supabase
          .from('favorites')
          .select('image_id')
          .eq('user_id', user.id);

        if (!error) {
          const favoriteIds = (loadedFavorites || []).map((item: any) => item.image_id).filter(Boolean);
          const mergedFavorites = mergeFavorites(localFavorites, favoriteIds);
          setFavorites(mergedFavorites);
          saveStoredFavorites(user.id, mergedFavorites);
        }
      } catch (error) {
        console.error('Error loading favorites:', error);
      }
    };

    loadFavorites();
  }, [user, active]);

  const showPrev = () => {
    onNavigate((currentIndex - 1 + galleryImages.length) % galleryImages.length);
  };

  const showNext = () => {
    onNavigate((currentIndex + 1) % galleryImages.length);
  };

  const toggleFavorite = async () => {
    if (!user || user.id === 'guest') {
      alert('Please log in to save favorites');
      return;
    }

    // Only customers can have favorites
    if (user.role !== 'customer') {
      return;
    }

    const currentImage = galleryImages[currentIndex] || galleryImages[0];
    const imageId = currentImage.id;
    const legacyImageId = currentImage.src || currentImage.url || currentImage.imageData;
    const isPersistableFavorite = typeof imageId === 'string' && !String(imageId).startsWith('default-');
    
    try {
      // Optimistically update UI
      let updatedFavorites: string[];
      const hasFavorite = favorites.includes(imageId) || favorites.includes(legacyImageId);
      if (hasFavorite) {
        updatedFavorites = favorites.filter(id => id !== imageId && id !== legacyImageId);
      } else {
        updatedFavorites = [...favorites, imageId];
      }
      setFavorites(updatedFavorites);
      saveStoredFavorites(user.id, updatedFavorites);

      if (!isPersistableFavorite) {
        return;
      }

      if (hasFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('image_id', imageId);

        if (error) {
          console.error('Failed to remove favorite from Supabase:', error);
        }
      } else {
        const { error } = await supabase
          .from('favorites')
          .upsert({
            user_id: user.id,
            image_id: imageId,
          }, { onConflict: 'user_id,image_id' });

        if (error) {
          console.error('Failed to save favorite to Supabase:', error);
        }
      }
    } catch (error) {
      console.error('Error toggling favorite in backend:', error);
    }
  };

  if (!active) return null;

  const currentImage = galleryImages[currentIndex] || galleryImages[0];
  const isFavorite = favorites.includes(currentImage.id) || favorites.includes(currentImage.src);
  const canFavorite = user && user.id !== 'guest' && user.role === 'customer';

  return (
    <div className={`lightbox ${active ? 'active' : ''}`} onClick={onClose}>
      <button className="lightbox-close" onClick={onClose}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M18 6L6 18M6 6L18 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      </button>
      {canFavorite && (
        <button 
          className={`lightbox-favorite ${isFavorite ? 'active' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleFavorite(); }}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Heart size={24} fill={isFavorite ? 'currentColor' : 'none'} />
        </button>
      )}
      <button className="lightbox-nav lightbox-prev" onClick={(e) => { e.stopPropagation(); showPrev(); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <button className="lightbox-nav lightbox-next" onClick={(e) => { e.stopPropagation(); showNext(); }}>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="lightbox-content" onClick={(e) => e.stopPropagation()}>
        <img src={currentImage.src || currentImage.url || currentImage.imageData} alt={currentImage.title} id="lightboxImg" />
        <div className="lightbox-info">
          <h3>{currentImage.title}</h3>
          <p>{String(currentImage.category || '').toUpperCase()}</p>
        </div>
      </div>
      <div className="lightbox-counter">{currentIndex + 1} / {galleryImages.length}</div>
    </div>
  );
}