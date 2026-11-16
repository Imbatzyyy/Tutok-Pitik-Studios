import { useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import logoImage from '../assets/logo-160.png';
import { STUDIO } from '../content/site';

export function PolicyContent({ type }: { type: 'terms' | 'privacy' }) {
  return type === 'terms' ? <div className="policy-text">
    <p><strong>Account use.</strong> Use your account for legitimate {STUDIO.name} services, including bookings, inquiries and profile management.</p>
    <p><strong>Accurate information.</strong> Provide accurate contact and booking details, and keep them up to date.</p>
    <p><strong>Bookings and payments.</strong> Reservations remain pending until the studio reviews availability and verifies your GCash payment. A submitted booking or email acknowledgment does not itself confirm payment or reserve a date.</p>
    <p><strong>Google sign-in.</strong> You may use Google to create an account or sign in. Keep your Google account secure; the studio never asks for your Google password.</p>
    <p><strong>Your responsibility.</strong> Protect your account, sign out on shared devices, and contact us promptly about unauthorized activity.</p>
    <p><strong>Service arrangements.</strong> Contact the studio to agree on changes, cancellations, rescheduling or refunds. Pricing and service requirements are shown during booking and may change for future bookings.</p>
    <p><strong>Contact.</strong> Email <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> with account or booking questions.</p>
  </div> : <div className="policy-text">
    <p><strong>Who handles your data.</strong> {STUDIO.name} uses your information to provide photography and reservation services. Contact <a href={`mailto:${STUDIO.email}`}>{STUDIO.email}</a> about privacy, access, correction or account deletion.</p>
    <p><strong>What we collect.</strong> Your name, email, contact details, booking details, payment receipts and files you choose to upload. Google sign-in supplies your basic Google profile, email and account identifier; it does not give us your Google password.</p>
    <p><strong>How we use it.</strong> To sign you in, associate bookings with your account, verify payments, deliver services and send booking or account emails. Google access is limited to basic identity information; we do not request access to your Gmail messages, contacts or Drive files.</p>
    <p><strong>Service providers.</strong> Supabase hosts account, database and file services; Netlify hosts the website; Resend delivers transactional emails; Google verifies your identity when you choose Google sign-in. These providers process information needed for those functions and may process it outside the Philippines.</p>
    <p><strong>Protection and access.</strong> HTTPS protects information in transit, and Supabase encrypts hosted data at rest. Customer records and payment receipts have access controls. Authorized studio personnel can access information needed to manage your booking; this is not end-to-end encryption that hides records from the studio.</p>
    <p><strong>Browser storage.</strong> Your browser stores your sign-in session and booking draft. “Keep me signed in” retains the session across visits. Sign out after using a shared device.</p>
    <p><strong>Retention and requests.</strong> We retain information needed to provide services, resolve booking or payment questions and meet applicable obligations. Contact us to request access, correction or deletion; some records may need to be retained for those purposes.</p>
    <p><strong>Your choices.</strong> Google sign-in is optional; email and password remain available. You can revoke the Google connection in your Google account. Revoking that connection does not itself delete your studio bookings; contact us for account deletion.</p>
  </div>;
}

export default function PolicyPage({ type }: { type: 'terms' | 'privacy' }) {
  const title = type === 'terms' ? 'Terms and Conditions' : 'Data Privacy Notice';
  useEffect(() => { document.title = `${title} · ${STUDIO.name}`; }, [title]);
  return <main className="policy-page container">
    <a className="btn btn-ghost" href="/"><ArrowLeft size={18} /> Back to the website</a>
    <img src={logoImage} alt="Tutok Pitik Studios" width={64} height={64} />
    <h1>{title}</h1><p className="field-hint">Updated November 16, 2026</p>
    <PolicyContent type={type} />
  </main>;
}
