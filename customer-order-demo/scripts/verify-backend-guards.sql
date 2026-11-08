-- Read-only managed Fabric SQL verification. Run after EVERY Rayfin schema apply.
IF (SELECT COUNT(*) FROM sys.triggers WHERE is_disabled = 0 AND name IN
  (N'TR_Rayfin_OrderItems_Guard', N'TR_Rayfin_Orders_Total',
   N'TR_Rayfin_Phones_Primary', N'TR_Rayfin_Emails_Primary')) <> 4
  THROW 51030, 'Missing or disabled backend guard trigger.', 1;
IF (SELECT COUNT(*) FROM sys.check_constraints WHERE is_disabled = 0 AND is_not_trusted = 0
  AND name IN (N'CK_Rayfin_Customers_Names', N'CK_Rayfin_Addresses_Required', N'CK_Rayfin_Phones_Number',
    N'CK_Rayfin_Emails_Format', N'CK_Rayfin_Products_Valid', N'CK_Rayfin_Orders_Valid',
    N'CK_Rayfin_OrderItems_Valid')) <> 7
  THROW 51031, 'Missing, disabled or untrusted backend guard check.', 1;
IF (SELECT COUNT(*) FROM sys.indexes WHERE is_unique = 1 AND is_disabled = 0 AND has_filter = 1
  AND name IN (N'UX_Rayfin_Phones_Primary', N'UX_Rayfin_Emails_Primary')) <> 2
  THROW 51032, 'Missing or disabled unique primary contact index.', 1;
IF NOT EXISTS (
  SELECT 1 FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
  WHERE fk.parent_object_id = OBJECT_ID(N'dbo.OrderItems') AND fk.referenced_object_id = OBJECT_ID(N'dbo.Orders')
    AND c.name = N'order_id' AND fk.is_disabled = 0 AND fk.is_not_trusted = 0 AND fk.delete_referential_action = 1
) THROW 51033, 'OrderItems order foreign key must be trusted ON DELETE CASCADE.', 1;
IF (SELECT COUNT(DISTINCT fk.parent_object_id)
  FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fc ON fc.constraint_object_id = fk.object_id
  JOIN sys.columns c ON c.object_id = fc.parent_object_id AND c.column_id = fc.parent_column_id
  WHERE fk.parent_object_id IN (OBJECT_ID(N'dbo.Addresses'), OBJECT_ID(N'dbo.Phones'), OBJECT_ID(N'dbo.Emails'))
    AND fk.referenced_object_id = OBJECT_ID(N'dbo.Customers') AND c.name = N'customer_id'
    AND fk.is_disabled = 0 AND fk.is_not_trusted = 0 AND fk.delete_referential_action = 1) <> 3
  THROW 51034, 'Customer contact foreign keys must be trusted ON DELETE CASCADE.', 1;
SELECT name, is_disabled FROM sys.triggers WHERE name IN
  (N'TR_Rayfin_OrderItems_Guard', N'TR_Rayfin_Orders_Total',
   N'TR_Rayfin_Phones_Primary', N'TR_Rayfin_Emails_Primary');
SELECT OBJECT_NAME(object_id) AS tableName, name, is_unique, is_disabled, filter_definition
FROM sys.indexes WHERE name IN
  (N'UX_Rayfin_Phones_Primary', N'UX_Rayfin_Emails_Primary', N'IX_Rayfin_OrderItems_Order');
SELECT OBJECT_NAME(parent_object_id) AS tableName, name, is_disabled, is_not_trusted, definition
FROM sys.check_constraints WHERE name LIKE N'CK_Rayfin_%';
SELECT OBJECT_NAME(parent_object_id) AS tableName, name, is_disabled, is_not_trusted,
  delete_referential_action_desc, update_referential_action_desc
FROM sys.foreign_keys WHERE parent_object_id IN
  (OBJECT_ID(N'dbo.Addresses'), OBJECT_ID(N'dbo.Phones'), OBJECT_ID(N'dbo.Emails'),
   OBJECT_ID(N'dbo.Orders'), OBJECT_ID(N'dbo.OrderItems'));
SELECT o.id, o.totalAmount, calculated.amount AS computedTotal
FROM dbo.Orders o OUTER APPLY (
  SELECT COALESCE(SUM(CAST(i.quantity AS decimal(10,0)) * i.unitPrice), 0) amount
  FROM dbo.OrderItems i WHERE i.order_id = o.id
) calculated WHERE o.totalAmount <> calculated.amount;
SELECT N'Phone' AS contactType, customer_id, COUNT(*) AS primaryCount
FROM dbo.Phones WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1
UNION ALL SELECT N'Email', customer_id, COUNT(*)
FROM dbo.Emails WHERE isPrimary = 1 GROUP BY customer_id HAVING COUNT(*) > 1;
