import { useEffect } from 'react';
import { CalendarCheck, Home, Images } from 'lucide-react';
import logoImage from '../assets/logo-160.png';

/** Shown for any address the site does not have, so stray links don't silently load the homepage. */
export default function NotFound() {
  useEffect(() => {
    document.title = 'Page not found · Tutok Pitik Studios';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    document.head.appendChild(robots);
    return () => robots.remove();
  }, []);

  return (
    <main className="reset-page not-found">
      <div className="not-found-card">
        <a href="/" aria-label="Tutok Pitik Studios home">
          <img src={logoImage} alt="" width={64} height={64} className="reset-logo" />
        </a>
        <p className="not-found-code" aria-hidden="true">404</p>
        <h1>This page is out of frame</h1>
        <p>The link may be old or mistyped. Everything else is right where you left it.</p>
        <div className="not-found-actions">
          <a className="btn btn-primary" href="/#contact">
            <CalendarCheck size={18} aria-hidden="true" /> Book a session
          </a>
          <a className="btn btn-ghost" href="/#portfolio">
            <Images size={18} aria-hidden="true" /> See the work
          </a>
          <a className="btn btn-ghost" href="/">
            <Home size={18} aria-hidden="true" /> Home
          </a>
        </div>
      </div>
    </main>
  );
}
