import type { Phone } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
export function PhoneTable(props: TableProps<Phone>) {
  return <DataTable {...props} columns={[
    { label: 'Phone number', render: row => row.number },
    { label: 'Type', render: row => row.type },
    { label: 'Primary', render: row => row.isPrimary ? 'Yes' : 'No' },
  ]} />;
}
