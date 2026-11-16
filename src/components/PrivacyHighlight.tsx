import { ArrowUpRight, ShieldCheck } from 'lucide-react';

export default function PrivacyHighlight({ onRead, compact = false }: { onRead?: () => void; compact?: boolean }) {
  return <aside className={`privacy-highlight${compact ? ' privacy-highlight-compact' : ''}`} aria-label="Your privacy and Republic Act No. 10173">
    <ShieldCheck size={22} aria-hidden="true" />
    <div><strong>Your privacy matters.</strong><p>Encrypted connections. Restricted access to your records.</p>
      {onRead ? <button type="button" className="privacy-read-link" onClick={onRead}>Data Privacy Notice · RA 10173 <ArrowUpRight size={14} aria-hidden="true" /></button>
        : <a className="privacy-read-link" href="/privacy" target="_blank" rel="noopener noreferrer">Data Privacy Notice · RA 10173 <ArrowUpRight size={14} aria-hidden="true" /><span className="sr-only"> (opens in a new tab)</span></a>}
    </div>
  </aside>;
}
