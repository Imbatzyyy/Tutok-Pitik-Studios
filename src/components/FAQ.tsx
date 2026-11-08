import { ChevronDown, MessageCircle } from 'lucide-react';
import { FAQS, STUDIO } from '../content/site';

const faqSchema = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQS.map((faq) => ({ '@type': 'Question', name: faq.q, acceptedAnswer: { '@type': 'Answer', text: faq.a } })),
});

export default function FAQ() {
  return (
    <section id="faq" className="section faq-section">
      <div className="container faq-grid">
        <header className="section-head faq-head">
          <p className="eyebrow">FAQ</p>
          <h2 className="section-title">Questions before you book</h2>
          <p className="section-lead">Still unsure about something? Send us a message and we will help you plan your shoot.</p>
          <a className="btn btn-outline" href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={18} /> Message us
          </a>
        </header>
        <div className="faq-list">
          {FAQS.map((faq, index) => (
            <details key={faq.q} className="faq-item" open={index === 0}>
              <summary>
                <span>{faq.q}</span>
                <ChevronDown size={20} aria-hidden="true" />
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqSchema }} />
    </section>
  );
}
