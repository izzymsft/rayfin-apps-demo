# Task: Build a Complete Rayfin Customer & Order Management CRUD Application

You are an expert Microsoft Fabric Apps, Rayfin, Fabric SQL Database, React, TypeScript, and full-stack application developer.

I am building a Customer & Order Management CRUD application using Microsoft Rayfin (Fabric Apps), React, TypeScript, and a Rayfin-managed Fabric SQL Database.

**Your task is to generate and implement the complete application, including the Rayfin SQL data model, all entity definitions, relationships, schema registration, frontend services, reusable React components, pages, routing, validation, and CRUD functionality.**

Create and modify actual files within the existing project, not just code snippets.

## 1. Inspect the Existing Rayfin Project

Before making changes:

1. Inspect the project structure, `package.json`, Rayfin configuration, and installed dependencies.
2. Determine whether the project uses `rayfin/data/` and `src/`, or a monorepo layout such as `packages/data/` and `packages/frontend/src/`.
3. Identify the installed Rayfin CLI and SDK versions.
4. Inspect the existing Rayfin entities, schema registration, generated clients, and authentication setup.
5. Read the relevant documentation:
   - https://rayfin.ai/docs/reference/agent-rules.md
   - https://rayfin.ai/docs/data/modeling
   - https://rayfin.ai/docs/data/relationships
   - https://learn.microsoft.com/en-us/fabric/apps/
6. Use only supported methods, decorators, data types, relationship definitions, configuration, and API calls for the installed SDK version.
7. Preserve working Rayfin authentication, configuration, and deployment settings.
8. Do not invent unsupported Rayfin decorators, APIs, or SDK imports.
9. Reuse existing infrastructure and avoid creating unnecessary dependencies.

## 2. Required Application Structure

Generate the following structure, adapting to the existing project layout if necessary.

```text

customer-order-demo/
├── rayfin/
│   ├── data/
│   │   ├── Customer.ts
│   │   ├── Address.ts
│   │   ├── Phone.ts
│   │   ├── Email.ts
│   │   ├── Order.ts
│   │   ├── OrderItem.ts
│   │   ├── Product.ts
│   │   └── schema.ts
│   └── rayfin.yml
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppLayout.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   └── Header.tsx
│   │   ├── customers/
│   │   │   ├── CustomerForm.tsx
│   │   │   ├── CustomerTable.tsx
│   │   │   ├── AddressForm.tsx
│   │   │   ├── AddressTable.tsx
│   │   │   ├── PhoneForm.tsx
│   │   │   ├── PhoneTable.tsx
│   │   │   ├── EmailForm.tsx
│   │   │   └── EmailTable.tsx
│   │   ├── orders/
│   │   │   ├── OrderForm.tsx
│   │   │   ├── OrderTable.tsx
│   │   │   └── OrderItemEditor.tsx
│   │   ├── products/
│   │   │   ├── ProductForm.tsx
│   │   │   └── ProductTable.tsx
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Modal.tsx
│   │       ├── ConfirmDialog.tsx
│   │       ├── LoadingSpinner.tsx
│   │       └── ErrorMessage.tsx
│   ├── pages/
│   │   ├── DashboardPage.tsx
│   │   ├── CustomersPage.tsx
│   │   ├── CustomerDetailsPage.tsx
│   │   ├── OrdersPage.tsx
│   │   ├── OrderDetailsPage.tsx
│   │   └── ProductsPage.tsx
│   ├── services/
│   │   ├── rayfinClient.ts
│   │   ├── customerService.ts
│   │   ├── addressService.ts
│   │   ├── phoneService.ts
│   │   ├── emailService.ts
│   │   ├── orderService.ts
│   │   └── productService.ts
│   ├── hooks/
│   │   ├── useCustomers.ts
│   │   ├── useOrders.ts
│   │   └── useProducts.ts
│   ├── types/
│   │   └── index.ts
│   ├── App.tsx
│   └── main.tsx
├── package.json
└── vite.config.ts
```

The structure above represents the desired logical organization. Follow the actual installed template and its supported configuration rather than forcing incompatible file locations.

## 3. Generate All Rayfin Data Entities

**This is a mandatory part of the implementation.**

Generate the complete contents of every entity file under `rayfin/data/`, including all required imports, field decorators, primary keys, relationships, and security permissions.

