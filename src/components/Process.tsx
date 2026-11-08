import { CalendarCheck, Camera, Images, Wallet } from 'lucide-react';
import { BOOKING_STEPS } from '../content/site';

const ICONS = [CalendarCheck, Wallet, Camera, Images];

export default function Process({ onBook }: { onBook: () => void }) {
  return (
    <section id="process" className="section process-section">
      <div className="container">
        <header className="section-head">
          <p className="eyebrow">How it works</p>
          <h2 className="section-title">From booking to photos in four steps</h2>
        </header>
        <ol className="process-list">
          {BOOKING_STEPS.map((step, index) => {
            const Icon = ICONS[index] || Camera;
            return (
              <li key={step.title} className="process-step">
                <span className="process-index">{String(index + 1).padStart(2, '0')}</span>
                <Icon size={26} aria-hidden="true" className="process-icon" />
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </li>
            );
          })}
        </ol>
        <div className="center-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={onBook}>
            Start your booking
          </button>
        </div>
      </div>
    </section>
  );
}
