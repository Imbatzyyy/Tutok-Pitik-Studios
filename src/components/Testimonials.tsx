import { useEffect, useState } from 'react';
import { Quote, Star } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { initials } from '../lib/format';

export interface Testimonial {
  id: string;
  client_name: string;
  client_context?: string | null;
  quote: string;
  rating?: number | null;
  photo_url?: string | null;
  is_published?: boolean;
  display_order?: number | null;
}

/** Shows published client reviews managed in Admin → Testimonials. Renders nothing until there are some. */
export default function Testimonials() {
  const [items, setItems] = useState<Testimonial[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('testimonials')
          .select('*')
          .eq('is_published', true)
          .order('display_order', { ascending: true })
          .order('created_at', { ascending: false })
          .limit(9);
        if (!cancelled && !error) setItems((data || []) as Testimonial[]);
      } catch {
        /* table not created yet or offline: section stays hidden */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (items.length === 0) return null;

  return (
    <section id="reviews" className="section reviews-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Client reviews</p>
          <h2 className="section-title">What clients say</h2>
        </header>
        <ul className="review-grid">
          {items.map((item) => (
            <li key={item.id} className="review-card">
              <Quote size={28} className="review-quote-icon" aria-hidden="true" />
              {item.rating ? (
                <div className="review-stars" aria-label={`${item.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Star key={index} size={16} fill={index < (item.rating || 0) ? 'currentColor' : 'none'} aria-hidden="true" />
                  ))}
                </div>
              ) : null}
              <blockquote>{item.quote}</blockquote>
              <div className="review-author">
                {item.photo_url ? <img src={item.photo_url} alt="" loading="lazy" /> : <span className="avatar-fallback">{initials(item.client_name)}</span>}
                <div>
                  <strong>{item.client_name}</strong>
                  {item.client_context && <span>{item.client_context}</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
