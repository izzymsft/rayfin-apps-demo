import type { Product, ProductInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { mutationError, nullableTextForWrite, requireRecord, requireUuid, validateProduct } from './validation';

export async function getProducts(): Promise<Product[]> {
  return collectPages(cursor => {
    let query = getRayfinClient().data.Product.select(['id', 'sku', 'name', 'description', 'unitPrice', 'isActive'])
      .orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
export async function getProductById(id: string): Promise<Product> {
  return requireRecord(await getRayfinClient().data.Product.findById(requireUuid(id)), 'Product');
}
export async function createProduct(data: ProductInput): Promise<Product> {
  const input = validateProduct(data);
  try {
    const created = await getRayfinClient().data.Product.create(input);
    return await getProductById(created.id);
  } catch (error) { throw mutationError(error, 'Create product (SKU must be unique)'); }
}
export async function updateProduct(id: string, data: ProductInput): Promise<Product> {
  const input = validateProduct(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Product.update({ id }, { ...input, description: nullableTextForWrite(input.description) });
    return await getProductById(id);
  } catch (error) { throw mutationError(error, 'Update product (SKU must be unique)'); }
}
export async function deleteProduct(id: string): Promise<void> {
  requireUuid(id);
  const referenced = await collectPages(cursor => {
    let query = getRayfinClient().data.OrderItem.select(['id']).where({ product_id: { eq: id } })
      .orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
  if (referenced.length) throw new Error('Cannot delete a product referenced by order items. Mark it inactive instead.');
  try { await getRayfinClient().data.Product.delete({ id }); }
  catch (error) { throw mutationError(error, 'Delete product'); }
}
