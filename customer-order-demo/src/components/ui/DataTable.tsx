import type { ReactNode } from 'react';
import { Button } from './Button';
export interface Column<T> { label: string; render: (row: T) => ReactNode }
export interface TableProps<T> { rows: T[]; onEdit?: (row: T) => void; onDelete?: (row: T) => void; onPrimary?: (row: T) => void; busy?: boolean }
export function DataTable<T extends { id: string }>({ rows, columns, onEdit, onDelete, onPrimary, busy }: TableProps<T> & { columns: Column<T>[] }) {
  if (!rows.length) return <div className="empty-state">No records found. Create a record to get started.</div>;
  return <div className="table-scroll"><table><thead><tr>{columns.map(column => <th scope="col" key={column.label}>{column.label}</th>)}{(onEdit || onDelete || onPrimary) && <th scope="col">Actions</th>}</tr></thead>
    <tbody>{rows.map(row => <tr key={row.id}>{columns.map(column => <td key={column.label}>{column.render(row)}</td>)}{(onEdit || onDelete || onPrimary) && <td><div className="row-actions">
      {onPrimary && <Button variant="secondary" disabled={busy} onClick={() => onPrimary(row)}>Make primary</Button>}
      {onEdit && <Button variant="secondary" disabled={busy} onClick={() => onEdit(row)}>Edit</Button>}
      {onDelete && <Button variant="danger" disabled={busy} onClick={() => onDelete(row)}>Delete</Button>}
    </div></td>}</tr>)}</tbody></table></div>;
}
