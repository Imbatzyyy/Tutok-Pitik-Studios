import { Facebook, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import logoImage from '../assets/logo-160.png';
import { SERVICES, STUDIO } from '../content/site';
import { handleSectionLinkClick } from '../lib/scroll';

const LINKS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'services', label: 'Services' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'about', label: 'About' },
  { id: 'faq', label: 'FAQ' },
  { id: 'contact', label: 'Book a session' },
];

export default function Footer({ onBook }: { onBook: (serviceId?: string) => void }) {
  return (
    <footer className="site-footer">
      <div className="container footer-cta">
        <div>
          <h2>Ready when you are.</h2>
          <p>Check open dates and reserve your session in a few minutes.</p>
        </div>
        <button type="button" className="btn btn-primary btn-lg" onClick={() => onBook()}>
          Book a session
        </button>
      </div>

      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={logoImage} alt="" width={56} height={56} loading="lazy" />
          <p>
            <strong>{STUDIO.name}</strong>
            <br />
            Portrait, birthday, event and commercial photography in {STUDIO.serviceArea}.
          </p>
        </div>

        <nav aria-label="Footer">
          <h3>Explore</h3>
          <ul>
            {LINKS.map((link) => (
              <li key={link.id}>
                <a href={`#${link.id}`} onClick={(event) => handleSectionLinkClick(event, link.id)}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h3>Services</h3>
          <ul>
            {SERVICES.map((service) => (
              <li key={service.id}>
                <button type="button" className="footer-link-btn" onClick={() => onBook(service.id)}>
                  {service.title}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3>Contact</h3>
          <ul className="footer-contact">
            <li>
              <Phone size={16} aria-hidden="true" />
              <a href={STUDIO.phoneHref}>{STUDIO.phoneDisplay}</a>
            </li>
            <li>
              <Mail size={16} aria-hidden="true" />
              <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a>
            </li>
            <li>
              <MapPin size={16} aria-hidden="true" />
              <span>{STUDIO.location}</span>
            </li>
          </ul>
          <div className="social-row">
            <a href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer" aria-label="Messenger">
              <MessageCircle size={18} />
            </a>
            <a href={STUDIO.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
              <Instagram size={18} />
            </a>
            <a href={STUDIO.socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
              <Facebook size={18} />
            </a>
            <a href={STUDIO.socials.behance} target="_blank" rel="noopener noreferrer" aria-label="Behance" className="social-text">
              Bē
            </a>
          </div>
        </div>
      </div>

      <div className="container footer-bottom">
        <p>
          © {new Date().getFullYear()} {STUDIO.name}. All rights reserved.
        </p>
        <p>Founded by {STUDIO.founder}</p>
      </div>
    </footer>
  );
}
