export function formatUtcDateTime(value: string | Date) {
  const date = typeof value === 'string' ? new Date(value) : value;
  const parts = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('month')} ${part('day')}, ${part('year')} at ${part('hour')}:${part('minute')} ${part('dayPeriod')}`;
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
