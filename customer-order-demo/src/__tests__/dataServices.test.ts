import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../services/customerService';
import { createAddress, getAddressesByCustomer, updateAddress } from '../services/addressService';
import { createEmail, setPrimaryEmail } from '../services/emailService';
import { createPhone, setPrimaryPhone } from '../services/phoneService';
import { deleteProduct, getProducts, updateProduct } from '../services/productService';
import { addOrderItem, calculateOrderTotal, createOrderWithItems, deleteOrder, getOrderItems, updateOrder, updateOrderItem, updateOrderWithItems } from '../services/orderService';
import { seedDevelopmentData } from '../services/seed';
import { normalizeMoney, sumOrderItems } from '../services/money';
import type { Order, OrderFormInput, OrderItem } from '../types';

const mocks = vi.hoisted(() => {
  function entity() {
    const query = {
      where: vi.fn(),
      orderBy: vi.fn(),
      first: vi.fn(),
      after: vi.fn(),
      execute: vi.fn(),
      executePaginated: vi.fn(),
    };
    for (const method of [query.where, query.orderBy, query.first, query.after]) method.mockReturnValue(query);
    return {
      query, select: vi.fn().mockReturnValue(query), findById: vi.fn(),
      create: vi.fn(), update: vi.fn(), delete: vi.fn(),
    };
  }
  return {
    data: {
      Customer: entity(), Address: entity(), Phone: entity(), Email: entity(),
      Product: entity(), Order: entity(), OrderItem: entity(),
    },
    getClient: vi.fn(),
  };
});
vi.mock('../services/rayfinClient', () => ({ getRayfinClient: mocks.getClient }));

const customerId = '00000000-0000-4000-8000-000000000001';
const productId = '00000000-0000-4000-8000-000000000002';
const orderId = '00000000-0000-4000-8000-000000000003';
const itemId = '00000000-0000-4000-8000-000000000004';
const contactId = '00000000-0000-4000-8000-000000000005';
const customer = { id: customerId, firstName: 'Mira', lastName: 'Brook', isActive: true };
const product = { id: productId, sku: 'SKU', name: 'Supply', unitPrice: '0.10', isActive: true };
const order = { id: orderId, customer_id: customerId, orderNumber: 'O1', orderDate: '2026-01-01', status: 'Draft', totalAmount: '0.30' };
const item = { id: itemId, order_id: orderId, product_id: productId, quantity: 3, unitPrice: '0.10' };

beforeEach(() => {
  vi.clearAllMocks();
  for (const entity of Object.values(mocks.data)) {
    entity.query.executePaginated.mockReset().mockResolvedValue({ items: [], hasNextPage: false });
    entity.query.execute.mockReset().mockResolvedValue([]);
    entity.findById.mockReset();
    entity.create.mockReset().mockResolvedValue({ id: contactId });
    entity.update.mockReset().mockResolvedValue({});
    entity.delete.mockReset().mockResolvedValue({});
  }
  mocks.getClient.mockReturnValue({ data: mocks.data });
  mocks.data.Customer.query.execute.mockResolvedValue([customer]);
  mocks.data.Product.query.execute.mockResolvedValue([product]);
  mocks.data.Order.query.execute.mockResolvedValue([order]);
  mocks.data.OrderItem.query.execute.mockResolvedValue([item]);
  mocks.data.Order.findById.mockResolvedValue({ id: orderId });
});

