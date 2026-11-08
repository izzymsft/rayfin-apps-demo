import type { AddressInput, CustomerInput, EmailInput, OrderInput, PhoneInput, ProductInput } from '../types';
import { moneyForWrite } from './money';

export function requireUuid(value: string, label = 'ID'): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`${label} must be a UUID.`);
  }
  return value;
}
export function requireRecord<T>(value: T | null, label: string): T {
  if (!value) throw new Error(`${label} not found.`);
  return value;
}
export function nullableTextForWrite(value: string | undefined): string {
  // SDK optional primitive types omit null, but its documented GraphQL transport supports it.
  return value ?? (null as unknown as string);
}
function text(value: string, max: number, label: string): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${label} is required and must be at most ${max} characters.`);
  }
  return value.trim();
}
function optionalText(value: string | null | undefined, max: number, label: string): string | undefined {
  if (value == null || value === '') return undefined;
  if (typeof value !== 'string' || value.trim().length > max) throw new Error(`${label} is too long.`);
  return value.trim() || undefined;
}
function boolean(value: boolean, label: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`${label} must be a boolean.`);
  return value;
}
function choice<T extends string>(value: T, allowed: readonly T[], label: string): T {
  if (!allowed.includes(value)) throw new Error(`Invalid ${label}.`);
  return value;
}
export function validateQuantity(value: number): number {
  if (!Number.isInteger(value) || value < 1 || value > 2147483647) {
    throw new Error('Quantity must be an integer between 1 and 2147483647.');
  }
  return value;
}
export function validateCustomer(data: CustomerInput) {
  return {
    firstName: text(data.firstName, 100, 'First name'),
    lastName: text(data.lastName, 100, 'Last name'),
    companyName: optionalText(data.companyName, 200, 'Company name'),
    isActive: boolean(data.isActive, 'Active'),
  };
}
export function validateAddress(data: AddressInput) {
  return {
    customer_id: requireUuid(data.customer_id, 'Customer ID'),
    line1: text(data.line1, 200, 'Address line 1'),
    line2: optionalText(data.line2, 200, 'Address line 2'),
    city: text(data.city, 100, 'City'),
    state: text(data.state, 100, 'State'),
    postalCode: text(data.postalCode, 20, 'Postal code'),
    country: text(data.country, 100, 'Country'),
    addressType: choice(data.addressType, ['Billing', 'Shipping', 'Work', 'Other'], 'address type'),
    isPrimary: boolean(data.isPrimary, 'Primary'),
  };
}
export function validatePhone(data: PhoneInput) {
  return {
    customer_id: requireUuid(data.customer_id, 'Customer ID'),
    number: text(data.number, 30, 'Phone number'),
    type: choice(data.type, ['Mobile', 'Home', 'Work'], 'phone type'),
    isPrimary: boolean(data.isPrimary, 'Primary'),
  };
}
export function validateEmail(data: EmailInput) {
  const emailAddress = text(data.emailAddress, 254, 'Email address');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddress)) throw new Error('Invalid email address.');
  return {
    customer_id: requireUuid(data.customer_id, 'Customer ID'),
    emailAddress,
    isPrimary: boolean(data.isPrimary, 'Primary'),
  };
}
export function validateProduct(data: ProductInput) {
  return {
    sku: text(data.sku, 50, 'SKU'),
    name: text(data.name, 200, 'Product name'),
    description: optionalText(data.description, 2000, 'Description'),
    unitPrice: moneyForWrite(data.unitPrice),
    isActive: boolean(data.isActive, 'Active'),
  };
}
export function validateOrder(data: OrderInput) {
  if (typeof data.orderDate === 'string' && !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(data.orderDate)) {
    throw new Error('Order date must be an ISO date.');
  }
  if (typeof data.orderDate === 'string') {
    const [year, month, day] = data.orderDate.slice(0, 10).split('-').map(Number);
    const calendar = new Date(0);
    calendar.setUTCFullYear(year, month - 1, day);
    if (calendar.toISOString().slice(0, 10) !== data.orderDate.slice(0, 10)) {
      throw new Error('Order date is not a valid calendar date.');
    }
  }
  const orderDate = new Date(data.orderDate);
  if (Number.isNaN(orderDate.getTime())) throw new Error('Invalid order date.');
  return {
    customer_id: requireUuid(data.customer_id, 'Customer ID'),
    orderNumber: text(data.orderNumber, 100, 'Order number'),
    orderDate,
    status: choice(data.status, ['Draft', 'Submitted', 'Completed', 'Cancelled'], 'order status'),
  };
}

export function mutationError(error: unknown, action: string): Error {
  const detail = error instanceof Error ? error.message : String(error);
  return new Error(`${action} failed: ${detail}. Refresh to verify the server state before retrying.`, { cause: error });
}

export async function changePrimaryContact<T extends { id: string; customer_id: string; isPrimary: boolean }>(
  customerId: string,
  targetId: string,
  list: () => Promise<T[]>,
  update: (id: string, primary: boolean) => Promise<void>,
): Promise<void> {
  const contacts = await list();
  const target = requireRecord(contacts.find(item => item.id === targetId) ?? null, 'Contact for this customer');
  if (target.customer_id !== customerId) throw new Error('Contact belongs to another customer.');
  try {
    // The reviewed SQL UPDATE trigger demotes the previous choice in this transaction.
    await update(targetId, true);
    const current = await list();
    const primary = current.filter(item => item.isPrimary);
    if (primary.length !== 1 || primary[0].id !== targetId) {
      throw new Error('Primary selection changed concurrently or required SQL guards are missing.');
    }
  } catch (error) {
    throw mutationError(error, 'Set primary contact (SQL transaction rolls back failures; never overwrite a concurrent winner)');
  }
}
