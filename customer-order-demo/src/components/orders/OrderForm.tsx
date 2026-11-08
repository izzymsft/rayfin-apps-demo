import type { Customer, Order, OrderInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
export function OrderForm({ initial, onSubmit, onCancel, customers, customerId }: FormProps<Order, OrderInput> & { customers: Customer[]; customerId?: string }) {
  const date = initial ? new Date(initial.orderDate) : new Date();
  const dateOnly = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  return <EntityForm fields={[
    { name: 'customer_id', label: 'Customer', type: 'select', required: true, options: customers.map(row => ({ value: row.id, label: `${row.firstName} ${row.lastName}${row.companyName ? ` - ${row.companyName}` : ''}` })) },
    { name: 'orderNumber', label: 'Order number', required: true, maxLength: 100 },
    { name: 'orderDate', label: 'Order date', type: 'date', required: true },
    { name: 'status', label: 'Status', type: 'select', required: true, options: ['Draft', 'Submitted', 'Completed', 'Cancelled'].map(value => ({ value, label: value })) },
  ]} initial={{ customer_id: initial?.customer_id ?? customerId ?? '', orderNumber: initial?.orderNumber ?? '', orderDate: dateOnly, status: initial?.status ?? 'Draft' }} onCancel={onCancel} onSubmit={values => {
    const status = String(values.status);
    if (status !== 'Draft' && status !== 'Submitted' && status !== 'Completed' && status !== 'Cancelled') throw new Error('Select a valid order status.');
    return onSubmit({ customer_id: String(values.customer_id), orderNumber: String(values.orderNumber), orderDate: new Date(`${values.orderDate}T00:00:00.000Z`), status });
  }} />;
}
