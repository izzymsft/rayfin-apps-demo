import type { Address } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
export function AddressTable(props: TableProps<Address>) {
  return <DataTable {...props} columns={[
    { label: 'Address', render: row => <>{row.line1}{row.line2 && <><br />{row.line2}</>}</> },
    { label: 'City / region', render: row => `${row.city}, ${row.state} ${row.postalCode}` },
    { label: 'Country', render: row => row.country },
    { label: 'Type', render: row => `${row.addressType}${row.isPrimary ? ' (Primary)' : ''}` },
  ]} />;
}
