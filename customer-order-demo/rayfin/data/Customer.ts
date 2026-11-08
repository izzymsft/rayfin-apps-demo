import { authenticated, boolean, entity, many, text, uuid } from '@microsoft/rayfin-core';
import { Address } from './Address.js';
import { Phone } from './Phone.js';
import { Email } from './Email.js';
import { Order } from './Order.js';

@entity()
@authenticated()
export class Customer {
  @uuid() id!: string;
  @text({ min: 1, max: 100 }) firstName!: string;
  @text({ min: 1, max: 100 }) lastName!: string;
  @text({ optional: true, max: 200 }) companyName?: string;
  @boolean({ default: true }) isActive!: boolean;
  @many(() => Address) addresses?: Address[];
  @many(() => Phone) phones?: Phone[];
  @many(() => Email) emails?: Email[];
  @many(() => Order) orders?: Order[];
}
