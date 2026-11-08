export function formatOrderDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, { timeZone: 'UTC' });
}
