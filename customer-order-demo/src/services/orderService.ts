import type { Order, OrderInput, OrderItem, OrderItemInput } from '../types';
import { getRayfinClient } from './rayfinClient';
import { collectPages } from './pagination';
import { moneyForWrite, normalizeMoney, sumOrderItems } from './money';
import { mutationError, requireRecord, requireUuid, validateOrder, validateQuantity } from './validation';
import { getProductById } from './productService';

const orderFields = ['id', 'customer_id', 'orderNumber', 'orderDate', 'status', 'totalAmount'] as const;
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
  return requireRecord(await getRayfinClient().data.Order.findById(requireUuid(id)), 'Order');
}
export async function getOrderItems(orderId: string): Promise<OrderItem[]> {
  requireUuid(orderId);
  return collectPages(cursor => {
    let query = getRayfinClient().data.OrderItem.select(['id', 'order_id', 'product_id', 'quantity', 'unitPrice'])
      .where({ order_id: { eq: orderId } }).orderBy({ id: 'asc' }).first(100);
    if (cursor) query = query.after(cursor);
    return query.executePaginated();
  });
}
async function getOrderItem(id: string): Promise<OrderItem> {
  return requireRecord(await getRayfinClient().data.OrderItem.findById(requireUuid(id)), 'Order item');
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
export async function addOrderItem(orderId: string, productId: string, quantity: number): Promise<OrderItem> {
  requireUuid(orderId); requireUuid(productId); validateQuantity(quantity);
  await getOrderById(orderId);
  const product = await getProductById(productId);
  const unitPrice = moneyForWrite(product.unitPrice);
  try {
    const created = await getRayfinClient().data.OrderItem.create({
      order_id: orderId, product_id: productId, quantity, unitPrice,
    });
    await verifyOrderTotal(orderId);
    return await getOrderItem(created.id);
  } catch (error) { throw mutationError(error, 'Add order item (item may already exist; do not blindly resubmit)'); }
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
