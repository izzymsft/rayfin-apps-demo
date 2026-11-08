import type { Phone, PhoneInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
export function PhoneForm({ initial, onSubmit, onCancel, customerId }: FormProps<Phone, PhoneInput> & { customerId: string }) {
  return <EntityForm fields={[
    { name: 'number', label: 'Phone number', type: 'tel', required: true, maxLength: 30 },
    { name: 'type', label: 'Type', type: 'select', required: true, options: ['Mobile', 'Home', 'Work'].map(value => ({ value, label: value })) },
    { name: 'isPrimary', label: 'Primary phone', type: 'checkbox' },
  ]} initial={{ number: initial?.number ?? '', type: initial?.type ?? 'Mobile', isPrimary: initial?.isPrimary ?? false }} onCancel={onCancel} onSubmit={values => {
    const type = String(values.type);
    if (type !== 'Mobile' && type !== 'Home' && type !== 'Work') throw new Error('Select a valid phone type.');
    return onSubmit({ customer_id: customerId, number: String(values.number), type, isPrimary: values.isPrimary === true });
  }} />;
}
