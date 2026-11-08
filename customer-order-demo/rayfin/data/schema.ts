import { Todo } from './Todo.js';
import { Customer } from './Customer.js';
import { Address } from './Address.js';
import { Phone } from './Phone.js';
import { Email } from './Email.js';
import { Product } from './Product.js';
import { Order } from './Order.js';
import { OrderItem } from './OrderItem.js';

export type AppSchema = {
  Todo: Todo;
  Customer: Customer;
  Address: Address;
  Phone: Phone;
  Email: Email;
  Product: Product;
  Order: Order;
  OrderItem: OrderItem;
};

export type TodoAppSchema = AppSchema;

export const schema = [Todo, Customer, Address, Phone, Email, Product, Order, OrderItem];
