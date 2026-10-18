// Read-only characterization: runs the shipped content script against a tiny
// lifecycle fixture; never opens a browser or loads remote content.
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');

const listeners = new Map();
const windowListeners = new Map();
const rendered = new Map();
function element(tag) {
  return {
    tag, children: [], append(...items) {
      this.children.push(...items);
      for (const item of items) if (item.id) rendered.set(item.id, item);
    }, setAttribute() {}, focus() {}, remove() { rendered.delete(this.id); }
  };
}
const root = element('html');
root.classList = { add() {}, remove() {} };
const document = {
  body: null, documentElement: root, readyState: 'loading',
  createElement: element,
  getElementById: id => rendered.get(id),
  addEventListener(name, callback) { listeners.set(name, callback); }
};
const location = { hostname: 'youtube.com', pathname: '/shorts/fixture' };
const window = { location, addEventListener(name, callback) { windowListeners.set(name, callback); } };
vm.runInNewContext(readFileSync('ios/FREEDSafariFocusShield/content.js', 'utf8'), {
  window, document, history: { pushState() {}, replaceState() {} }, URLSearchParams,
  MutationObserver: class { observe() {} }, queueMicrotask: fn => fn()
});
assert.ok(listeners.has('DOMContentLoaded'), 'fixture must reach the deferred render path');
location.pathname = '/watch';
windowListeners.get('popstate')();
document.body = element('body');
document.readyState = 'interactive';
listeners.get('DOMContentLoaded')();
const observed = {
  currentPath: location.pathname,
  normalRouteAllowed: !rendered.has('freed-safari-focus-shield'),
  staleShieldRendered: rendered.has('freed-safari-focus-shield')
};
console.log(JSON.stringify(observed, null, 2));
assert.equal(observed.normalRouteAllowed, true,
  'an allowed route must remain allowed after a pre-DOM-ready route change');
