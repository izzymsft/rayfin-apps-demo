import { useState } from 'react';
import { getCustomers } from '@/services/customerService';
import { getProducts } from '@/services/productService';
import { getOrders } from '@/services/orderService';
import { formatMoney, sumOrderItems } from '@/services/money';
import { useResource, errorMessage } from '@/hooks/useResource';
import { OrderTable } from '@/components/orders/OrderTable';
import { Button } from '@/components/ui/Button';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
async function loadDashboard() {
  const [customers, products, orders] = await Promise.all([getCustomers(), getProducts(), getOrders()]);
  return { customers, products, orders };
}
export function DashboardPage() {
  const resource = useResource(loadDashboard);
  const [seeding, setSeeding] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  async function seed() {
    setSeeding(true); setError(''); setNotice('');
    try {
      const { seedDevelopmentData } = await import('@/services/seed');
      await seedDevelopmentData(); setNotice('Development data seeded. Existing records were not reset.');
      try { await resource.refresh(); } catch (err) { setError(`Seed finished, but refreshing failed: ${errorMessage(err)}.`); }
    } catch (err) { setError(errorMessage(err)); }
    finally { setSeeding(false); }
  }
  const data = resource.data;
  return <><div className="page-heading"><div><h1>Business overview</h1><p>Your customers, catalog, and orders in one workspace.</p></div><div className="row-actions"><Button variant="secondary" disabled={resource.loading || seeding} onClick={() => void resource.refresh().catch(err => setError(errorMessage(err)))}>Refresh</Button>
    {import.meta.env.DEV && <Button variant="secondary" disabled={seeding} onClick={() => void seed()}>{seeding ? 'Seeding...' : 'Seed development data'}</Button>}</div></div>
    <ErrorMessage message={resource.error || error} />{notice && <p role="status" className="success-message">{notice}</p>}
    {resource.loading ? <LoadingSpinner /> : data && <>
      <div className="stat-grid">{[
        ['Customers', data.customers.length.toLocaleString(), 'Customer relationships'],
        ['Products', data.products.length.toLocaleString(), 'Catalog records'],
        ['Orders', data.orders.length.toLocaleString(), 'Across all statuses'],
        ['Total order value', formatMoney(sumOrderItems(data.orders.map(order => ({ unitPrice: order.totalAmount, quantity: 1 })))), 'USD · all statuses'],
      ].map(([label, value, caption]) => <section className="stat-card" key={label}><h2>{label}</h2><strong>{value}</strong><p>{caption}</p></section>)}</div>
      <section className="panel"><div className="section-heading"><h2>Recent orders</h2><span className="muted">Latest 5</span></div><OrderTable rows={[...data.orders].sort((a, b) => new Date(b.orderDate).getTime() - new Date(a.orderDate).getTime()).slice(0, 5)} customers={data.customers} /></section>
    </>}
  </>;
}
