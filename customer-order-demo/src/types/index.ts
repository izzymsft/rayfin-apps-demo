export type Money = number | string;
export type AddressType = 'Billing' | 'Shipping' | 'Work' | 'Other';
export type PhoneType = 'Mobile' | 'Home' | 'Work';
export type OrderStatus = 'Draft' | 'Submitted' | 'Completed' | 'Cancelled';

export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  isActive: boolean;
}
export interface Address {
  id: string;
  customer_id: string;
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  addressType: AddressType;
  isPrimary: boolean;
}
export interface Phone {
  id: string;
  customer_id: string;
  number: string;
  type: PhoneType;
  isPrimary: boolean;
}
export interface Email {
  id: string;
  customer_id: string;
  emailAddress: string;
  isPrimary: boolean;
}
export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string | null;
  unitPrice: Money;
  isActive: boolean;
}
export interface Order {
  id: string;
  customer_id: string;
  orderNumber: string;
  orderDate: Date | string;
  status: OrderStatus;
  totalAmount: Money;
}
export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unitPrice: Money;
}
export type CustomerInput = Omit<Customer, 'id'>;
export type AddressInput = Omit<Address, 'id'>;
export type PhoneInput = Omit<Phone, 'id'>;
export type EmailInput = Omit<Email, 'id'>;
export type ProductInput = Omit<Product, 'id'>;
export type OrderInput = Omit<Order, 'id' | 'totalAmount'>;
export type OrderItemInput = Pick<OrderItem, 'quantity'>;
