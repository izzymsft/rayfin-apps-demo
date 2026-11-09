# Customer & Order Management

A React 19 / TypeScript business application using the installed Microsoft Rayfin
1.36.2 SDK and its managed Fabric SQL data API. No Express server, frontend SQL
connection, or in-memory business-data fallback is used.

## What is implemented

- Dashboard: complete paginated customer/product/order counts, exact total order
  value, and the five most recent orders.
- Customers: name/company search, create/edit/delete, and detail tabs for
  overview, addresses, phones, emails, and orders.
- Contacts: typed CRUD forms, primary phone/email selection, and customer-scoped
  queries.
- Products: SKU/name search, CRUD, prices, and active/inactive status.
- Orders: customer/status filters, CRUD, customer selection, status updates,
  product selection inside new/edit dialogs, unit prices, quantity edits,
  line removal, immutable price snapshots, and live order totals.
- Shared responsive Fluent-inspired layout, accessible native dialogs, keyboard
  tabs, required-field validation, confirmation before deletion, loading,
  empty/error states, success notices, and explicit refresh recovery.
- Fabric authentication and embedded-session initialization are preserved.
  Every management route is authenticated; deep links return to their requested
  route after sign-in. The router honors Vite's deployment base path.

Money is calculated using integer cents, not floating-point multiplication.
The SDK represents decimals as numbers on writes; unsafe conversions are
rejected instead of silently losing precision. Prices and totals use
`DECIMAL(18,2)` in SQL. This single-currency demo displays USD. Order dates are
entered and displayed as UTC calendar dates, avoiding previous-day shifts.

## Data model

The seven complete entity definitions are registered in both `AppSchema` and
the `schema` array in [schema.ts](rayfin/data/schema.ts):

```text
Customer --< Address
         --< Phone
         --< Email
         --< Order --< OrderItem >-- Product
```

Every entity has an explicit UUID `id`, authenticated permissions, typed
fields, string limits, defaults where appropriate, and lazy `@one` / `@many`
relationships. Foreign keys use the supported `customer_id`, `order_id`, and
`product_id` conventions. Related writes use the supported typed Rayfin client.
SKU and order-number uniqueness are declared in the entity model.

Full-record reads explicitly select their scalar fields, filter by UUID, and
fetch one row. In the installed SDK, `findById()` selects only the primary key,
despite its full-entity TypeScript return type; it is used only for existence
checks. This distinction matters for product active status, snapshot prices,
order totals, contact refreshes, and idempotent seed checks.

The business entity remains `Order`; the installed generator maps it to the
plural SQL table `Orders`, avoiding the reserved singular SQL identifier. The existing `Todo`
entity and its per-user permissions remain registered, so replacing the UI
does not drop existing starter data. `TodoAppSchema` remains available for
authentication compatibility.

**Authorization:** the new demo entities intentionally share CRUD access among
authenticated users. There is no anonymous access. Production requires
appropriate roles, tenant/ownership policies, and auditing before using real
customer information.

## Backend business-rule safeguards

The [backend-guards.sql](scripts/backend-guards.sql) migration contains
supplemental business-rule safeguards for the **Rayfin-managed Fabric SQL database**.
Entity decorators alone do not provide all cross-record rules. Review and apply
the guard migration using authorized Fabric SQL tooling after Rayfin has created
the tables, before seeding or enabling business writes.

These safeguards are required for primary-contact uniqueness, exact automatic
totals, immutable product-price snapshots, and deletion restrictions to remain
correct when requests bypass React or arrive concurrently. The services also
validate inputs and report failures; frontend checks are not a substitute for
database enforcement.

The installed generator does not emit SQL checks for numeric minimums, nonblank
text, or email format. The migration supplies those checks too, as well as
atomic primary-contact switching and atomic deletion of dependent records.
Run [verify-backend-guards.sql](scripts/verify-backend-guards.sql) after applying
it. Upstream DAB trigger support was checked, but the hosted Fabric runtime still
requires a metadata refresh and live mutation testing; offline checks cannot
establish hosted trigger compatibility.

Do not apply SQL to a different database. Review the generated model and the
supplemental migration, back up real data, and resolve any pre-existing invalid
or duplicate records deliberately. No existing tables or records are reset
automatically, and no destructive schema migration was applied during this
implementation. Never use Rayfin's `--force` without an approved migration
review.

List queries fetch all pages with stable ordering and validate advancing
cursors. This is appropriate for a small demo; a production-scale application
should implement server-filtered page-at-a-time tables.

Multi-call workflows and development seeding are not one application-wide
transaction. Do not blindly repeat a write when its response is ambiguous.
Refresh and inspect the persisted record first; notices distinguish a completed
write from a failed subsequent refresh. The backend migration is part of the
deployment, not a JavaScript transaction shim.

### Creating and editing an order

Use **New order** or **Edit** in the orders list, the customer's Orders tab, or
**Edit order** on the details page. Within the dialog, choose **Add product**,
select a product, and enter its quantity. Unit prices, line totals, and the
decimal-safe order total are displayed before saving. Existing product lines
retain their snapshot prices even if the catalog price changes. To replace an
existing product, confirm removing its line and add the replacement.

