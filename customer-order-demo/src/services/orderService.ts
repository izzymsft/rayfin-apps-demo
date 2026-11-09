import type { Order, OrderFormInput, OrderInput, OrderItem, OrderItemInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { moneyForWrite, normalizeMoney, sumOrderItems } from './money';
import { mutationError, requireRecord, requireUuid, validateOrder, validateQuantity } from './validation';
import { getProductById } from './productService';

const orderFields = ['id', 'customer_id', 'orderNumber', 'orderDate', 'status', 'totalAmount'] as const;
const itemFields = ['id', 'order_id', 'product_id', 'quantity', 'unitPrice'] as const;
async function listOrders(customerId?: string): Promise<Order[]> {
  return collectPages(cursor => {
    let query = getRayfinClient().data.Order.select([...orderFields]).orderBy({ id: 'asc' }).first(100);
    if (customerId) query = query.where({ customer_id: { eq: customerId } });
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
export function getOrders(): Promise<Order[]> { return listOrders(); }
export function getOrdersByCustomer(customerId: string): Promise<Order[]> {
  return listOrders(requireUuid(customerId));
}
export async function getOrderById(id: string): Promise<Order> {
  const rows = await getRayfinClient().data.Order.select([...orderFields])
    .where({ id: { eq: requireUuid(id) } }).first(1).execute();
  return requireRecord(rows[0] ?? null, 'Order');
}
export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  requireUuid(orderId);
  return collectPages(cursor => {
    let query = getRayfinClient().data.OrderItem.select([...itemFields])
      .where({ order_id: { eq: orderId } }).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
async function getOrderItem(id: string): Promise<OrderItem> {
  const rows = await getRayfinClient().data.OrderItem.select([...itemFields])
    .where({ id: { eq: requireUuid(id) } }).first(1).execute();
  return requireRecord(rows[0] ?? null, 'Order item');
}
export async function createOrder(data: OrderInput): Promise<Order> {
  const input = validateOrder(data);
  try {
    const created = await getRayfinClient().data.Order.create({ ...input, totalAmount: 0 });
    return await getOrderById(created.id);
  } catch (error) { throw mutationError(error, 'Create order (order number must be unique)'); }
}
export async function updateOrder(id: string, data: OrderInput): Promise<Order> {
  const input = validateOrder(data);
  requireUuid(id);
  try {
    await getRayfinClient().data.Order.update({ id }, input);
    return await getOrderById(id);
  } catch (error) { throw mutationError(error, 'Update order'); }
}
export async function deleteOrder(id: string): Promise<void> {
  requireUuid(id);
  await getOrderById(id);
  try {
    await getRayfinClient().data.Order.delete({ id });
  } catch (error) {
    throw mutationError(error, 'Delete order (required SQL cascade guard deletes items atomically)');
  }
}
export async function addOrderItem(orderId: string, productId: string, quantity: number, id?: string): Promise<OrderItem> {
  requireUuid(orderId); requireUuid(productId); validateQuantity(quantity);
  if (id) requireUuid(id);
  await getOrderById(orderId);
  const product = await getProductById(productId);
  if (!product.isActive) throw new Error('Inactive products cannot be added to an order.');
  const unitPrice = moneyForWrite(product.unitPrice);
  try {
    const created = await getRayfinClient().data.OrderItem.create({
      ...(id ? { id } : {}), order_id: orderId, product_id: productId, quantity, unitPrice,
    });
    await verifyOrderTotal(orderId);
    return await getOrderItem(created.id);
  } catch (error) { throw mutationError(error, 'Add order item (item may already exist; do not blindly resubmit)'); }
}
export function createOrderWithItems(data: OrderFormInput): Promise<Order> {
  return saveOrderWithItems(data, false);
}
export function updateOrderWithItems(id: string, data: OrderFormInput): Promise<Order> {
  if (requireUuid(id) !== data.id) throw new Error('Order form belongs to a different order.');
  return saveOrderWithItems(data, true);
}
async function saveOrderWithItems(data: OrderFormInput, editing: boolean): Promise<Order> {
  const input = validateOrder(data);
  const id = requireUuid(data.id, 'Order ID');
  const desired = new Map(data.items.map(item => {
    requireUuid(item.id, 'Order item ID'); requireUuid(item.product_id, 'Product ID'); validateQuantity(item.quantity);
    return [item.id, item] as const;
  }));
  if (desired.size !== data.items.length) throw new Error('Duplicate order item IDs.');
  const original = new Map(data.originalItems.map(item => {
    if (item.order_id !== id) throw new Error('Order item belongs to a different order.');
    requireUuid(item.id); requireUuid(item.product_id); validateQuantity(item.quantity); normalizeMoney(item.unitPrice);
    return [item.id, item] as const;
  }));
  if (!editing && original.size) throw new Error('A new order cannot contain existing order items.');
  const removed = new Set([
    ...data.removedItemIds.map(itemId => requireUuid(itemId, 'Removed order item ID')),
    ...[...original.keys()].filter(itemId => !desired.has(itemId)),
  ]);
  if ([...removed].some(itemId => desired.has(itemId))) throw new Error('An order item cannot be kept and removed.');
  const existing = await getRayfinClient().data.Order.findById(id);
  if (editing && !existing) throw new Error('Order not found.');
  const current = new Map((existing ? await getOrderItems(id) : []).map(item => [item.id, item]));
  const pricedItems: { quantity: number; unitPrice: OrderItem['unitPrice'] }[] = [];
  for (const item of desired.values()) {
    const before = original.get(item.id);
    const saved = current.get(item.id);
    if (before && before.product_id !== item.product_id) {
      throw new Error('To change an existing product, remove its line and add the replacement.');
    }
    if (saved && (saved.product_id !== item.product_id || (before && normalizeMoney(saved.unitPrice) !== normalizeMoney(before.unitPrice)))) {
      throw new Error('Order items changed while editing. Reopen the form to reload them.');
    }
    if (before && (!saved || (saved.quantity !== before.quantity && saved.quantity !== item.quantity))) {
      throw new Error('Order item quantity changed or the item was deleted while editing. Reopen the form.');
    }
    if (!saved) {
      const product = await getProductById(item.product_id);
      if (!product.isActive) throw new Error('Inactive products cannot be added to an order.');
      moneyForWrite(product.unitPrice);
      pricedItems.push({ quantity: item.quantity, unitPrice: product.unitPrice });
    } else {
      pricedItems.push({ quantity: item.quantity, unitPrice: saved.unitPrice });
    }
  }
  pricedItems.push(...[...current.values()].filter(item => !desired.has(item.id) && !removed.has(item.id)));
  sumOrderItems(pricedItems);
  for (const before of original.values()) {
    const saved = current.get(before.id);
    if (!desired.has(before.id) && saved && (saved.quantity !== before.quantity ||
      saved.product_id !== before.product_id || normalizeMoney(saved.unitPrice) !== normalizeMoney(before.unitPrice))) {
      throw new Error('An item marked for removal changed while editing. Reopen the form.');
    }
  }
  try {
    // Stable order/line IDs let this form resume an interrupted multi-request save.
    if (existing) await updateOrder(id, input);
    else await getRayfinClient().data.Order.create({ id, ...input, totalAmount: 0 });
    for (const item of desired.values()) {
      const saved = current.get(item.id);
      if (!saved) await addOrderItem(id, item.product_id, item.quantity, item.id);
      else if (saved.quantity !== item.quantity) await updateOrderItem(item.id, { quantity: item.quantity });
    }
    for (const itemId of removed) {
      if (current.has(itemId)) await deleteOrderItem(itemId);
    }
    await verifyOrderTotal(id);
    return await getOrderById(id);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`Order save did not finish: ${detail}. Some changes may already be saved. ` +
      `Keep this form open and retry to resume using the same record IDs, or reopen order ${id} to inspect it.`, { cause: error });
  }
}
export async function updateOrderItem(id: string, data: OrderItemInput): Promise<OrderItem> {
  requireUuid(id); validateQuantity(data.quantity);
  if (Object.keys(data).some(key => key !== 'quantity')) {
    throw new Error('Only order item quantity is editable; snapshot price and relationships are immutable.');
  }
  const item = await getOrderItem(id);
  try {
    await getRayfinClient().data.OrderItem.update({ id }, { quantity: data.quantity });
    await verifyOrderTotal(item.order_id);
    return await getOrderItem(id);
  } catch (error) { throw mutationError(error, 'Update order item'); }
}
export async function deleteOrderItem(id: string): Promise<void> {
  requireUuid(id);
  const item = await getOrderItem(id);
  try {
    await getRayfinClient().data.OrderItem.delete({ id });
    await verifyOrderTotal(item.order_id);
  } catch (error) { throw mutationError(error, 'Delete order item'); }
}
export async function calculateOrderTotal(orderId: string): Promise<string> {
  return sumOrderItems(await getOrderItems(requireUuid(orderId)));
}
async function verifyOrderTotal(orderId: string): Promise<void> {
  const [order, total] = await Promise.all([getOrderById(orderId), calculateOrderTotal(orderId)]);
  if (normalizeMoney(order.totalAmount) !== total) {
    throw new Error('Server total differs from items: required SQL guards may be missing or concurrent edits occurred. Refresh; do not overwrite the total from the browser.');
  }
}
