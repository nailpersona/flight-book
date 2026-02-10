import { StatusColor } from './types';

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = d.getDate().toString().padStart(2, '0');
  const month = (d.getMonth() + 1).toString().padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export function computeColor(lastDate: string | null, allowedDays: number): StatusColor {
  if (!lastDate || !allowedDays) return 'gray';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const last = new Date(lastDate);
  last.setHours(0, 0, 0, 0);
  const daysSince = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));
  const remaining = allowedDays - daysSince;
  if (remaining <= 0) return 'red';
  if (remaining <= 15) return 'yellow';
  return 'green';
}

export function computeColorFromExpiry(expiryDate: string | null): StatusColor {
  if (!expiryDate) return 'gray';
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  const remaining = Math.floor((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (remaining <= 0) return 'red';
  if (remaining <= 15) return 'yellow';
  return 'green';
}

export function addMonths(dateStr: string | null, m: number): string | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + m);
  return d.toISOString().split('T')[0];
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${hours}:${mins.toString().padStart(2, '0')}`;
}

export function parseInterval(interval: string | null): number {
  if (!interval) return 0;
  // Postgres interval format: "HH:MM:SS" or "X hours Y mins Z secs"
  const hmsMatch = interval.match(/(\d+):(\d+):(\d+)/);
  if (hmsMatch) {
    return parseInt(hmsMatch[1]) * 60 + parseInt(hmsMatch[2]);
  }
  let minutes = 0;
  const hourMatch = interval.match(/(\d+)\s*hour/);
  if (hourMatch) minutes += parseInt(hourMatch[1]) * 60;
  const minMatch = interval.match(/(\d+)\s*min/);
  if (minMatch) minutes += parseInt(minMatch[1]);
  return minutes;
}

export function worstStatus(statuses: StatusColor[]): StatusColor {
  if (statuses.includes('red')) return 'red';
  if (statuses.includes('yellow')) return 'yellow';
  if (statuses.includes('green')) return 'green';
  return 'gray';
}
