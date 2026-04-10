export default function Hero() {
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
    const sectionId = href.replace('#', '');
    scrollToSection(sectionId);
  };

  return (
    <section id="home" className="hero">
      <div className="hero-bg">
        <div className="hero-gradient hero-gradient-1"></div>
        <div className="hero-gradient hero-gradient-2"></div>
        <div className="hero-gradient hero-gradient-3"></div>
        <div className="hero-particles">
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
          <div className="particle"></div>
        </div>
      </div>

      <div className="hero-container">
        <div className="hero-badge">
          <span className="badge-dot"></span>
          Premium Photography Service
        </div>

        <h1 className="hero-title">
          <span className="title-word">Capturing</span>
          <span className="title-word">Timeless</span>
          <span className="title-word">Moments</span>
        </h1>

        <p className="hero-subtitle">
          Where vision meets precision. We transform moments into visual stories crafted with detail, depth, and emotion.
        </p>

        <div className="hero-buttons">
          <a href="#portfolio" className="btn btn-primary" onClick={(e) => handleLinkClick(e, '#portfolio')}>
            <span>View Our Work</span>
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M3.75 9H14.25M14.25 9L9 3.75M14.25 9L9 14.25" stroke="currentColor" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
          <a href="#contact" className="btn btn-secondary" onClick={(e) => handleLinkClick(e, '#contact')}>
            <span>Get In Touch</span>
          </a>
        </div>
      </div>

      <div className="scroll-down">
        <div className="scroll-line"></div>
        <span>Scroll</span>
      </div>
    </section>
  );
}
