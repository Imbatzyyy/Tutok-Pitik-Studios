import { supabase, setRememberMePreference } from './supabase';
import { resolveSessionUser } from './session';

export const GOOGLE_START_PATH = '/auth/google';
export const GOOGLE_CALLBACK_PATH = '/auth/callback';
const ATTEMPT_KEY = 'tps:google-signin';
const MAX_AGE = 10 * 60 * 1000;
const RETURN_PATHS = ['/', '/#contact', '/account', '/admin'] as const;
type ReturnPath = (typeof RETURN_PATHS)[number];
type Attempt = { startedAt: number; returnTo: ReturnPath };

/** Where to land after Google: the booking form, the page that asked for sign-in, or home. */
const returnPathFor = (booking: boolean): ReturnPath => {
  if (booking) return '/#contact';
  const section = `/${window.location.pathname.split('/')[1] || ''}`;
  return section === '/account' || section === '/admin' ? section : '/';
};

/** Store only navigation state, never credentials or customer details. */
export function prepareGoogleSignIn(remember: boolean, booking: boolean) {
  setRememberMePreference(remember);
  sessionStorage.setItem(ATTEMPT_KEY, JSON.stringify({
    startedAt: Date.now(), returnTo: returnPathFor(booking),
  } satisfies Attempt));
  window.location.assign(GOOGLE_START_PATH);
}

export function readGoogleAttempt(): Attempt | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(ATTEMPT_KEY) || 'null');
    if (!value || !Number.isFinite(value.startedAt)
      || value.startedAt > Date.now() || Date.now() - value.startedAt > MAX_AGE
      || !RETURN_PATHS.includes(value.returnTo)) return null;
    return value;
  } catch { return null; }
}

export function clearGoogleAttempt() {
  sessionStorage.removeItem(ATTEMPT_KEY);
}

export async function beginGoogleSignIn() {
  if (!readGoogleAttempt()) throw new Error('Start Google sign-in from the website and try again.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}${GOOGLE_CALLBACK_PATH}`,
      scopes: 'openid email profile',
      queryParams: { prompt: 'select_account' },
      skipBrowserRedirect: true,
    },
  });
  if (error || !data.url) throw new Error('Google sign-in is temporarily unavailable. Please use email sign-in or try again shortly.');
  window.location.assign(data.url);
}

export async function finishGoogleSignIn() {
  const url = new URL(window.location.href);
  const params = url.searchParams;
  const hash = new URLSearchParams(url.hash.slice(1));
  const code = params.get('code');
  const denied = params.has('error') || hash.has('error');
  // Remove one-use codes and provider errors from browser history immediately.
  window.history.replaceState({}, '', GOOGLE_CALLBACK_PATH);
  const attempt = readGoogleAttempt();
  clearGoogleAttempt();
  if (denied) throw new Error('Google sign-in was cancelled or could not be completed. You can try again or sign in with email.');
  if (!code || !attempt) throw new Error('This sign-in link is missing or expired. Start Google sign-in again in this browser.');
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.session || !data.user) {
    throw new Error('This sign-in link could not be verified. Please start Google sign-in again in this browser.');
  }
  await resolveSessionUser(data.user);
  return attempt.returnTo;
}
