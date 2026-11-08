import { useCrudResource } from './useResource';
import { getOrders, createOrder, updateOrder, deleteOrder } from '@/services/orderService';
export function useOrders() {
  return useCrudResource(getOrders, createOrder, updateOrder, deleteOrder);
}
