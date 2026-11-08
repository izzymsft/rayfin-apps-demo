import type { Email, EmailInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { changePrimaryContact, mutationError, requireRecord, requireUuid, validateEmail } from './validation';

export async function getEmailsByCustomer(customerId: string): Promise<Email[]> {
  requireUuid(customerId);
  return collectPages(cursor => {
    let query = getRayfinClient().data.Email.select(['id', 'customer_id', 'emailAddress', 'isPrimary'])
      .where({ customer_id: { eq: customerId } }).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
async function getEmail(id: string): Promise<Email> {
  return requireRecord(await getRayfinClient().data.Email.findById(requireUuid(id)), 'Email');
}
export async function createEmail(data: EmailInput): Promise<Email> {
  const input = validateEmail(data);
  try {
    const created = await getRayfinClient().data.Email.create({ ...input, isPrimary: false });
    if (input.isPrimary) await setPrimaryEmail(input.customer_id, created.id);
    return await getEmail(created.id);
  } catch (error) { throw mutationError(error, 'Create email (record may exist without primary status)'); }
}
export async function updateEmail(id: string, data: EmailInput): Promise<Email> {
  const input = validateEmail(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Email.update({ id }, input);
    return await getEmail(id);
  } catch (error) { throw mutationError(error, 'Update email'); }
}
export async function deleteEmail(id: string): Promise<void> {
  requireUuid(id);
  try { await getRayfinClient().data.Email.delete({ id }); }
  catch (error) { throw mutationError(error, 'Delete email'); }
}
export async function setPrimaryEmail(customerId: string, emailId: string): Promise<Email> {
  requireUuid(customerId); requireUuid(emailId);
  await changePrimaryContact(customerId, emailId, () => getEmailsByCustomer(customerId),
    async (id, isPrimary) => { await getRayfinClient().data.Email.update({ id }, { isPrimary }); });
  return getEmail(emailId);
}
