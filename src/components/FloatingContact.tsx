import { useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, X } from 'lucide-react';
import { STUDIO } from '../content/site';

/** Bottom-right quick contact: Messenger, call, email. */
export default function FloatingContact() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 480);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <div className={`float-contact ${visible || open ? 'is-visible' : ''} ${open ? 'is-open' : ''}`}>
      <div className="float-contact-menu" id="float-contact-menu" hidden={!open}>
        <a href={STUDIO.socials.messenger} target="_blank" rel="noopener noreferrer" className="float-contact-item">
          <MessageCircle size={18} /> Messenger
        </a>
        <a href={STUDIO.phoneHref} className="float-contact-item">
          <Phone size={18} /> Call {STUDIO.phoneDisplay}
        </a>
        <a href={`mailto:${STUDIO.email}`} className="float-contact-item">
          <Mail size={18} /> Email us
        </a>
      </div>
      <button
        type="button"
        className="float-contact-toggle"
        aria-expanded={open}
        aria-controls="float-contact-menu"
        aria-label={open ? 'Close contact options' : 'Contact us'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
