import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { AddressForm } from '@/components/customers/AddressForm';
import { PhoneForm } from '@/components/customers/PhoneForm';
import { EmailForm } from '@/components/customers/EmailForm';
import { EntityForm } from '@/components/ui/EntityForm';

describe('Customer and contact forms', () => {
  it('creates a customer with trimmed names and active default', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('First name *'), '  Ada  ');
    await user.type(screen.getByLabelText('Last name *'), '  Example  ');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ firstName: 'Ada', lastName: 'Example', companyName: '', isActive: true }));
  });

  it('requires names before creating a customer', async () => {
    const onSubmit = vi.fn();
    render(<CustomerForm onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps an edit form open and displays backend validation errors', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Customer update rejected.'));
    render(<CustomerForm initial={{ id: 'customer', firstName: 'Ada', lastName: 'Example', isActive: false }} onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer update rejected.');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByLabelText('Active')).not.toBeChecked();
  });

  it('uses the customer relationship when creating an email', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(<EmailForm customerId="c1" onSubmit={onSubmit} onCancel={() => {}} />);
    await user.type(screen.getByLabelText('Email address *'), 'contact@example.com');
    await user.click(screen.getByLabelText('Primary email'));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ customer_id: 'c1', emailAddress: 'contact@example.com', isPrimary: true }));
  });

  it('rejects an invalid email through native form validation', async () => {
    const onSubmit = vi.fn();
    render(<EmailForm customerId="c1" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('Email address *'), 'invalid-email');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('creates a phone with an allowed type', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<PhoneForm customerId="c1" onSubmit={onSubmit} onCancel={() => {}} />);
    await userEvent.type(screen.getByLabelText('Phone number *'), '+1 555 0100');
    await userEvent.selectOptions(screen.getByLabelText('Type *'), 'Work');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith({ customer_id: 'c1', number: '+1 555 0100', type: 'Work', isPrimary: false }));
  });

  it('renders all required address fields', () => {
    render(<AddressForm customerId="c1" onSubmit={vi.fn()} onCancel={() => {}} />);
    for (const label of ['Address line 1 *', 'City *', 'State / province *', 'Postal code *', 'Country *']) {
      expect(screen.getByLabelText(label)).toBeRequired();
    }
  });

  it('disables duplicate submission while saving', async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const submit = vi.fn(() => pending);
    render(<EntityForm fields={[{ name: 'name', label: 'Name' }]} initial={{ name: 'Example' }} onSubmit={submit} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    finish();
  });
});
