import { useCallback, useState } from 'react';
import type { OrderItem } from '@/types';
import { getProducts } from '@/services/productService';
import { getOrderItems, addOrderItem, updateOrderItem, deleteOrderItem } from '@/services/orderService';
import { formatMoney, sumOrderItems } from '@/services/money';
import { useResource, errorMessage } from '@/hooks/useResource';
import { Button } from '@/components/ui/Button';
import { DataTable } from '@/components/ui/DataTable';
import { EntityForm } from '@/components/ui/EntityForm';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export function OrderItemEditor({ orderId, onChange }: { orderId: string; onChange: () => Promise<unknown> }) {
  const load = useCallback(async () => {
    const [items, products] = await Promise.all([getOrderItems(orderId), getProducts()]);
    return { items, products };
  }, [orderId]);
  const resource = useResource(load);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<OrderItem>();
  const [deleting, setDeleting] = useState<OrderItem>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  async function mutate(action: () => Promise<unknown>) {
    setBusy(true); setError(''); setNotice('');
    try {
      await action(); setNotice('Order items saved.');
      try { await Promise.all([resource.refresh(), onChange()]); }
      catch (err) { setError(`Saved, but refreshing failed: ${errorMessage(err)}. Use Refresh; do not repeat the write.`); }
    } finally { setBusy(false); }
  }
  const products = resource.data?.products ?? [];
  const names = new Map(products.map(product => [product.id, product.name]));
  return <section className="panel"><div className="section-heading"><h2>Order items</h2><div className="row-actions"><Button variant="secondary" disabled={busy || resource.loading} onClick={() => void Promise.all([resource.refresh(), onChange()]).catch(err => setError(errorMessage(err)))}>Refresh</Button><Button disabled={busy} onClick={() => setAdding(true)}>Add product</Button></div></div>
    <p className="muted">Prices are captured when products are added. Changing catalog prices will not alter these items.</p>
    <ErrorMessage message={resource.error || error} />{notice && <p role="status" className="success-message">{notice}</p>}
    {resource.loading ? <LoadingSpinner /> : <><DataTable<OrderItem> rows={resource.data?.items ?? []} busy={busy} onEdit={setEditing} onDelete={setDeleting} columns={[
      { label: 'Product', render: row => names.get(row.product_id) ?? row.product_id },
      { label: 'Quantity', render: row => row.quantity },
      { label: 'Snapshot unit price', render: row => formatMoney(row.unitPrice) },
      { label: 'Line total', render: row => formatMoney(sumOrderItems([row])) },
    ]} /><div className="order-total">Calculated total <strong>{formatMoney(sumOrderItems(resource.data?.items ?? []))}</strong></div></>}
    {adding && <Modal title="Add product" busy={busy} onClose={() => setAdding(false)}><EntityForm initial={{ product_id: '', quantity: '1' }} fields={[
      { name: 'product_id', label: 'Product', type: 'select', required: true, options: products.filter(row => row.isActive).map(row => ({ value: row.id, label: `${row.sku} - ${row.name} (${formatMoney(row.unitPrice)})` })) },
      { name: 'quantity', label: 'Quantity', type: 'number', min: 1, step: '1', required: true },
    ]} onCancel={() => setAdding(false)} onSubmit={async values => {
      const quantity = Number(values.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive integer.');
      await mutate(() => addOrderItem(orderId, String(values.product_id), quantity)); setAdding(false);
    }} /></Modal>}
    {editing && <Modal title="Edit quantity" busy={busy} onClose={() => setEditing(undefined)}><EntityForm initial={{ quantity: String(editing.quantity) }} fields={[{ name: 'quantity', label: 'Quantity', type: 'number', min: 1, step: '1', required: true }]} onCancel={() => setEditing(undefined)} onSubmit={async values => {
      const quantity = Number(values.quantity);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('Quantity must be a positive integer.');
      await mutate(() => updateOrderItem(editing.id, { quantity })); setEditing(undefined);
    }} /></Modal>}
    {deleting && <ConfirmDialog label="this order item" onClose={() => setDeleting(undefined)} onConfirm={() => mutate(() => deleteOrderItem(deleting.id))} />}
  </section>;
}
