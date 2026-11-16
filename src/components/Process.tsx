import { ArrowRight, CalendarCheck, Camera, Images, Wallet } from 'lucide-react';
import { BOOKING_STEPS } from '../content/site';

const ICONS = [CalendarCheck, Wallet, Camera, Images];

/** A short timeline: four steps from booking to delivered photos. */
export default function Process({ onBook }: { onBook: () => void }) {
  return (
    <section id="process" className="section process-section">
      <div className="container">
        <header className="process-head">
          <div>
            <p className="eyebrow">How it works</p>
            <h2 className="section-title">From booking to photos in four steps</h2>
          </div>
          <button type="button" className="btn btn-primary" onClick={onBook}>
            Start your booking <ArrowRight size={18} aria-hidden="true" />
          </button>
        </header>
        <ol className="process-timeline">
          {BOOKING_STEPS.map((step, index) => {
            const Icon = ICONS[index] || Camera;
            return (
              <li key={step.title} className="process-step">
                <span className="process-dot" aria-hidden="true">
                  <Icon size={20} />
                </span>
                <div>
                  <h3>
                    <span className="process-num">{index + 1}.</span> {step.title}
                  </h3>
                  <p>{step.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
