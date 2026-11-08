import { createClient } from '@supabase/supabase-js';

const REMEMBER_ME_KEY = 'tutok:remember_me';

const getRememberPreference = () => {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(REMEMBER_ME_KEY) === 'true';
};

const AUTH_STORAGE_KEY_PREFIX = 'sb-';

const migrateSupabaseSessionStorage = (remember: boolean) => {
  if (typeof window === 'undefined') return;

  const source = remember ? window.sessionStorage : window.localStorage;
  const target = remember ? window.localStorage : window.sessionStorage;

  for (let index = 0; index < source.length; index += 1) {
    const key = source.key(index);
    if (!key || !key.startsWith(AUTH_STORAGE_KEY_PREFIX)) continue;
    const value = source.getItem(key);
    if (value !== null) {
      target.setItem(key, value);
      source.removeItem(key);
      index -= 1;
    }
  }
};

const authStorage = {
  getItem(key: string) {
    if (typeof window === 'undefined') return null;
    const remember = getRememberPreference();
    const primary = remember ? window.localStorage : window.sessionStorage;
    const secondary = remember ? window.sessionStorage : window.localStorage;
    return primary.getItem(key) ?? secondary.getItem(key);
  },
  setItem(key: string, value: string) {
    if (typeof window === 'undefined') return;
    const remember = getRememberPreference();
    const primary = remember ? window.localStorage : window.sessionStorage;
    const secondary = remember ? window.sessionStorage : window.localStorage;
    primary.setItem(key, value);
    secondary.removeItem(key);
  },
  removeItem(key: string) {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify before deploying.'
  );
}

// Local testing only: VITE_DEMO_MODE=true swaps the network for an in-memory
// backend (see demo.ts). Production builds drop this branch entirely.
// A build-time constant, so the demo banner is also stripped from production.
export const isDemoMode = import.meta.env.VITE_DEMO_MODE === 'true';

const demoFetch: typeof fetch | undefined = isDemoMode
  ? (await import('./demo')).createDemoFetch(supabaseUrl)
  : undefined;

export const appFetch: typeof fetch = demoFetch || ((...args) => fetch(...args));

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: demoFetch ? { fetch: demoFetch } : undefined,
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: authStorage,
  },
});

export const setRememberMePreference = (remember: boolean) => {
  if (typeof window === 'undefined') return;
  if (remember) {
    window.localStorage.setItem(REMEMBER_ME_KEY, 'true');
  } else {
    window.localStorage.removeItem(REMEMBER_ME_KEY);
  }
  migrateSupabaseSessionStorage(remember);
};

export const getRememberMePreference = getRememberPreference;

const projectHost = new URL(supabaseUrl).hostname;
export const projectId = projectHost.replace('.supabase.co', '');
