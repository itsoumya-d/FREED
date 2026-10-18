'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const api = require('../website/assets/recovery.js');
const html = fs.readFileSync('website/recovery.html', 'utf8');
function fixture(language) {
  const nodes = new Map();
  const doc = { documentElement: {}, title: '', getElementById(id) {
    if (!nodes.has(id)) nodes.set(id, { textContent: '', value: '', events: {}, addEventListener(type, fn) { this.events[type] = fn; } });
    return nodes.get(id);
  }};
  Object.defineProperty(doc, 'referrer', { get() { throw Error('Browsing referrer must not be read'); } });
  const context = { document: doc, navigator: { language }, fetch() { throw Error('No network'); }, localStorage: new Proxy({}, { get() { throw Error('No storage'); } }) };
  Object.defineProperty(context, 'location', { get() { throw Error('Private URL must not be read'); } });
  vm.runInNewContext(fs.readFileSync('website/assets/recovery.js', 'utf8'), context);
  return { doc, nodes };
}
test('page uses fixed payload-free app destinations and a safe exit', () => {
  assert.match(html, /id="open-challenge"[^>]+href="freed:\/\/guided-reset"/);
  assert.match(html, /data-app-link="https:\/\/freed-7d5ee\.firebaseapp\.com\/intervention"/);
  assert.match(html, /id="open-installed"[^>]+href="freed:\/\/guided-reset"/);
  assert.match(html, /id="safe-exit"[^>]+href="https:\/\/www\.google\.com\/"/);
  assert.equal(api.APP_LINK, 'https://freed-7d5ee.firebaseapp.com/intervention');
  assert.equal(api.SCHEME_LINK, 'freed://guided-reset');
  assert.match(html, /name="referrer" content="no-referrer"/);
  assert.match(html, /connect-src 'none'/);
  assert.doesNotMatch(html, /<iframe|<form|googletag|doubleclick|admob|analytics/i);
});
test('all ten language choices render; switching preserves fixed links and sets Arabic direction', () => {
  assert.equal(Object.keys(api.COPY).length, 10);
  const { doc, nodes } = fixture('en-GB');
  for (const locale of Object.keys(api.COPY)) {
    assert.equal(api.COPY[locale].length, 10);
    assert.ok(api.COPY[locale].every(text => typeof text === 'string' && text.length > 0));
    nodes.get('language').value = locale;
    nodes.get('language').events.change();
    assert.equal(doc.documentElement.lang, locale);
    assert.equal(doc.documentElement.dir, locale === 'ar' ? 'rtl' : 'ltr');
    assert.equal(nodes.get('open-challenge').textContent, api.COPY[locale][3]);
  }
  assert.equal(api.localeFor('zh-CN'), 'zh-Hans');
  assert.equal(api.localeFor('unknown'), 'en');
});
test('mount and explicit tap never read location/referrer/storage or make network/ad calls', () => {
  const { nodes } = fixture('ar');
  assert.equal(nodes.get('status').textContent, '');
  nodes.get('open-challenge').events.click();
  assert.equal(nodes.get('open-installed').hidden, false);
  assert.equal(nodes.get('status').textContent, api.COPY.ar[9]);
  assert.equal(nodes.get('open-installed').events.click, undefined, 'fallback remains a plain user-operated anchor');
});