Do not generate empty placeholder classes.

Use the current Rayfin TypeScript entity-modeling SDK.

### 3.1 Customer.ts

Create a `Customer` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| firstName | String | Required, max 100 |
| lastName | String | Required, max 100 |
| companyName | String | Optional, max 200 |
| isActive | Boolean | Default true |

Relationships:
- Customer has many Addresses.
- Customer has many Phones.
- Customer has many Emails.
- Customer has many Orders.

Use the supported Rayfin one-to-many relationship decorator, such as `@many()` where applicable.

### 3.2 Address.ts

Create an `Address` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | Foreign key |
| line1 | String | Required, max 200 |
| line2 | String | Optional, max 200 |
| city | String | Required, max 100 |
| state | String | Required, max 100 |
| postalCode | String | Required, max 20 |
| country | String | Required, max 100 |
| addressType | String | Billing, Shipping, Work, Other |
| isPrimary | Boolean | Default false |

Relationships:
- Address belongs to one Customer.

Create the relationship using Rayfin-supported modeling syntax, such as `@one(() => Customer)` if supported by the installed SDK.

### 3.3 Phone.ts

Create a `Phone` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | Foreign key |
| number | String | Required, max 30 |
| type | String | Mobile, Home, Work |
| isPrimary | Boolean | Default false |

Relationships:
- Phone belongs to one Customer.

### 3.4 Email.ts

Create an `Email` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | Foreign key |
| emailAddress | String | Required, max 254 |
| isPrimary | Boolean | Default false |

Relationships:
- Email belongs to one Customer.

Validate email address format in the frontend and server-side where supported.

### 3.5 Product.ts

Create a `Product` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| sku | String | Required, unique, max 50 |
| name | String | Required, max 200 |
| description | String | Optional, max 2000 |
| unitPrice | Decimal | Precision 18, scale 2 |
| isActive | Boolean | Default true |

Relationships:
- Product has many OrderItems.

Use an exact decimal representation for monetary values, preserving two decimal places.

### 3.6 Order.ts

Create an `Order` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| customer_id | UUID | Foreign key |
| orderNumber | String | Required, unique |
| orderDate | Date/DateTime | Required |
| status | String | Draft, Submitted, Completed, Cancelled |
| totalAmount | Decimal | Precision 18, scale 2 |

Relationships:
- Order belongs to one Customer.
- Order has many OrderItems.

If `Order` is a reserved SQL identifier, ensure the generated database mapping handles it correctly. Do not silently rename the business entity without documenting the change.

### 3.7 OrderItem.ts

Create an `OrderItem` entity with:

| Field | Type | Requirements |
|---|---|---|
| id | UUID | Primary key |
| order_id | UUID | Foreign key |
| product_id | UUID | Foreign key |
| quantity | Integer | Required, greater than zero |
| unitPrice | Decimal | Precision 18, scale 2 |

Relationships:
- OrderItem belongs to one Order.
- OrderItem belongs to one Product.

OrderItem represents the relationship between Orders and Products.

Preserve the product price at the time the order item is created.

### 3.8 Entity Modeling Requirements

For every entity:

1. Use the Rayfin `@entity()` decorator or the appropriate equivalent supported by the installed SDK.
2. Define the primary key correctly.
3. Use supported field decorators for UUIDs, strings, booleans, integers, dates, and decimals.
4. Define all relationships explicitly.
5. Use supported foreign key mappings.
6. Apply appropriate authenticated access permissions.
7. Do not allow anonymous access to customer and order data.
8. Avoid circular import failures.
9. Add optional fields and default values where appropriate.
10. Define maximum string lengths.
11. Ensure all relationship definitions can be generated into a valid SQL schema.
12. Use descriptive and consistent property names.
13. Ensure that creating related records works using supported Rayfin relationship-write syntax.

For this demo, allow authenticated users to perform CRUD operations where appropriate. Document that stronger role-based authorization would be required for production use.

## 4. Generate schema.ts

Create or update `rayfin/data/schema.ts`.

Requirements:

1. Import all seven entities.
2. Register each entity with Rayfin's data model system.
3. Export the schema in the format required by the installed Rayfin SDK.
4. Ensure all relationships resolve correctly.
5. Ensure no entity is omitted.
6. Ensure the resulting SQL schema includes primary keys, foreign keys, constraints, and supported indexes.
7. Ensure a deployment can create or update the Fabric SQL Database schema.

