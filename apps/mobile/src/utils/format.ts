export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatTimeOfDay(value: string | Date | null | undefined): string {
  if (!value) return '--:--';
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}/.test(value)) return value.slice(0, 5);
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '--:--';
    return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  }
  return `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}`;
}

export function formatDateLong(value: string | Date | null | undefined): string {
  if (!value) return '';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
