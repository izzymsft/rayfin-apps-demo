import { Link } from 'react-router-dom';
import type { Customer, Order } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
import { formatMoney } from '@/services/money';
import { formatOrderDate } from './orderDate';
export function OrderTable({ customers = [], ...props }: TableProps<Order> & { customers?: Customer[] }) {
  const names = new Map(customers.map(row => [row.id, `${row.firstName} ${row.lastName}`]));
  return <DataTable {...props} columns={[
    { label: 'Order', render: row => <Link to={`/orders/${row.id}`}>{row.orderNumber}</Link> },
    { label: 'Customer', render: row => <Link to={`/customers/${row.customer_id}`}>{names.get(row.customer_id) ?? 'View customer'}</Link> },
    { label: 'Date', render: row => formatOrderDate(row.orderDate) },
    { label: 'Status', render: row => <span className="badge">{row.status}</span> },
    { label: 'Total', render: row => formatMoney(row.totalAmount) },
  ]} />;
}
