import { useMemo, useState } from 'react';
import { ArrowRight, Building2, Cake, Check, Info, Mic, ShoppingBag, UserRound } from 'lucide-react';
import { askStudio } from './Inquiry';
import { countStep } from '../lib/client-experience';
import Picture from './common/Picture';
import { DOWNPAYMENT_RATE, INCLUDED_IN_EVERY_SESSION, SERVICES, type Service, type ServiceIcon } from '../content/site';
import type { PortfolioItem } from '../content/portfolio';
import { formatPeso, hoursLabel } from '../lib/format';
import { scrollToSection } from '../lib/scroll';
import { PORTFOLIO_FILTER_EVENT } from './Portfolio';

export const SERVICE_ICONS: Record<ServiceIcon, typeof Cake> = {
  portrait: UserRound,
  birthday: Cake,
  event: Mic,
  commercial: ShoppingBag,
  landscape: Building2,
};

/** Best photo from the live portfolio for a service card: featured first, then display order. */
const coverFor = (service: Service, items: PortfolioItem[]) => {
  const pool = items.filter((item) => item.category === service.portfolioCategory);
  const refined =
    service.id === 'birthday'
      ? pool.filter((item) => item.subCategory === 'birthday')
      : service.id === 'event'
        ? pool.filter((item) => item.subCategory !== 'birthday')
        : pool;
  const list = refined;
  return list.find((item) => item.isFeatured) || list[0] || null;
};

const shortTitle = (title: string) => title.replace(' Photography', '').replace(' & Architecture', ' & Arch.');

interface ServicesProps {
  items: PortfolioItem[];
  deliveryDays?:number;
  onBook: (serviceId: string, hours?: number) => void;
}

/** Services and pricing in one place: pick a shoot by its photo, then compare its packages. */
export default function Services({ items, onBook, deliveryDays }: ServicesProps) {
  const [serviceId, setServiceId] = useState(SERVICES[0].id);
  const service = SERVICES.find((entry) => entry.id === serviceId) || SERVICES[0];
  const covers = useMemo(() => Object.fromEntries(SERVICES.map((entry) => [entry.id, coverFor(entry, items)])), [items]);
  const ServiceIconLarge = SERVICE_ICONS[service.icon];

  const showExamples = () => {
    window.dispatchEvent(new CustomEvent(PORTFOLIO_FILTER_EVENT, { detail: {category:service.portfolioCategory, subtype:service.id === 'birthday' ? 'birthday' : 'all', excludeBirthdays:service.id === 'event'} }));
    scrollToSection('portfolio');
  };

  const select = (id: string, focus = false) => {
    setServiceId(id); countStep('service_view',id);
    if (focus) document.getElementById(`service-tab-${id}`)?.focus();
  };

  return (
    <section id="services" className="section services-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Services &amp; pricing</p>
          <h2 className="section-title">Pick your shoot</h2>
          <p className="section-lead">
            Every session is priced per hour, so you only pay for the coverage you need. Hold a time before sending the {Math.round(DOWNPAYMENT_RATE * 100)}% GCash deposit. The studio confirms after reviewing your payment.
          </p>
        </header>

        <div className="service-rail" role="tablist" aria-label="Choose a service">
          {SERVICES.map((entry, index) => {
            const Icon = SERVICE_ICONS[entry.icon];
            const cover = covers[entry.id];
            const selected = entry.id === serviceId;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`service-tab-${entry.id}`}
                aria-selected={selected}
                aria-controls="pricing"
                tabIndex={selected ? 0 : -1}
                className={`service-tile ${selected ? 'is-active' : ''} ${cover ? '' : 'is-plain'}`}
                onClick={() => select(entry.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                  event.preventDefault();
                  const next = SERVICES[(index + (event.key === 'ArrowRight' ? 1 : -1) + SERVICES.length) % SERVICES.length];
                  select(next.id, true);
                }}
              >
                <span className="service-tile-media" aria-hidden="true">
                  {cover ? <Picture item={cover} alt="" sizes="(max-width: 900px) 44vw, 240px" /> : <Icon size={40} />}
                </span>
                <span className="service-tile-body">
                  <span className="service-tile-title">{shortTitle(entry.title)}</span>
                  <span className="service-tile-rate">{formatPeso(entry.rate)}/hr</span>
                </span>
              </button>
            );
          })}
        </div>

        <div id="pricing" role="tabpanel" aria-labelledby={`service-tab-${service.id}`} className="service-panel" key={service.id}>
          <div className="service-panel-intro">
            <span className="service-icon">
              <ServiceIconLarge size={22} aria-hidden="true" />
            </span>
            <h3>{service.title}</h3>
            <p>{service.description}</p>
            <p className="service-ideal">
              <span>Ideal for</span> {service.idealFor}
            </p>
            <p>{deliveryDays ? 'Gallery delivery target: '+deliveryDays+' days after the shoot. ' : ''}Ask for your edited-photo count and venue travel quote before paying.</p>
            <button type="button" className="btn-link" onClick={()=>askStudio(service.id)}>Ask the studio</button> · <a href={'/services/'+service.id+'/'}>View service details</a>
            <ul className="check-list">
              {INCLUDED_IN_EVERY_SESSION.map((line) => (
                <li key={line}>
                  <Check size={16} aria-hidden="true" /> {line}
                </li>
              ))}
            </ul>
            <button type="button" className="btn-link" onClick={covers[service.id] ? showExamples : () => askStudio(service.id)}>
              {covers[service.id] ? 'See '+shortTitle(service.title).toLowerCase()+' examples' : 'Ask for a sample or quote'} <ArrowRight size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="package-grid">
            {service.packages.map((pack) => {
              const total = service.rate * pack.hours;
              return (
                <article key={pack.name} className={`package-card ${pack.recommended ? 'is-recommended' : ''}`}>
                  {pack.recommended && <span className="package-flag">Recommended</span>}
                  <div className="package-head">
                    <h4>{pack.name}</h4>
                    <p className="package-hours">{hoursLabel(pack.hours)}</p>
                  </div>
                  <p className="package-price">
                    <strong>{formatPeso(total)}</strong>
                    <span className="package-down">{formatPeso(total * DOWNPAYMENT_RATE)} deposit</span>
                  </p>
                  <p className="package-note">{pack.note}</p>
                  <button type="button" className={`btn ${pack.recommended ? 'btn-primary' : 'btn-outline'} btn-block`} onClick={() => {countStep('package',service.id);onBook(service.id, pack.hours);}}>
                    Book {pack.name}
                  </button>
                </article>
              );
            })}
          </div>
        </div>

        <div className="pricing-footnote">
          <Info size={18} aria-hidden="true" />
          <p>
            Need a different length? Choose an available duration at {formatPeso(service.rate)}/hour. A transportation fee based on your venue is added after we review your booking, and you will see it in your account before the shoot.
          </p>
        </div>
      </div>
    </section>
  );
}
