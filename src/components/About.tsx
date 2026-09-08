export default function About() {
  return (
    <section id="about" className="about">
      <div className="container">
        <div className="section-header">
          <div className="section-tag">About Studio</div>
          <h2 className="section-title">Excellence in Every Frame</h2>
        </div>

        <div className="about-grid">
          <div className="about-content">
            <p className="about-lead">
              We are a premium photography studio dedicated to creating extraordinary visual experiences that transcend the ordinary.
            </p>
            <p className="about-text">
              Founded in 2023, Tutok Pitik Studios has established itself as an official photography school created by Prince Balane as the founder of it.
              Through the years, Tutok Pitik Studios migrated as an official standalone photography studio made for many various clients.
            </p>
            <p className="about-text">
              Every project we undertake is treated with meticulous attention to detail, ensuring that each photograph captures not just a moment, but the essence of the story being told.
            </p>

            <div className="about-features">
              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path
                      d="M16 2L19.09 11.26L29 12.18L21.77 18.77L23.64 28.54L16 23.77L8.36 28.54L10.23 18.77L3 12.18L12.91 11.26L16 2Z"
                      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div className="feature-content">
                  <h3>Quality Assured</h3>
                  <p>Every project meets high standards</p>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <rect x="4" y="4" width="24" height="24" rx="4" stroke="currentColor" strokeWidth="2" />
                    <circle cx="16" cy="16" r="4" stroke="currentColor" strokeWidth="2" />
                    <path d="M22 10H24M8 22H10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="feature-content">
                  <h3>Premium Equipment</h3>
                  <p>State-of-the-art technology</p>
                </div>
              </div>

              <div className="feature-card">
                <div className="feature-icon">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <path
                      d="M16 28C22.6274 28 28 22.6274 28 16C28 9.37258 22.6274 4 16 4C9.37258 4 4 9.37258 4 16C4 22.6274 9.37258 28 16 28Z"
                      stroke="currentColor" strokeWidth="2" />
                    <path d="M16 10V16L20 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                </div>
                <div className="feature-content">
                  <h3>Fast Delivery</h3>
                  <p>Professional turnaround time</p>
                </div>
              </div>
            </div>
          </div>

          <div className="about-visual">
            <div className="visual-card visual-card-1">
              <div className="visual-content">
                <div className="visual-number">16</div>
                <div className="visual-text">Completed Projects</div>
              </div>
            </div>
            <div className="visual-card visual-card-2">
              <div className="visual-content">
                <div className="visual-number">100%</div>
                <div className="visual-text">Client Satisfaction</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}