import { ArrowRight, Building2, Cake, Mic, ShoppingBag, UserRound } from 'lucide-react';
import { SERVICES, type ServiceIcon } from '../content/site';
import { formatPeso } from '../lib/format';
import { scrollToSection } from '../lib/scroll';
import { PORTFOLIO_FILTER_EVENT } from './Portfolio';

export const SERVICE_ICONS: Record<ServiceIcon, typeof Cake> = {
  portrait: UserRound,
  birthday: Cake,
  event: Mic,
  commercial: ShoppingBag,
  landscape: Building2,
};

interface ServicesProps {
  onBook: (serviceId: string) => void;
}

export default function Services({ onBook }: ServicesProps) {
  const showExamples = (category: string) => {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_FILTER_EVENT, { detail: category }));
    scrollToSection('portfolio');
  };

  return (
    <section id="services" className="section services-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Services</p>
          <h2 className="section-title">What we shoot</h2>
          <p className="section-lead">Every session is priced per hour, so you only pay for the coverage you need. Pick a service to see packages or book it straight away.</p>
        </header>

        <ul className="service-grid">
          {SERVICES.map((service) => {
            const Icon = SERVICE_ICONS[service.icon];
            return (
              <li key={service.id} className="service-card">
                <div className="service-card-top">
                  <span className="service-icon">
                    <Icon size={24} aria-hidden="true" />
                  </span>
                  <span className="service-price">
                    <strong>{formatPeso(service.rate)}</strong>
                    <span>/ hour</span>
                  </span>
                </div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <p className="service-ideal">
                  <span>Ideal for</span> {service.idealFor}
                </p>
                <div className="service-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onBook(service.id)}>
                    Book this
                  </button>
                  <button type="button" className="btn-link" onClick={() => showExamples(service.portfolioCategory)}>
                    See examples <ArrowRight size={16} />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
