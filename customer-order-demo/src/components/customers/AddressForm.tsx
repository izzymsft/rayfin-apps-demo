import type { Address, AddressInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
export function AddressForm({ initial, onSubmit, onCancel, customerId }: FormProps<Address, AddressInput> & { customerId: string }) {
  return <EntityForm fields={[
    { name: 'line1', label: 'Address line 1', required: true, maxLength: 200 },
    { name: 'line2', label: 'Address line 2', maxLength: 200 },
    { name: 'city', label: 'City', required: true, maxLength: 100 },
    { name: 'state', label: 'State / province', required: true, maxLength: 100 },
    { name: 'postalCode', label: 'Postal code', required: true, maxLength: 20 },
    { name: 'country', label: 'Country', required: true, maxLength: 100 },
    { name: 'addressType', label: 'Type', required: true, type: 'select', options: ['Billing', 'Shipping', 'Work', 'Other'].map(value => ({ value, label: value })) },
    { name: 'isPrimary', label: 'Primary address', type: 'checkbox' },
  ]} initial={{ line1: initial?.line1 ?? '', line2: initial?.line2 ?? '', city: initial?.city ?? '', state: initial?.state ?? '', postalCode: initial?.postalCode ?? '', country: initial?.country ?? '', addressType: initial?.addressType ?? 'Billing', isPrimary: initial?.isPrimary ?? false }} onCancel={onCancel} onSubmit={values => {
    const addressType = String(values.addressType);
    if (addressType !== 'Billing' && addressType !== 'Shipping' && addressType !== 'Work' && addressType !== 'Other') throw new Error('Select a valid address type.');
    return onSubmit({ customer_id: customerId, line1: String(values.line1), line2: String(values.line2), city: String(values.city), state: String(values.state), postalCode: String(values.postalCode), country: String(values.country), addressType, isPrimary: values.isPrimary === true });
  }} />;
}
