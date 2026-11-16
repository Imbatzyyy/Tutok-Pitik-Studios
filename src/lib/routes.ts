import type { ProfileTab } from '../components/UserProfile';

// Addresses the main site answers to. Anything else gets the 404 page.
// Kept free of component imports so the lazy profile and admin bundles stay lazy.

export const PROFILE_TABS: ProfileTab[] = ['bookings', 'favorites', 'account'];
export const ADMIN_TABS = ['overview', 'bookings', 'users', 'portfolio', 'availability', 'reviews', 'payments', 'customers', 'activity', 'inbox'];

export type SiteRoute =
  | { view: 'home' }
  | { view: 'account'; tab?: ProfileTab }
  | { view: 'admin'; tab?: string; bookingId?: string };

export const HOME: SiteRoute = { view: 'home' };

export function parseRoute(pathname: string): SiteRoute | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts.length === 0 || (parts.length === 1 && parts[0] === 'index.html')) return HOME;

  if (parts[0] === 'account' && parts.length <= 2) {
    const tab = parts[1] as ProfileTab | undefined;
    return !tab || PROFILE_TABS.includes(tab) ? { view: 'account', tab } : null;
  }

  if (parts[0] === 'admin') {
    if (parts.length === 1) return { view: 'admin' };
    if (parts.length === 2 && ADMIN_TABS.includes(parts[1])) return { view: 'admin', tab: parts[1] };
    if (parts.length === 3 && parts[1] === 'bookings') {
      try {
        return { view: 'admin', tab: 'bookings', bookingId: decodeURIComponent(parts[2]) };
      } catch {
        return null;
      }
    }
  }

  return null;
}
