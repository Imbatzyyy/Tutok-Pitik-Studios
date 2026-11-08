import { useEffect, useState } from 'react';
import { User as UserIcon, Shield, X, Menu, CalendarCheck, Instagram, Facebook, MessageCircle } from 'lucide-react';
import { handleSectionLinkClick, scrollToSection } from '../lib/scroll';
import { initials } from '../lib/format';
import { STUDIO } from '../content/site';
import { useModal } from '../hooks/useModal';
import logoImage from '../assets/logo-160.png';

interface NavigationProps {
  user: any;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
  onBook?: () => void;
}

export const NAV_LINKS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'services', label: 'Services' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Contact' },
];

export default function Navigation({ user, onOpenAuth, onOpenProfile, onOpenAdmin, onBook }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState('home');
  const menuRef = useModal<HTMLDivElement>(menuOpen, () => setMenuOpen(false));

  const isSignedIn = user && user.role !== 'guest';
  const isStaff = user && ['superadmin', 'admin', 'staff'].includes(user.role);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      setScrolled(window.scrollY > 40);
      ticking = false;
    };
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        window.requestAnimationFrame(update);
      }
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const ids = ['home', ...NAV_LINKS.map((link) => link.id)];
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]) setActiveSection(visible[0].target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5] }
    );

    const attach = () => ids.forEach((id) => {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    });
    attach();
    const retry = window.setTimeout(attach, 1200);
    return () => {
      window.clearTimeout(retry);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const closeOnDesktop = () => {
      if (window.innerWidth > 1100) setMenuOpen(false);
    };
    window.addEventListener('resize', closeOnDesktop);
    return () => window.removeEventListener('resize', closeOnDesktop);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  const handleBookNow = () => {
    closeMenu();
    if (onBook) onBook();
    else scrollToSection('contact');
  };

  const accountButton = isSignedIn ? (
    <button className="site-nav-account" onClick={() => { closeMenu(); onOpenProfile(); }} aria-label="Open your profile">
      <span className="site-nav-avatar">
        {user.profilePicture ? (
          <img src={user.profilePicture} alt="" />
        ) : (
          initials(user.fullName)
        )}
      </span>
      <span className="site-nav-account-label">{user.username || user.fullName?.split(' ')[0]}</span>
    </button>
  ) : (
    <button className="site-nav-account" onClick={() => { closeMenu(); onOpenAuth(); }} aria-label="Sign in">
      <UserIcon size={18} />
      <span className="site-nav-account-label">Sign In</span>
    </button>
  );

  return (
    <header className={`site-nav ${scrolled || menuOpen ? 'is-solid' : ''} ${menuOpen ? 'is-open' : ''}`}>
      <div className="site-nav-bar">
        <a href="#home" className="site-nav-logo" onClick={(event) => handleSectionLinkClick(event, '#home', closeMenu)} aria-label={`${STUDIO.name} home`}>
          <img src={logoImage} alt={STUDIO.name} width={64} height={64} />
        </a>

        <nav className="site-nav-links" aria-label="Main">
          {NAV_LINKS.map((link) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              className={`site-nav-link ${activeSection === link.id ? 'is-active' : ''}`}
              aria-current={activeSection === link.id ? 'true' : undefined}
              onClick={(event) => handleSectionLinkClick(event, `#${link.id}`)}
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="site-nav-actions">
          {isStaff && onOpenAdmin && (
            <button className="site-nav-admin" onClick={() => { closeMenu(); onOpenAdmin(); }} aria-label="Open admin dashboard">
              <Shield size={18} />
              <span className="site-nav-account-label">Dashboard</span>
            </button>
          )}
          {accountButton}
          <button className="site-nav-cta" onClick={handleBookNow}>
            <CalendarCheck size={16} className="site-nav-cta-icon" />
            <span>Book Now</span>
          </button>
          <button
            className="site-nav-toggle"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={menuOpen}
            aria-controls="site-mobile-menu"
          >
            {menuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <div className={`site-mobile-backdrop ${menuOpen ? 'is-open' : ''}`} onClick={closeMenu} aria-hidden="true" />
      <div
        id="site-mobile-menu"
        ref={menuRef}
        className={`site-mobile-menu ${menuOpen ? 'is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Site menu"
        aria-hidden={!menuOpen}
        tabIndex={-1}
      >
        <nav className="site-mobile-links" aria-label="Mobile">
          {NAV_LINKS.map((link, index) => (
            <a
              key={link.id}
              href={`#${link.id}`}
              tabIndex={menuOpen ? 0 : -1}
              className={`site-mobile-link ${activeSection === link.id ? 'is-active' : ''}`}
              style={{ transitionDelay: menuOpen ? `${60 + index * 35}ms` : '0ms' }}
              onClick={(event) => handleSectionLinkClick(event, `#${link.id}`, closeMenu)}
            >
              <span className="site-mobile-link-index">{String(index + 1).padStart(2, '0')}</span>
              {link.label}
            </a>
          ))}
        </nav>
        <div className="site-mobile-footer">
          <button className="btn btn-primary btn-block" onClick={handleBookNow} tabIndex={menuOpen ? 0 : -1}>
            <CalendarCheck size={18} />
            <span>Book a Session</span>
          </button>
          <div className="site-mobile-socials">
            <a href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer" tabIndex={menuOpen ? 0 : -1} aria-label="Message us on Messenger"><MessageCircle size={20} /></a>
            <a href={STUDIO.socials.instagram} target="_blank" rel="noopener noreferrer" tabIndex={menuOpen ? 0 : -1} aria-label="Instagram"><Instagram size={20} /></a>
            <a href={STUDIO.socials.facebook} target="_blank" rel="noopener noreferrer" tabIndex={menuOpen ? 0 : -1} aria-label="Facebook"><Facebook size={20} /></a>
          </div>
        </div>
      </div>
    </header>
  );
}
