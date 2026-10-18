const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { test } = require('node:test');
const vm = require('node:vm');

const script = readFileSync(resolve(__dirname, '../../../ios/FREEDSafariFocusShield/content.js'), 'utf8');

function fixture() {
  const elements = new Map();
  const intervals = [];
  const classes = new Set();
  const navigations = [];
  let active = true;
  let nativePublications = 0;
  let publicationHook;
  const makeElement = (tag) => ({ tag, children: [], listeners: {},
    setAttribute() {}, focus() {},
    addEventListener(event, callback) { this.listeners[event] = callback; },
    append(...children) { this.children.push(...children); for (const child of children) { if (child.id) elements.set(child.id, child); } },
    remove() { if (this.id) elements.delete(this.id); }
  });
  const root = makeElement('html');
  root.classList = { add: (name) => classes.add(name), remove: (name) => classes.delete(name) };
  const body = makeElement('body');
  const location = { hostname: 'youtube.com', pathname: '/shorts/example', assign: (url) => navigations.push(url) };
  const context = { URLSearchParams, document: { documentElement: root, body, readyState: 'complete',
    createElement: makeElement, getElementById: (id) => elements.get(id), addEventListener() {} },
    window: { location, addEventListener() {} }, history: { pushState() {}, replaceState() {} },
    queueMicrotask, setInterval: (callback) => intervals.push(callback),
    MutationObserver: class { observe() {} },
    browser: { runtime: { async sendMessage(message) {
      if (message.type === 'get-protection-configuration') return { protectionConfigurationActive: active };
      nativePublications += 1;
      if (publicationHook) publicationHook();
      return { accepted: active, protectionConfigurationActive: active };
    } } }
  };
  vm.runInNewContext(script, context);
  return { elements, classes, navigations, intervals,
    setActive: (value) => { active = value; },
    setPublicationHook: (hook) => { publicationHook = hook; },
    publications: () => nativePublications };
}

const settle = () => new Promise((done) => setImmediate(done));

test('reset removes an existing overlay on fresh periodic configuration read', async () => {
  const state = fixture();
  await settle();
  assert.ok(state.elements.has('freed-safari-focus-shield'));
  state.setActive(false);
  await state.intervals[0]();
  assert.equal(state.elements.has('freed-safari-focus-shield'), false);
  assert.equal(state.classes.has('freed-focus-shield-active'), false);
  const published = state.publications();
  await state.intervals[0]();
  assert.equal(state.publications(), published, 'A reset cannot publish another native intervention.');
});

test('an already rendered challenge link fetches fresh state and cannot redirect after reset', async () => {
  const state = fixture();
  await settle();
  const card = state.elements.get('freed-safari-focus-shield').children[1];
  const link = card.children[2];
  state.setActive(false);
  let defaultPrevented = false;
  await link.listeners.click({ preventDefault: () => { defaultPrevented = true; } });
  assert.equal(defaultPrevented, true);
  assert.deepEqual(state.navigations, []);
  assert.equal(state.elements.has('freed-safari-focus-shield'), false);
});

test('reset during publication cannot create an overlay from an earlier permissive result', async () => {
  const state = fixture();
  state.setPublicationHook(() => state.setActive(false));
  await settle();
  assert.equal(state.elements.has('freed-safari-focus-shield'), false);
  assert.deepEqual(state.navigations, []);
});
