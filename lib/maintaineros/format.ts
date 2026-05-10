export function formatUtcDateTime(value: string | Date) {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(typeof value === 'string' ? new Date(value) : value);
}

export function formatInteger(value: number) {
  return new Intl.NumberFormat('en-US').format(value);
}
