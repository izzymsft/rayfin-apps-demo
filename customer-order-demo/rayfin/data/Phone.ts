import { authenticated, boolean, entity, one, set, text, uuid } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';

@entity()
@authenticated()
export class Phone {
  @uuid() id!: string;
  @uuid() customer_id!: string;
  @text({ min: 1, max: 30 }) number!: string;
  @set('Mobile', 'Home', 'Work') type!: 'Mobile' | 'Home' | 'Work';
  @boolean({ default: false }) isPrimary!: boolean;
  @one(() => Customer) customer?: Customer;
}