**Save** persists both the header and the selected line items, then reloads the
backend total. Cancelling does not save pending item edits. Empty draft orders
remain supported. New items receive stable IDs so an interrupted save can be
resumed without creating duplicate orders or lines. The save is multiple Rayfin
requests, not one transaction: if a request fails, some changes may already be
persisted. Keep the dialog open and retry to resume, or close it and refresh the
orders list to inspect the saved state. Detected concurrent edits require
reopening the form rather than overwriting them.

The SQL total guards described above are still required. If a saved order total
does not match its items, the service surfaces an error instead of inventing a
successful client-side total update.

## Run locally

From the repository root:

```bash
cd customer-order-demo
npx rayfin login
npm run dev
```

Select the intended Fabric workspace and ensure it has an eligible capacity and
that your identity can create/manage Fabric Apps and their SQL database.
`rayfin dev` provisions/reuses a **Fabric-hosted backend**, applies the Rayfin
model, writes public environment settings, and starts the local frontend.
Review any proposed migration before accepting it; the retained Todo entity
should not be removed. Apply the reviewed supplemental SQL safeguards before
creating business records.

Open the frontend address printed by Rayfin (normally
`http://localhost:5173`) and sign in. Restart development after entity or
Rayfin configuration changes. Deployment coordinates, credentials, and
capacity cannot be guessed from the template.

For an already configured backend, `npm run dev:frontend` starts just Vite.
Without a generated API environment, the application deliberately shows a
configuration error rather than pretending to save local records. Local
fixture authentication is restricted to development, never production.

## Seed fictional development data

In a development build, sign in and use **Seed development data** on the
dashboard. The [seed service](src/services/seed.ts) uses the same Rayfin APIs
and deterministic development identities to create:

- 10 customers, each with an address, phone, and example-domain email;
- 20 products;
- 20 orders, each with at least two items.

The seed action is removed from production builds, is never run automatically,
does not reset records, and can be rerun to recover a partial seed. Run it only
against a designated development Fabric app, after the database safeguards are
installed. Verify persistence by refreshing the browser and opening customer
and order detail pages.

## Build and validate

```bash
npm run typecheck
npm run validate:schema
npm run build
npm run lint
npm test
```

`npm run build` runs the existing Rayfin environment generation prebuild.
`npm run build:fabric` is the configured deployment build. Tests cover exact
money, pagination, service rules/recovery, forms, delete dialogs, resource
lifecycle, authentication restoration, and routed management workflows.
Service and UI integration tests use mocked API responses; they do **not**
prove that a live Fabric database was deployed.

Initial implementation validation: all seven management entities (plus the retained Todo)
passed the actual offline Rayfin analyzer/generator, including foreign-key
targets and `DECIMAL(18,2)` mappings. TypeScript and the production build passed.
All 68 tests passed, including a non-UTC timezone run. ESLint reported zero
errors and the existing AuthContext Fast Refresh warning. Desktop/mobile browser
checks with mocked data confirmed navigation, native form dialogs, and a
390-pixel layout without document-level horizontal overflow.

`npx rayfin up status` reported that the project has not been deployed.
No live database migration, seeding, CRUD, persistence, or Fabric authentication
test is claimed. Those require the authorized workspace and managed database.

## Deploy to Microsoft Fabric

1. Authenticate and select/authorize the intended development or production
   workspace and its capacity.
2. Run model validation and tests, inspect generated schema changes and the
   supplemental guard SQL, and approve the target database.
3. Deploy using the installed CLI:

   ```bash
   npx rayfin login
   npx rayfin up
   npx rayfin up status
   ```

4. Apply [backend-guards.sql](scripts/backend-guards.sql) to the app's managed
   Fabric SQL database using authorized SQL tooling. Refresh the managed data
   API metadata, run [verify-backend-guards.sql](scripts/verify-backend-guards.sql),
   and confirm database permissions and hosted DAB trigger compatibility.
5. Verify sign-in, all CRUD workflows, primary-contact switching, negative
   price/quantity rejection, uniqueness, snapshot prices, totals, deletion
   restrictions, and persistence after a refresh against the actual backend.

Static hosting stays protected and MSSQL remains enabled in
[rayfin.yml](rayfin/rayfin.yml). No authentication/deployment coordinates were
replaced. Do not add connection strings or secrets to frontend environment
variables or source code.

## Implementation file inventory

All paths below are relative to this application directory.

- **Entities:** [Customer.ts](rayfin/data/Customer.ts),
  [Address.ts](rayfin/data/Address.ts), [Phone.ts](rayfin/data/Phone.ts),
  [Email.ts](rayfin/data/Email.ts), [Product.ts](rayfin/data/Product.ts),
  [Order.ts](rayfin/data/Order.ts), [OrderItem.ts](rayfin/data/OrderItem.ts);
  updated [schema.ts](rayfin/data/schema.ts).
