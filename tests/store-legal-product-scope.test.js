const assert = require('node:assert/strict');
const { test } = require('node:test');
const { validateLaunchProductScope } = require('../scripts/store-legal-policy-audit');
const ids = ['freed_premium_yearly', 'freed_premium_monthly'];
const future = ['freed_family_yearly', 'freed_accountability_monthly', 'freed_ai_coach_monthly'];
const catalog = { schemaVersion: 'freed-store-products-v1', launchProductIds: ids, products: ids.map(productId => ({ productId })), futureProductsDisabledForV1: future };
const metadata = { playMetadata: ids.join(' '), appStoreMetadata: ids.join(' '), activePrivacyText: 'Private recovery data', consolePacket: 'Future SKUs are disabled for v1 ' + future.join(' ') };

test('monthly/yearly launch metadata passes without advertising a lifetime SKU', () => {
  assert.equal(validateLaunchProductScope(catalog, metadata).passed, true);
});
test('a platform missing a launched subscription fails even if the other platform mentions it', () => {
  assert.equal(validateLaunchProductScope(catalog, { ...metadata, playMetadata: ids[0] }).passed, false);
});
test('future and lifetime SKU identifiers cannot appear in active metadata or privacy answers', () => {
  for (const id of [...future, 'freed_premium_lifetime']) {
    assert.equal(validateLaunchProductScope(catalog, { ...metadata, activePrivacyText: id }).passed, false, id);
    assert.equal(validateLaunchProductScope(catalog, { ...metadata, appStoreMetadata: metadata.appStoreMetadata + ' ' + id }).passed, false, id);
  }
});
test('a changed catalog cannot quietly add lifetime or drop a monthly/yearly product', () => {
  assert.equal(validateLaunchProductScope({ ...catalog, launchProductIds: ids.slice(0, 1) }, metadata).passed, false);
  assert.equal(validateLaunchProductScope({ ...catalog, products: [...catalog.products, { productId: 'freed_premium_lifetime' }] }, metadata).passed, false);
});
test('future disabled-product declarations are required in both catalog and console handoff', () => {
  assert.equal(validateLaunchProductScope({ ...catalog, futureProductsDisabledForV1: [] }, metadata).passed, false);
  assert.equal(validateLaunchProductScope(catalog, { ...metadata, consolePacket: 'Future launch ideas' }).passed, false);
});
test('malformed catalog shape returns a concrete failed gate rather than skipping product validation', () => {
  const result = validateLaunchProductScope({ ...catalog, products: {} }, metadata);
  assert.equal(result.passed, false);
  assert.ok(result.failures.some(reason => reason.includes('catalog products')));
});