describe('typed API services', () => {
  it('lists all pages with stable ID sorting, not execute()', async () => {
    mocks.data.Customer.query.executePaginated
      .mockResolvedValueOnce({ items: [customer], hasNextPage: true, endCursor: 'opaque' })
      .mockResolvedValueOnce({ items: [{ ...customer, id: productId }], hasNextPage: false });
    expect(await getCustomers()).toHaveLength(2);
    expect(mocks.data.Customer.query.orderBy).toHaveBeenCalledWith({ id: 'asc' });
    expect(mocks.data.Customer.query.first).toHaveBeenCalledWith(100);
    expect(mocks.data.Customer.query.after).toHaveBeenCalledWith('opaque');
    await getProducts();
    await getAddressesByCustomer(customerId);
    expect(mocks.data.Product.query.executePaginated).toHaveBeenCalled();
    expect(mocks.data.Address.query.where).toHaveBeenCalledWith({ customer_id: { eq: customerId } });
  });
  it('never falls back to memory if the client is unavailable', async () => {
    mocks.getClient.mockImplementationOnce(() => { throw new Error('Client not initialized'); });
    await expect(getCustomers()).rejects.toThrow(/not initialized/);
  });
  it('creates then refreshes customer DTO and clears optional fields on full-input edits', async () => {
    mocks.data.Customer.create.mockResolvedValue({ ...customer, firstName: 'stale' });
    expect(await createCustomer({ firstName: ' Mira ', lastName: 'Brook', isActive: true })).toEqual(customer);
    expect(mocks.data.Customer.create).toHaveBeenCalledWith({
      firstName: 'Mira', lastName: 'Brook', companyName: undefined, isActive: true,
    });
    await updateCustomer(customerId, { firstName: 'Mira', lastName: 'Brook', isActive: true, companyName: '' });
    expect(mocks.data.Customer.update).toHaveBeenCalledWith({ id: customerId }, {
      firstName: 'Mira', lastName: 'Brook', isActive: true, companyName: null,
    });
  });
  it('writes scalar FKs and refreshes address instead of requiring navigations', async () => {
    const address = {
      customer_id: customerId, line1: '1 Example Lane', city: 'Town', state: 'WA',
      postalCode: '98000', country: 'US', addressType: 'Billing' as const, isPrimary: false,
    };
    mocks.data.Address.query.execute.mockResolvedValue([{ ...address, id: contactId }]);
    expect(await createAddress(address)).toEqual({ ...address, id: contactId });
    expect(mocks.data.Address.create).toHaveBeenCalledWith({ ...address, line2: undefined });
    await updateAddress(contactId, { ...address, line2: '' });
    expect(mocks.data.Address.update).toHaveBeenLastCalledWith({ id: contactId }, { ...address, line2: null });
  });
  it('prevents customer/product deletes with references before mutation', async () => {
    mocks.data.Order.query.executePaginated.mockResolvedValue({ items: [order], hasNextPage: false });
    await expect(deleteCustomer(customerId)).rejects.toThrow(/existing orders/);
    expect(mocks.data.Customer.delete).not.toHaveBeenCalled();
    mocks.data.OrderItem.query.executePaginated.mockResolvedValue({ items: [item], hasNextPage: false });
    await expect(deleteProduct(productId)).rejects.toThrow(/inactive/);
    expect(mocks.data.Product.delete).not.toHaveBeenCalled();
  });
  it('uses one header delete, leaving atomic item deletion to the server cascade', async () => {
    await deleteOrder(orderId);
    expect(mocks.data.Order.delete).toHaveBeenCalledExactlyOnceWith({ id: orderId });
    expect(mocks.data.OrderItem.delete).not.toHaveBeenCalled();
  });
  it('uses one customer delete, leaving contact deletion atomic on the server', async () => {
    await deleteCustomer(customerId);
    expect(mocks.data.Customer.delete).toHaveBeenCalledExactlyOnceWith({ id: customerId });
    expect(mocks.data.Address.delete).not.toHaveBeenCalled();
    expect(mocks.data.Phone.delete).not.toHaveBeenCalled();
    expect(mocks.data.Email.delete).not.toHaveBeenCalled();
  });
  it('does not forward a submitted total in header edits', async () => {
    await updateOrder(orderId, {
      customer_id: customerId, orderNumber: 'O1', orderDate: '2026-01-01', status: 'Draft',
      ...{ totalAmount: '999.00' },
    });
    expect(mocks.data.Order.update).toHaveBeenCalledWith({ id: orderId }, {
      customer_id: customerId, orderNumber: 'O1', orderDate: new Date('2026-01-01'), status: 'Draft',
    });
  });
  it('clears product description and refuses negative prices', async () => {
    await updateProduct(productId, { sku: 'SKU', name: 'Supply', unitPrice: '1.00', isActive: true, description: '' });
    expect(mocks.data.Product.update).toHaveBeenCalledWith({ id: productId }, {
      sku: 'SKU', name: 'Supply', unitPrice: 1, isActive: true, description: null,
    });
    await expect(updateProduct(productId, { sku: 'SKU', name: 'Supply', unitPrice: '-1', isActive: true })).rejects.toThrow();
  });
});

