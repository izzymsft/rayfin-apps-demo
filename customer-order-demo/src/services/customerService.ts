import type { Customer, CustomerInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { mutationError, nullableTextForWrite, requireRecord, requireUuid, validateCustomer } from './validation';
import { getOrdersByCustomer } from './orderService';

export const customerFields = ['id', 'firstName', 'lastName', 'companyName', 'isActive'] as const;

export async function getCustomers(): Promise<Customer[]> {
  return collectPages(cursor => {
    let query = getRayfinClient().data.Customer.select([...customerFields]).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
export async function getCustomerById(id: string): Promise<Customer> {
  const rows = await getRayfinClient().data.Customer.select([...customerFields])
    .where({ id: { eq: requireUuid(id) } }).first(1).execute();
  return requireRecord(rows[0] ?? null, 'Customer');
}
export async function createCustomer(data: CustomerInput): Promise<Customer> {
  const input = validateCustomer(data);
  try {
    const created = await getRayfinClient().data.Customer.create(input);
    return await getCustomerById(created.id);
  } catch (error) { throw mutationError(error, 'Create customer'); }
}
export async function updateCustomer(id: string, data: CustomerInput): Promise<Customer> {
  const input = validateCustomer(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Customer.update({ id }, { ...input, companyName: nullableTextForWrite(input.companyName) });
    return await getCustomerById(id);
  } catch (error) { throw mutationError(error, 'Update customer'); }
}
export async function deleteCustomer(id: string): Promise<void> {
  requireUuid(id);
  await getCustomerById(id);
  if ((await getOrdersByCustomer(id)).length) throw new Error('Cannot delete a customer with existing orders.');
  try {
    await getRayfinClient().data.Customer.delete({ id });
  } catch (error) {
    throw mutationError(error, 'Delete customer (required SQL contact cascades are atomic; orders prevent deletion)');
  }
}
