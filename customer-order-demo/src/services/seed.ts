import { getRayfinClient } from './rayfinClient';
import { calculateOrderTotal, getOrderById } from './orderService';
import { moneyForWrite, normalizeMoney } from './money';
import { mutationError } from './validation';

function seedId(group: number, index: number): string {
  return `c0de000${group}-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

async function ensure<T>(
  read: () => Promise<T | null>,
  create: () => Promise<T>,
): Promise<T> {
  const existing = await read();
  if (existing) return existing;
  try { return await create(); }
  catch (error) {
    // A duplicate fixed UUID or a lost response is recoverable without another insert.
    const recovered = await read();
    if (recovered) return recovered;
    throw error;
  }
}

const names = [
  ['Mira', 'Brook'], ['Owen', 'Vale'], ['Nora', 'Finch'], ['Eli', 'Marsh'], ['Ada', 'Grove'],
  ['Theo', 'Stone'], ['Lina', 'Reed'], ['Iris', 'Pine'], ['Arlo', 'Wren'], ['Zoe', 'Lake'],
] as const;

// Explicit opt-in only. Never invoked by bootstrap or on module import.
export async function seedDevelopmentData(): Promise<void> {
  if (!import.meta.env.DEV) throw new Error('Development seeding is disabled in production.');
  const data = getRayfinClient().data;
  try {
    for (let index = 0; index < names.length; index++) {
      const id = seedId(1, index + 1);
      const [firstName, lastName] = names[index];
      const customer = await ensure(() => data.Customer.findById(id), () => data.Customer.create({
        id, firstName, lastName, companyName: `Fictional ${lastName} Studio`, isActive: true,
      }));
      if (customer.firstName !== firstName || customer.lastName !== lastName) throw new Error(`Seed UUID collision: ${id}`);
      const addressId = seedId(2, index + 1);
      const address = await ensure(() => data.Address.findById(addressId), () => data.Address.create({
        id: addressId, customer_id: id, line1: `${100 + index} Example Lane`,
        city: 'Sampleton', state: 'WA', postalCode: '98000', country: 'United States',
        addressType: 'Billing', isPrimary: false,
      }));
      const phoneId = seedId(3, index + 1);
      const phone = await ensure(() => data.Phone.findById(phoneId), () => data.Phone.create({
        id: phoneId, customer_id: id, number: `+1-202-555-${String(100 + index).padStart(4, '0')}`,
        type: 'Work', isPrimary: false,
      }));
      const emailId = seedId(4, index + 1);
      const email = await ensure(() => data.Email.findById(emailId), () => data.Email.create({
        id: emailId, customer_id: id, emailAddress: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
        isPrimary: false,
      }));
      if ([address, phone, email].some(contact => contact.customer_id !== id)) {
        throw new Error('Seed contact UUID collision; existing records were not modified.');
      }
    }
    for (let index = 1; index <= 20; index++) {
      const id = seedId(5, index);
      const sku = `DEMO-P${String(index).padStart(3, '0')}`;
      const product = await ensure(() => data.Product.findById(id), () => data.Product.create({
        id, sku, name: `Fictional Studio Supply ${index}`, description: 'Fictional development sample product.',
        unitPrice: moneyForWrite(`${index + 4}.25`), isActive: true,
      }));
      if (product.sku !== sku) throw new Error(`Seed product UUID collision: ${id}`);
    }
    for (let index = 1; index <= 20; index++) {
      const id = seedId(6, index);
      const customerId = seedId(1, ((index - 1) % 10) + 1);
      const orderNumber = `DEMO-O${String(index).padStart(3, '0')}`;
      const order = await ensure(() => data.Order.findById(id), () => data.Order.create({
        id, customer_id: customerId, orderNumber,
        orderDate: new Date(`2026-01-${String(index).padStart(2, '0')}T12:00:00.000Z`),
        status: 'Draft', totalAmount: 0,
      }));
      if (order.orderNumber !== orderNumber || order.customer_id !== customerId) throw new Error(`Seed order UUID collision: ${id}`);
      for (let itemIndex = 0; itemIndex < 2; itemIndex++) {
        const itemId = seedId(7, (index - 1) * 2 + itemIndex + 1);
        const productId = seedId(5, ((index + itemIndex - 1) % 20) + 1);
        const product = await data.Product.findById(productId);
        if (!product) throw new Error('Seed product missing.');
        const item = await ensure(() => data.OrderItem.findById(itemId), () => data.OrderItem.create({
          id: itemId, order_id: id, product_id: productId, quantity: itemIndex + 1,
          unitPrice: moneyForWrite(product.unitPrice),
        }));
        if (item.order_id !== id || item.product_id !== productId) throw new Error(`Seed item UUID collision: ${itemId}`);
      }
      const [refreshed, total] = await Promise.all([getOrderById(id), calculateOrderTotal(id)]);
      if (normalizeMoney(refreshed.totalAmount) !== total) {
        throw new Error('Required SQL total guards are missing or concurrent edits occurred; seeding stopped without overwriting totals.');
      }
    }
  } catch (error) {
    throw mutationError(error, 'Seed development data (partial seed is safe to rerun; no existing records are deleted or reset)');
  }
}
