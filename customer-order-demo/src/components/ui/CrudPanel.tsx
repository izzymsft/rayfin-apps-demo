import { useState, type ReactNode } from 'react';
import { useCrudResource, errorMessage } from '@/hooks/useResource';
import type { FormProps } from './EntityForm';
import type { TableProps } from './DataTable';
import { Button } from './Button';
import { Modal } from './Modal';
import { ConfirmDialog } from './ConfirmDialog';
import { ErrorMessage } from './ErrorMessage';
import { LoadingSpinner } from './LoadingSpinner';

export function CrudPanel<T extends { id: string }, I>({ title, singular, load, create, update, remove, search, form, table, makePrimary }: {
  title: string; singular: string;
  load: () => Promise<T[]>; create: (input: I) => Promise<unknown>;
  update: (id: string, input: I) => Promise<unknown>; remove: (id: string) => Promise<void>;
  search?: (row: T, query: string) => boolean;
  form: (props: FormProps<T, I>) => ReactNode; table: (props: TableProps<T>) => ReactNode;
  makePrimary?: (row: T) => Promise<unknown>;
}) {
  const resource = useCrudResource(load, create, update, remove);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<T | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<T>();
  const [extraError, setExtraError] = useState('');
  const [primaryNotice, setPrimaryNotice] = useState('');
  const [primaryBusy, setPrimaryBusy] = useState(false);
  async function primary(row: T) {
    setPrimaryBusy(true); setExtraError(''); setPrimaryNotice('');
    try { await makePrimary?.(row); setPrimaryNotice('Primary contact updated.'); await resource.refresh(); }
    catch (err) { setExtraError(errorMessage(err)); }
    finally { setPrimaryBusy(false); }
  }
  return <section className="panel">
    <div className="section-heading"><h2>{title}</h2><div className="row-actions"><Button variant="secondary" onClick={() => void resource.refresh().catch(err => setExtraError(errorMessage(err)))} disabled={resource.loading}>Refresh</Button><Button onClick={() => setEditing(null)}>New {singular}</Button></div></div>
    {search && <label className="search-field">Search {title.toLowerCase()}<input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${title.toLowerCase()}...`} /></label>}
    <ErrorMessage message={resource.error || resource.mutationError || extraError} />
    {(resource.notice || primaryNotice) && <p className="success-message" role="status">{resource.notice || primaryNotice}</p>}
    {resource.loading ? <LoadingSpinner /> : table({ rows: (resource.data ?? []).filter(row => !search || search(row, query.toLowerCase())), busy: resource.saving || primaryBusy, onEdit: setEditing, onDelete: setDeleting, onPrimary: makePrimary ? row => void primary(row) : undefined })}
    {editing !== undefined && <Modal title={`${editing ? 'Edit' : 'New'} ${singular}`} busy={resource.saving} onClose={() => setEditing(undefined)}>
      {form({ initial: editing ?? undefined, onCancel: () => setEditing(undefined), onSubmit: async input => {
        if (editing) await resource.update(editing.id, input); else await resource.create(input);
        setEditing(undefined);
      } })}
    </Modal>}
    {deleting && <ConfirmDialog label={singular} onClose={() => setDeleting(undefined)} onConfirm={() => resource.remove(deleting.id)} />}
  </section>;
}
