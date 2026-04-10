import { useState, useEffect, useRef } from 'react';

export default function StatsBar() {
  const [countersAnimated, setCountersAnimated] = useState(false);
  const statsRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting && !countersAnimated) {
            animateCounters();
            setCountersAnimated(true);
          }
        });
      },
      { threshold: 0.5 }
    );

    if (statsRef.current) {
      observer.observe(statsRef.current);
    }

    return () => observer.disconnect();
  }, [countersAnimated]);

  const animateCounters = () => {
    const stats = [
      { id: 'stat-projects', target: 16 },
      { id: 'stat-clients', target: 103 },
      { id: 'stat-years', target: 3 }
    ];

    stats.forEach(stat => {
      const element = document.getElementById(stat.id);
      if (!element) return;

      const duration = 2000;
      const increment = stat.target / (duration / 16);
      let current = 0;

      const updateCounter = () => {
        current += increment;
        if (current < stat.target) {
          element.textContent = Math.floor(current).toString();
          requestAnimationFrame(updateCounter);
        } else {
          element.textContent = stat.target.toString();
        }
      };

      updateCounter();
    });
  };

  return (
    <section className="stats-bar" ref={statsRef}>
      <div className="stats-container">
        <div className="stat-item">
          <div className="stat-number" id="stat-projects">0</div>
          <div className="stat-label">Projects</div>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <div className="stat-number" id="stat-clients">0</div>
          <div className="stat-label">Clients</div>
        </div>
        <div className="stat-divider"></div>
        <div className="stat-item">
          <div className="stat-number" id="stat-years">0</div>
          <div className="stat-label">Years</div>
        </div>
      </div>
    </section>
  );
}