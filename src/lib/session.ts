import { supabase } from './supabase';

export interface SessionUser {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'superadmin' | 'admin' | 'staff' | 'customer' | 'guest';
  profilePicture: string;
  joinDate: string;
}

export const GUEST_USER: SessionUser = {
  id: 'guest',
  firstName: '',
  lastName: '',
  username: '',
  fullName: 'Guest',
  email: '',
  phone: '',
  role: 'guest',
  profilePicture: '',
  joinDate: '',
};

const VALID_ROLES = ['superadmin', 'admin', 'staff', 'customer'];
const normalizeRole = (role?: string) => {
  if (role === 'super_admin') return 'superadmin';
  return VALID_ROLES.includes(role || '') ? (role as SessionUser['role']) : 'customer';
};

const splitName = (name = '') => {
  const [first = '', ...rest] = name.trim().split(/\s+/);
  return { firstName: first, lastName: rest.join(' ') };
};

export const userFromProfile = (profile: any, authUser?: any): SessionUser => {
  const fullName = profile.full_name || authUser?.user_metadata?.full_name || authUser?.email?.split('@')[0] || 'User';
  return {
    id: profile.id,
    ...splitName(fullName),
    username: profile.username || authUser?.user_metadata?.username || '',
    fullName,
    email: profile.email || authUser?.email || '',
    phone: profile.phone || authUser?.user_metadata?.phone || '',
    role: normalizeRole(profile.role),
    profilePicture: profile.profile_picture_url || '',
    joinDate: profile.created_at || authUser?.created_at || new Date().toISOString(),
  };
};

/** Used only when the users row cannot be read. Never trusts a role from user metadata. */
export const userFromAuth = (authUser: any): SessionUser => {
  const fullName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'User';
  return {
    id: authUser.id,
    ...splitName(fullName),
    username: authUser.user_metadata?.username || '',
    fullName,
    email: authUser.email || '',
    phone: authUser.user_metadata?.phone || '',
    role: 'customer',
    profilePicture: '',
    joinDate: authUser.created_at || new Date().toISOString(),
  };
};

export async function fetchProfile(userId: string, retries = 4, delayMs = 350) {
  for (let attempt = 0; attempt < retries; attempt += 1) {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('id', userId).maybeSingle();
      if (!error && data) return data;
    } catch {
      /* retry */
    }
    if (attempt < retries - 1) await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
  }
  return null;
}

export const INACTIVE_ACCOUNT_MESSAGE = 'This account is inactive. Please contact the studio if you think this is a mistake.';

export class InactiveAccountError extends Error {
  constructor() {
    super(INACTIVE_ACCOUNT_MESSAGE);
    this.name = 'InactiveAccountError';
  }
}

/** Resolve the signed-in user's profile. Signs out and throws for accounts set to inactive by the studio. */
export async function resolveSessionUser(authUser: any) {
  const profile = await fetchProfile(authUser.id);
  if (profile?.status === 'inactive') {
    try {
      await supabase.auth.signOut();
    } catch {
      /* already signed out */
    }
    throw new InactiveAccountError();
  }
  return profile ? userFromProfile(profile, authUser) : userFromAuth(authUser);
}
