import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createCustomer, deleteCustomer, getCustomers, updateCustomer } from '../services/customerService';
import { createAddress, getAddressesByCustomer, updateAddress } from '../services/addressService';
import { createEmail, setPrimaryEmail } from '../services/emailService';
import { createPhone, setPrimaryPhone } from '../services/phoneService';
import { deleteProduct, getProducts, updateProduct } from '../services/productService';
import { addOrderItem, calculateOrderTotal, deleteOrder, getOrderItems, updateOrder, updateOrderItem } from '../services/orderService';
import { seedDevelopmentData } from '../services/seed';
import { sumOrderItems } from '../services/money';

const mocks = vi.hoisted(() => {
  function entity() {
    const query = {
      where: vi.fn(),
      orderBy: vi.fn(),
      first: vi.fn(),
      after: vi.fn(),
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
    entity.findById.mockReset();
    entity.create.mockReset().mockResolvedValue({ id: contactId });
    entity.update.mockReset().mockResolvedValue({});
    entity.delete.mockReset().mockResolvedValue({});
  }
  mocks.getClient.mockReturnValue({ data: mocks.data });
  mocks.data.Customer.findById.mockResolvedValue(customer);
  mocks.data.Product.findById.mockResolvedValue(product);
  mocks.data.Order.findById.mockResolvedValue(order);
  mocks.data.OrderItem.findById.mockResolvedValue(item);
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
    mocks.data.Address.findById.mockResolvedValue({ ...address, id: contactId });
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
    mocks.data.Product.findById.mockResolvedValue({ ...product, unitPrice: '99.00' });
    await updateOrderItem(itemId, { quantity: 3 });
    expect(mocks.data.OrderItem.update).toHaveBeenCalledWith({ id: itemId }, { quantity: 3 });
    expect(mocks.data.Product.findById).not.toHaveBeenCalled();
    await expect(updateOrderItem(itemId, { quantity: 3, ...{ unitPrice: '99.00' } })).rejects.toThrow(/immutable/);
  });
  it('reports missing total guard without an unsafe browser repair', async () => {
    mocks.data.Order.findById.mockResolvedValue({ ...order, totalAmount: '0.00' });
    await expect(addOrderItem(orderId, productId, 3)).rejects.toThrow(/SQL guards/);
    expect(mocks.data.Order.update).not.toHaveBeenCalled();
    expect(mocks.data.OrderItem.delete).not.toHaveBeenCalled();
  });
  it('rejects invalid quantity before any API writes', async () => {
    await expect(addOrderItem(orderId, productId, 0)).rejects.toThrow(/Quantity/);
    expect(mocks.data.OrderItem.create).not.toHaveBeenCalled();
  });
});

describe('contact primary mutations', () => {
  it('creates nonprimary first, then performs one atomic SQL-controlled selection', async () => {
    const phone = { id: contactId, customer_id: customerId, number: '+1-202-555-0100', type: 'Work', isPrimary: true };
    mocks.data.Phone.findById.mockResolvedValue(phone);
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
    mocks.data.Email.findById.mockResolvedValue(email);
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
