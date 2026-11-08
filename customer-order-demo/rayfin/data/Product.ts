import { authenticated, boolean, decimal, entity, many, text, uuid } from '@microsoft/rayfin-core';
import { OrderItem } from './OrderItem.js';

@entity()
@authenticated()
export class Product {
  @uuid() id!: string;
  @text({ min: 1, max: 50, unique: true }) sku!: string;
  @text({ min: 1, max: 200 }) name!: string;
  @text({ optional: true, max: 2000 }) description?: string;
  @decimal({ precision: 18, scale: 2, min: 0 }) unitPrice!: number;
  @boolean({ default: true }) isActive!: boolean;
  @many(() => OrderItem) orderItems?: OrderItem[];
}
