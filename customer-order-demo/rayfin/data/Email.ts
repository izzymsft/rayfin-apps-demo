import { authenticated, boolean, email, entity, one, uuid } from '@microsoft/rayfin-core';
import { Customer } from './Customer.js';

@entity()
@authenticated()
export class Email {
  @uuid() id!: string;
  @uuid() customer_id!: string;
  @email({ min: 3, max: 254 }) emailAddress!: string;
  @boolean({ default: false }) isPrimary!: boolean;
  @one(() => Customer) customer?: Customer;
}
