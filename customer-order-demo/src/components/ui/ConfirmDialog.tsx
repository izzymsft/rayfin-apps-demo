import { useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { ErrorMessage } from './ErrorMessage';
import { errorMessage } from '@/hooks/useResource';
export function ConfirmDialog({ label, onConfirm, onClose }: { label: string; onConfirm: () => Promise<void>; onClose: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function confirm() {
    setBusy(true); setError('');
    try { await onConfirm(); onClose(); }
    catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return <Modal title="Confirm deletion" onClose={onClose} busy={busy}>
    <p>Delete {label}? This cannot be undone.</p><ErrorMessage message={error} />
    <div className="form-actions"><Button variant="secondary" disabled={busy} onClick={onClose}>Cancel</Button><Button variant="danger" disabled={busy} onClick={() => void confirm()}>{busy ? 'Deleting...' : 'Delete'}</Button></div>
  </Modal>;
}
