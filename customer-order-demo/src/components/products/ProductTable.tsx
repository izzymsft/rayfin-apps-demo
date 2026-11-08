import type { Product } from '@/types';
import { DataTable, type TableProps } from '@/components/ui/DataTable';
import { formatMoney } from '@/services/money';
export function ProductTable(props: TableProps<Product>) {
  return <DataTable {...props} columns={[
    { label: 'SKU', render: row => row.sku },
    { label: 'Product', render: row => row.name },
    { label: 'Unit price', render: row => formatMoney(row.unitPrice) },
    { label: 'Status', render: row => <span className={`badge ${row.isActive ? 'active' : ''}`}>{row.isActive ? 'Active' : 'Inactive'}</span> },
  ]} />;
}
