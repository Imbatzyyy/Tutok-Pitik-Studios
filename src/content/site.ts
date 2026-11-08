// Single source of truth for studio info, services, packages and FAQ.
// Edit this file to change prices, copy or contact details everywhere on the site.

export const STUDIO = {
  name: 'Tutok Pitik Studios',
  founder: 'Prince Balane',
  foundedYear: 2023,
  email: 'tutokpitikstudios@gmail.com',
  phoneDisplay: '+63 962 4323 187',
  phoneHref: 'tel:+639624323187',
  location: 'Quezon City, Philippines',
  serviceArea: 'Quezon City & Metro Manila',
  socials: {
    instagram: 'https://www.instagram.com/tutokpitikstudios_/',
    facebook: 'https://www.facebook.com/profile.php?id=61554013355967',
    behance: 'https://www.behance.net/princebalane',
    messenger: 'https://m.me/61554013355967',
  },
};

export const STATS = {
  projects: 16,
  clients: 103,
  years: Math.max(1, new Date().getFullYear() - STUDIO.foundedYear),
};

export const DOWNPAYMENT_RATE = 0.5;
export const MAX_ACTIVE_BOOKINGS = 3;

export type ServiceIcon = 'portrait' | 'birthday' | 'event' | 'commercial' | 'landscape';

export interface ServicePackage {
  name: string;
  hours: number;
  recommended?: boolean;
  note: string;
}

export interface Service {
  id: string;
  /** Stored on bookings as the service name; keep stable once customers have booked. */
  title: string;
  rate: number;
  icon: ServiceIcon;
  description: string;
  idealFor: string;
  portfolioCategory: string;
  packages: ServicePackage[];
}

export const SERVICES: Service[] = [
  {
    id: 'portrait',
    title: 'Portrait Photography',
    rate: 2500,
    icon: 'portrait',
    description: 'Personal, graduation, couple and street portraits that capture personality with artistic precision.',
    idealFor: 'Graduation, couples, personal branding',
    portfolioCategory: 'portrait',
    packages: [
      { name: 'Essential', hours: 1, note: 'One look, one location' },
      { name: 'Signature', hours: 2, recommended: true, note: 'Two looks, relaxed pacing' },
      { name: 'Story', hours: 4, note: 'Multiple looks and locations' },
    ],
  },
  {
    id: 'birthday',
    title: 'Birthday Photography',
    rate: 1000,
    icon: 'birthday',
    description: 'Genuine moments, emotions and celebrations, from intimate gatherings to big birthday parties.',
    idealFor: '1st birthdays, debuts, family parties',
    portfolioCategory: 'events',
    packages: [
      { name: 'Essential', hours: 2, note: 'Key moments and portraits' },
      { name: 'Signature', hours: 4, recommended: true, note: 'Program, guests and details' },
      { name: 'Full Party', hours: 6, note: 'Arrival to last dance' },
    ],
  },
  {
    id: 'event',
    title: 'Event Coverage',
    rate: 1500,
    icon: 'event',
    description: 'School programs, corporate events, concerts and stage performances, even in challenging low light.',
    idealFor: 'Schools, concerts, corporate, festivals',
    portfolioCategory: 'events',
    packages: [
      { name: 'Essential', hours: 3, note: 'Main program coverage' },
      { name: 'Signature', hours: 5, recommended: true, note: 'Program, crowd and candids' },
      { name: 'Full Day', hours: 8, note: 'Complete event documentation' },
    ],
  },
  {
    id: 'commercial',
    title: 'Commercial Photography',
    rate: 4000,
    icon: 'commercial',
    description: 'Product, brand and lifestyle images built for your website, ads and social media.',
    idealFor: 'Small businesses, brands, food & products',
    portfolioCategory: 'commercial',
    packages: [
      { name: 'Essential', hours: 2, note: 'Focused product set' },
      { name: 'Signature', hours: 4, recommended: true, note: 'Products plus lifestyle scenes' },
      { name: 'Campaign', hours: 8, note: 'Full-day brand production' },
    ],
  },
  {
    id: 'landscape',
    title: 'Landscape & Architecture',
    rate: 3000,
    icon: 'landscape',
    description: 'Architectural, interior and landscape photography that showcases beauty and design.',
    idealFor: 'Venues, interiors, real estate, travel',
    portfolioCategory: 'creative',
    packages: [
      { name: 'Essential', hours: 2, note: 'One property or location' },
      { name: 'Signature', hours: 4, recommended: true, note: 'Interiors, exteriors and details' },
      { name: 'Full Day', hours: 6, note: 'Golden hour and multiple sites' },
    ],
  },
];

export const INCLUDED_IN_EVERY_SESSION = [
  'Professional editing and color grading',
  'Private Google Drive delivery',
  'Booking status and photos tracked in your account',
  'Official PDF receipt',
];

export const findService = (value?: string | null) => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  return SERVICES.find(
    (service) =>
      service.id === normalized ||
      service.title.toLowerCase() === normalized ||
      normalized.startsWith(service.title.toLowerCase())
  );
};

export const BOOKING_STEPS = [
  { title: 'Pick a service & date', text: 'Choose your session, see the price instantly and check which dates are still open.' },
  { title: 'Secure your slot', text: 'Pay the 50% downpayment through GCash and upload your receipt. That reserves your date.' },
  { title: 'We confirm & shoot', text: 'We review your booking, confirm by email and show up ready on the day.' },
  { title: 'Receive your photos', text: 'Your edited photos arrive in a private Google Drive folder linked in your account.' },
];

export const FAQS = [
  {
    q: 'How do I book a session?',
    a: 'Pick a service, date and time in the booking form, pay the 50% downpayment through GCash and upload your receipt. We review it and confirm by email. You can follow every update in Profile → Bookings.',
  },
  {
    q: 'How much is the downpayment?',
    a: 'The downpayment is 50% of the session price, paid through GCash when you book. The remaining balance, plus any transportation fee, is paid on the day of the shoot.',
  },
  {
    q: 'Do you shoot on location?',
    a: `Yes. We are based in ${STUDIO.location.split(',')[0]} and travel to your venue. A transportation fee based on your address is added after review and shown in your Bookings tab before the shoot.`,
  },
  {
    q: 'How will I receive my photos?',
    a: 'Your edited photos are delivered through a private Google Drive link. The link appears in your account as soon as your photos are ready.',
  },
  {
    q: 'Can I reschedule?',
    a: 'Message us on Messenger, call or email with your booking reference as early as possible and we will help you find a new date.',
  },
  {
    q: 'Why do I need an account to book?',
    a: 'Your booking, payment receipt, status updates and photo delivery link are all kept together in your account, so nothing gets lost in chat threads.',
  },
];

/** Booking hours offered in the form (24h clock). Sessions can start 08:00–19:00 and end by 20:00. */
export const FIRST_START_HOUR = 8;
export const LAST_END_HOUR = 20;
export const MAX_SESSION_HOURS = 8;
/** Earliest bookable day, counted from today (1 = tomorrow) so there is time to review the payment. */
export const MIN_LEAD_DAYS = 1;
/** How far ahead customers can book. */
export const BOOKING_WINDOW_MONTHS = 6;

/** Map a portfolio photo to the service a visitor would book for a similar shoot. */
export const serviceForPortfolio = (category?: string, subCategory?: string) => {
  if (category === 'events') return subCategory === 'birthday' ? 'birthday' : 'event';
  if (category === 'commercial') return 'commercial';
  if (category === 'creative') return 'landscape';
  if (category === 'documentary') return 'event';
  return 'portrait';
};
