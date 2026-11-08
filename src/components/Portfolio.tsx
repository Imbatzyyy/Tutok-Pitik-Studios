import { useEffect, useMemo, useState } from 'react';
import { Expand } from 'lucide-react';
import Picture from './common/Picture';
import { categoryLabel, subCategoryLabel, type PortfolioItem } from '../content/portfolio';

interface PortfolioProps {
  items: PortfolioItem[];
  onOpen: (items: PortfolioItem[], index: number) => void;
}

const PAGE_SIZE = 9;
export const PORTFOLIO_FILTER_EVENT = 'tps:portfolio-filter';

export default function Portfolio({ items, onOpen }: PortfolioProps) {
  const [category, setCategory] = useState('all');
  const [subCategory, setSubCategory] = useState('all');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    items.forEach((item) => counts.set(item.category, (counts.get(item.category) || 0) + 1));
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count, label: categoryLabel(value) }));
  }, [items]);

  const subCategories = useMemo(() => {
    if (category === 'all') return [];
    const counts = new Map<string, number>();
    items
      .filter((item) => item.category === category && item.subCategory)
      .forEach((item) => counts.set(item.subCategory, (counts.get(item.subCategory) || 0) + 1));
    return Array.from(counts.entries()).map(([value, count]) => ({ value, count, label: subCategoryLabel(category, value) }));
  }, [items, category]);

  const filtered = useMemo(() => {
    const matches = items.filter(
      (item) => (category === 'all' || item.category === category) && (subCategory === 'all' || item.subCategory === subCategory)
    );
    // In the "All" view, photos the studio marked as featured lead the grid.
    if (category !== 'all') return matches;
    return [...matches.filter((item) => item.isFeatured), ...matches.filter((item) => !item.isFeatured)];
  }, [items, category, subCategory]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [category, subCategory]);

  // Other sections (e.g. Services → "See examples") can ask for a filter.
  useEffect(() => {
    const handler = (event: Event) => {
      const value = (event as CustomEvent<string>).detail;
      setCategory(categories.some((entry) => entry.value === value) ? value : 'all');
      setSubCategory('all');
    };
    window.addEventListener(PORTFOLIO_FILTER_EVENT, handler);
    return () => window.removeEventListener(PORTFOLIO_FILTER_EVENT, handler);
  }, [categories]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <section id="portfolio" className="section portfolio-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Portfolio</p>
          <h2 className="section-title">Real clients. Real moments.</h2>
          <p className="section-lead">A selection of recent portrait, birthday, concert and creative work. Tap any photo to view it full size.</p>
        </header>

        {categories.length > 1 && (
          <div className="chip-row" role="group" aria-label="Filter by category">
            <button type="button" className={`chip ${category === 'all' ? 'is-active' : ''}`} aria-pressed={category === 'all'} onClick={() => { setCategory('all'); setSubCategory('all'); }}>
              All <span className="chip-count">{items.length}</span>
            </button>
            {categories.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={`chip ${category === entry.value ? 'is-active' : ''}`}
                aria-pressed={category === entry.value}
                onClick={() => {
                  setCategory(entry.value);
                  setSubCategory('all');
                }}
              >
                {entry.label} <span className="chip-count">{entry.count}</span>
              </button>
            ))}
          </div>
        )}

        {subCategories.length > 1 && (
          <div className="chip-row chip-row-sub" role="group" aria-label="Filter by type">
            <button type="button" className={`chip chip-sm ${subCategory === 'all' ? 'is-active' : ''}`} aria-pressed={subCategory === 'all'} onClick={() => setSubCategory('all')}>
              All {categoryLabel(category)}
            </button>
            {subCategories.map((entry) => (
              <button
                key={entry.value}
                type="button"
                className={`chip chip-sm ${subCategory === entry.value ? 'is-active' : ''}`}
                aria-pressed={subCategory === entry.value}
                onClick={() => setSubCategory(entry.value)}
              >
                {entry.label}
              </button>
            ))}
          </div>
        )}

        {visible.length === 0 ? (
          <p className="empty-note">No photos in this category yet.</p>
        ) : (
          <ul className="gallery-grid">
            {visible.map((item, index) => (
              <li key={item.id} className={`gallery-item ${index === 0 && category === 'all' ? 'is-wide' : ''}`}>
                <button type="button" className="gallery-button" onClick={() => onOpen(filtered, index)} aria-label={`Open ${item.title}`}>
                  <Picture item={item} size="thumb" alt={`${item.title}${item.description ? ` — ${item.description}` : ''}`} sizes="(max-width: 640px) 50vw, (max-width: 1100px) 50vw, 33vw" />
                  <span className="gallery-overlay">
                    <span className="gallery-meta">
                      <span className="gallery-title">{item.title}</span>
                      <span className="gallery-sub">{subCategoryLabel(item.category, item.subCategory) || categoryLabel(item.category)}</span>
                    </span>
                    <Expand size={18} aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {filtered.length > visibleCount && (
          <div className="center-actions">
            <button type="button" className="btn btn-outline" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Show more photos ({filtered.length - visibleCount} more)
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
