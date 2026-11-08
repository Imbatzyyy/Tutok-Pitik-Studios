import { appFetch, projectId, supabase } from './supabase';

const FUNCTION_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-032fda65`;

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

/** Call the studio's Supabase edge function with the signed-in user's token. */
export async function callEdge<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new ApiError('Please sign in again.', 401);

  const response = await appFetch(`${FUNCTION_BASE}${path}`, {
    method: init.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  let payload: any = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    throw new ApiError(payload?.error || payload?.message || `Request failed (${response.status})`, response.status);
  }
  return payload as T;
}

/** Fire-and-forget variant for notification emails: never blocks the main action. */
export async function notify(path: string, body: unknown) {
  try {
    await callEdge(path, { method: 'POST', body });
  } catch (error) {
    console.warn(`Notification ${path} failed:`, error);
  }
}

/** True when a Supabase error means the table/function does not exist yet (migration not applied). */
export const isMissingRelation = (error: any) => {
  if (!error) return false;
  const code = String(error.code || '');
  const message = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    code === '42883' ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('could not find the function')
  );
};

export const errorMessage = (error: unknown, fallback = 'Something went wrong. Please try again.') => {
  if (!error) return fallback;
  if (error instanceof Error) return error.message || fallback;
  if (typeof error === 'object' && 'message' in (error as any)) return String((error as any).message || fallback);
  return fallback;
};
