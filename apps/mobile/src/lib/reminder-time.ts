// v1.18 "Remind me to buy": the quick times offered in the sheet and how a reminder time reads.

export interface QuickPick {
  key: string;
  label: string;
  icon: 'time-outline' | 'moon-outline' | 'sunny-outline' | 'cafe-outline' | 'wallet-outline';
  at: Date;
}

const at = (base: Date, days: number, hour: number, minute = 0) => {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
};

/** "In 1 hour", "Tonight", "Tomorrow morning", "This weekend", "Payday (1st)". */
export function quickPicks(now = new Date()): QuickPick[] {
  const picks: QuickPick[] = [];
  const inHour = new Date(now.getTime() + 60 * 60_000);
  inHour.setSeconds(0, 0);
  picks.push({ key: 'hour', label: 'In 1 hour', icon: 'time-outline', at: inHour });
  if (now.getHours() < 19 || (now.getHours() === 19 && now.getMinutes() < 30)) {
    picks.push({ key: 'tonight', label: 'Tonight', icon: 'moon-outline', at: at(now, 0, 20) });
  }
  picks.push({
    key: 'tomorrow',
    label: 'Tomorrow morning',
    icon: 'sunny-outline',
    at: at(now, 1, 9),
  });
  // The coming Saturday (next week's when today is Saturday or Sunday).
  const toSat = (6 - now.getDay() + 7) % 7 || 7;
  picks.push({
    key: 'weekend',
    label: 'This weekend',
    icon: 'cafe-outline',
    at: at(now, toSat, 10),
  });
  const payday = new Date(now.getFullYear(), now.getMonth() + 1, 1, 10, 0, 0, 0);
  picks.push({ key: 'payday', label: 'Payday (1st)', icon: 'wallet-outline', at: payday });
  return picks;
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

export function timeLabel(d: Date): string {
  const h = d.getHours() % 12 || 12;
  const m = d.getMinutes();
  return `${h}${m ? `:${String(m).padStart(2, '0')}` : ''} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}

/** "Today, 8 PM" / "Tomorrow, 9 AM" / "Sat 7 Nov, 10 AM". */
export function whenLabel(d: Date, now = new Date()): string {
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const day = sameDay(d, now)
    ? 'Today'
    : sameDay(d, tomorrow)
      ? 'Tomorrow'
      : d.toLocaleDateString('en-IN', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}),
        });
  return `${day}, ${timeLabel(d)}`;
}

/** "in 45 min" / "in 3 hours" / "in 5 days". */
export function fromNow(d: Date, now = new Date()): string {
  const min = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (min < 1) return 'any moment';
  if (min < 60) return `in ${min} min`;
  const hours = Math.round(min / 60);
  if (hours < 24) return `in ${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.round(hours / 24);
  return `in ${days} day${days === 1 ? '' : 's'}`;
}

export const REPEAT_LABEL = {
  NONE: 'Just once',
  WEEKLY: 'Every week',
  MONTHLY: 'Every month',
} as const;
