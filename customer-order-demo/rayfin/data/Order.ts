import { authenticated, date, decimal, entity, many, one, set, text, uuid } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';
import { OrderItem } from './OrderItem.js';

@entity()
@authenticated()
export class Order {
  @uuid() id!: string;
  @uuid() customer_id!: string;
  @text({ min: 1, max: 100, unique: true }) orderNumber!: string;
  @date() orderDate!: Date;
  @set('Draft', 'Submitted', 'Completed', 'Cancelled') status!: 'Draft' | 'Submitted' | 'Completed' | 'Cancelled';
  @decimal({ precision: 18, scale: 2, min: 0, default: 0 }) totalAmount!: number;
  @one(() => Customer) customer?: Customer;
  @many(() => OrderItem) orderItems?: OrderItem[];
}
