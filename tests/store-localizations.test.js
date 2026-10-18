const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const languages = ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'];
test('local store packets cover ten languages, equal plans and explicit renewal/privacy disclosures', () => {
  const catalog = JSON.parse(fs.readFileSync('store/store-products.json','utf8'));
  for (const language of languages) {
    const file = `store/localizations/${language}.json`;
    assert.ok(fs.existsSync(file), `missing store metadata for ${language}`);
    const packet = JSON.parse(fs.readFileSync(file,'utf8'));
    assert.equal(packet.status,'draft-not-published');
    assert.equal(packet.language,language);
    assert.equal(packet.title,'FREED');
    assert.ok(packet.appStore.subtitle.length <= 30);
    assert.ok(packet.googlePlay.shortDescription.length <= 80);
    assert.ok(packet.appStore.description.length <= 4000);
    assert.ok(packet.googlePlay.description.length <= 4000);
    assert.deepEqual(Object.keys(packet.products).sort(),['freed_premium_monthly','freed_premium_yearly']);
    for (const product of catalog.products) {
      assert.deepEqual(product.apple.localizations[packet.appStore.locale], { displayName: packet.products[product.productId].displayName, description: packet.products[product.productId].description });
      assert.deepEqual(product.google.localizations[packet.googlePlay.locale], { displayName: packet.products[product.productId].displayName, description: packet.products[product.productId].description });
    }
    for (const product of Object.values(packet.products)) {
      assert.ok(product.displayName.length <= 30);
      assert.ok(product.description.length <= 45);
    }
    for (const key of ['subscriptions','privacy','limitations']) assert.ok(packet.disclosures[key]?.trim());
  }
});