describe('order snapshot and server totals', () => {
  beforeEach(() => {
    mocks.data.OrderItem.query.executePaginated.mockResolvedValue({ items: [item], hasNextPage: false });
    mocks.data.OrderItem.create.mockResolvedValue(item);
  });
  it('takes initial product snapshot and never writes a total from the browser', async () => {
    expect(await addOrderItem(orderId, productId, 3)).toEqual(item);
    expect(mocks.data.OrderItem.create).toHaveBeenCalledWith({
      order_id: orderId, product_id: productId, quantity: 3, unitPrice: 0.1,
    });
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
    expect(await calculateOrderTotal(orderId)).toBe('0.30');
    expect(await getOrderItems(orderId)).toEqual([item]);
  });
  it('changes only quantity, never current product price', async () => {
    mocks.data.Product.query.execute.mockResolvedValue([{ ...product, unitPrice: '99.00' }]);
    await updateOrderItem(itemId, { quantity: 3 });
    expect(mocks.data.OrderItem.update).toHaveBeenCalledWith({ id: itemId }, { quantity: 3 });
    expect(mocks.data.Product.query.execute).not.toHaveBeenCalled();
    await expect(updateOrderItem(itemId, { quantity: 3, ...{ unitPrice: '99.00' } })).rejects.toThrow(/immutable/);
  });
  it('reports missing total guard without an unsafe browser repair', async () => {
    mocks.data.Order.query.execute.mockResolvedValue([{ ...order, totalAmount: '0.00' }]);
    await expect(addOrderItem(orderId, productId, 3)).rejects.toThrow(/SQL guards/);
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
    expect(mocks.data.OrderItem.delete).not.toHaveBeenCalled();
  });
  it('rejects invalid quantity before any API writes', async () => {
    await expect(addOrderItem(orderId, productId, 0)).rejects.toThrow(/Quantity/);
    expect(mocks.data.OrderItem.create).not.toHaveBeenCalled();
  });
});

