import { useState } from 'react';
import { Check, Info } from 'lucide-react';
import { DOWNPAYMENT_RATE, INCLUDED_IN_EVERY_SESSION, SERVICES } from '../content/site';
import { formatPeso, hoursLabel } from '../lib/format';
import { SERVICE_ICONS } from './Services';

interface PricingProps {
  onBook: (serviceId: string, hours?: number) => void;
}

export default function Pricing({ onBook }: PricingProps) {
  const [serviceId, setServiceId] = useState(SERVICES[0].id);
  const service = SERVICES.find((entry) => entry.id === serviceId) || SERVICES[0];

  return (
    <section id="pricing" className="section pricing-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">Pricing</p>
          <h2 className="section-title">Simple packages, no surprises</h2>
          <p className="section-lead">
            Choose a service to compare packages. Reserve your date with a {Math.round(DOWNPAYMENT_RATE * 100)}% GCash downpayment and pay the rest on the day of the shoot.
          </p>
        </header>

        <div className="segmented" role="tablist" aria-label="Choose a service">
          {SERVICES.map((entry) => {
            const Icon = SERVICE_ICONS[entry.icon];
            const selected = entry.id === serviceId;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                id={`pricing-tab-${entry.id}`}
                aria-selected={selected}
                aria-controls="pricing-panel"
                tabIndex={selected ? 0 : -1}
                className={selected ? 'is-active' : ''}
                onClick={() => setServiceId(entry.id)}
                onKeyDown={(event) => {
                  if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
                  const current = SERVICES.findIndex((item) => item.id === serviceId);
                  const next = SERVICES[(current + (event.key === 'ArrowRight' ? 1 : -1) + SERVICES.length) % SERVICES.length];
                  setServiceId(next.id);
                  document.getElementById(`pricing-tab-${next.id}`)?.focus();
                }}
              >
                <Icon size={18} aria-hidden="true" />
                <span>{entry.title.replace(' Photography', '').replace(' & Architecture', ' & Arch.')}</span>
              </button>
            );
          })}
        </div>

        <div id="pricing-panel" role="tabpanel" aria-labelledby={`pricing-tab-${service.id}`} className="package-grid">
          {service.packages.map((pack) => {
            const total = service.rate * pack.hours;
            return (
              <article key={pack.name} className={`package-card ${pack.recommended ? 'is-recommended' : ''}`}>
                {pack.recommended && <span className="package-flag">Recommended</span>}
                <h3>{pack.name}</h3>
                <p className="package-hours">{hoursLabel(pack.hours)} of coverage</p>
                <p className="package-price">
                  <strong>{formatPeso(total)}</strong>
                </p>
                <p className="package-down">
                  {formatPeso(total * DOWNPAYMENT_RATE)} downpayment to reserve
                </p>
                <p className="package-note">{pack.note}</p>
                <ul className="check-list">
                  {INCLUDED_IN_EVERY_SESSION.slice(0, 3).map((line) => (
                    <li key={line}>
                      <Check size={16} aria-hidden="true" /> {line}
                    </li>
                  ))}
                </ul>
                <button type="button" className={`btn ${pack.recommended ? 'btn-primary' : 'btn-outline'} btn-block`} onClick={() => onBook(service.id, pack.hours)}>
                  Book {pack.name}
                </button>
              </article>
            );
          })}
        </div>

        <div className="pricing-footnote">
          <Info size={18} aria-hidden="true" />
          <p>
            Need a different length? Any number of hours works at {formatPeso(service.rate)}/hour. A transportation fee based on your venue is added after we review your booking, and you will see it in your account before the shoot.
          </p>
        </div>
      </div>
    </section>
  );
}
