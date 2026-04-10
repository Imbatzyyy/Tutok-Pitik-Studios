import logoImage from 'figma:asset/c5d3e549442d77b6cd4fded105377d2618135800.png';

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-brand">
            <img src={logoImage} alt="Tutok Pitik Studios" className="footer-logo" />
            <p>Premium photography studio creating timeless visual narratives since 2023.</p>
          </div>
          <div className="footer-links">
            <div className="footer-col">
              <h4>Studio</h4>
              <a href="#about">About</a>
              <a href="#portfolio">Portfolio</a>
              <a href="#services">Services</a>
              <a href="#contact">Contact</a>
            </div>
            <div className="footer-col">
              <h4>Services</h4>
              <a href="#services">Portrait</a>
              <a href="#services">Birthday</a>
              <a href="#services">Concert</a>
              <a href="#services">Art</a>
              <a href="#services">School</a>
            </div>
            <div className="footer-col">
              <h4>Connect</h4>
              <a href="https://www.instagram.com/tutokpitikstudios_/">Instagram</a>
              <a href="https://www.facebook.com/profile.php?id=61554013355967">Facebook</a>
              <a href="https://www.behance.net/princebalane">Behance</a>
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2025 Tutok Pitik Studios. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}