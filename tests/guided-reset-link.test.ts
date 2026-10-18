import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGuidedResetLinkInbox, isGuidedResetLink } from '../src/lib/guided-reset-link';

test('a recovery opener accepts no website, account, membership, or native authority payload', () => {
  assert.equal(isGuidedResetLink('freed://guided-reset'), true);
  for (const link of [null, '', 'https://guided-reset', 'freed://guided-reset/', 'freed:///guided-reset', 'freed://guided-reset?premium=true', 'freed://guided-reset#nativeInterventionId=secret', 'freed://user@guided-reset', 'freed://guided-reset:80', 'freed://GUIDED-RESET', 'freed://guided-reset?']) assert.equal(isGuidedResetLink(link), false, String(link));
});

test('the inbox waits for foreground readiness, deduplicates cold start and permits a later explicit tap', () => {
  let now = 1000;
  const inbox = createGuidedResetLinkInbox(() => now);
  assert.equal(inbox.offer('freed://guided-reset', 'initial'), true);
  assert.equal(inbox.take(false), false);
  assert.equal(inbox.take(true), true);
  assert.equal(inbox.take(true), false);
  assert.equal(inbox.offer('freed://guided-reset', 'initial'), false);
  assert.equal(inbox.offer('freed://guided-reset', 'event'), true);
  assert.equal(inbox.take(true), true);
  assert.equal(inbox.offer('freed://guided-reset?app=com.twitter', 'event'), false);
  assert.equal(inbox.take(true), false);
  inbox.offer('freed://guided-reset', 'event'); now += 60_001;
  assert.equal(inbox.take(true), false, 'old manual hints cannot spring open after an unrelated login');
});

test('account changes explicitly discard a queued generic opener', () => {
  const inbox = createGuidedResetLinkInbox(() => 1000);
  inbox.offer('freed://guided-reset', 'event'); inbox.clear();
  assert.equal(inbox.take(true), false);
});

test('the owned HTTPS recovery route has exactly the same authority-free inbox behavior', () => {
  const url = 'https://freed-7d5ee.firebaseapp.com/intervention';
  assert.equal(isGuidedResetLink(url), true);
  for (const suffix of ['/', '?', '#', '?premium=true', '?nativeInterventionId=forged', '/elsewhere']) {
    assert.equal(isGuidedResetLink(url + suffix), false);
  }
  for (const bad of [url.replace('https:', 'http:'), url.replace('freed-7d5ee.', 'freed-7d5ee.attacker.'), url.replace('/intervention', ':443/intervention'), url.replace('https://', 'https://user@')]) assert.equal(isGuidedResetLink(bad), false);
  const inbox = createGuidedResetLinkInbox(() => 1000);
  assert.equal(inbox.offer(url, 'initial'), true);
  assert.equal(inbox.take(false), false);
  assert.equal(inbox.take(true), true);
  assert.equal(inbox.take(true), false);
  inbox.offer(url, 'event'); inbox.clear();
  assert.equal(inbox.take(true), false);
});
