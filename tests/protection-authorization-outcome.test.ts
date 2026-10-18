import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isProtectionSetupStatusObserved, normalizeProtectionAuthorization } from '../src/lib/protection-authorization-outcome';

test('only an explicit or legacy consistent grant can continue authorization', () => {
  assert.deepEqual(normalizeProtectionAuthorization({ authorized: true, authorizationOutcome: 'granted' }), { authorized: true, outcome: 'granted' });
  assert.deepEqual(normalizeProtectionAuthorization({ authorized: true }), { authorized: true, outcome: 'granted' });
  for (const outcome of ['denied', 'cancelled', 'error', 'unsupported']) {
    assert.deepEqual(normalizeProtectionAuthorization({ authorized: true, authorizationOutcome: outcome }), { authorized: false, outcome });
    assert.deepEqual(normalizeProtectionAuthorization({ authorizationOutcome: outcome, statusReadAccepted: false }), { authorized: false, outcome });
  }
  for (const value of [null, undefined, [], false, {}, { authorized: false }, { authorized: false, authorizationOutcome: 'granted' }, { authorized: true, authorizationOutcome: 'private arbitrary outcome' }]) {
    assert.deepEqual(normalizeProtectionAuthorization(value), { authorized: false, outcome: 'unconfirmed' });
  }
});

test('native authorization diagnostics retain only exact public integer pairs and strip all native text', () => {
  const payload = { authorized: false, authorizationOutcome: 'error', message: 'private account', localizedDescription: 'https://private.example', scope: 'private-scope' };
  const allowed: Array<[string, number]> = Array.from({ length: 9 }, (_, code) => ['FamilyControls.FamilyControlsError', code]);
  allowed.push(['NSCocoaErrorDomain', 3072], ['NSOSStatusErrorDomain', -128]);
  for (const [authorizationErrorDomain, authorizationErrorCode] of allowed) {
    assert.deepEqual(normalizeProtectionAuthorization({ ...payload, authorizationErrorDomain, authorizationErrorCode }), { authorized: false, outcome: 'error', authorizationErrorDomain, authorizationErrorCode });
  }
  for (const [authorizationErrorDomain, authorizationErrorCode] of [
    ['private-domain', 3], ['FamilyControls.FamilyControlsError', -1], ['FamilyControls.FamilyControlsError', 9],
    ['FamilyControls.FamilyControlsError', 3.1], ['FamilyControls.FamilyControlsError', '3'],
    ['NSCocoaErrorDomain', 3], ['NSOSStatusErrorDomain', 3072], ['NSOSStatusErrorDomain', Number.MAX_SAFE_INTEGER + 1],
  ]) {
    assert.deepEqual(normalizeProtectionAuthorization({ ...payload, authorizationErrorDomain, authorizationErrorCode }), { authorized: false, outcome: 'error' });
  }
});

test('required native status must be observed before setup can use permission or protection facts', () => {
  const status = { authorized: true, active: true, adultFilterActive: true, mode: 'screen-time', message: '' };
  assert.equal(isProtectionSetupStatusObserved(status), true);
  assert.equal(isProtectionSetupStatusObserved({ ...status, statusReadAccepted: true, statusVisibility: 'account' }), true);
  assert.equal(isProtectionSetupStatusObserved({ ...status, statusReadAccepted: true, statusVisibility: 'device' }), true);
  for (const value of [null, [], {}, { ...status, authorized: undefined }, { ...status, active: 'true' }, { ...status, message: null }, { ...status, mode: '' }, { ...status, adultFilterActive: 'true' }, { ...status, statusReadAccepted: false }, { ...status, statusReadError: 'native-status-read-failed' }, { ...status, statusVisibility: 'unknown' }]) {
    assert.equal(isProtectionSetupStatusObserved(value), false);
  }
});