Before applying any database schema changes, inspect the proposed migration and identify potentially destructive operations.

Do not drop existing tables or data automatically.

## 5. Implement the Rayfin Services Layer

Create all service files under `src/services/`.

Each service must use the Rayfin typed data client and the documented CRUD operations supported by the installed SDK.

Implement:

**customerService.ts**
- getCustomers()
- getCustomerById(id)
- createCustomer(data)
- updateCustomer(id, data)
- deleteCustomer(id)

**addressService.ts**
- getAddressesByCustomer(customerId)
- createAddress(data)
- updateAddress(id, data)
- deleteAddress(id)

**phoneService.ts**
- getPhonesByCustomer(customerId)
- createPhone(data)
- updatePhone(id, data)
- deletePhone(id)
- setPrimaryPhone(customerId, phoneId)

**emailService.ts**
- getEmailsByCustomer(customerId)
- createEmail(data)
- updateEmail(id, data)
- deleteEmail(id)
- setPrimaryEmail(customerId, emailId)

**productService.ts**
- getProducts()
- getProductById(id)
- createProduct(data)
- updateProduct(id, data)
- deleteProduct(id)

**orderService.ts**
- getOrders()
- getOrdersByCustomer(customerId)
- getOrderById(id)
- createOrder(data)
- updateOrder(id, data)
- deleteOrder(id)
- addOrderItem(orderId, productId, quantity)
- updateOrderItem(id, data)
- deleteOrderItem(id)
- calculateOrderTotal(orderId)

Use the Rayfin-managed data API. Do not build a separate REST or Express server for basic CRUD.

Use appropriate pagination and error handling.

Implement multi-record order operations atomically when the installed Rayfin platform provides supported server-side transactions or functions. Otherwise, document any consistency limitations and implement safe recovery behavior.

## 6. Build the React Components

Generate reusable components under `src/components/`.

Each component must:

- Use React and TypeScript.
- Support typed props.
- Support Create and Edit modes where applicable.
- Validate user input.
- Provide loading and error states.
- Display success and failure notifications.
- Support accessible interaction.
- Work on desktop and mobile screen sizes.
- Avoid duplicating database access logic.

Create working forms and tables for Customers, Addresses, Phones, Emails, Orders, OrderItems, and Products.

Use reusable dialogs for create/edit workflows and delete confirmations.

## 7. Build the Application Pages

Implement the following pages.

**DashboardPage**
- Total customers.
- Total products.
- Total orders.
- Total order value.
- Recent orders.

**CustomersPage**
- Customer list.
- Search by name or company.
- Create customer.
- Edit customer.
- Delete customer.
- Navigate to customer details.

**CustomerDetailsPage**

Display customer information using tabs:
- Overview.
- Addresses.
- Phone Numbers.
- Email Addresses.
- Orders.

Each related-data tab must support CRUD operations.

**ProductsPage**
- Display products.
- Search by SKU or name.
- Create product.
- Edit product.
- Delete product.
- Show product pricing and status.

**OrdersPage**
- Display orders.
- Filter by customer and status.
- Create orders.
- View existing orders.

**OrderDetailsPage**
- Display order header.
- Select customer.
- Add products.
- Edit quantities.
- Remove products.
- Calculate totals.
- Update order status.

## 8. Implement Business Validation

Implement the following business rules:

- Customer first and last names are required.
- Product SKU must be unique.
- Product prices cannot be negative.
- Order item quantity must be greater than zero.
- Only one primary email per customer.
- Only one primary phone per customer.
- Order totals must be calculated from order items.
- Existing order item prices must not change when product prices change.
- Email addresses must be validated.
- Deletes must require confirmation.
- Prevent deletion of customers with existing orders.
- Prevent deletion of products referenced by order items, or use an explicit inactive status.
- Use decimal-safe arithmetic for monetary calculations.
- Validate critical rules at the backend, not only in React.

## 9. Application Routing

Implement navigation using the existing routing library, or React Router where appropriate.

Required routes:

- `/`
- `/customers`
- `/customers/:id`
- `/orders`
- `/orders/:id`
- `/products`

Use a shared application layout with navigation sidebar and header.

Preserve Rayfin authentication and deployment-specific base paths.

## 10. React State Management

Create custom hooks:

