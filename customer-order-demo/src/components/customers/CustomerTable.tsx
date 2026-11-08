import { Link } from 'react-router-dom';
import type { Customer } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
export function CustomerTable(props: TableProps<Customer>) {
  return <DataTable {...props} columns={[
    { label: 'Customer', render: row => <Link to={`/customers/${row.id}`}>{row.firstName} {row.lastName}</Link> },
    { label: 'Company', render: row => row.companyName || '-' },
    { label: 'Status', render: row => <span className={`badge ${row.isActive ? 'active' : ''}`}>{row.isActive ? 'Active' : 'Inactive'}</span> },
  ]} />;
}
