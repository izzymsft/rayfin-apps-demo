import { useCrudResource } from './useResource';
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '@/services/customerService';
export function useCustomers() {
  return useCrudResource(getCustomers, createCustomer, updateCustomer, deleteCustomer);
}
