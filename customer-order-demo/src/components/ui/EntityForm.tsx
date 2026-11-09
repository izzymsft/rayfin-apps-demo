import { useState, type FormEvent, type ReactNode } from 'react';
import { Button } from './Button';
import { ErrorMessage } from './ErrorMessage';
import { errorMessage } from '@/hooks/useResource';

export type FormValues = Record<string, string | boolean>;
export interface FormField {
  name: string;
  label: string;
  type?: 'text' | 'email' | 'tel' | 'date' | 'number' | 'checkbox' | 'textarea' | 'select';
  required?: boolean;
  maxLength?: number;
  min?: number;
  step?: string;
  options?: { value: string; label: string }[];
}
export interface FormProps<T, I> {
  initial?: T;
  onSubmit: (input: I) => Promise<void>;
  onCancel: () => void;
}
export function EntityForm({ fields, initial, onSubmit, onCancel, children, submitDisabled = false }: { fields: FormField[]; initial: FormValues; onSubmit: (values: FormValues) => Promise<void>; onCancel: () => void; children?: ReactNode; submitDisabled?: boolean }) {
  const [values, setValues] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value]));
      await onSubmit(trimmed);
    } catch (err) { setError(errorMessage(err)); setBusy(false); }
  }
  return <form onSubmit={(event) => void submit(event)} aria-busy={busy}>
    <fieldset disabled={busy} className="form-grid">
      {fields.map(field => {
        const change = (value: string | boolean) => setValues(old => ({ ...old, [field.name]: value }));
        const value = values[field.name] ?? '';
        return <label key={field.name} className={field.type === 'checkbox' ? 'checkbox-field' : ''}>
          <span>{field.label}{field.required ? ' *' : ''}</span>
          {field.type === 'select' ? <select value={String(value)} required={field.required} onChange={event => change(event.target.value)}>
            <option value="">Select...</option>{field.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select> : field.type === 'checkbox' ? <input type="checkbox" checked={value === true} onChange={event => change(event.target.checked)} />
            : field.type === 'textarea' ? <textarea value={String(value)} maxLength={field.maxLength} onChange={event => change(event.target.value)} />
              : <input type={field.type ?? 'text'} value={String(value)} required={field.required} maxLength={field.maxLength} min={field.min} step={field.step} onChange={event => change(event.target.value)} />}
        </label>;
      })}
    </fieldset>
    {children && <fieldset disabled={busy} className="form-content">{children}</fieldset>}
    <ErrorMessage message={error} />
    <div className="form-actions"><Button variant="secondary" disabled={busy} onClick={onCancel}>Cancel</Button><Button type="submit" disabled={busy || submitDisabled}>{busy ? 'Saving...' : 'Save'}</Button></div>
  </form>;
}
