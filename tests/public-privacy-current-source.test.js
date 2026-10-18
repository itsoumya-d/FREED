const assert = require('node:assert/strict');
const test = require('node:test');
const { readFileSync } = require('node:fs');
const { inspectPublicPrivacyComposition } = require('../scripts/lib/cleanup-source-contract');
const read = path => readFileSync(path,'utf8');
const source = read('src/features/legal-pages.tsx');
const catalog = JSON.parse(read('src/i18n/native-android-catalog.json'));
const context = {
  routes: { PrivacyPolicyPage: read('app/privacy.tsx'), SupportPage: read('app/support.tsx'), AccountDeletionPage: read('app/account-deletion.tsx') },
  locales: Object.fromEntries(['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].map(locale => [locale,JSON.parse(read(`src/i18n/locales/${locale}.json`))])),
  website: read('website/build-legal-pages.js'),
};
const passes = (legal=source,native=catalog,composition=context) => inspectPublicPrivacyComposition(legal,native,composition);
function mutate(before,after) {
  assert.ok(source.includes(before),`actual public disclosure exists: ${before}`);
  const changed=source.replaceAll(before,after); assert.notEqual(changed,source);
  assert.equal(passes(changed),false,before);
}
test('current actual public renderer, imports, routes, destinations, UID and TTL disclosures pass', () => assert.equal(passes(),true));
test('comments, unused strings and disconnected public imports/renderer cannot preserve disclosures', () => {
  mutate('Photos are not uploaded.','Photos may be uploaded.');
  mutate('nativeAndroidCopy.freed_accessibility_description,','"Disclosure removed", // nativeAndroidCopy.freed_accessibility_description,');
  mutate('section.body.map((paragraph)','[].map((paragraph)');
  mutate('{paragraph}','{"hidden"}');
  mutate('sections={[','unusedSections={[');
  for (const [name,route] of Object.entries(context.routes)) {
    for (const changed of [route.replace('@/features/legal-pages','./fake-legal-pages'),route.replace(`return <${name} />;`,`const unused = <${name} />; return null;`)]) {
      assert.notEqual(changed,route); assert.equal(passes(source,catalog,{...context,routes:{...context.routes,[name]:changed}}),false,name);
    }
  }
  const before='Photos are checked on your device';
  assert.equal(passes(source.replaceAll(before,'Photo disclosure removed')+'\n// '+before),false);
});
test('current account-linked counters, delayed TTL deletion, Google retention and deletion acceptance must stay truthful', () => {
  for (const [before,after] of [
    ['authenticated account UID','anonymous only'],['14-day window','30-day window'],['configured 14-day expiry','configured 30-day expiry'],
    ['configured 7-day expiry','configured 1-day expiry'],['physical deletion may occur later','physical deletion is instant'],
    ['eligible for TTL deletion','already physically erased'],['account-linked quota and request deduplication metadata','anonymous metadata'],
    ['Derived rates, streak summaries and challenge categories stay local','Derived rates are uploaded'],
    ['does not promise a fixed Google retention period or zero retention','guarantees zero retention'],
    ['accepted request means deletion is in progress','accepted request proves full erasure'],['native acknowledgment','automatic success'],
    ['legal retention','no retention'],['ML Kit may send operational SDK metrics','ML Kit sends no metrics'],
    ['does not automatically cancel App Store or Google Play subscriptions','automatically cancels subscriptions'],
    ['does not promise instantaneous provider authorization revocation','promises instantaneous provider authorization revocation'],
  ]) mutate(before,after);
});
test('actual action destination and translated catalog UID/TTL drift are rejected', () => {
  mutate('https://freed-landing.web.app/account-deletion','https://example.org/delete');
  mutate('onPress={() => openUrl(action.url)}','onPress={() => undefined}');
  const changedCatalog={...catalog,freed_accessibility_description:catalog.freed_accessibility_description.replace('whole-app guards','screenshots')};
  assert.notEqual(changedCatalog.freed_accessibility_description,catalog.freed_accessibility_description); assert.equal(passes(source,changedCatalog),false);
  for (const locale of Object.keys(context.locales)) {
    for (const [phrase,token] of [['authenticated account UID','UID'],['configured 14-day expiry','14'],['configured 7-day expiry','7']]) {
      const original=context.locales[locale]; const key=Object.keys(original.source).find(key=>key.includes(phrase));
      assert.ok(key);assert.ok(original.source[key].includes(token));
      const changed={...original,source:{...original.source,[key]:original.source[key].replaceAll(token,'removed')}};
      assert.notDeepEqual(changed,original);assert.equal(passes(source,catalog,{...context,locales:{...context.locales,[locale]:changed}}),false,`${locale} ${token}`);
    }
  }
});
test('hosted English adult eligibility and subscription composition remain explicit and connected', () => {
  for (const [before,after] of [['adults 18+','all ages'],['auto-renewing monthly and yearly subscriptions','free forever'],['[eligibility,','["no eligibility",'],['[billing,','["no billing",'],['billing, cancellation,','billing, "no cancellation",']]) {
    assert.ok(context.website.includes(before),before);const changed=context.website.replaceAll(before,after);assert.notEqual(changed,context.website);
    assert.equal(passes(source,catalog,{...context,website:changed}),false,before);
  }
});

test('review I3 binds actual per-page rendered actions and mailto to the declared safe destinations', () => {
  for (const [before,after] of [
    ['url: ACCOUNT_DELETION_URL','url: "https://example.org/no-deletion"'],
    ['url: SUPPORT_URL','url: "https://example.org/no-support"'],
    ['url: PRIVACY_URL','url: "https://example.org/no-privacy"'],
    ['url: mailto("FREED privacy request")','url: "mailto:someone@example.org"'],
    ['url: mailto("FREED support request")','url: mailto("wrong subject")'],
    ['url: mailto("FREED account deletion request")','url: otherMailto("FREED account deletion request")'],
    ['url: ACCOUNT_DELETION_URL','url: ACCOUNT_DELETION_URL, url: "https://example.org/no-deletion"'],
    ['url: SUPPORT_URL','url: SUPPORT_URL, ...{url: "https://example.org/no-support"}'],
    ['export function PrivacyPolicyPage() {','export function PrivacyPolicyPage() { const ACCOUNT_DELETION_URL = "https://example.org/no-deletion";'],
    ['export function SupportPage() {','export function SupportPage(mailto) {'],
    ['return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(translateSource(subject))}`;','return `mailto:someone@example.org`;'],
    ["  actions\n}: {","  actions: unusedActions\n}: {"],
    ['{actions.map((action) => (','{[{label:"Other",url:"https://example.org/no-deletion"}].map((action) => ('],
  ]) mutate(before,after);
});
