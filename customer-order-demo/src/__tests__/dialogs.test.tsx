import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; };
});
describe('delete confirmation', () => {
  it('does not delete until explicitly confirmed', async () => {
    const confirm = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();
    render(<ConfirmDialog label="this customer" onConfirm={confirm} onClose={close} />);
    expect(confirm).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(close).toHaveBeenCalled();
  });
  it('cancels without deleting', async () => {
    const confirm = vi.fn();
    const close = vi.fn();
    render(<ConfirmDialog label="this product" onConfirm={confirm} onClose={close} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(confirm).not.toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
  });
  it('shows deletion rules returned by the backend', async () => {
    const close = vi.fn();
    render(<ConfirmDialog label="this customer" onConfirm={vi.fn().mockRejectedValue(new Error('Customer has existing orders.'))} onClose={close} />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Customer has existing orders.');
    expect(close).not.toHaveBeenCalled();
  });
});
