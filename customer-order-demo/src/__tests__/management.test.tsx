import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '@/App';
import type { Customer, CustomerInput } from '@/types';
import { createOrderWithItems, updateOrderWithItems } from '@/services/orderService';

const fixture = vi.hoisted(() => ({
  authenticated: true,
  customers: [{ id: 'c1', firstName: 'Ada', lastName: 'Example', companyName: 'Example Works', isActive: true }] as Customer[],
}));
vi.mock('@/hooks/AuthContext', () => ({
  useAuth: () => ({ user: { name: 'Demo', email: 'demo@example.com' }, isAuthenticated: fixture.authenticated, loading: false, error: null, signIn: vi.fn(), signOut: vi.fn(), fabricAuthEnabled: true }),
}));
vi.mock('@/services/customerService', () => ({
  getCustomers: async () => [...fixture.customers],
  getCustomerById: async (id: string) => fixture.customers.find(row => row.id === id) ?? null,
  createCustomer: async (input: CustomerInput) => {
    const row = { id: 'c2', ...input }; fixture.customers.push(row); return row;
  },
  updateCustomer: async (id: string, input: CustomerInput) => {
    fixture.customers = fixture.customers.map(row => row.id === id ? { ...row, ...input } : row);
  },
  deleteCustomer: async (id: string) => { fixture.customers = fixture.customers.filter(row => row.id !== id); },
}));
vi.mock('@/services/productService', () => ({
  getProducts: async () => [{ id: 'p1', sku: 'DEMO-01', name: 'Example Product', description: '', isActive: true, unitPrice: '12.50' }],
  createProduct: vi.fn(), updateProduct: vi.fn(), deleteProduct: vi.fn(),
}));
vi.mock('@/services/orderService', () => ({
  getOrders: async () => [{ id: 'o1', customer_id: 'c1', orderNumber: 'DEMO-001', orderDate: '2026-11-08T00:00:00Z', status: 'Draft', totalAmount: '25.00' }],
  getOrdersByCustomer: async () => [],
  getOrderById: async () => ({ id: 'o1', customer_id: 'c1', orderNumber: 'DEMO-001', orderDate: '2026-11-08T00:00:00Z', status: 'Draft', totalAmount: '25.00' }),
  getOrderItems: async () => [{ id: 'i1', order_id: 'o1', product_id: 'p1', unitPrice: '12.50', quantity: 2 }],
  createOrder: vi.fn(), updateOrder: vi.fn(), createOrderWithItems: vi.fn().mockResolvedValue(undefined),
  updateOrderWithItems: vi.fn().mockResolvedValue(undefined), deleteOrder: vi.fn(), addOrderItem: vi.fn(), updateOrderItem: vi.fn(), deleteOrderItem: vi.fn(),
}));
vi.mock('@/services/addressService', () => ({
  getAddressesByCustomer: async () => [], createAddress: vi.fn(), updateAddress: vi.fn(), deleteAddress: vi.fn(),
}));
vi.mock('@/services/phoneService', () => ({
  getPhonesByCustomer: async () => [], createPhone: vi.fn(), updatePhone: vi.fn(), deletePhone: vi.fn(), setPrimaryPhone: vi.fn(),
}));
vi.mock('@/services/emailService', () => ({
  getEmailsByCustomer: async () => [], createEmail: vi.fn(), updateEmail: vi.fn(), deleteEmail: vi.fn(), setPrimaryEmail: vi.fn(),
}));
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
beforeEach(() => {
  vi.clearAllMocks();
  fixture.authenticated = true;
  fixture.customers = [{ id: 'c1', firstName: 'Ada', lastName: 'Example', companyName: 'Example Works', isActive: true }];
  window.history.replaceState(null, '', '/');
});
describe('management application integration (mocked data API)', () => {
  it('shows dashboard metrics and navigates to products', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Recent orders' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'DEMO-001' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Products' }));
    expect(await screen.findByText('Example Product')).toBeInTheDocument();
    expect(screen.getByText('$12.50')).toBeInTheDocument();
  });
  it('creates, searches, edits, deletes, and reloads customers through services', async () => {
    window.history.replaceState(null, '', '/customers');
    const user = userEvent.setup();
    const app = render(<App />);
    expect(await screen.findByRole('link', { name: 'Ada Example' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New customer' }));
    await user.type(screen.getByLabelText('First name *'), 'Grace');
    await user.type(screen.getByLabelText('Last name *'), 'Sample');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('link', { name: 'Grace Sample' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Search customers'), 'Grace');
    expect(screen.queryByRole('link', { name: 'Ada Example' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(screen.getByLabelText('Last name *'));
    await user.type(screen.getByLabelText('Last name *'), 'Updated');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('link', { name: 'Grace Updated' })).toBeInTheDocument();
    app.unmount();
    render(<App />);
    expect(await screen.findByRole('link', { name: 'Grace Updated' })).toBeInTheDocument();
    const row = screen.getByRole('link', { name: 'Grace Updated' }).closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Delete' }));
    expect(fixture.customers).toHaveLength(2);
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByRole('link', { name: 'Grace Updated' })).not.toBeInTheDocument());
    expect(fixture.customers).toHaveLength(1);
  });
  it('loads customer detail tabs and permits keyboard navigation', async () => {
    window.history.replaceState(null, '', '/customers/c1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Ada Example' })).toBeInTheDocument();
    const overview = screen.getByRole('tab', { name: 'Overview' });
    overview.focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Addresses' })).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByRole('button', { name: 'New address' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Phone Numbers' }));
    expect(await screen.findByRole('button', { name: 'New phone' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'Email Addresses' }));
    expect(await screen.findByRole('button', { name: 'New email' })).toBeInTheDocument();
  });
  it('loads order details and calculates line totals', async () => {
    window.history.replaceState(null, '', '/orders/o1');
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'Order DEMO-001' })).toBeInTheDocument();
    expect(await screen.findByText('Example Product')).toBeInTheDocument();
    expect(screen.getByText('Snapshot unit price')).toBeInTheDocument();
    expect(screen.getByText(new Date('2026-11-08T00:00:00Z').toLocaleDateString(undefined, { timeZone: 'UTC' }))).toBeInTheDocument();
    expect(screen.getAllByText('$25.00').length).toBeGreaterThanOrEqual(2);
  });
  it('protects deep links and restores the requested route after sign-in', async () => {
    fixture.authenticated = false;
    window.history.replaceState(null, '', '/orders/o1');
    const app = render(<App />);
    expect(await screen.findByRole('button', { name: 'Sign in with Microsoft' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/auth');
    fixture.authenticated = true;
    app.rerender(<App />);
    expect(await screen.findByRole('heading', { name: 'Order DEMO-001' })).toBeInTheDocument();
    expect(window.location.pathname).toBe('/orders/o1');
  });
  it('saves products and quantities from the Orders new/edit dialogs', async () => {
    window.history.replaceState(null, '', '/orders');
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: 'New order' }));
    await user.click(await screen.findByRole('button', { name: 'Add product' }));
    await user.selectOptions(screen.getByLabelText('Product 1'), 'p1');
    await user.clear(screen.getByLabelText('Quantity 1'));
    await user.type(screen.getByLabelText('Quantity 1'), '2');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$25.00');
    await user.selectOptions(screen.getByLabelText('Customer *'), 'c1');
    await user.type(screen.getByLabelText('Order number *'), 'NEW-001');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createOrderWithItems).toHaveBeenCalledWith(expect.objectContaining({ items: [{ id: expect.any(String), product_id: 'p1', quantity: 2 }] })));
    await user.click(await screen.findByRole('button', { name: 'Edit' }));
    await user.clear(await screen.findByLabelText('Quantity 1'));
    await user.type(screen.getByLabelText('Quantity 1'), '3');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$37.50');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateOrderWithItems).toHaveBeenCalledWith('o1', expect.objectContaining({ items: [{ id: 'i1', product_id: 'p1', quantity: 3 }] })));
  });
  it('uses line-aware saving from order details', async () => {
    window.history.replaceState(null, '', '/orders/o1');
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit order' }));
    const dialog = within(screen.getByRole('dialog'));
    await userEvent.clear(await dialog.findByLabelText('Quantity 1'));
    await userEvent.type(dialog.getByLabelText('Quantity 1'), '4');
    expect(dialog.getByLabelText('Order total')).toHaveTextContent('$50.00');
    await userEvent.click(dialog.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(updateOrderWithItems).toHaveBeenCalledWith('o1', expect.objectContaining({ items: [{ id: 'i1', product_id: 'p1', quantity: 4 }] })));
  });
  it('saves selected products from the customer Orders tab', async () => {
    window.history.replaceState(null, '', '/customers/c1');
    render(<App />);
    await userEvent.click(await screen.findByRole('tab', { name: 'Orders' }));
    await userEvent.click(await screen.findByRole('button', { name: 'New order' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Add product' }));
    expect(screen.getByLabelText('Customer *')).toHaveValue('c1');
    await userEvent.selectOptions(screen.getByLabelText('Product 1'), 'p1');
    await userEvent.type(screen.getByLabelText('Order number *'), 'CUSTOMER-001');
    expect(screen.getByLabelText('Order total')).toHaveTextContent('$12.50');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(createOrderWithItems).toHaveBeenCalledWith(expect.objectContaining({
      customer_id: 'c1', orderNumber: 'CUSTOMER-001', items: [{ id: expect.any(String), product_id: 'p1', quantity: 1 }],
    })));
  });
});
