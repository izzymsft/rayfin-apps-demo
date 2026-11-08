/*
REVIEWED SUPPLEMENTAL MIGRATION — NOT automatically applied by Rayfin.
1. Run scripts/validate-schema.mjs after `npx tsc -b rayfin`.
2. Review/apply the additive Rayfin entity schema without --force. Order maps to dbo.Orders.
3. In managed Fabric SQL tooling, verify the connection's server AND database against this
   app's Fabric SQL Database. Execute this whole file as one batch via mssql_run_query
   (queryIntent=data_migration), or the Fabric SQL query editor. No frontend SQL endpoint.
4. Reload managed Data API metadata after adding triggers, then verify create/update/delete.
   Upstream DAB v2.0.12 is trigger-aware: INSERT uses OUTPUT INTO plus SELECT, UPDATE
   uses a subsequent SELECT, DELETE uses no OUTPUT. Its MsSqlMetadataProvider discovers
   enabled INSERT/UPDATE triggers. Sources (verified, not proof of Fabric's hosted version):
   https://github.com/Azure/data-api-builder/blob/v2.0.12/src/Core/Resolvers/MsSqlQueryBuilder.cs
   https://github.com/Azure/data-api-builder/blob/v2.0.12/src/Core/Services/MetadataProviders/MsSqlMetadataProvider.cs
   Rayfin's hosted DAB version/metadata refresh is unverified because no backend exists.
   Stale/older metadata may use bare OUTPUT and cause SQL error 334. If that occurs, STOP:
   do not disable guards. A supported trigger-aware managed API must be enabled and tested.
5. Run scripts/verify-backend-guards.sql after every Rayfin schema apply.

Idempotent, transactional, no deletes and no rewriting existing business data.
Existing invalid data aborts the batch; repair only after explicit review.
The supplemental indexes/checks/triggers must remain managed outside the entity generator.
FK NO ACTION protects customers with orders and products with items through every CRUD
entry point. Four reviewed FK replacements add Customer -> Addresses/Phones/Emails and
Order -> OrderItems ON DELETE CASCADE; they delete no rows during migration. Single API
customer/order deletes later remove owned contacts/items atomically; an existing order
prevents the entire customer delete transaction, including any contact cascades.
Primary switches use one API UPDATE; triggers serialize on customer rows and demote the
old choice in the same transaction. Filtered indexes also protect direct INSERT bypasses.
Creating a contact and selecting it primary are separate calls; a failed selection leaves
the new nonprimary contact intact and the service reports that recoverable partial result.
OrderItems mutation + total maintenance runs inside the SAME SQL transaction.
Deadlock/overflow/snapshot-race errors roll back that mutation; refresh before retrying.
Primary UPDATE can already hold a target-row lock before acquiring the customer lock:
concurrent switches may deadlock while demoting one another. SQL rolls back one whole
transaction; the unique index prevents duplicates. There are no client rollback writes.
Multi-row item triggers UNION inserted/deleted order IDs, lock all surviving headers and
recompute each affected total using DECIMAL SUM with HOLDLOCK item ranges. Lock conversion
deadlocks are similarly rollback-safe. Order cascade removes headers so their totals need
no recomputation. Administrative MERGE mixing insertion and updates is deliberately rejected.
*/
SET XACT_ABORT ON;
BEGIN TRY
  BEGIN TRANSACTION;

  IF OBJECT_ID(N'dbo.Customers', N'U') IS NULL OR OBJECT_ID(N'dbo.Addresses', N'U') IS NULL
     OR OBJECT_ID(N'dbo.Phones', N'U') IS NULL OR OBJECT_ID(N'dbo.Emails', N'U') IS NULL
     OR OBJECT_ID(N'dbo.Products', N'U') IS NULL OR OBJECT_ID(N'dbo.Orders', N'U') IS NULL
     OR OBJECT_ID(N'dbo.OrderItems', N'U') IS NULL
    THROW 51000, 'Apply the reviewed Rayfin entity schema before supplemental guards.', 1;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      (N'Products', N'unitPrice'), (N'Orders', N'totalAmount'), (N'OrderItems', N'unitPrice')
    ) expected(tableName, columnName)
    LEFT JOIN sys.columns c ON c.object_id = OBJECT_ID(N'dbo.' + expected.tableName) AND c.name = expected.columnName
    WHERE c.column_id IS NULL OR c.precision <> 18 OR c.scale <> 2
      OR TYPE_NAME(c.system_type_id) NOT IN (N'decimal', N'numeric') OR c.is_nullable = 1
  ) THROW 51001, 'Expected non-null DECIMAL(18,2) monetary columns.', 1;

  IF EXISTS (
    SELECT 1 FROM (VALUES
      (N'Addresses', N'customer_id', N'Customers'), (N'Phones', N'customer_id', N'Customers'),
      (N'Emails', N'customer_id', N'Customers'), (N'Orders', N'customer_id', N'Customers'),
      (N'OrderItems', N'order_id', N'Orders'), (N'OrderItems', N'product_id', N'Products')
    ) expected(childTable, childColumn, parentTable)
    WHERE NOT EXISTS (
      SELECT 1 FROM sys.foreign_keys fk
      JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
      JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
      JOIN sys.columns parentColumn ON parentColumn.object_id = fc.referenced_object_id
        AND parentColumn.column_id = fc.referenced_column_id
      WHERE fk.parent_object_id = OBJECT_ID(N'dbo.' + expected.childTable)
        AND fk.referenced_object_id = OBJECT_ID(N'dbo.' + expected.parentTable)
        AND c.name = expected.childColumn AND parentColumn.name = N'id'
        AND c.is_nullable = 0 AND fk.is_disabled = 0 AND fk.is_not_trusted = 0
        AND (fk.delete_referential_action = 0 OR
          (fk.delete_referential_action = 1 AND
            ((expected.childTable = N'OrderItems' AND expected.childColumn = N'order_id')
              OR expected.childTable IN (N'Addresses', N'Phones', N'Emails'))))
        AND fk.update_referential_action = 0
    )
  ) THROW 51002, 'Expected trusted non-null NO ACTION foreign keys. Review generated schema.', 1;

  DECLARE @orderFk sysname;
  SELECT @orderFk = fk.name FROM sys.foreign_keys fk
  JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID(N'dbo.OrderItems')
    AND fk.referenced_object_id = OBJECT_ID(N'dbo.Orders') AND c.name = N'order_id'
    AND fk.delete_referential_action = 0;
  IF @orderFk IS NOT NULL
    EXEC(N'ALTER TABLE dbo.OrderItems DROP CONSTRAINT ' + QUOTENAME(@orderFk)
      + N'; ALTER TABLE dbo.OrderItems WITH CHECK ADD CONSTRAINT ' + QUOTENAME(@orderFk)
      + N' FOREIGN KEY (order_id) REFERENCES dbo.Orders(id) ON DELETE CASCADE;');

  DECLARE @contactTable sysname, @contactFk sysname;
  DECLARE contactCascades CURSOR LOCAL FAST_FORWARD FOR
    SELECT OBJECT_NAME(fk.parent_object_id), fk.name FROM sys.foreign_keys fk
    JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
    JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
    WHERE fk.parent_object_id IN (OBJECT_ID(N'dbo.Addresses'), OBJECT_ID(N'dbo.Phones'), OBJECT_ID(N'dbo.Emails'))
      AND fk.referenced_object_id = OBJECT_ID(N'dbo.Customers') AND c.name = N'customer_id'
      AND fk.delete_referential_action = 0;
  OPEN contactCascades;
  FETCH NEXT FROM contactCascades INTO @contactTable, @contactFk;
  WHILE @@FETCH_STATUS = 0
  BEGIN
    EXEC(N'ALTER TABLE dbo.' + QUOTENAME(@contactTable) + N' DROP CONSTRAINT ' + QUOTENAME(@contactFk)
      + N'; ALTER TABLE dbo.' + QUOTENAME(@contactTable) + N' WITH CHECK ADD CONSTRAINT ' + QUOTENAME(@contactFk)
      + N' FOREIGN KEY (customer_id) REFERENCES dbo.Customers(id) ON DELETE CASCADE;');
    FETCH NEXT FROM contactCascades INTO @contactTable, @contactFk;
  END;
  CLOSE contactCascades;
  DEALLOCATE contactCascades;

  IF EXISTS (SELECT customer_id FROM dbo.Phones WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1)
     OR EXISTS (SELECT customer_id FROM dbo.Emails WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1)
    THROW 51003, 'Duplicate primary contacts exist; manual review required.', 1;

  IF EXISTS (
    SELECT 1 FROM dbo.Orders o
    OUTER APPLY (
      SELECT COALESCE(SUM(CAST(i.quantity AS decimal(10,0)) * i.unitPrice), 0) amount
      FROM dbo.OrderItems i WHERE i.order_id = o.id
    ) calculated WHERE o.totalAmount <> calculated.amount
  ) THROW 51004, 'Existing order totals differ from item sums; manual review required.', 1;

  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Phones') AND name = N'UX_Rayfin_Phones_Primary')
    CREATE UNIQUE INDEX UX_Rayfin_Phones_Primary ON dbo.Phones(customer_id) WHERE isPrimary = 1;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.Emails') AND name = N'UX_Rayfin_Emails_Primary')
    CREATE UNIQUE INDEX UX_Rayfin_Emails_Primary ON dbo.Emails(customer_id) WHERE isPrimary = 1;
  IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE object_id = OBJECT_ID(N'dbo.OrderItems') AND name = N'IX_Rayfin_OrderItems_Order')
    CREATE INDEX IX_Rayfin_OrderItems_Order ON dbo.OrderItems(order_id) INCLUDE (quantity, unitPrice);

  IF EXISTS (
    SELECT 1 FROM sys.indexes ix
    WHERE ix.name IN (N'UX_Rayfin_Phones_Primary', N'UX_Rayfin_Emails_Primary')
      AND ix.object_id IN (OBJECT_ID(N'dbo.Phones'), OBJECT_ID(N'dbo.Emails'))
      AND (ix.is_unique = 0 OR ix.is_disabled = 1 OR ix.has_filter = 0
        OR LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(ix.filter_definition,
          N' ', N''), N'[', N''), N']', N''), N'(', N''), N')', N'')) <> N'isprimary=1'
        OR (SELECT COUNT(*) FROM sys.index_columns ic WHERE ic.object_id = ix.object_id
          AND ic.index_id = ix.index_id AND ic.key_ordinal > 0) <> 1
        OR NOT EXISTS (SELECT 1 FROM sys.index_columns ic JOIN sys.columns c
          ON c.object_id = ic.object_id AND c.column_id = ic.column_id
          WHERE ic.object_id = ix.object_id AND ic.index_id = ix.index_id
            AND ic.key_ordinal = 1 AND c.name = N'customer_id'))
  ) THROW 51005, 'Existing primary index has unexpected definition or is disabled; review required.', 1;

  IF OBJECT_ID(N'dbo.CK_Rayfin_Customers_Names', N'C') IS NULL
    ALTER TABLE dbo.Customers WITH CHECK ADD CONSTRAINT CK_Rayfin_Customers_Names
      CHECK (firstName LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND lastName LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%');
  IF OBJECT_ID(N'dbo.CK_Rayfin_Addresses_Required', N'C') IS NULL
    ALTER TABLE dbo.Addresses WITH CHECK ADD CONSTRAINT CK_Rayfin_Addresses_Required
      CHECK (line1 LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND city LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND state LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND postalCode LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND country LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%');
  IF OBJECT_ID(N'dbo.CK_Rayfin_Phones_Number', N'C') IS NULL
    ALTER TABLE dbo.Phones WITH CHECK ADD CONSTRAINT CK_Rayfin_Phones_Number
      CHECK (number LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%');
  IF OBJECT_ID(N'dbo.CK_Rayfin_Emails_Format', N'C') IS NULL
    ALTER TABLE dbo.Emails WITH CHECK ADD CONSTRAINT CK_Rayfin_Emails_Format
      CHECK (emailAddress LIKE N'%_@_%._%' AND emailAddress NOT LIKE N'%@%@%'
        AND emailAddress NOT LIKE N'% %' AND emailAddress NOT LIKE N'%' + CHAR(9) + N'%'
        AND emailAddress NOT LIKE N'%' + CHAR(10) + N'%' AND emailAddress NOT LIKE N'%' + CHAR(13) + N'%');
  IF OBJECT_ID(N'dbo.CK_Rayfin_Products_Valid', N'C') IS NULL
    ALTER TABLE dbo.Products WITH CHECK ADD CONSTRAINT CK_Rayfin_Products_Valid
      CHECK (sku LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%'
        AND name LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%' AND unitPrice >= 0);
  IF OBJECT_ID(N'dbo.CK_Rayfin_Orders_Valid', N'C') IS NULL
    ALTER TABLE dbo.Orders WITH CHECK ADD CONSTRAINT CK_Rayfin_Orders_Valid
      CHECK (orderNumber LIKE N'%[^ ' + CHAR(9) + CHAR(10) + CHAR(13) + N']%' AND totalAmount >= 0);
  IF OBJECT_ID(N'dbo.CK_Rayfin_OrderItems_Valid', N'C') IS NULL
    ALTER TABLE dbo.OrderItems WITH CHECK ADD CONSTRAINT CK_Rayfin_OrderItems_Valid
      CHECK (quantity > 0 AND unitPrice >= 0);

  EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_Rayfin_Phones_Primary
    ON dbo.Phones INSTEAD OF UPDATE AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (SELECT 1 FROM inserted i FULL JOIN deleted d ON i.id = d.id WHERE i.id IS NULL OR d.id IS NULL)
        THROW 51020, ''Phone ID is immutable.'', 1;
      IF EXISTS (SELECT customer_id FROM inserted WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1)
        THROW 51021, ''Only one primary phone per customer.'', 1;
      DECLARE @locked TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @locked SELECT c.id FROM dbo.Customers c WITH (UPDLOCK, HOLDLOCK)
        WHERE c.id IN (SELECT customer_id FROM inserted UNION SELECT customer_id FROM deleted);
      UPDATE p SET isPrimary = 0 FROM dbo.Phones p
        WHERE p.isPrimary = 1 AND p.customer_id IN (SELECT customer_id FROM inserted WHERE isPrimary = 1)
          AND p.id NOT IN (SELECT id FROM inserted);
      UPDATE p SET customer_id = i.customer_id, number = i.number, type = i.type, isPrimary = i.isPrimary
        FROM dbo.Phones p JOIN inserted i ON p.id = i.id;
    END');

  EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_Rayfin_Emails_Primary
    ON dbo.Emails INSTEAD OF UPDATE AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (SELECT 1 FROM inserted i FULL JOIN deleted d ON i.id = d.id WHERE i.id IS NULL OR d.id IS NULL)
        THROW 51022, ''Email ID is immutable.'', 1;
      IF EXISTS (SELECT customer_id FROM inserted WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1)
        THROW 51023, ''Only one primary email per customer.'', 1;
      DECLARE @locked TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @locked SELECT c.id FROM dbo.Customers c WITH (UPDLOCK, HOLDLOCK)
        WHERE c.id IN (SELECT customer_id FROM inserted UNION SELECT customer_id FROM deleted);
      UPDATE e SET isPrimary = 0 FROM dbo.Emails e
        WHERE e.isPrimary = 1 AND e.customer_id IN (SELECT customer_id FROM inserted WHERE isPrimary = 1)
          AND e.id NOT IN (SELECT id FROM inserted);
      UPDATE e SET customer_id = i.customer_id, emailAddress = i.emailAddress, isPrimary = i.isPrimary
        FROM dbo.Emails e JOIN inserted i ON e.id = i.id;
    END');

  EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_Rayfin_OrderItems_Guard
    ON dbo.OrderItems AFTER INSERT, UPDATE, DELETE AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (
        SELECT 1 FROM inserted i FULL JOIN deleted d ON i.id = d.id
        WHERE EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted)
          AND (i.id IS NULL OR d.id IS NULL OR i.order_id <> d.order_id
            OR i.product_id <> d.product_id OR i.unitPrice <> d.unitPrice)
      ) THROW 51010, ''Order item identity, product, order and snapshot price are immutable.'', 1;

      IF NOT EXISTS (SELECT 1 FROM deleted) AND EXISTS (
        SELECT 1 FROM inserted i JOIN dbo.Products p WITH (UPDLOCK, HOLDLOCK) ON p.id = i.product_id
        WHERE i.unitPrice <> p.unitPrice
      ) THROW 51011, ''Snapshot price must equal the current product price. Refresh and retry.'', 1;

      DECLARE @affected TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @affected SELECT order_id FROM inserted UNION SELECT order_id FROM deleted;
      DECLARE @locked TABLE (id uniqueidentifier PRIMARY KEY);
      INSERT INTO @locked SELECT o.id FROM dbo.Orders o WITH (UPDLOCK, HOLDLOCK)
        JOIN @affected a ON a.id = o.id;
      UPDATE o SET totalAmount = CAST(calculated.amount AS decimal(18,2))
      FROM dbo.Orders o JOIN @locked a ON a.id = o.id
      OUTER APPLY (
        SELECT COALESCE(SUM(CAST(i.quantity AS decimal(10,0)) * i.unitPrice), 0) amount
        FROM dbo.OrderItems i WITH (UPDLOCK, HOLDLOCK) WHERE i.order_id = o.id
      ) calculated;
    END');

  EXEC(N'CREATE OR ALTER TRIGGER dbo.TR_Rayfin_Orders_Total
    ON dbo.Orders AFTER INSERT, UPDATE AS
    BEGIN
      SET NOCOUNT ON;
      IF EXISTS (
        SELECT 1 FROM inserted o
        OUTER APPLY (
          SELECT COALESCE(SUM(CAST(i.quantity AS decimal(10,0)) * i.unitPrice), 0) amount
          FROM dbo.OrderItems i WITH (HOLDLOCK) WHERE i.order_id = o.id
        ) calculated WHERE o.totalAmount <> calculated.amount
      ) THROW 51012, ''Order totals are computed by the database from order items.'', 1;
    END');

  -- Re-trust named checks on repeated execution; never silently keep disabled checks.
  ALTER TABLE dbo.Customers WITH CHECK CHECK CONSTRAINT CK_Rayfin_Customers_Names;
  ALTER TABLE dbo.Addresses WITH CHECK CHECK CONSTRAINT CK_Rayfin_Addresses_Required;
  ALTER TABLE dbo.Phones WITH CHECK CHECK CONSTRAINT CK_Rayfin_Phones_Number;
  ALTER TABLE dbo.Emails WITH CHECK CHECK CONSTRAINT CK_Rayfin_Emails_Format;
  ALTER TABLE dbo.Products WITH CHECK CHECK CONSTRAINT CK_Rayfin_Products_Valid;
  ALTER TABLE dbo.Orders WITH CHECK CHECK CONSTRAINT CK_Rayfin_Orders_Valid;
  ALTER TABLE dbo.OrderItems WITH CHECK CHECK CONSTRAINT CK_Rayfin_OrderItems_Valid;
  ENABLE TRIGGER dbo.TR_Rayfin_OrderItems_Guard ON dbo.OrderItems;
  ENABLE TRIGGER dbo.TR_Rayfin_Orders_Total ON dbo.Orders;
  ENABLE TRIGGER dbo.TR_Rayfin_Phones_Primary ON dbo.Phones;
  ENABLE TRIGGER dbo.TR_Rayfin_Emails_Primary ON dbo.Emails;

  COMMIT TRANSACTION;
END TRY
BEGIN CATCH
  IF @@TRANCOUNT > 0 ROLLBACK TRANSACTION;
  THROW;
END CATCH;
