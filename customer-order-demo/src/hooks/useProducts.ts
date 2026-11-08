import { useCrudResource } from './useResource';
import { getProducts, createProduct, updateProduct, deleteProduct } from '@/services/productService';
export function useProducts() {
  return useCrudResource(getProducts, createProduct, updateProduct, deleteProduct);
}
