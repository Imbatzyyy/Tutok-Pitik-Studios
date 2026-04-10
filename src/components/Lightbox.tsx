import { useEffect, useState } from 'react';
import { Heart } from 'lucide-react';
import { portfolioImages } from './Portfolio';
import { supabase, projectId } from '../lib/supabase';

interface LightboxProps {
  active: boolean;
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  user: any;
}

export default function Lightbox({ active, currentIndex, onClose, onNavigate, user }: LightboxProps) {
  const [favorites, setFavorites] = useState<string[]>([]);

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
    // Load favorites from Supabase
    const loadFavorites = async () => {
      if (user && user.id !== 'guest') {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/favorites`, {
              headers: {
                'Authorization': `Bearer ${session.access_token}`
              }
            });
            
            if (response.ok) {
              const { favorites: loadedFavorites } = await response.json();
              setFavorites(loadedFavorites || []);
            }
          }
        } catch (error) {
          console.error('Error loading favorites:', error);
        }
      }
    };
    
    loadFavorites();
  }, [user]);

  const showPrev = () => {
    onNavigate((currentIndex - 1 + portfolioImages.length) % portfolioImages.length);
  };

  const showNext = () => {
    onNavigate((currentIndex + 1) % portfolioImages.length);
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

    const currentImage = portfolioImages[currentIndex];
    const imageId = currentImage.src;
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('Please log in to save favorites');
        return;
      }

      // Optimistically update UI
      let updatedFavorites: string[];
      if (favorites.includes(imageId)) {
        updatedFavorites = favorites.filter(id => id !== imageId);
      } else {
        updatedFavorites = [...favorites, imageId];
      }
      setFavorites(updatedFavorites);

      // Save to Supabase
      const response = await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-032fda65/favorites/toggle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ imageId })
      });

      if (!response.ok) {
        // Revert on error
        setFavorites(favorites);
        console.error('Failed to toggle favorite');
      }
    } catch (error) {
      // Revert on error
      setFavorites(favorites);
      console.error('Error toggling favorite:', error);
    }
  };

  if (!active) return null;

  const currentImage = portfolioImages[currentIndex];
  const isFavorite = favorites.includes(currentImage.src);
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
        <img src={currentImage.src} alt={currentImage.title} id="lightboxImg" />
        <div className="lightbox-info">
          <h3>{currentImage.title}</h3>
          <p>{currentImage.category.toUpperCase()}</p>
        </div>
      </div>
      <div className="lightbox-counter">{currentIndex + 1} / {portfolioImages.length}</div>
    </div>
  );
}