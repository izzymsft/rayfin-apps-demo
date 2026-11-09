import { useCallback, useEffect, useState } from 'react';
import type { Customer, Money, Order, OrderFormInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { getProducts } from '@/services/productService';
import { getOrderItems } from '@/services/orderService';
import { formatMoney, sumOrderItems } from '@/services/money';
import { validateQuantity } from '@/services/validation';
import { errorMessage, useResource } from '@/hooks/useResource';

interface DraftLine {
  id: string;
  product_id: string;
  quantity: string;
  unitPrice: Money;
  persisted: boolean;
}
export function OrderForm({ initial, onSubmit, onCancel, customers, customerId }: FormProps<Order, OrderFormInput> & { customers: Customer[]; customerId?: string }) {
  const existingId = initial?.id;
  const [orderId] = useState(() => existingId ?? crypto.randomUUID());
  const load = useCallback(async () => {
    const [products, items] = await Promise.all([getProducts(), existingId ? getOrderItems(existingId) : Promise.resolve([])]);
    return { products, items };
  }, [existingId]);
  const resource = useResource(load);
  const [lines, setLines] = useState<DraftLine[]>();
  const [removedItemIds, setRemovedItemIds] = useState<string[]>([]);
  const [removing, setRemoving] = useState<string>();
  useEffect(() => {
    if (resource.data && lines === undefined) {
      setLines(resource.data.items.map(item => ({ ...item, quantity: String(item.quantity), persisted: true })));
    }
  }, [resource.data, lines]);
  const date = initial ? new Date(initial.orderDate) : new Date();
  const dateOnly = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  const products = resource.data?.products ?? [];
  const draft = lines ?? [];
  let total: string | undefined;
  let totalError = '';
  try { total = sumOrderItems(draft.map(line => ({ quantity: Number(line.quantity), unitPrice: line.unitPrice }))); }
  catch (error) { totalError = errorMessage(error); }
  function changeLine(id: string, changes: Partial<DraftLine>) {
    setLines(rows => rows?.map(row => row.id === id ? { ...row, ...changes } : row));
  }
  function removeLine(id: string) {
    setRemovedItemIds(ids => [...ids, id]);
    setLines(rows => rows?.filter(row => row.id !== id));
  }
  if (resource.error) return <><ErrorMessage message={resource.error} /><Button variant="secondary" onClick={() => void resource.refresh().catch(() => {})}>Retry loading products</Button><Button variant="secondary" onClick={onCancel}>Cancel</Button></>;
  if (resource.loading || lines === undefined) return <><LoadingSpinner /><Button variant="secondary" onClick={onCancel}>Cancel</Button></>;
  return <EntityForm fields={[
    { name: 'customer_id', label: 'Customer', type: 'select', required: true, options: customers.map(row => ({ value: row.id, label: `${row.firstName} ${row.lastName}${row.companyName ? ` - ${row.companyName}` : ''}` })) },
    { name: 'orderNumber', label: 'Order number', required: true, maxLength: 100 },
    { name: 'orderDate', label: 'Order date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Draft', 'Submitted', 'Completed', 'Cancelled'].map(value => ({ value, label: value })) },
  ]} initial={{ customer_id: initial?.customer_id ?? customerId ?? '', orderNumber: initial?.orderNumber ?? '', orderDate: dateOnly, status: initial?.status ?? 'Draft' }}
    submitDisabled={!!totalError}
    onCancel={onCancel} onSubmit={values => {
      const status = String(values.status);
      if (status !== 'Draft' && status !== 'Submitted' && status !== 'Completed' && status !== 'Cancelled') throw new Error('Select a valid order status.');
      if (!resource.data || !lines) throw new Error('Products and order items have not loaded.');
      return onSubmit({
        id: orderId, customer_id: String(values.customer_id), orderNumber: String(values.orderNumber),
        orderDate: new Date(`${values.orderDate}T00:00:00.000Z`), status,
        originalItems: resource.data.items,
        removedItemIds,
        items: lines.map(line => ({ id: line.id, product_id: line.product_id, quantity: validateQuantity(Number(line.quantity)) })),
      });
    }}>
    <div className="section-heading order-lines-heading"><h3>Products ordered</h3>
      <Button variant="secondary" onClick={() => setLines(rows => [...(rows ?? []), { id: crypto.randomUUID(), product_id: '', quantity: '1', unitPrice: '0.00', persisted: false }])}>Add product</Button>
    </div>
    <ErrorMessage message={totalError} />
    <>
      <p className="muted">Choose products and quantities. Existing lines retain their original unit prices; new lines use the catalog price at save time.</p>
      {!draft.length && <p className="empty-state">No products yet. Use Add product to include a product in this order.</p>}
      {draft.map((line, index) => <div className="order-form-line" key={line.id}>
        <label>Product {index + 1}<select required value={line.product_id} disabled={line.persisted} onChange={event => {
          const product = products.find(row => row.id === event.target.value);
          changeLine(line.id, { product_id: event.target.value, unitPrice: product?.unitPrice ?? '0.00' });
        }}>
          <option value="">Select a product...</option>
          {products.filter(product => product.isActive || product.id === line.product_id).map(product =>
            <option key={product.id} value={product.id}>{product.sku} - {product.name}{product.isActive ? '' : ' (Inactive)'}</option>)}
          {line.persisted && !products.some(product => product.id === line.product_id) && <option value={line.product_id}>Existing product {line.product_id}</option>}
        </select></label>
        <label>Quantity {index + 1}<input type="number" required min="1" max="2147483647" step="1" value={line.quantity} onChange={event => changeLine(line.id, { quantity: event.target.value })} /></label>
        <div><span className="line-label">Unit price</span><output aria-label={`Unit price ${index + 1}`}>{formatMoney(line.unitPrice)}</output></div>
        <div><span className="line-label">Line total</span><output aria-label={`Line total ${index + 1}`}>{Number.isInteger(Number(line.quantity)) && Number(line.quantity) > 0 && Number(line.quantity) <= 2147483647 && !totalError ? formatMoney(sumOrderItems([{ quantity: Number(line.quantity), unitPrice: line.unitPrice }])) : 'Not available'}</output></div>
        <Button variant="danger" aria-label={`Remove product ${index + 1}`} onClick={() => {
          if (line.persisted) setRemoving(line.id); else removeLine(line.id);
        }}>Remove</Button>
      </div>)}
      <div className="order-total">Order total <output aria-label="Order total"><strong>{total ? formatMoney(total) : 'Not available'}</strong></output></div>
    </>
    {removing && <ConfirmDialog label="this product from the order when you save" onClose={() => setRemoving(undefined)} onConfirm={async () => removeLine(removing)} />}
  </EntityForm>;
}
