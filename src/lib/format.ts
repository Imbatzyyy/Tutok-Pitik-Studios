export const formatPeso = (value: number | string | null | undefined, decimals = 0) => {
  const amount = Number(value || 0);
  return `₱${amount.toLocaleString('en-PH', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
};

export const formatPesoExact = (value: number | string | null | undefined) => formatPeso(value, 2);

export const formatTime = (time?: string | null) => {
  if (!time) return 'TBD';
  const [rawHours = '0', rawMinutes = '00'] = time.split(':');
  const hours = Number(rawHours);
  const suffix = hours >= 12 ? 'PM' : 'AM';
  return `${hours % 12 || 12}:${rawMinutes.slice(0, 2)} ${suffix}`;
};

export const parseDateKey = (dateKey: string) => {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export const formatDateLong = (dateKey?: string | null) => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}/.test(dateKey)) return dateKey || 'TBD';
  return parseDateKey(dateKey.slice(0, 10)).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

export const formatDateShort = (dateKey?: string | null) => {
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}/.test(dateKey)) return dateKey || 'TBD';
  return parseDateKey(dateKey.slice(0, 10)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const hoursLabel = (hours: number) => `${hours} ${hours === 1 ? 'hour' : 'hours'}`;

export const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const initials = (name?: string | null) =>
  (name || '?')
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