- **Types and services:** [types/index.ts](src/types/index.ts);
  [customerService.ts](src/services/customerService.ts),
  [addressService.ts](src/services/addressService.ts),
  [phoneService.ts](src/services/phoneService.ts),
  [emailService.ts](src/services/emailService.ts),
  [productService.ts](src/services/productService.ts),
  [orderService.ts](src/services/orderService.ts) (including OrderItem CRUD),
  [pagination.ts](src/services/pagination.ts), [money.ts](src/services/money.ts),
  [validation.ts](src/services/validation.ts), [seed.ts](src/services/seed.ts);
  updated [rayfinClient.ts](src/services/rayfinClient.ts) and
  [bootstrap.ts](src/services/bootstrap.ts).
- **Hooks:** [useResource.ts](src/hooks/useResource.ts),
  [useCustomers.ts](src/hooks/useCustomers.ts),
  [useOrders.ts](src/hooks/useOrders.ts),
  [useProducts.ts](src/hooks/useProducts.ts);
  updated [AuthContext.tsx](src/hooks/AuthContext.tsx).
- **Layout:** [AppLayout.tsx](src/components/layout/AppLayout.tsx),
  [Sidebar.tsx](src/components/layout/Sidebar.tsx),
  [Header.tsx](src/components/layout/Header.tsx).
- **Shared UI:** [Button.tsx](src/components/ui/Button.tsx),
  [Modal.tsx](src/components/ui/Modal.tsx),
  [ConfirmDialog.tsx](src/components/ui/ConfirmDialog.tsx),
  [LoadingSpinner.tsx](src/components/ui/LoadingSpinner.tsx),
  [ErrorMessage.tsx](src/components/ui/ErrorMessage.tsx),
  [EntityForm.tsx](src/components/ui/EntityForm.tsx),
  [DataTable.tsx](src/components/ui/DataTable.tsx),
  [CrudPanel.tsx](src/components/ui/CrudPanel.tsx).
- **Customer/contact UI:** [CustomerForm.tsx](src/components/customers/CustomerForm.tsx),
  [CustomerTable.tsx](src/components/customers/CustomerTable.tsx),
  [AddressForm.tsx](src/components/customers/AddressForm.tsx),
  [AddressTable.tsx](src/components/customers/AddressTable.tsx),
  [PhoneForm.tsx](src/components/customers/PhoneForm.tsx),
  [PhoneTable.tsx](src/components/customers/PhoneTable.tsx),
  [EmailForm.tsx](src/components/customers/EmailForm.tsx),
  [EmailTable.tsx](src/components/customers/EmailTable.tsx).
- **Product/order UI:** [ProductForm.tsx](src/components/products/ProductForm.tsx),
  [ProductTable.tsx](src/components/products/ProductTable.tsx),
  [OrderForm.tsx](src/components/orders/OrderForm.tsx),
  [OrderTable.tsx](src/components/orders/OrderTable.tsx),
  [OrderItemEditor.tsx](src/components/orders/OrderItemEditor.tsx),
  [orderDate.ts](src/components/orders/orderDate.ts).
- **Pages:** [DashboardPage.tsx](src/pages/DashboardPage.tsx),
  [CustomersPage.tsx](src/pages/CustomersPage.tsx),
  [CustomerDetailsPage.tsx](src/pages/CustomerDetailsPage.tsx),
  [ProductsPage.tsx](src/pages/ProductsPage.tsx),
  [OrdersPage.tsx](src/pages/OrdersPage.tsx),
  [OrderDetailsPage.tsx](src/pages/OrderDetailsPage.tsx).
- **Application integration:** updated [App.tsx](src/App.tsx),
  [main.tsx](src/main.tsx), [main.css](src/main.css),
  [AuthPage.tsx](src/components/AuthPage.tsx), [index.html](index.html),
  [package.json](package.json), and this README.
- **Tests:** [dataMoneyValidation.test.ts](src/__tests__/dataMoneyValidation.test.ts),
  [dataServices.test.ts](src/__tests__/dataServices.test.ts),
  [orderForm.test.tsx](src/__tests__/orderForm.test.tsx),
  [rayfinSelection.test.ts](src/__tests__/rayfinSelection.test.ts) (actual SDK
  requests against a field-projecting mocked backend),
  [forms.test.tsx](src/__tests__/forms.test.tsx),
  [dialogs.test.tsx](src/__tests__/dialogs.test.tsx),
  [useResource.test.tsx](src/__tests__/useResource.test.tsx),
  [management.test.tsx](src/__tests__/management.test.tsx);
  updated [AuthProvider.test.tsx](src/__tests__/AuthProvider.test.tsx).
- **Database/model validation:** [validate-schema.mjs](scripts/validate-schema.mjs),
  [backend-guards.sql](scripts/backend-guards.sql),
  [verify-backend-guards.sql](scripts/verify-backend-guards.sql).

The original Todo files and tests remain untouched and are no longer the
application's main UI.
