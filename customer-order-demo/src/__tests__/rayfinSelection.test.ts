import { RayfinClient } from '@microsoft/rayfin-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSchema } from '../../rayfin/data/schema';
import { getProductById } from '@/services/productService';
import { addOrderItem, getOrderById, updateOrderItem } from '@/services/orderService';
import { sumOrderItems } from '@/services/money';

let client: RayfinClient<AppSchema>;
vi.mock('@/services/rayfinClient', () => ({ getRayfinClient: () => client }));
const productId = '00000000-0000-4000-8000-000000000002';
const orderId = '00000000-0000-4000-8000-000000000003';
const itemId = '00000000-0000-4000-8000-000000000004';
let product: Record<string, unknown>;
let order: Record<string, unknown>;
let items: Record<string, unknown>[];
let queries: string[];

function selected(row: Record<string, unknown>, fields: string) {
  return Object.fromEntries(Object.entries(row).filter(([key]) => new RegExp(`\\b${key}\\b`).test(fields)));
}
function updateTotal() {
  order.totalAmount = sumOrderItems(items.map(item => ({ quantity: Number(item.quantity), unitPrice: String(item.unitPrice) })));
}
beforeEach(() => {
  product = { id: productId, sku: 'P200', name: 'Example Conference', description: '', unitPrice: '3500.00', isActive: true };
  order = { id: orderId, customer_id: '00000000-0000-4000-8000-000000000001', orderNumber: '100', orderDate: '2026-11-08', status: 'Submitted', totalAmount: '0.00' };
  items = [];
  queries = [];
  vi.stubGlobal('fetch', vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    if (typeof init?.body !== 'string') throw new Error('Expected an SDK GraphQL POST body.');
    const { query } = JSON.parse(init.body) as { query: string };
    queries.push(query);
    let data: Record<string, unknown>;
    if (query.includes('product_by_pk')) {
      const fields = query.match(/\)\s*\{([^{}]*)\}/)?.[1];
      if (!fields) throw new Error('Missing primary-key selection.');
      data = { product_by_pk: selected(product, fields) };
    } else if (query.includes('createOrderItem')) {
      const quantity = query.match(/\bquantity:\s*(\d+)/)?.[1];
      const unitPrice = query.match(/\bunitPrice:\s*([\d.]+)/)?.[1];
      if (!quantity || !unitPrice) throw new Error('Missing order item mutation fields.');
      const item = { id: itemId, order_id: orderId, product_id: productId, quantity: Number(quantity), unitPrice };
      items.push(item); updateTotal(); data = { createOrderItem: item };
    } else if (query.includes('updateOrderItem')) {
      const quantity = query.match(/\bquantity:\s*(\d+)/)?.[1];
      if (!quantity || !items.length) throw new Error('Missing quantity or existing item.');
      items[0] = { ...items[0], quantity: Number(quantity) };
      updateTotal(); data = { updateOrderItem: items[0] };
    } else {
      const fields = query.match(/items\s*\{([^{}]*)\}/)?.[1];
      if (!fields) throw new Error('Missing explicit collection field selection.');
      const root = query.match(/\{\s*(products|orders|orderItems)\b/)?.[1];
      if (!root) throw new Error('Unexpected test GraphQL query.');
      const rows = root === 'products' ? [product] : root === 'orders' ? [order] : items;
      data = { [root]: { items: rows.map(row => selected(row, fields)), hasNextPage: false, endCursor: null } };
    }
    return new Response(JSON.stringify({ data }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }));
  client = new RayfinClient<AppSchema>({
    baseUrl: 'http://localhost:5168/', publishableKey: 'selection-test',
    persistSession: false, autoRefreshToken: false, multiTabSync: false,
  });
});
afterEach(() => vi.unstubAllGlobals());

describe('actual Rayfin SDK field-selection regression', () => {
  it('demonstrates that the installed findById selects only ID', async () => {
    expect(await client.data.Product.findById(productId)).toEqual({ id: productId });
  });
  it('fetches active status and price explicitly instead of treating an ID-only row as inactive', async () => {
    const result = await getProductById(productId);
    expect(result.isActive).toBe(true);
    expect(result.unitPrice).toBe('3500.00');
    expect(queries[0]).toContain('isActive');
    expect(queries[0]).toContain('unitPrice');
    expect(queries[0]).not.toContain('product_by_pk');
  });
  it('adds the selected active product and reads the full persisted total', async () => {
    const item = await addOrderItem(orderId, productId, 1);
    expect(item.product_id).toBe(productId);
    expect(item.unitPrice).toBe('3500');
    expect((await getOrderById(orderId)).totalAmount).toBe('3500.00');
    expect(queries.some(query => query.includes('createOrderItem'))).toBe(true);
    expect(queries.filter(query => query.includes('orders')).every(query => query.includes('totalAmount'))).toBe(true);
  });
  it('continues to reject genuinely inactive products', async () => {
    product.isActive = false;
    await expect(addOrderItem(orderId, productId, 1)).rejects.toThrow(/Inactive/);
    expect(items).toHaveLength(0);
  });
  it('does not misreport a missing status as an inactive product', async () => {
    delete product.isActive;
    await expect(getProductById(productId)).rejects.toThrow(/valid product status/);
  });
  it('reads item relationships before verifying quantity edits and keeps their original price', async () => {
    await addOrderItem(orderId, productId, 1);
    product.unitPrice = '9999.00';
    const updated = await updateOrderItem(itemId, { quantity: 2 });
    expect(updated.order_id).toBe(orderId);
    expect((await getOrderById(orderId)).totalAmount).toBe('7000.00');
  });
});
