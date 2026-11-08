import type { Address, AddressInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { mutationError, nullableTextForWrite, requireRecord, requireUuid, validateAddress } from './validation';

const fields = ['id', 'customer_id', 'line1', 'line2', 'city', 'state', 'postalCode', 'country', 'addressType', 'isPrimary'] as const;
export async function getAddressesByCustomer(customerId: string): Promise<Address[]> {
  requireUuid(customerId);
  return collectPages(cursor => {
    let query = getRayfinClient().data.Address.select([...fields])
      .where({ customer_id: { eq: customerId } }).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
async function getAddress(id: string): Promise<Address> {
  return requireRecord(await getRayfinClient().data.Address.findById(requireUuid(id)), 'Address');
}
export async function createAddress(data: AddressInput): Promise<Address> {
  const input = validateAddress(data);
  try {
    const created = await getRayfinClient().data.Address.create(input);
    return await getAddress(created.id);
  } catch (error) { throw mutationError(error, 'Create address'); }
}
export async function updateAddress(id: string, data: AddressInput): Promise<Address> {
  const input = validateAddress(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Address.update({ id }, { ...input, line2: nullableTextForWrite(input.line2) });
    return await getAddress(id);
  } catch (error) { throw mutationError(error, 'Update address'); }
}
export async function deleteAddress(id: string): Promise<void> {
  requireUuid(id);
  try { await getRayfinClient().data.Address.delete({ id }); }
  catch (error) { throw mutationError(error, 'Delete address'); }
}