describe('order forms persist headers and line items', () => {
  let savedOrder: Order | null;
  let savedItems: Map<string, OrderItem>;
  const input = (): OrderFormInput => ({
    id: orderId, customer_id: customerId, orderNumber: 'O1', orderDate: '2026-01-01', status: 'Draft',
    items: [{ id: itemId, product_id: productId, quantity: 3 }], originalItems: [], removedItemIds: [],
  });
  function calculateSavedTotal() {
    if (savedOrder) savedOrder = { ...savedOrder, totalAmount: sumOrderItems([...savedItems.values()]) };
  }
  beforeEach(() => {
    savedOrder = null;
    savedItems = new Map();
    mocks.data.Order.findById.mockImplementation(async () => savedOrder ? { id: savedOrder.id } : null);
    mocks.data.Order.query.execute.mockImplementation(async () => savedOrder ? [savedOrder] : []);
    mocks.data.Order.create.mockImplementation(async (header: Order) => {
      if (savedOrder) throw new Error('Duplicate order ID');
      savedOrder = { ...header }; return savedOrder;
    });
    mocks.data.Order.update.mockImplementation(async (_filter, header) => {
      if (!savedOrder) throw new Error('Order missing');
      savedOrder = { ...savedOrder, ...header }; return savedOrder;
    });
    mocks.data.OrderItem.query.executePaginated.mockImplementation(async () => ({ items: [...savedItems.values()], hasNextPage: false }));
    mocks.data.OrderItem.query.execute.mockImplementation(async () => {
      const filter = mocks.data.OrderItem.query.where.mock.calls.at(-1)?.[0];
      const saved = savedItems.get(filter?.id?.eq);
      return saved ? [saved] : [];
    });
    mocks.data.OrderItem.create.mockImplementation(async (line: OrderItem) => {
      if (savedItems.has(line.id)) throw new Error('Duplicate item ID');
      const saved = { ...line, unitPrice: normalizeMoney(line.unitPrice) };
      savedItems.set(saved.id, saved); calculateSavedTotal(); return saved;
    });
    mocks.data.OrderItem.update.mockImplementation(async ({ id }, changes) => {
      const saved = savedItems.get(id);
      if (!saved) throw new Error('Item missing');
      savedItems.set(id, { ...saved, ...changes }); calculateSavedTotal();
    });
    mocks.data.OrderItem.delete.mockImplementation(async ({ id }) => {
      savedItems.delete(id); calculateSavedTotal();
    });
  });
  it('creates selected products and returns their exact persisted total', async () => {
    const result = await createOrderWithItems(input());
    expect(result.totalAmount).toBe('0.30');
    expect(savedItems.get(itemId)).toEqual(item);
    expect(mocks.data.Order.create).toHaveBeenCalledWith(expect.objectContaining({ id: orderId, totalAmount: 0 }));
    expect(mocks.data.OrderItem.create).toHaveBeenCalledWith({ id: itemId, order_id: orderId, product_id: productId, quantity: 3, unitPrice: 0.1 });
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
  });
  it('updates quantities using historical prices, never the new catalog price', async () => {
    await createOrderWithItems(input());
    const original = [...savedItems.values()];
    mocks.data.Product.query.execute.mockResolvedValue([{ ...product, unitPrice: '99.99' }]);
    const result = await updateOrderWithItems(orderId, { ...input(), originalItems: original, items: [{ id: itemId, product_id: productId, quantity: 5 }] });
    expect(result.totalAmount).toBe('0.50');
    expect(savedItems.get(itemId)?.unitPrice).toBe('0.10');
    expect(mocks.data.Order.update).toHaveBeenCalledWith({ id: orderId }, expect.not.objectContaining({ totalAmount: expect.anything() }));
  });
  it('removes selected original lines but does not delete concurrently added lines', async () => {
    await createOrderWithItems(input());
    const original = [...savedItems.values()];
    savedItems.set(contactId, { ...item, id: contactId, quantity: 1 });
    calculateSavedTotal();
    const result = await updateOrderWithItems(orderId, { ...input(), originalItems: original, items: [], removedItemIds: [itemId] });
    expect(result.totalAmount).toBe('0.10');
    expect(savedItems.has(itemId)).toBe(false);
    expect(savedItems.has(contactId)).toBe(true);
    expect(mocks.data.OrderItem.delete).toHaveBeenCalledExactlyOnceWith({ id: itemId });
  });
  it('resumes an interrupted create using the same IDs without duplicate items', async () => {
    const create = mocks.data.OrderItem.create.getMockImplementation()!;
    mocks.data.OrderItem.create.mockImplementationOnce(async (line: OrderItem) => {
      await create(line); throw new Error('Response lost after commit');
    });
    await expect(createOrderWithItems(input())).rejects.toThrow(/Some changes may already be saved/);
    expect((await createOrderWithItems(input())).totalAmount).toBe('0.30');
    expect(mocks.data.Order.create).toHaveBeenCalledTimes(1);
    expect(mocks.data.OrderItem.create).toHaveBeenCalledTimes(1);
    expect(savedItems.size).toBe(1);
  });
  it('removes a partially saved new line when it is removed before retrying', async () => {
    const create = mocks.data.OrderItem.create.getMockImplementation()!;
    mocks.data.OrderItem.create.mockImplementationOnce(async (line: OrderItem) => {
      await create(line); throw new Error('Response lost after commit');
    });
    await expect(createOrderWithItems(input())).rejects.toThrow(/did not finish/);
    const result = await createOrderWithItems({ ...input(), items: [], removedItemIds: [itemId] });
    expect(result.totalAmount).toBe('0.00');
    expect(savedItems.size).toBe(0);
  });
  it('rejects inactive products and invalid quantities before creating a header', async () => {
    mocks.data.Product.query.execute.mockResolvedValue([{ ...product, isActive: false }]);
    await expect(createOrderWithItems(input())).rejects.toThrow(/Inactive/);
    await expect(createOrderWithItems({ ...input(), items: [{ id: itemId, product_id: productId, quantity: 0 }] })).rejects.toThrow(/Quantity/);
    expect(mocks.data.Order.create).not.toHaveBeenCalled();
    expect(mocks.data.OrderItem.create).not.toHaveBeenCalled();
  });
  it('detects concurrent edits before overwriting a changed quantity', async () => {
    await createOrderWithItems(input());
    const original = [...savedItems.values()];
    savedItems.set(itemId, { ...item, quantity: 7 }); calculateSavedTotal();
    await expect(updateOrderWithItems(orderId, { ...input(), originalItems: original, items: [{ id: itemId, product_id: productId, quantity: 4 }] })).rejects.toThrow(/changed.*editing/);
    expect(savedItems.get(itemId)?.quantity).toBe(7);
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
  });
  it('never disguises a missing server total guard with a client-side total write', async () => {
    mocks.data.OrderItem.create.mockImplementation(async (line: OrderItem) => {
      savedItems.set(line.id, { ...line }); return line;
    });
    await expect(createOrderWithItems(input())).rejects.toThrow(/SQL guards/);
    expect(savedOrder?.totalAmount).toBe(0);
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
  });
});

