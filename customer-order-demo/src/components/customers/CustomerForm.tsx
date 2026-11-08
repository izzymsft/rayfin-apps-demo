import type { Customer, CustomerInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
export function CustomerForm({ initial, onSubmit, onCancel }: FormProps<Customer, CustomerInput>) {
  return <EntityForm fields={[
    { name: 'firstName', label: 'First name', required: true, maxLength: 100 },
    { name: 'lastName', label: 'Last name', required: true, maxLength: 100 },
    { name: 'companyName', label: 'Company', maxLength: 200 },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ]} initial={{ firstName: initial?.firstName ?? '', lastName: initial?.lastName ?? '', companyName: initial?.companyName ?? '', isActive: initial?.isActive ?? true }} onCancel={onCancel} onSubmit={values => onSubmit({
    firstName: String(values.firstName), lastName: String(values.lastName), companyName: String(values.companyName), isActive: values.isActive === true,
  })} />;
}
