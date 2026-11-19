import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { RECEIPTS_BUCKET } from './images';

export interface SlotHold {
  id: string;
  expires_at: string;
  service: string;
  date: string;
  start: string;
  end: string;
}

const prefix = 'tps:payment-hold:';
export function clearBookingDrafts() {
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (
        key.startsWith('tps:booking-draft') ||
        key.startsWith(prefix) ||
        key.startsWith('tps-booking-submit:')
      )
        sessionStorage.removeItem(key);
    }
  } catch {
    /* The React form is also unmounted on account changes. */
  }
}

export function useBookingHold(
  userId: string | null,
  onResume: (h: SlotHold) => void,
  onRecovered: (row: any) => void,
) {
  const [hold, setHold] = useState<SlotHold | null>(null);
  const [checking, setChecking] = useState(Boolean(userId));
  const [problem, setProblem] = useState('');
  const [revision, setRevision] = useState(0);
  const [now, setNow] = useState(Date.now);
  const remember = useCallback(
    (h: SlotHold | null) => {
      setHold(h);
      if (!userId) return;
      try {
        if (h) sessionStorage.setItem(prefix + userId, JSON.stringify(h));
        else sessionStorage.removeItem(prefix + userId);
      } catch {
        /* Server retains the active hold. */
      }
    },
    [userId],
  );

  useEffect(() => {
    if (!userId) return;
    let mounted = true;
    setChecking(true);
    setProblem('');
    void (async () => {
      let saved: SlotHold | null = null;
      try {
        saved = JSON.parse(sessionStorage.getItem(prefix + userId) || 'null');
      } catch {
        /* unavailable */
      }
      if (saved?.id) {
        const { data, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('user_id', userId)
          .eq('client_request_id', saved.id)
          .maybeSingle();
        if (error) throw error;
        if (data && mounted) {
          remember(null);
          onRecovered(data);
          return;
        }
      }
      const { data, error } = await supabase.rpc('studio_current_hold');
      if (error) throw error;
      if (!mounted) return;
      const current: SlotHold | null =
        data ||
        (saved ? { ...saved, expires_at: new Date(0).toISOString() } : null);
      remember(current);
      if (data) onResume(data);
    })()
      .catch(() => {
        if (mounted)
          setProblem(
            'We could not verify your previous booking or hold. Check again before paying.',
          );
      })
      .finally(() => {
        if (mounted) setChecking(false);
      });
    return () => {
      mounted = false;
    };
  }, [userId, revision, remember, onRecovered, onResume]);

  useEffect(() => {
    if (!hold) return;
    const refresh = () => setNow(Date.now());
    refresh();
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener('focus', refresh);
    };
  }, [hold]);

  return {
    hold,
    remember,
    checking,
    problem,
    retry: () => setRevision((n) => n + 1),
    active: !!hold && Date.parse(hold.expires_at) > now,
  };
}

// Retrying the same proof uses the same private object; a replacement has its own hash.
export async function uploadHoldReceipt(
  owner: string,
  key: string,
  file: Blob,
) {
  const hash = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const digest = Array.from(new Uint8Array(hash), (n) =>
    n.toString(16).padStart(2, '0'),
  ).join('');
  const path = owner + '/' + key + '-' + digest + '.jpg';
  const { error } = await supabase.storage
    .from(RECEIPTS_BUCKET)
    .upload(path, file, {
      contentType: 'image/jpeg',
      upsert: false,
      cacheControl: '0',
    });
  if (error && !['409', '400'].includes(String((error as any).statusCode)))
    throw error;
  if (error) {
    const { data, error: readError } = await supabase.storage
      .from(RECEIPTS_BUCKET)
      .createSignedUrl(path, 30);
    if (readError || !data?.signedUrl) throw error;
  }
  return path;
}