describe('contact primary mutations', () => {
  it('creates nonprimary first, then performs one atomic SQL-controlled selection', async () => {
    const phone = { id: contactId, customer_id: customerId, number: '+1-202-555-0100', type: 'Work', isPrimary: true };
    mocks.data.Phone.query.execute.mockResolvedValue([phone]);
    mocks.data.Phone.query.executePaginated
      .mockResolvedValueOnce({ items: [{ ...phone, isPrimary: false }], hasNextPage: false })
      .mockResolvedValueOnce({ items: [phone], hasNextPage: false });
    expect(await createPhone({ customer_id: customerId, number: phone.number, type: 'Work', isPrimary: true })).toEqual(phone);
    expect(mocks.data.Phone.create).toHaveBeenCalledWith({
      customer_id: customerId, number: phone.number, type: 'Work', isPrimary: false,
    });
    expect(mocks.data.Phone.update).toHaveBeenCalledExactlyOnceWith({ id: contactId }, { isPrimary: true });
  });
  it('does not switch a phone belonging to another customer', async () => {
    await expect(setPrimaryPhone(customerId, contactId)).rejects.toThrow(/not found/);
    expect(mocks.data.Phone.update).not.toHaveBeenCalled();
  });
  it('validates email before mutation and supports primary email DTO refresh', async () => {
    await expect(createEmail({ customer_id: customerId, emailAddress: 'invalid', isPrimary: false })).rejects.toThrow(/email/);
    expect(mocks.data.Email.create).not.toHaveBeenCalled();
    const email = { id: contactId, customer_id: customerId, emailAddress: 'mira@example.com', isPrimary: true };
    mocks.data.Email.query.execute.mockResolvedValue([email]);
    mocks.data.Email.query.executePaginated.mockResolvedValue({ items: [email], hasNextPage: false });
    expect(await setPrimaryEmail(customerId, contactId)).toEqual(email);
    expect(mocks.data.Email.update).toHaveBeenCalledExactlyOnceWith({ id: contactId }, { isPrimary: true });
  });
});

describe('development seed safety', () => {
  it('rejects production before acquiring a data client', async () => {
    vi.stubEnv('DEV', false);
    try {
      await expect(seedDevelopmentData()).rejects.toThrow(/production/);
      expect(mocks.getClient).not.toHaveBeenCalled();
    } finally { vi.unstubAllEnvs(); }
  });
  it('seeds required fictional counts idempotently, including lost-response recovery', async () => {
    type Row = Record<string, unknown> & { id: string };
    const stores = Object.fromEntries(Object.keys(mocks.data).map(name => [name, new Map<string, Row>()]));
    const filters: Record<string, Record<string, { eq: string }>> = {};
    let lostResponse = true;
    for (const [name, entity] of Object.entries(mocks.data)) {
      entity.findById.mockImplementation(async id => stores[name].get(id) ?? null);
      entity.query.where.mockImplementation(filter => { filters[name] = filter; return entity.query; });
      entity.query.executePaginated.mockImplementation(async () => ({
        items: [...stores[name].values()].filter(row =>
          Object.entries(filters[name] ?? {}).every(([key, value]) => row[key] === value.eq)),
        hasNextPage: false,
      }));
      entity.query.execute.mockImplementation(async () => [...stores[name].values()].filter(row =>
        Object.entries(filters[name] ?? {}).every(([key, value]) => row[key] === value.eq)));
      entity.create.mockImplementation(async (input: Row) => {
        if (stores[name].has(input.id)) throw new Error('Duplicate UUID');
        stores[name].set(input.id, { ...input });
        if (name === 'OrderItem') {
          const order = stores.Order.get(String(input.order_id));
          if (!order) throw new Error('Missing order');
          order.totalAmount = sumOrderItems([...stores.OrderItem.values()]
            .filter(row => row.order_id === order.id)
            .map(row => ({ quantity: Number(row.quantity), unitPrice: String(row.unitPrice) })));
          if (lostResponse) { lostResponse = false; throw new Error('Response lost after commit'); }
        }
        return { ...input };
      });
    }
    vi.stubEnv('DEV', true);
    try {
      await seedDevelopmentData();
      await seedDevelopmentData();
      expect(stores.Customer.size).toBe(10);
      for (const name of ['Address', 'Phone', 'Email']) expect(stores[name].size).toBe(10);
      expect(stores.Product.size).toBe(20);
      expect(stores.Order.size).toBe(20);
      expect(stores.OrderItem.size).toBe(40);
      expect(mocks.data.OrderItem.create).toHaveBeenCalledTimes(40);
      expect(mocks.data.Order.update).not.toHaveBeenCalled();
      expect(mocks.data.Customer.delete).not.toHaveBeenCalled();
      for (const order of stores.Order.values()) {
        expect([...stores.OrderItem.values()].filter(item => item.order_id === order.id)).toHaveLength(2);
      }
    } finally { vi.unstubAllEnvs(); }
  });
});
