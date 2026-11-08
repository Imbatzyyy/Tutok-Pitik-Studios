import { Aperture, Clapperboard, HardDriveDownload } from 'lucide-react';
import Picture from './common/Picture';
import { DEFAULT_PORTFOLIO } from '../content/portfolio';
import { STATS, STUDIO } from '../content/site';

const aboutPhoto = DEFAULT_PORTFOLIO.find((item) => item.id === 'bgc-series-3') || DEFAULT_PORTFOLIO[0];

const VALUES = [
  { icon: Clapperboard, title: 'Directed, not awkward', text: 'We guide poses and pacing so you can relax and look like yourself.' },
  { icon: Aperture, title: 'Edited with care', text: 'Every delivered photo is hand-picked, color graded and retouched.' },
  { icon: HardDriveDownload, title: 'Organized delivery', text: 'Photos arrive in a private Google Drive folder linked in your account.' },
];

export default function About() {
  return (
    <section id="about" className="section about-section">
      <div className="container about-grid">
        <div className="about-media">
          <Picture item={aboutPhoto} size="large" alt={`${aboutPhoto.title} by ${STUDIO.name}`} sizes="(max-width: 900px) 100vw, 45vw" />
          <div className="about-badge">
            <strong>Since {STUDIO.foundedYear}</strong>
            <span>{STATS.clients}+ clients</span>
          </div>
        </div>
        <div className="about-copy">
          <p className="eyebrow">About the studio</p>
          <h2 className="section-title">A small studio that treats every shoot like it matters</h2>
          <p className="about-lead">
            {STUDIO.name} was founded in {STUDIO.foundedYear} by {STUDIO.founder}. It started as a photography school and grew into a standalone studio
            serving clients across {STUDIO.serviceArea}.
          </p>
          <p>
            From first birthdays to concerts, graduation portraits to product launches, we plan each session around the story you want to tell, then
            deliver photos you will actually want to print and share.
          </p>
          <ul className="value-list">
            {VALUES.map((value) => {
              const Icon = value.icon;
              return (
                <li key={value.title}>
                  <span className="value-icon">
                    <Icon size={20} aria-hidden="true" />
                  </span>
                  <div>
                    <h3>{value.title}</h3>
                    <p>{value.text}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
