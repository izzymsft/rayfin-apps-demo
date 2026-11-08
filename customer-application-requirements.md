
We need to create a Rayfin App that supports the following CRUD operations using a Rayfin-managed SQL database.

These are the entities (Customer, Address, Phone, Email, Order, OrderItem, Product) and their respective fields:

Customer:   id, firstName, lastName, companyName, status
Address:	id, customer_id, adress1, city, state, postalCode, country, addressType
Phone:      id, customer_id, number, type, isPrimary
Email:      id, customer_id, emailAddress, isPrimary
Order:      id, customer_id, orderNumber, orderDate, status, totalAmount
Product:	id, sku, name, description, unitPrice, isActive
OrderItem:	id, order_id, product_id, quantity, unitPrice