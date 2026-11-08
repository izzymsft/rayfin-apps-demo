import * as service from '@/services/productService';
import { CrudPanel } from '@/components/ui/CrudPanel';
import { ProductForm } from '@/components/products/ProductForm';
import { ProductTable } from '@/components/products/ProductTable';
export function ProductsPage() {
  return <><div className="page-heading"><h1>Products</h1><p>Manage your catalog. Historical orders retain their original prices.</p></div><CrudPanel title="Products" singular="product" load={service.getProducts} create={service.createProduct} update={service.updateProduct} remove={service.deleteProduct} search={(row, query) => `${row.sku} ${row.name}`.toLowerCase().includes(query)} form={props => <ProductForm {...props} />} table={props => <ProductTable {...props} />} /></>;
}
