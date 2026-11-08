import type { Email, EmailInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
export function EmailForm({ initial, onSubmit, onCancel, customerId }: FormProps<Email, EmailInput> & { customerId: string }) {
  return <EntityForm fields={[
    { name: 'emailAddress', label: 'Email address', type: 'email', required: true, maxLength: 254 },
    { name: 'isPrimary', label: 'Primary email', type: 'checkbox' },
  ]} initial={{ emailAddress: initial?.emailAddress ?? '', isPrimary: initial?.isPrimary ?? false }} onCancel={onCancel} onSubmit={values => onSubmit({ customer_id: customerId, emailAddress: String(values.emailAddress), isPrimary: values.isPrimary === true })} />;
}
