import { describe, expect, it } from 'vitest';
import { formatMoney, moneyForWrite, normalizeMoney, sumOrderItems } from '../services/money';
import { collectPages } from '../services/pagination';
import { changePrimaryContact, validateAddress, validateCustomer, validateEmail, validateOrder, validateProduct, validateQuantity } from '../services/validation';

describe('exact decimal money', () => {
  it('adds in integer cents instead of floating point', () => {
    expect(sumOrderItems([{ quantity: 3, unitPrice: '0.10' }, { quantity: 1, unitPrice: 0.2 }])).toBe('0.50');
    expect(sumOrderItems([])).toBe('0.00');
    expect(normalizeMoney('00012.3')).toBe('12.30');
    expect(formatMoney('1234567890123456.78')).toBe('$1,234,567,890,123,456.78');
  });
  it('supports the SQL decimal limit as a string', () => {
    expect(normalizeMoney('9999999999999999.99')).toBe('9999999999999999.99');
    expect(() => sumOrderItems([{ quantity: 2, unitPrice: '9999999999999999.99' }])).toThrow(/total exceeds/);
  });
  it.each([-1, 'NaN', 'Infinity', '1e3', '1.001', '10000000000000000', ''])('rejects invalid money %s', value => {
    expect(() => normalizeMoney(value)).toThrow();
  });
  it('refuses lossy numeric SDK writes', () => {
    expect(moneyForWrite('19.95')).toBe(19.95);
    expect(() => moneyForWrite('9999999999999999.99')).toThrow();
    expect(() => normalizeMoney(Number('999999999999999'))).toThrow(/string/);
  });
  it.each([0, -1, 1.5, NaN, Infinity, 2147483648])('rejects invalid quantity %s', quantity => {
    expect(() => validateQuantity(quantity)).toThrow();
    expect(() => sumOrderItems([{ quantity, unitPrice: '1.00' }])).toThrow();
  });
});

describe('complete cursor pagination', () => {
  it('collects every page and forwards the exact opaque cursor', async () => {
    const seen: (string | undefined)[] = [];
    const result = await collectPages(async cursor => {
      seen.push(cursor);
      return cursor
        ? { items: [{ id: 'b' }], hasNextPage: false }
        : { items: [{ id: 'a' }], hasNextPage: true, endCursor: 'opaque/next=' };
    });
    expect(result).toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(seen).toEqual([undefined, 'opaque/next=']);
  });
  it('rejects missing, empty-page and repeated cursors instead of truncating', async () => {
    await expect(collectPages(async () => ({ items: [{ id: 'a' }], hasNextPage: true }))).rejects.toThrow(/cursor/);
    await expect(collectPages(async () => ({ items: [], hasNextPage: true, endCursor: 'a' }))).rejects.toThrow(/cursor/);
    let call = 0;
    await expect(collectPages(async () => ({
      items: [{ id: String(call++) }], hasNextPage: true, endCursor: 'repeat',
    }))).rejects.toThrow(/cursor/);
  });
  it('rejects duplicate rows caused by an unstable server result', async () => {
    await expect(collectPages(async cursor => ({
      items: [{ id: 'a' }], hasNextPage: !cursor, endCursor: 'next',
    }))).rejects.toThrow(/duplicate/);
  });
});

describe('editable scalar input validation', () => {
  const customerId = '00000000-0000-4000-8000-000000000001';
  it('trims names and does not forward injected identity/navigation', () => {
    expect(validateCustomer({ firstName: ' Mira ', lastName: ' Brook ', isActive: true, companyName: '' }))
      .toEqual({ firstName: 'Mira', lastName: 'Brook', companyName: undefined, isActive: true });
    expect(() => validateCustomer({ firstName: ' ', lastName: 'Brook', isActive: true })).toThrow(/First name/);
  });
  it('validates emails, enums, IDs, dates and numeric prices', () => {
    expect(() => validateEmail({ customer_id: customerId, emailAddress: 'bad@address', isPrimary: false })).toThrow(/email/);
    expect(() => validateAddress({
      customer_id: customerId, line1: '1 Example', city: 'Town', state: 'WA', postalCode: '98000',
      country: 'US', addressType: 'Invalid' as 'Billing', isPrimary: false,
    })).toThrow(/address type/);
    expect(() => validateOrder({
      customer_id: customerId, orderNumber: 'O1', orderDate: 'not-a-date', status: 'Draft',
    })).toThrow(/ISO/);
    expect(() => validateOrder({
      customer_id: customerId, orderNumber: 'O1', orderDate: '2026-02-30', status: 'Draft',
    })).toThrow(/calendar/);
    expect(() => validateProduct({ sku: 'SKU', name: 'Sample', isActive: true, unitPrice: '-0.01' })).toThrow();
  });
});

describe('atomic primary API contract', () => {
  const customerId = 'customer';
  it('sends only the target update and leaves demotion to the database', async () => {
    const updates: unknown[] = [];
    let updated = false;
    await changePrimaryContact(customerId, 'b', async () => [
      { id: 'a', customer_id: customerId, isPrimary: !updated },
      { id: 'b', customer_id: customerId, isPrimary: updated },
    ], async (id, primary) => { updates.push([id, primary]); updated = true; });
    expect(updates).toEqual([['b', true]]);
  });
  it('rejects missing guards and never attempts a competing rollback', async () => {
    const updates: unknown[] = [];
    await expect(changePrimaryContact(customerId, 'b', async () => [
      { id: 'a', customer_id: customerId, isPrimary: true },
      { id: 'b', customer_id: customerId, isPrimary: true },
    ], async (id, primary) => { updates.push([id, primary]); })).rejects.toThrow(/SQL guards/);
    expect(updates).toEqual([['b', true]]);
  });
  it('does not modify another customer contact', async () => {
    await expect(changePrimaryContact(customerId, 'b', async () => [
      { id: 'b', customer_id: 'another', isPrimary: false },
    ], async () => { throw new Error('should not be reached'); })).rejects.toThrow(/another customer/);
  });
});
