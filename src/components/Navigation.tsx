import { useState, useEffect } from 'react';
import { User, Shield } from 'lucide-react';
import logoImage from 'figma:asset/c5d3e549442d77b6cd4fded105377d2618135800.png';

interface NavigationProps {
  user: any;
  onOpenAuth: () => void;
  onOpenProfile: () => void;
  onOpenAdmin?: () => void;
}

export default function Navigation({ user, onOpenAuth, onOpenProfile, onOpenAdmin }: NavigationProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuActive, setMobileMenuActive] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const navHeight = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - navHeight;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuActive(false);
    
    const sectionId = href.replace('#', '');
    scrollToSection(sectionId);
  };

  const handleBookNowClick = () => {
    setMobileMenuActive(false);
    scrollToSection('contact');
  };

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`} id="nav">
      <div className="nav-wrapper">
        <a href="#home" className="nav-logo" onClick={(e) => handleLinkClick(e, '#home')}>
          <img src={logoImage} alt="Tutok Pitik Studios" className="nav-logo-img" />
        </a>

        <div className={`nav-links ${mobileMenuActive ? 'active' : ''}`} id="navLinks">
          <a href="#home" className="nav-link" onClick={(e) => handleLinkClick(e, '#home')}>Home</a>
          <a href="#about" className="nav-link" onClick={(e) => handleLinkClick(e, '#about')}>About</a>
          <a href="#portfolio" className="nav-link" onClick={(e) => handleLinkClick(e, '#portfolio')}>Portfolio</a>
          <a href="#services" className="nav-link" onClick={(e) => handleLinkClick(e, '#services')}>Services</a>
          <a href="#contact" className="nav-link" onClick={(e) => handleLinkClick(e, '#contact')}>Contact</a>
        </div>

        <div className="nav-actions">
          <button 
            className="nav-btn" 
            onClick={handleBookNowClick}
          >
            Book Now
          </button>

          {user && ['superadmin', 'admin', 'staff'].includes(user.role) && onOpenAdmin && (
            <button className="nav-admin-btn" onClick={onOpenAdmin}>
              <Shield size={18} />
              <span>Dashboard</span>
            </button>
          )}

          {user && user.role !== 'guest' ? (
            <button className="nav-user-btn" onClick={onOpenProfile}>
              <div className="nav-user-avatar">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt={user.username || user.fullName} className="nav-user-avatar-img" />
                ) : (
                  user.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                )}
              </div>
              <span className="nav-user-name">{user.username || user.fullName.split(' ')[0]}</span>
            </button>
          ) : (
            <button className="nav-login-btn" onClick={onOpenAuth}>
              <User size={18} />
              <span>Sign In</span>
            </button>
          )}
        </div>

        <button 
          className={`nav-toggle ${mobileMenuActive ? 'active' : ''}`}
          onClick={() => setMobileMenuActive(!mobileMenuActive)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
}