- useCustomers()
- useOrders()
- useProducts()

Each hook must handle:
- Fetching records.
- Loading state.
- Error state.
- CRUD actions.
- Refreshing data.
- Preventing invalid state updates after unmount.

Keep components focused on presentation and interaction.

## 11. Generate Sample Data

Create an idempotent development-only seed script.

Populate the database with:

- 10 customers.
- At least one address per customer.
- At least one email per customer.
- At least one phone per customer.
- 20 products.
- 20 orders.
- At least two order items per order.

Use fictional business names and example-domain email addresses.

Use supported Rayfin APIs rather than making direct SQL connections from the frontend.

Do not automatically reset or delete existing database records.

## 12. UI Design

Build a polished, Microsoft Fluent-inspired business application.

Include:

- Responsive sidebar.
- Application header.
- Dashboard cards.
- Searchable tables.
- Create/Edit dialogs.
- Delete confirmation dialogs.
- Customer details tabs.
- Order item editor.
- Loading indicators.
- Error notifications.
- Success notifications.
- Empty-state messages.

Reuse existing UI dependencies where appropriate.

Avoid unnecessary packages.

## 13. Build and Test

After implementing all files:

1. Verify all seven entity files contain complete definitions.
2. Verify `schema.ts` registers every entity.
3. Check the relationship mappings.
4. Validate generated SQL-compatible types and constraints.
5. Verify the Rayfin client configuration.
6. Run TypeScript type checking.
7. Run the frontend production build.
8. Fix import errors and compilation errors.
9. Check forms and navigation.
10. Test CRUD operations against the actual Rayfin backend where credentials and access are available.
11. Confirm that database records persist after refresh.
12. Confirm that related records can be queried.
13. Test order total calculations and deletion rules.
14. Document any functionality that could not be validated.

Do not claim successful database deployment or CRUD testing unless it was actually completed.

## 14. Deployment

Use the installed version of the Rayfin CLI.

Validate the schema and application configuration before deployment.

For deployment, use the supported command:

```bash
npx rayfin up
```

Verify deployment using:

```bash
npx rayfin up status
```

If deployment requires Fabric workspace selection, capacity assignment, authentication, or other user authorization, identify the required steps rather than making unsupported assumptions.

Do not perform destructive schema migrations without explicit approval.

## 15. Implementation Order

Execute the implementation in the following phases.

**Phase 1 — Project Discovery**
- Inspect existing code.
- Verify Rayfin SDK.
- Review current configurations and dependencies.

**Phase 2 — SQL Data Model**
- Generate Customer.ts.
- Generate Address.ts.
- Generate Phone.ts.
- Generate Email.ts.
- Generate Product.ts.
- Generate Order.ts.
- Generate OrderItem.ts.
- Generate schema.ts.
- Validate all relationships.

**Phase 3 — Data Access**
- Configure the Rayfin client.
- Implement all seven entities' CRUD services, including OrderItem operations in orderService.ts.
- Implement error handling.

**Phase 4 — React Components**
- Generate forms.
- Generate tables.
- Generate dialogs.
- Generate shared layout components.

**Phase 5 — Application Pages**
- Generate dashboard.
- Generate customer management.
- Generate customer details.
- Generate product management.
- Generate order management.

**Phase 6 — Integration**
- Connect components to services.
- Implement routing.
- Implement validation.
- Implement relationship-based data retrieval.

**Phase 7 — Sample Data**
- Generate the seed script.
- Verify that it can run repeatedly without producing duplicates.

**Phase 8 — Validation**
- Run TypeScript checks.
- Run the build.
- Fix errors.
- Validate CRUD workflows where possible.

## 16. Final Deliverables

At completion, provide:

1. A summary of every file created or modified.
2. A description of the SQL data model and relationships.
3. Confirmation that all seven Rayfin entities are registered.
4. A summary of implemented CRUD operations.
5. A summary of implemented pages and components.
6. Build and TypeScript validation results.
7. Any assumptions, limitations, or unresolved errors.
8. Instructions to run the app locally.
9. Instructions to seed the database.
10. Instructions to deploy the Rayfin app to Microsoft Fabric.

**Important: Do not stop after generating the entities. Implement the complete application and connect the React frontend to the Rayfin-managed SQL backend.**

Begin by inspecting the existing project, then generate and integrate all required files.