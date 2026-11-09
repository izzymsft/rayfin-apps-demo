import { useCallback, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getOrderById, updateOrderWithItems, deleteOrder } from '@/services/orderService';
import { getCustomers } from '@/services/customerService';
import { formatMoney } from '@/services/money';
import { useResource, errorMessage } from '@/hooks/useResource';
import { OrderForm } from '@/components/orders/OrderForm';
import { formatOrderDate } from '@/components/orders/orderDate';
import { OrderItemEditor } from '@/components/orders/OrderItemEditor';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useNavigate } from 'react-router-dom';
export function OrderDetailsPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const load = useCallback(async () => {
    const [order, customers] = await Promise.all([getOrderById(id), getCustomers()]);
    return { order, customers };
  }, [id]);
  const resource = useResource(load);
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  if (!resource.data) {
    return resource.loading ? <LoadingSpinner /> : <><ErrorMessage message={resource.error} /><Button onClick={() => void resource.refresh().catch(() => {})}>Retry</Button></>;
  }
  const { order, customers } = resource.data;
  if (order && order.id !== id) return <LoadingSpinner />;
  if (!order) return <div className="empty-state">Order not found. <Link to="/orders">Back to orders</Link></div>;
  const customer = customers.find(row => row.id === order.customer_id);
  return <><Link className="back-link" to="/orders">Back to orders</Link><div className="page-heading"><h1>Order {order.orderNumber}</h1><p>Manage customer, status, and line items.</p></div>
    <ErrorMessage message={resource.error} />{notice && <p role="status" className="success-message">{notice}</p>}
    <section className="panel"><div className="section-heading"><h2>Order summary</h2><div className="row-actions"><Button disabled={saving} onClick={() => setEditing(true)}>Edit order</Button><Button variant="danger" disabled={saving} onClick={() => setDeleting(true)}>Delete order</Button></div></div>
      <dl className="detail-grid"><div><dt>Customer</dt><dd><Link to={`/customers/${order.customer_id}`}>{customer ? `${customer.firstName} ${customer.lastName}` : 'View customer'}</Link></dd></div><div><dt>Date</dt><dd>{formatOrderDate(order.orderDate)}</dd></div><div><dt>Status</dt><dd><span className="badge">{order.status}</span></dd></div><div><dt>Stored total</dt><dd>{formatMoney(order.totalAmount)}</dd></div></dl>
    </section>
    <OrderItemEditor key={id} orderId={id} onChange={resource.refresh} />
    {editing && <Modal title="Edit order" busy={saving} onClose={() => setEditing(false)}><OrderForm initial={order} customers={customers} onCancel={() => setEditing(false)} onSubmit={async input => {
      setSaving(true);
      try {
        await updateOrderWithItems(id, input); setEditing(false); setNotice('Order updated.');
        try { await resource.refresh(); } catch (err) { setNotice(`Order saved, but refreshing failed: ${errorMessage(err)}.`); }
      } finally { setSaving(false); }
    }} /></Modal>}
    {deleting && <ConfirmDialog label={`order ${order.orderNumber} and its items`} onClose={() => setDeleting(false)} onConfirm={async () => { await deleteOrder(id); navigate('/orders'); }} />}
  </>;
}
