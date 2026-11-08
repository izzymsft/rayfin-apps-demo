import * as service from '@/services/customerService';
import { CrudPanel } from '@/components/ui/CrudPanel';
import { CustomerForm } from '@/components/customers/CustomerForm';
import { CustomerTable } from '@/components/customers/CustomerTable';
export function CustomersPage() {
  return <><div className="page-heading"><h1>Customers</h1><p>Manage business relationships and customer contact information.</p></div><CrudPanel title="Customers" singular="customer" load={service.getCustomers} create={service.createCustomer} update={service.updateCustomer} remove={service.deleteCustomer} search={(row, query) => `${row.firstName} ${row.lastName} ${row.companyName ?? ''}`.toLowerCase().includes(query)} form={props => <CustomerForm {...props} />} table={props => <CustomerTable {...props} />} /></>;
}
