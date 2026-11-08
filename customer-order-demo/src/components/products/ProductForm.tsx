import type { Product, ProductInput } from '@/types';
import { EntityForm, type FormProps } from '@/components/ui/EntityForm';
import { normalizeMoney } from '@/services/money';
export function ProductForm({ initial, onSubmit, onCancel }: FormProps<Product, ProductInput>) {
  return <EntityForm fields={[
    { name: 'sku', label: 'SKU', required: true, maxLength: 50 },
    { name: 'name', label: 'Product name', required: true, maxLength: 200 },
    { name: 'description', label: 'Description', type: 'textarea', maxLength: 2000 },
    { name: 'unitPrice', label: 'Unit price (USD)', required: true, type: 'number', min: 0, step: '0.01' },
    { name: 'isActive', label: 'Active', type: 'checkbox' },
  ]} initial={{ sku: initial?.sku ?? '', name: initial?.name ?? '', description: initial?.description ?? '', unitPrice: normalizeMoney(initial?.unitPrice ?? '0.00'), isActive: initial?.isActive ?? true }} onCancel={onCancel} onSubmit={values => onSubmit({
    sku: String(values.sku), name: String(values.name), description: String(values.description), unitPrice: normalizeMoney(String(values.unitPrice)), isActive: values.isActive === true,
  })} />;
}
