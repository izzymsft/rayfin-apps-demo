import { authenticated, decimal, entity, int, one, uuid } from '@microsoft/rayfin-core';
import { Order } from './Order.js';
import { Product } from './Product.js';

@entity()
@authenticated()
export class OrderItem {
  @uuid() id!: string;
  @uuid() order_id!: string;
  @uuid() product_id!: string;
  @int({ min: 1, max: 2147483647 }) quantity!: number;
  @decimal({ precision: 18, scale: 2, min: 0 }) unitPrice!: number;
  @one(() => Order) order?: Order;
  @one(() => Product) product?: Product;
}
