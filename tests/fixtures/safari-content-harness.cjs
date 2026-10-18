const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const { setImmediate } = require('node:timers');

class LocalElement {
  constructor(tagName) {
    this.tagName = tagName; this.children = []; this.parent = null;
    this.id = ''; this.className = ''; this.textContent = ''; this.href = ''; this.hidden = false;
    this.attributes = new Map(); this.listeners = new Map();
    const classes = new Set();
    this.classList = { add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value) };
  }
  setAttribute(key, value) { this.attributes.set(key, value); }
  removeAttribute(key) { this.attributes.delete(key); if (key === 'href') this.href = ''; }
  append(...elements) { for (const element of elements) { element.parent = this; this.children.push(element); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  addEventListener(name, listener) { this.listeners.set(name, listener); }
  focus() {}
}
const descendants = element => [element, ...element.children.flatMap(descendants)];

/** Runs shipped content code with controlled local DOM, native replies and timer ticks. */
function createSafariContentHarness(locationUrl, options = {}) {
  const root = new LocalElement('html');
  const body = options.loading ? null : new LocalElement('body');
  if (body) root.append(body);
  const documentListeners = new Map(), windowListeners = new Map(), timers = [], messages = [], pending = [], navigations = [];
  let deferNative = options.deferNative === true;
  let active = options.active === undefined ? true : options.active;
  let accepted = options.accepted === undefined ? true : options.accepted;
  const document = {
    documentElement: root, body, readyState: options.loading ? 'loading' : 'complete',
    createElement: tag => new LocalElement(tag),
    getElementById: id => descendants(root).find(element => element.id === id),
    addEventListener(name, callback) { documentListeners.set(name, callback); }
  };
  const window = { location: new URL(locationUrl), addEventListener(name, callback) { windowListeners.set(name, callback); } };
  window.location.assign = href => navigations.push(href);
  const runtime = { sendMessage(message) {
    const input = JSON.parse(JSON.stringify(message)); messages.push(input);
    if (input.type === 'get-protection-configuration') assert.deepEqual(Object.keys(input), ['type']);
    else {
      assert.deepEqual(Object.keys(input).sort(), ['host', 'rule']);
      assert.ok(['short-form:youtube-shorts', 'short-form:instagram-reels', 'short-form:tiktok-feed'].includes(input.rule));
    }
    if (deferNative) return new Promise(resolve => pending.push({ input, resolve }));
    if (options.rejectNative) return Promise.reject(new Error('Native relay unavailable'));
    return Promise.resolve(input.type ? { protectionConfigurationActive: active } : { accepted, protectionConfigurationActive: active });
  } };
  const sandbox = {
    document, window, history: { pushState() {}, replaceState() {} },
    MutationObserver: class { observe() {} }, URLSearchParams, queueMicrotask,
    setInterval(callback, delay) { assert.equal(delay, 1000); timers.push(callback); return timers.length; },
    fetch() { assert.fail('Content harness must not browse or fetch'); },
    XMLHttpRequest: class { constructor() { assert.fail('Content harness must not browse or fetch'); } },
    navigator: { sendBeacon() { assert.fail('Content harness must not send analytics'); } }
  };
  if (options.browserAvailable !== false) sandbox.browser = { runtime };
  vm.runInNewContext(readFileSync('ios/FREEDSafariFocusShield/content.js', 'utf8'), sandbox);
  const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
  return {
    document, window, documentListeners, windowListeners, timers, messages, pending, navigations, root, flush,
    links: () => descendants(root).filter(element => element.tagName === 'a'),
    hasShield: () => Boolean(document.getElementById('freed-safari-focus-shield')),
    setDeferredNative(value) { deferNative = value; },
    setActive(value) { active = value; }, setAccepted(value) { accepted = value; },
    navigate(pathname) { window.location.pathname = pathname; },
    dispatchWindow(name) { assert.ok(windowListeners.has(name)); windowListeners.get(name)(); },
    async tick() { assert.equal(timers.length, 1); timers[0](); await flush(); },
    async ready() {
      if (!document.body) { document.body = new LocalElement('body'); root.append(document.body); }
      document.readyState = 'interactive';
      documentListeners.get('DOMContentLoaded')?.(); await flush();
    },
    async resolveNextNative(response) { assert.ok(pending.length, 'A real native request must be pending'); pending.shift().resolve(response); await flush(); },
    async click(link) { let prevented = false; assert.ok(link.listeners.has('click')); await link.listeners.get('click')({ preventDefault() { prevented = true; } }); assert.equal(prevented, true); await flush(); }
  };
}
module.exports = { LocalElement, createSafariContentHarness };
