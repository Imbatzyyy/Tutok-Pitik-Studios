import { useRef, useState, type FormEvent } from 'react';
import { SERVICES } from '../content/site';
import { visitContext } from '../lib/client-experience';

export default function Inquiry({
  serviceId = 'other',
}: {
  serviceId?: string;
}) {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [channel, setChannel] = useState('email');
  const request = useRef({ body: '', id: '' });
  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = Object.fromEntries(new FormData(form));
    const body = JSON.stringify(fields);
    if (request.current.body !== body)
      request.current = { body, id: crypto.randomUUID() };
    setBusy(true);
    setStatus('');
    try {
      const response = await fetch('/.netlify/functions/studio-contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...fields,
          key: request.current.id,
          kind: 'inquiry',
          optOut: navigator.doNotTrack === '1',
          stage: 'inquiry',
          ...visitContext(),
        }),
      });
      const result = await response.json();
      setStatus(result.message);
      if (response.ok) {
        form.reset();
        setChannel('email');
        request.current = { body: '', id: '' };
      }
    } catch {
      setStatus(
        'We could not confirm receipt. Retry here or email the studio.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <details id="ask-studio" className="contact-card inquiry">
      <summary>Ask about this shoot</summary>
      <form onSubmit={send}>
        <p>
          Ask about edited-photo counts, a travel quote or your preferred date.
          Choose how you would like the studio to reply.
        </p>
        <label>
          Service
          <select name="service" defaultValue={serviceId}>
            {SERVICES.map((s) => (
              <option value={s.id} key={s.id}>
                {s.title}
              </option>
            ))}
            <option value="other">Other question</option>
          </select>
        </label>
        <label>
          Your name
          <input name="name" required maxLength={100} autoComplete="name" />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            required
            maxLength={254}
            autoComplete="email"
          />
        </label>
        <label>
          Preferred reply
          <select value={channel} onChange={(e) => setChannel(e.target.value)}>
            <option value="email">Email</option>
            <option value="phone">Phone call</option>
          </select>
        </label>
        {channel === 'phone' && (
          <label>
            Number for our call
            <input
              name="phone"
              required
              type="tel"
              minLength={7}
              maxLength={22}
              autoComplete="tel"
            />
          </label>
        )}
        <label>
          Preferred date (optional)
          <input name="date" type="date" />
        </label>
        <label>
          Question
          <textarea name="message" required minLength={5} maxLength={2000} />
        </label>
        <small>
          We use these details to answer your inquiry.{' '}
          <a href="/privacy">Data Privacy Notice</a>
        </small>
        <button className="btn btn-primary" disabled={busy}>
          {busy ? 'Sending…' : 'Send inquiry'}
        </button>
        <p role="status">{status}</p>
      </form>
    </details>
  );
}
export function askStudio(serviceId?: string) {
  const el = document.querySelector<HTMLDetailsElement>('#ask-studio');
  if (!el) return;
  el.open = true;
  const select = el.querySelector('select');
  if (select && serviceId) select.value = serviceId;
  el.scrollIntoView({ block: 'start' });
  el.querySelector<HTMLInputElement>('[name=name]')?.focus({
    preventScroll: true,
  });
}
