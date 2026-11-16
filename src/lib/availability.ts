import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { isMissingRelation } from './api';
import { toDateKey } from './format';
import { BOOKING_WINDOW_MONTHS, FIRST_START_HOUR, LAST_END_HOUR, MAX_SESSION_HOURS, MIN_LEAD_DAYS } from '../content/site';

export interface BookedSlot {
  date: string;
  start: number;
  end: number;
}

export interface ScheduleRules {opens_at:string;closes_at:string;max_hours:number;lead_days:number;}
const DEFAULT_RULES:ScheduleRules={opens_at:'08:00',closes_at:'20:00',max_hours:8,lead_days:1};
let currentRules=DEFAULT_RULES;
export interface AvailabilityState {
  rules:ScheduleRules;
  status: 'loading' | 'ready' | 'error';
  /** True when booked time slots could be read (needs the get_booked_slots function). */
  hasSlots: boolean;
  blocked: Record<string, string>;
  slots: Record<string, BookedSlot[]>;
  reload: () => void;
}

const hourOf = (time?: string | null) => {
  if (!time) return 0;
  const [hours = '0', minutes = '0'] = time.split(':');
  return Number(hours) + Number(minutes) / 60;
};

export const earliestBookableDate = () => {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=new Date(parts+'T00:00:00');
  date.setDate(date.getDate() + currentRules.lead_days);
  return date;
};

export const latestBookableDate = () => {
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const date=new Date(parts+'T00:00:00');
  date.setMonth(date.getMonth() + BOOKING_WINDOW_MONTHS);
  return date;
};

export function useAvailability(enabled = true): AvailabilityState {
  const [state, setState] = useState<Omit<AvailabilityState, 'reload'>>({ rules:DEFAULT_RULES,status: 'loading', hasSlots: false, blocked: {}, slots: {} });
  const [nonce, setNonce] = useState(0);
  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const start = toDateKey(new Date());
    const end = toDateKey(latestBookableDate());

    (async () => {
      const schedule=await supabase.rpc('studio_public_schedule');
      if(schedule.data)currentRules=schedule.data;
      const blocked: Record<string, string> = {};
      const slots: Record<string, BookedSlot[]> = {};
      let hasSlots = false;
      let failures = 0;

      try {
        // Public RPC returns dates only; the reason column stays team-only.
        const { data, error } = await supabase.rpc('get_blocked_dates', { start_date: start, end_date: end });
        if (error) {
          if (!isMissingRelation(error)) failures += 1;
        } else {
          (data || []).forEach((row: any) => {
            blocked[String(row.blocked_date).slice(0, 10)] = 'Unavailable';
          });
        }
      } catch {
        failures += 1;
      }

      try {
        const { data, error } = await supabase.rpc('get_booked_slots', { start_date: start, end_date: end });
        if (error) {
          if (!isMissingRelation(error)) failures += 1;
        } else {
          hasSlots = true;
          (data || []).forEach((row: any) => {
            const date = String(row.booking_date).slice(0, 10);
            (slots[date] ||= []).push({ date, start: hourOf(row.start_time), end: hourOf(row.end_time) });
          });
        }
      } catch {
        failures += 1;
      }

      if (!cancelled) setState({ rules:currentRules,status: failures > 0 ? 'error' : 'ready', hasSlots, blocked, slots });
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, nonce]);

  useEffect(()=>{if(!enabled)return;const visible=()=>{if(!document.hidden)reload();};const timer=window.setInterval(visible,60_000);document.addEventListener('visibilitychange',visible);window.addEventListener('online',reload);return()=>{clearInterval(timer);document.removeEventListener('visibilitychange',visible);window.removeEventListener('online',reload);};},[enabled,reload]);
  return { ...state, reload };
}

const overlaps = (start: number, end: number, slots: BookedSlot[] = []) => slots.some((slot) => start < slot.end && slot.start < end);

/** Start hours still free on a given date. */
export const freeStartHours = (slots: BookedSlot[] = []) => {
  const hours: number[] = [];
  for (let hour = Math.ceil(hourOf(currentRules.opens_at)); hour < hourOf(currentRules.closes_at); hour += 1) {
    if (!overlaps(hour, hour + 1, slots)) hours.push(hour);
  }
  return hours;
};

/** End hours that keep the session free of overlaps, starting from `start`. */
export const freeEndHours = (start: number, slots: BookedSlot[] = []) => {
  const hours: number[] = [];
  for (let end = start + 1; end <= Math.min(hourOf(currentRules.closes_at), start + currentRules.max_hours); end += 1) {
    if (overlaps(start, end, slots)) break;
    hours.push(end);
  }
  return hours;
};

export const isRangeFree = (start: number, end: number, slots: BookedSlot[] = []) => !overlaps(start, end, slots);

export type DayState = 'past' | 'blocked' | 'full' | 'limited' | 'open' | 'out-of-range';

export const dayState = (dateKey: string, availability: Pick<AvailabilityState, 'blocked' | 'slots'>): DayState => {
  const [year, month, dayOfMonth] = dateKey.split('-').map(Number);
  const date = new Date(year, month - 1, dayOfMonth);
  if (date < earliestBookableDate()) return 'past';
  if (date > latestBookableDate()) return 'out-of-range';
  if (availability.blocked[dateKey]) return 'blocked';
  const free = freeStartHours(availability.slots[dateKey]);
  if (free.length === 0) return 'full';
  if (free.length < LAST_END_HOUR - FIRST_START_HOUR) return 'limited';
  return 'open';
};

export const hourToTime = (hour: number) => `${String(Math.floor(hour)).padStart(2, '0')}:00`;
export const timeToHour = hourOf;
