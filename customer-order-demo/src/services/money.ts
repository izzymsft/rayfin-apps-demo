import type { Money } from '../types';

const MAX_CENTS = 999999999999999999n;

function cents(value: Money): bigint {
  const text = typeof value === 'number' ? String(value) : value.trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error('Money must be a non-negative decimal with at most two decimal places.');
  }
  const [whole, fraction = ''] = text.split('.');
  const result = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (result > MAX_CENTS) throw new Error('Money exceeds DECIMAL(18,2).');
  if (typeof value === 'number' && result > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Large monetary values must be returned as decimal strings, not lossy JS numbers.');
  }
  return result;
}

function fromCents(value: bigint): string {
  if (value > MAX_CENTS) throw new Error('Order total exceeds DECIMAL(18,2).');
  return `${value / 100n}.${String(value % 100n).padStart(2, '0')}`;
}

export function normalizeMoney(value: Money): string {
  return fromCents(cents(value));
}

export function sumOrderItems(items: readonly { quantity: number; unitPrice: Money }[]): string {
  return fromCents(items.reduce((sum, item) => {
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 2147483647) {
      throw new Error('Quantity must be an integer between 1 and 2147483647.');
    }
    return sum + cents(item.unitPrice) * BigInt(item.quantity);
  }, 0n));
}

export function formatMoney(value: Money): string {
  const [whole, fraction] = normalizeMoney(value).split('.');
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${fraction}`;
}

// The installed fluent client's numeric fields are transported as JS numbers.
export function moneyForWrite(value: Money): number {
  const exact = normalizeMoney(value);
  const numeric = Number(exact);
  if (normalizeMoney(numeric) !== exact) {
    throw new Error('This monetary value cannot be sent losslessly by the Rayfin numeric client.');
  }
  return numeric;
}
