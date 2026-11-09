import { useCallback, useState, type KeyboardEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getCustomerById, updateCustomer } from '@/services/customerService';
import * as addresses from '@/services/addressService';
import * as phones from '@/services/phoneService';
import * as emails from '@/services/emailService';
import * as orders from '@/services/orderService';
import { useResource, errorMessage } from '@/hooks/useResource';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { AddressForm } from '@/components/customers/AddressForm';
import { AddressTable } from '@/components/customers/AddressTable';
import { PhoneForm } from '@/components/customers/PhoneForm';
import { PhoneTable } from '@/components/customers/PhoneTable';
import { EmailForm } from '@/components/customers/EmailForm';
import { EmailTable } from '@/components/customers/EmailTable';
import { OrderForm } from '@/components/orders/OrderForm';
import { OrderTable } from '@/components/orders/OrderTable';
import { CrudPanel } from '@/components/ui/CrudPanel';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ErrorMessage } from '@/components/ui/ErrorMessage';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

const tabs = ['Overview', 'Addresses', 'Phone Numbers', 'Email Addresses', 'Orders'];
export function CustomerDetailsPage() {
  const { id = '' } = useParams();
  const load = useCallback(() => getCustomerById(id), [id]);
  const customer = useResource(load);
  const loadAddresses = useCallback(() => addresses.getAddressesByCustomer(id), [id]);
  const loadPhones = useCallback(() => phones.getPhonesByCustomer(id), [id]);
  const loadEmails = useCallback(() => emails.getEmailsByCustomer(id), [id]);
  const loadOrders = useCallback(() => orders.getOrdersByCustomer(id), [id]);
  const [tab, setTab] = useState(0);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next = index;
    if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') next = (index + tabs.length - 1) % tabs.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = tabs.length - 1;
    else return;
    event.preventDefault(); setTab(next); document.getElementById(`customer-tab-${next}`)?.focus();
  }
  if (customer.loading) return <LoadingSpinner />;
  if (customer.error) return <><ErrorMessage message={customer.error} /><Button onClick={() => void customer.refresh().catch(() => {})}>Retry</Button></>;
  const row = customer.data;
  if (!row) return <div className="empty-state">Customer not found. <Link to="/customers">Back to customers</Link></div>;
  return <><Link className="back-link" to="/customers">Back to customers</Link><div className="page-heading"><h1>{row.firstName} {row.lastName}</h1><p>{row.companyName || 'Individual customer'} · {row.isActive ? 'Active' : 'Inactive'}</p></div>
    <div className="tabs" role="tablist" aria-label="Customer details">{tabs.map((name, index) => <button type="button" role="tab" aria-selected={tab === index} aria-controls={`customer-panel-${index}`} tabIndex={tab === index ? 0 : -1} id={`customer-tab-${index}`} key={name} onClick={() => setTab(index)} onKeyDown={event => tabKey(event, index)}>{name}</button>)}</div>
    <div role="tabpanel" id={`customer-panel-${tab}`} aria-labelledby={`customer-tab-${tab}`} key={`${id}-${tab}`}>
      {tab === 0 && <section className="panel"><div className="section-heading"><h2>Customer overview</h2><Button onClick={() => setEditing(true)}>Edit customer</Button></div><dl className="detail-grid"><div><dt>First name</dt><dd>{row.firstName}</dd></div><div><dt>Last name</dt><dd>{row.lastName}</dd></div><div><dt>Company</dt><dd>{row.companyName || '-'}</dd></div><div><dt>Status</dt><dd>{row.isActive ? 'Active' : 'Inactive'}</dd></div></dl>{notice && <p role="status" className="success-message">{notice}</p>}</section>}
      {tab === 1 && <CrudPanel title="Addresses" singular="address" load={loadAddresses} create={addresses.createAddress} update={addresses.updateAddress} remove={addresses.deleteAddress} form={props => <AddressForm {...props} customerId={id} />} table={props => <AddressTable {...props} />} />}
      {tab === 2 && <CrudPanel title="Phone numbers" singular="phone" load={loadPhones} create={phones.createPhone} update={phones.updatePhone} remove={phones.deletePhone} makePrimary={phone => phones.setPrimaryPhone(id, phone.id)} form={props => <PhoneForm {...props} customerId={id} />} table={props => <PhoneTable {...props} />} />}
      {tab === 3 && <CrudPanel title="Email addresses" singular="email" load={loadEmails} create={emails.createEmail} update={emails.updateEmail} remove={emails.deleteEmail} makePrimary={email => emails.setPrimaryEmail(id, email.id)} form={props => <EmailForm {...props} customerId={id} />} table={props => <EmailTable {...props} />} />}
      {tab === 4 && <CrudPanel title="Customer orders" singular="order" load={loadOrders} create={orders.createOrderWithItems} update={orders.updateOrderWithItems} remove={orders.deleteOrder} form={props => <OrderForm {...props} customers={[row]} customerId={id} />} table={props => <OrderTable {...props} customers={[row]} />} />}
    </div>
    {editing && <Modal title="Edit customer" busy={saving} onClose={() => setEditing(false)}><CustomerForm initial={row} onCancel={() => setEditing(false)} onSubmit={async input => {
      setSaving(true);
      try {
        await updateCustomer(id, input); setEditing(false); setNotice('Customer updated.');
        try { await customer.refresh(); } catch (err) { setNotice(`Customer saved, but refreshing failed: ${errorMessage(err)}.`); }
      } finally { setSaving(false); }
    }} /></Modal>}
  </>;
}
