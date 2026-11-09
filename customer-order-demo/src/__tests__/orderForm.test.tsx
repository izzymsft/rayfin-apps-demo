import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { OrderForm } from '@/components/orders/OrderForm';
import { getProducts } from '@/services/productService';
import { getOrderItems } from '@/services/orderService';
import type { Order, OrderItem, Product } from '@/types';

vi.mock('@/services/productService', () => ({ getProducts: vi.fn() }));
vi.mock('@/services/orderService', () => ({ getOrderItems: vi.fn() }));
const customerId = '00000000-0000-4000-8000-000000000001';
const productId = '00000000-0000-4000-8000-000000000002';
const orderId = '00000000-0000-4000-8000-000000000003';
const itemId = '00000000-0000-4000-8000-000000000004';
const secondProductId = '00000000-0000-4000-8000-000000000005';
const products: Product[] = [
  { id: productId, sku: 'A', name: 'Paper', unitPrice: '0.10', isActive: true },
  { id: secondProductId, sku: 'B', name: 'Pens', unitPrice: '0.20', isActive: true },
];
const order: Order = { id: orderId, customer_id: customerId, orderNumber: 'O1', orderDate: '2026-11-08', status: 'Draft', totalAmount: '0.30' };
const item: OrderItem = { id: itemId, order_id: orderId, product_id: productId, quantity: 3, unitPrice: '0.10' };
const customers = [{ id: customerId, firstName: 'Ada', lastName: 'Example', isActive: true }];

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getProducts).mockResolvedValue(products);
  vi.mocked(getOrderItems).mockResolvedValue([item]);
});
describe('order product forms', () => {
  it('selects products, calculates exact prices, and submits lines with the header', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<OrderForm customers={customers} onSubmit={onSubmit} onCancel={() => {}} />);
    await user.click(await screen.findByRole('button', { name: 'Add product' }));
    await user.selectOptions(screen.getByLabelText('Product 1'), productId);
    await user.click(screen.getByRole('button', { name: 'Add product' }));
    await user.selectOptions(screen.getByLabelText('Product 2'), secondProductId);
    expect(screen.getByLabelText('Unit price 1')).toHaveTextContent('$0.10');
    expect(screen.getByLabelText('Unit price 2')).toHaveTextContent('$0.20');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.30');
    await user.clear(screen.getByLabelText('Quantity 1'));
    await user.type(screen.getByLabelText('Quantity 1'), '3');
    expect(screen.getByLabelText('Line total 1')).toHaveTextContent('$0.30');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.50');
    await user.selectOptions(screen.getByLabelText('Customer *'), customerId);
    await user.type(screen.getByLabelText('Order number *'), 'O2');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      customer_id: customerId, orderNumber: 'O2', originalItems: [],
      items: [
        { id: expect.any(String), product_id: productId, quantity: 3 },
        { id: expect.any(String), product_id: secondProductId, quantity: 1 },
      ],
    })));
    expect(onSubmit.mock.calls[0][0]).not.toHaveProperty('totalAmount');
  });
  it('loads existing lines and preserves snapshot prices when the catalog price changes', async () => {
    vi.mocked(getProducts).mockResolvedValue([{ ...products[0], unitPrice: '99.99' }]);
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OrderForm initial={order} customers={customers} onSubmit={onSubmit} onCancel={() => {}} />);
    expect(await screen.findByLabelText('Quantity 1')).toHaveValue(3);
    expect(screen.getByLabelText('Product 1')).toHaveValue(productId);
    expect(screen.getByLabelText('Unit price 1')).toHaveTextContent('$0.10');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.30');
    await userEvent.clear(screen.getByLabelText('Quantity 1'));
    await userEvent.type(screen.getByLabelText('Quantity 1'), '5');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.50');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ id: orderId, originalItems: [item], items: [{ id: itemId, product_id: productId, quantity: 5 }] }));
  });
  it('confirms removing an existing product and updates the preview without writing early', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<OrderForm initial={order} customers={customers} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove product 1' }));
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.30');
    await userEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.00');
    expect(onSubmit).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ items: [], removedItemIds: [itemId] }));
  });
  it('lets invalid quantities be corrected and blocks an invalid total', async () => {
    render(<OrderForm initial={order} customers={customers} onSubmit={vi.fn()} onCancel={() => {}} />);
    await userEvent.clear(await screen.findByLabelText('Quantity 1'));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(screen.getByLabelText('Quantity 1')).toBeEnabled();
    expect(screen.getByLabelText('Order total')).toHaveTextContent('Not available');
    await userEvent.type(screen.getByLabelText('Quantity 1'), '2');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$0.20');
  });
  it('surfaces loading errors and offers a working retry', async () => {
    vi.mocked(getProducts).mockRejectedValueOnce(new Error('Catalog unavailable')).mockResolvedValueOnce(products);
    render(<OrderForm customers={customers} onSubmit={vi.fn()} onCancel={() => {}} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Catalog unavailable');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading products' }));
    expect(await screen.findByRole('button', { name: 'Add product' })).toBeEnabled();
  });
  it('retains form and line identities when a save is interrupted', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('Interrupted; retry this form.')).mockResolvedValueOnce(undefined);
    render(<OrderForm initial={order} customers={customers} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    await userEvent.selectOptions(screen.getByLabelText('Product 2'), secondProductId);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Interrupted');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit.mock.calls[1][0]).toEqual(onSubmit.mock.calls[0][0]);
  });
});
