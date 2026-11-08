import type { Phone, PhoneInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { changePrimaryContact, mutationError, requireRecord, requireUuid, validatePhone } from './validation';

export async function getPhonesByCustomer(customerId: string): Promise<Phone[]> {
  requireUuid(customerId);
  return collectPages(cursor => {
    let query = getRayfinClient().data.Phone.select(['id', 'customer_id', 'number', 'type', 'isPrimary'])
      .where({ customer_id: { eq: customerId } }).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
async function getPhone(id: string): Promise<Phone> {
  return requireRecord(await getRayfinClient().data.Phone.findById(requireUuid(id)), 'Phone');
}
export async function createPhone(data: PhoneInput): Promise<Phone> {
  const input = validatePhone(data);
  try {
    const created = await getRayfinClient().data.Phone.create({ ...input, isPrimary: false });
    if (input.isPrimary) await setPrimaryPhone(input.customer_id, created.id);
    return await getPhone(created.id);
  } catch (error) { throw mutationError(error, 'Create phone (record may exist without primary status)'); }
}
export async function updatePhone(id: string, data: PhoneInput): Promise<Phone> {
  const input = validatePhone(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Phone.update({ id }, input);
    return await getPhone(id);
  } catch (error) { throw mutationError(error, 'Update phone'); }
}
export async function deletePhone(id: string): Promise<void> {
  requireUuid(id);
  try { await getRayfinClient().data.Phone.delete({ id }); }
  catch (error) { throw mutationError(error, 'Delete phone'); }
}
export async function setPrimaryPhone(customerId: string, phoneId: string): Promise<Phone> {
  requireUuid(customerId); requireUuid(phoneId);
  await changePrimaryContact(customerId, phoneId, () => getPhonesByCustomer(customerId),
    async (id, isPrimary) => { await getRayfinClient().data.Phone.update({ id }, { isPrimary }); });
  return getPhone(phoneId);
}
