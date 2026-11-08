import { useState } from 'react';
import * as service from '@/services/orderService';
import { getCustomers } from '@/services/customerService';
import { useResource } from '@/hooks/useResource';
import { CrudPanel } from '@/components/ui/CrudPanel';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderTable } from '@/components/orders/OrderTable';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
export function OrdersPage() {
  const customers = useResource(getCustomers);
  const [customer, setCustomer] = useState('');
  const [status, setStatus] = useState('');
  return <><div className="page-heading"><h1>Orders</h1><p>Create orders and track their progress from draft to completion.</p></div><ErrorMessage message={customers.error} />
    {customers.loading ? <LoadingSpinner /> : <>
      <div className="filters"><label>Customer<select value={customer} onChange={event => setCustomer(event.target.value)}><option value="">All customers</option>{customers.data?.map(row => <option value={row.id} key={row.id}>{row.firstName} {row.lastName}</option>)}</select></label>
        <label>Status<select value={status} onChange={event => setStatus(event.target.value)}><option value="">All statuses</option>{['Draft', 'Submitted', 'Completed', 'Cancelled'].map(value => <option key={value}>{value}</option>)}</select></label></div>
      <CrudPanel title="Orders" singular="order" load={service.getOrders} create={service.createOrder} update={service.updateOrder} remove={service.deleteOrder}
        search={(row, query) => (!customer || row.customer_id === customer) && (!status || row.status === status) && row.orderNumber.toLowerCase().includes(query)}
        form={props => <OrderForm {...props} customers={customers.data ?? []} />} table={props => <OrderTable {...props} customers={customers.data} />} />
    </>}</>;
}
