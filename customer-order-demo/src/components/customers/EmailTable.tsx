import type { Email } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
export function EmailTable(props: TableProps<Email>) {
  return <DataTable {...props} columns={[
    { label: 'Email address', render: row => row.emailAddress },
    { label: 'Primary', render: row => row.isPrimary ? 'Yes' : 'No' },
  ]} />;
}
