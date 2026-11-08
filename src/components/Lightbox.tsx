import { useEffect, useRef, useState } from 'react';
import { CalendarCheck, ChevronLeft, ChevronRight, Heart, X } from 'lucide-react';
import { toast } from 'sonner';
import Picture from './common/Picture';
import { useModal } from '../hooks/useModal';
import { categoryLabel, itemMatchesKey, subCategoryLabel, type PortfolioItem } from '../content/portfolio';
import { serviceForPortfolio } from '../content/site';
import { useFavorites } from '../lib/useFavorites';

interface LightboxProps {
  items: PortfolioItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  user: any;
  onRequireSignIn: () => void;
  onBookSimilar: (serviceId: string) => void;
}

export default function Lightbox({ items, index, onIndexChange, onClose, user, onRequireSignIn, onBookSimilar }: LightboxProps) {
  const ref = useModal<HTMLDivElement>(true, onClose);
  const { favorites, toggle } = useFavorites(user);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [loaded, setLoaded] = useState(false);
  const count = items.length;
  const item = items[index] || items[0];

  const go = (delta: number) => {
    if (count < 2) return;
    setLoaded(false);
    onIndexChange((index + delta + count) % count);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  if (!item) return null;

  const isCustomer = user && user.role === 'customer';
  const isGuest = !user || user.role === 'guest';
  const isFavorite = favorites.some((key) => itemMatchesKey(item, key));
  const label = subCategoryLabel(item.category, item.subCategory) || categoryLabel(item.category);

  const handleFavorite = async () => {
    if (isGuest) {
      toast('Sign in to save favorites', { description: 'Create a free account to keep a shortlist of looks you love.' });
      onRequireSignIn();
      return;
    }
    if (!isCustomer) return;
    const added = await toggle(item);
    toast.success(added ? 'Saved to your favorites' : 'Removed from favorites');
  };

  return (
    <div
      ref={ref}
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${item.title} (${index + 1} of ${count})`}
      tabIndex={-1}
      onTouchStart={(event) => {
        const touch = event.touches[0];
        touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        if (!touchStart.current) return;
        const touch = event.changedTouches[0];
        const dx = touch.clientX - touchStart.current.x;
        const dy = touch.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)) go(dx < 0 ? 1 : -1);
        else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) onClose();
      }}
    >
      <div className="lightbox-backdrop" onClick={onClose} aria-hidden="true" />

      <div className="lightbox-top">
        <span className="lightbox-counter">
          {index + 1} / {count}
        </span>
        <div className="lightbox-top-actions">
          {(isCustomer || isGuest) && (
            <button type="button" className={`icon-btn lightbox-fav ${isFavorite ? 'is-active' : ''}`} onClick={handleFavorite} aria-pressed={isFavorite} aria-label={isFavorite ? 'Remove from favorites' : 'Save to favorites'}>
              <Heart size={20} fill={isFavorite ? 'currentColor' : 'none'} />
            </button>
          )}
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close viewer" data-autofocus>
            <X size={22} />
          </button>
        </div>
      </div>

      <figure className="lightbox-figure">
        <Picture
          key={item.id}
          item={item}
          size="large"
          loading="eager"
          className={`lightbox-image ${loaded ? 'is-loaded' : ''}`}
          onLoad={() => setLoaded(true)}
          alt={`${item.title}${item.description ? ` — ${item.description}` : ''}`}
        />
        <figcaption className="lightbox-caption">
          <div>
            <span className="lightbox-label">{label}</span>
            <h3>{item.title}</h3>
            {item.description && <p>{item.description}</p>}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onBookSimilar(serviceForPortfolio(item.category, item.subCategory));
              onClose();
            }}
          >
            <CalendarCheck size={18} />
            Book a shoot like this
          </button>
        </figcaption>
      </figure>

      {count > 1 && (
        <>
          {/* Hidden neighbours so next/previous feel instant. */}
          <div className="lightbox-preload" aria-hidden="true">
            {[items[(index + 1) % count], items[(index - 1 + count) % count]].map((neighbour) => (
              <Picture key={neighbour.id} item={neighbour} size="large" loading="eager" alt="" />
            ))}
          </div>
          <button type="button" className="lightbox-nav lightbox-prev" onClick={() => go(-1)} aria-label="Previous photo">
            <ChevronLeft size={28} />
          </button>
          <button type="button" className="lightbox-nav lightbox-next" onClick={() => go(1)} aria-label="Next photo">
            <ChevronRight size={28} />
          </button>
        </>
      )}
    </div>
  );
}
