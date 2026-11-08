import { authenticated, boolean, entity, one, set, text, uuid } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';

@entity()
@authenticated()
export class Address {
  @uuid() id!: string;
  @uuid() customer_id!: string;
  @text({ min: 1, max: 200 }) line1!: string;
  @text({ optional: true, max: 200 }) line2?: string;
  @text({ min: 1, max: 100 }) city!: string;
  @text({ min: 1, max: 100 }) state!: string;
  @text({ min: 1, max: 20 }) postalCode!: string;
  @text({ min: 1, max: 100 }) country!: string;
  @set('Billing', 'Shipping', 'Work', 'Other') addressType!: 'Billing' | 'Shipping' | 'Work' | 'Other';
  @boolean({ default: false }) isPrimary!: boolean;
  @one(() => Customer) customer?: Customer;
}
