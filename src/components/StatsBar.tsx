import { useEffect, useRef, useState } from 'react';
import { Camera, Images, Sparkles, CalendarCheck } from 'lucide-react';
import { SERVICES, STATS } from '../content/site';

const ITEMS = [
  { icon: Camera, value: STATS.clients, suffix: '+', label: 'Clients photographed' },
  { icon: Images, value: STATS.projects, suffix: '+', label: 'Featured projects' },
  { icon: CalendarCheck, value: STATS.years, suffix: '', label: STATS.years === 1 ? 'Year shooting' : 'Years shooting' },
  { icon: Sparkles, value: SERVICES.length, suffix: '', label: 'Session types' },
];

function useCountUp(target: number, start: boolean) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }
    let frame = 0;
    const startedAt = performance.now();
    const duration = 1400;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      setValue(Math.round(target * (1 - Math.pow(1 - progress, 3))));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, start]);
  return value;
}

function Stat({ item, start }: { item: (typeof ITEMS)[number]; start: boolean }) {
  const value = useCountUp(item.value, start);
  const Icon = item.icon;
  return (
    <li className="trust-item">
      <Icon size={22} aria-hidden="true" />
      <div>
        <strong>
          {value}
          {item.suffix}
        </strong>
        <span>{item.label}</span>
      </div>
    </li>
  );
}

export default function StatsBar() {
  const ref = useRef<HTMLUListElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!ref.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="trust-bar" aria-label="Studio in numbers">
      <ul ref={ref} className="container trust-list">
        {ITEMS.map((item) => (
          <Stat key={item.label} item={item} start={visible} />
        ))}
      </ul>
    </section>
  );
}
