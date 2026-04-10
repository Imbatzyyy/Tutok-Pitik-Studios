export default function Services() {
  const services = [
    {
      number: '01',
      title: 'Portrait Photography',
      description: 'Professional portraits that capture personality and character with artistic precision.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <circle cx="24" cy="18" r="8" stroke="currentColor" strokeWidth="2" />
          <path d="M8 40C8 32.268 14.268 26 22 26H26C33.732 26 40 32.268 40 40" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" />
        </svg>
      )
    },
    {
      number: '02',
      title: 'Performance & Stage Photography',
      description: 'Dynamic photography for stage performances, theater, concerts, and live shows — even in challenging low-light environments.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path
            d="M24 42C24 42 38 32 38 20C38 16.287 36.525 12.726 33.899 10.101C31.274 7.475 27.713 6 24 6C20.287 6 16.726 7.475 14.101 10.101C11.475 12.726 10 16.287 10 20C10 32 24 42 24 42Z"
            stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="20" r="5" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    },
    {
      number: '03',
      title: 'Birthday Event Photography',
      description: 'Professional birthday photography that captures genuine moments, emotions, and celebrations — from intimate gatherings to big birthday parties.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="12" width="36" height="28" rx="3" stroke="currentColor" strokeWidth="2" />
          <path
            d="M16 12V8C16 7.46957 16.2107 6.96086 16.5858 6.58579C16.9609 6.21071 17.4696 6 18 6H30C30.5304 6 31.0391 6.21071 31.4142 6.58579C31.7893 6.96086 32 7.46957 32 8V12"
            stroke="currentColor" strokeWidth="2" />
          <circle cx="24" cy="26" r="6" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    },
    {
      number: '04',
      title: 'Event Coverage',
      description: 'Comprehensive event documentation with journalistic excellence and creative flair.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <rect x="6" y="10" width="36" height="30" rx="3" stroke="currentColor" strokeWidth="2" />
          <path d="M16 6V14M32 6V14M6 20H42" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <circle cx="24" cy="28" r="4" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    },
    {
      number: '05',
      title: 'Landscape & Architecture',
      description: 'Stunning architectural and landscape photography that showcases beauty and design.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M4 40L24 8L44 40H4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <circle cx="14" cy="18" r="4" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    },
    {
      number: '06',
      title: 'Post-Production',
      description: 'Expert retouching and color grading to perfect every image to excellence.',
      icon: (
        <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
          <path d="M18 24L12 30M12 30L18 36M12 30H36M36 30L30 24M36 30L30 36" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="24" cy="24" r="18" stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    }
  ];

  return (
    <section id="services" className="services">
      <div className="container">
        <div className="section-header">
          <div className="section-tag">Our Services</div>
          <h2 className="section-title">What We Do Best</h2>
        </div>

        <div className="services-grid">
          {services.map((service, index) => (
            <div key={index} className="service-card">
              <div className="service-number">{service.number}</div>
              <div className="service-icon">{service.icon}</div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-desc">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
