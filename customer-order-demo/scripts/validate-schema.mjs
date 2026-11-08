// Offline only: compile rayfin first with `npx tsc -b rayfin`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ConfigGenerator, SchemaAnalyzer } from '@microsoft/rayfin-core/analysis';
import { schema } from '../rayfin/.temp/compiled/data/schema.js';

const analysis = new SchemaAnalyzer(schema, 'mssql').analyzeEntities();
const config = new ConfigGenerator('mssql').generateConfig(analysis);
assert.deepEqual(Object.keys(config.entities).sort(),
  ['Todo', 'Customer', 'Address', 'Phone', 'Email', 'Product', 'Order', 'OrderItem'].sort());
for (const [name, entity] of Object.entries(config.entities)) {
  const model = entity['x-schema'];
  assert.ok(model, `${name}: missing generated schema`);
  assert.deepEqual(model.constraints.primaryKey.columns, ['id']);
  for (const field of Object.values(model.fields)) {
    if (name !== 'Todo') assert.ok(!field.dbType.includes('(MAX)'), `${name}: unbounded string`);
  }
  if (name !== 'Todo') {
    assert.ok(entity.permissions.some(permission => permission.role === 'authenticated'));
    assert.ok(!entity.permissions.some(permission => permission.role === 'anonymous'));
  }
}
for (const [name, fields] of Object.entries({
  Address: ['customer_id'], Phone: ['customer_id'], Email: ['customer_id'],
  Order: ['customer_id'], OrderItem: ['order_id', 'product_id'],
})) {
  const model = config.entities[name]['x-schema'];
  for (const field of fields) {
    assert.ok(model.fields[field], `${name}: missing scalar ${field}`);
    assert.ok(model.constraints.foreignKeys.some(key => key.columns.includes(field)), `${name}: missing FK ${field}`);
    assert.equal(model.fields[field].nullable, false, `${name}: FK unexpectedly nullable`);
  }
}
for (const [name, field] of [['Product', 'unitPrice'], ['Order', 'totalAmount'], ['OrderItem', 'unitPrice']]) {
  assert.match(config.entities[name]['x-schema'].fields[field].dbType, /DECIMAL\(18,\s*2\)/i);
}
for (const [name, field] of [['Product', 'sku'], ['Order', 'orderNumber']]) {
  assert.ok(config.entities[name]['x-schema'].constraints.uniqueConstraints.some(key => key.columns.includes(field)));
}
assert.ok(config.entities.Order['x-schema'].constraints.checkConstraints?.length >= 1);
const guards = readFileSync(new URL('./backend-guards.sql', import.meta.url), 'utf8');
for (const name of ['Customer', 'Address', 'Phone', 'Email', 'Product', 'Order', 'OrderItem']) {
  const source = config.entities[name].source;
  assert.equal(typeof source, 'string');
  assert.ok(guards.includes(`dbo.${source}`), `SQL guard table differs from actual generated ${name} mapping`);
}
for (const guard of ['TR_Rayfin_OrderItems_Guard', 'TR_Rayfin_Orders_Total', 'TR_Rayfin_Phones_Primary',
  'TR_Rayfin_Emails_Primary', 'UX_Rayfin_Phones_Primary', 'UX_Rayfin_Emails_Primary']) {
  assert.ok(guards.includes(guard), `Missing supplemental ${guard}`);
}
assert.match(guards, /ON DELETE CASCADE/);
assert.match(guards, /INSTEAD OF UPDATE/);
assert.match(guards, /UPDLOCK, HOLDLOCK/);
assert.match(guards, /SUM\(CAST\(i\.quantity AS decimal\(10,0\)\) \* i\.unitPrice\)/);
assert.doesNotMatch(guards, /\b(?:DROP TABLE|TRUNCATE TABLE)\b/i);
console.log('Offline Rayfin 1.36.2 analyzer/generator validation passed.');
console.log('Numeric minimums, nonblank text and email format are not emitted as SQL checks by the default installed generator; supplemental guards are mandatory.');
console.log('Supplemental SQL references checked statically; live managed SQL/DAB validation remains required.');
console.log(JSON.stringify(Object.fromEntries(Object.entries(config.entities).map(([name, entity]) =>
  [name, { source: entity.source, foreignKeys: entity['x-schema'].constraints.foreignKeys?.map(key => ({
    columns: key.columns, referencedTable: key.referencedTable,
  })) }])), null, 2));
