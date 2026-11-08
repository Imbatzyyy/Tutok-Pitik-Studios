import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CalendarCheck } from 'lucide-react';
import Picture from './common/Picture';
import { HERO_PHOTOS } from '../content/portfolio';
import { SERVICES, STATS, STUDIO } from '../content/site';
import { formatPeso } from '../lib/format';
import { scrollToSection } from '../lib/scroll';

interface HeroProps {
  nextOpenDate?: string | null;
  onBook: () => void;
}

const SLIDE_MS = 5500;
const lowestRate = Math.min(...SERVICES.map((service) => service.rate));

export default function Hero({ nextOpenDate, onBook }: HeroProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reducedMotion = useMemo(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches, []);
  const timer = useRef<number>();

  useEffect(() => {
    if (paused || reducedMotion || HERO_PHOTOS.length < 2) return;
    timer.current = window.setTimeout(() => setIndex((value) => (value + 1) % HERO_PHOTOS.length), SLIDE_MS);
    return () => window.clearTimeout(timer.current);
  }, [index, paused, reducedMotion]);

  useEffect(() => {
    const onVisibility = () => setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, []);

  const current = HERO_PHOTOS[index];

  return (
    <section id="home" className="hero" aria-label="Introduction">
      <div className="hero-inner">
        <div className="hero-copy">
          <p className="eyebrow hero-eyebrow">
            <span className="eyebrow-dot" aria-hidden="true" />
            {STUDIO.location.split(',')[0]} photography studio · since {STUDIO.foundedYear}
          </p>
          <h1 className="hero-title">
            Photos that feel like the <em>moment</em> did.
          </h1>
          <p className="hero-lead">
            Portraits, birthdays, events and brand shoots across {STUDIO.serviceArea.replace('Quezon City & ', '')}. Clear prices, online booking,
            and your edited photos delivered straight to your account.
          </p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary btn-lg" onClick={onBook}>
              <CalendarCheck size={20} />
              Check open dates
            </button>
            <a
              className="btn btn-outline btn-lg"
              href="#portfolio"
              onClick={(event) => {
                event.preventDefault();
                scrollToSection('portfolio');
              }}
            >
              See the work
              <ArrowRight size={18} />
            </a>
          </div>
          <ul className="hero-trust">
            <li>
              <strong>{STATS.clients}+</strong>
              <span>clients photographed</span>
            </li>
            <li>
              <strong>{formatPeso(lowestRate)}</strong>
              <span>per hour, starting price</span>
            </li>
            <li>
              {nextOpenDate ? (
                <>
                  <strong>{nextOpenDate}</strong>
                  <span>next open date</span>
                </>
              ) : (
                <>
                  <strong>50%</strong>
                  <span>downpayment via GCash</span>
                </>
              )}
            </li>
          </ul>
        </div>

        <div
          className="hero-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocus={() => setPaused(true)}
          onBlur={() => setPaused(false)}
        >
          {HERO_PHOTOS.map((photo, photoIndex) => (
            <Picture
              key={photo.id}
              item={photo}
              size="large"
              alt={photoIndex === index ? `${photo.title} — ${photo.description}` : ''}
              aria-hidden={photoIndex !== index}
              pictureClassName={`hero-slide ${photoIndex === index ? 'is-active' : ''}`}
              loading={photoIndex === 0 ? 'eager' : 'lazy'}
              sizes="(max-width: 900px) 100vw, 50vw"
              {...(photoIndex === 0 ? ({ fetchpriority: 'high' } as any) : {})}
            />
          ))}
          <div className="hero-stage-shade" aria-hidden="true" />
          <div className="hero-caption" aria-live="polite">
            <span className="hero-caption-title">{current.title}</span>
            <span className="hero-caption-sub">{current.description}</span>
          </div>
          <div className="hero-dots" role="group" aria-label="Choose a photo">
            {HERO_PHOTOS.map((photo, photoIndex) => (
              <button
                key={photo.id}
                type="button"
                className={photoIndex === index ? 'is-active' : ''}
                aria-label={`Show photo ${photoIndex + 1}: ${photo.title}`}
                aria-pressed={photoIndex === index}
                onClick={() => setIndex(photoIndex)}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
