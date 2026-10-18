const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { inspectNativeUnlockWiring } = require('../scripts/lib/native-unlock-safety-contract');
const surface = readFileSync('src/features/freed-app.tsx', 'utf8');
const confirmation = readFileSync('src/lib/native-unlock-confirmation.ts', 'utf8');
const safe = (a = surface, b = confirmation) => Object.values(inspectNativeUnlockWiring(a, b)).every(Boolean);
const legacyCall = 'applyEarnedUnlockWindow(requestedUnlock.expiresAt, requestedUnlock.sourceAttemptHost, requestedUnlock.nativeInterventionId)';
const branches = [
  { name: 'v2', start: '    if (groupScope && origin.earnedTime) {', end: '    if (groupScope) {',
    call: 'grantEarnedAppTimeBreak(request, actionScope, offer)', validator: 'validateEarnedAppTimeGrantReceipt',
    prepare: 'prepareLiveEarnedAppTimeGrant', request: 'earned.request', scope: 'earned.actionScope', receipt: 'earned.grantReceipt', binding: 'offer' },
  { name: 'v1', start: '    if (groupScope) {', end: '    // Retained nongroup legacy behavior',
    call: 'grantResetAppGroupBreak(request, actionScope)', validator: 'validateResetAppGroupRewardReceipt',
    prepare: 'prepareLiveResetGroupReward', request: 'origin.rewardRequest', scope: 'origin.rewardActionScope', receipt: 'origin.rewardReceipt', binding: 'request' },
];
function replaceExact(source, before, after) {
  assert.ok(source.includes(before), `Mutation must reach executable source: ${before}`);
  assert.notEqual(before, after);
  return source.replace(before, after);
}
function replaceBranch(branch, before, after) {
  const start = surface.indexOf(branch.start, surface.indexOf('const requestCompletedAppBreak ='));
  const end = surface.indexOf(branch.end, start + branch.start.length);
  assert.ok(start >= 0 && end > start, branch.name);
  return surface.slice(0, start) + replaceExact(surface.slice(start, end), before, after) + surface.slice(end);
}
function rejects(before, after, branch) {
  const changed = branch ? replaceBranch(branch, before, after) : replaceExact(surface, before, after);
  // Neither the old expression in a comment nor a string repairs removed executable wiring.
  assert.equal(safe(changed + '\n// ' + before.replace(/\n/g, '\n// ') + '\nconst auditLookalike = ' + JSON.stringify(before) + ';'), false, `${branch?.name ?? 'shared'}: ${before}`);
}

test('native grant source wiring requires all three actual paths and readonly restoration', () => assert.equal(safe(), true));
test('source audit rejects broken current truth, forged acknowledgment and ledger regrant', () => {
  for (const [before, after] of [
    ['@/lib/native-unlock-confirmation', './untrusted-confirmation'],
    ['getPresentedEarnedUnlock(recoveryState.earnedUnlocks, protectionStatus, Platform.OS', 'getPresentedEarnedUnlock(recoveryState.earnedUnlocks, savedSetting, Platform.OS'],
    [legacyCall, legacyCall.replace('requestedUnlock.nativeInterventionId', 'otherId')],
    ['if (!nativeGrantConfirmsUnlock(requestedUnlock, status, Platform.OS))', 'if (false)'],
    ['actionTicket.isCurrent() && challengeBreakOrigin.current === origin', 'true && challengeBreakOrigin.current === origin'],
    ['getCompletedBreakAttempt(sessionId, true) === completionAttempt', 'true'],
  ]) rejects(before, after);
  const grant = surface.indexOf('if (!nativeGrantConfirmsUnlock(requestedUnlock, status, Platform.OS))');
  const write = surface.indexOf('persistRecoveryState(state => {', grant);
  assert.ok(write > grant);
  assert.equal(safe(surface.slice(0, grant) + 'persistRecoveryState(state => state);\n' + surface.slice(grant)), false, 'No durable grant before native acknowledgement');
  for (const [before, after] of [
    ['origin.ownerUid !== journeyOwner', 'false'],
    ['origin.sessionId !== sessionId', 'false'],
    ['receipt.ownerId !== journeyOwner', 'false'],
    ['receipt.phase !== "completed"', 'false'],
    ['!origin?.saved', 'false'],
    ['origin.attempt?.nativeInterventionId !== currentAttempt?.nativeInterventionId', 'false'],
    ['JSON.stringify(origin.attempt?.scope) !== JSON.stringify(currentAttempt?.scope)', 'false'],
    ['entry.sessionId === sessionId && entry.completedAt === new Date(receipt.completion!.completedAtMs).toISOString()', 'true'],
  ]) rejects(before, after);
  assert.equal(safe(surface + '\ngetActiveNativeEarnedUnlock(recoveryState.earnedUnlocks, Platform.OS);'), false);
  assert.equal(safe(surface + '\nactiveNativeUnlock.nativeInterventionId;'), false);
  for (const [before, after] of [
    ['evidence?.nativeUnlockGrantAccepted === true', 'true'],
    ['sanitizeNativeInterventionId(evidence.nativeUnlockGrantInterventionId) === id', 'true'],
    ['nativeWindowMatchesUnlock(unlock, evidence, platform, nowMs)', 'true'],
  ]) assert.equal(safe(surface, replaceExact(confirmation, before, after) + '\n// ' + before + '\nconst lookalike = ' + JSON.stringify(before) + ';'), false, before);
});
test('completed native request rejects counterfeit legacy target, expiry, scope origin and argument widening', () => {
  for (const after of [
    legacyCall.replace('requestedUnlock.expiresAt', 'otherExpiry'),
    legacyCall.replace('requestedUnlock.sourceAttemptHost', 'arbitraryHost'),
    legacyCall.replace(', requestedUnlock.nativeInterventionId)', ', requestedUnlock.nativeInterventionId, arbitraryAuthority)'),
  ]) rejects(legacyCall, after);
  rejects('? completionAttempt.scope : null', '? currentAttempt.scope : null');
  const focusCall = 'applyFocusShieldEarnedUnlock(requestedUnlock.expiresAt, completionAttempt.scope, requestedUnlock.nativeInterventionId)';
  rejects(focusCall, focusCall.replace('completionAttempt.scope', 'currentAttempt.scope'));
  rejects('!requestedUnlock || !requiresNativeUnlockConfirmation(requestedUnlock, Platform.OS)', '!requestedUnlock');
  rejects('const requestedUnlock = staged.earnedUnlocks.find(unlock => !current.earnedUnlocks.some(existing => existing.id === unlock.id))', 'const requestedUnlock = current.earnedUnlocks[0]');
  const legacyCurrent = '      if (!isCurrent()) return false;\n      setProtectionStatus(status);';
  rejects(legacyCurrent, legacyCurrent.replace('!isCurrent()', 'false'));
});
for (const branch of branches) {
  test(`${branch.name} group requests bind native arguments, original owner, live completion and current scope`, () => {
    for (const after of [
      branch.call.replace('(request,', '(otherRequest,'),
      branch.call.replace('actionScope', 'otherScope'),
      branch.call.replace(/\)$/, ', arbitraryAuthority)'),
      legacyCall,
    ]) rejects(branch.call, after, branch);
    if (branch.name === 'v2') rejects(branch.call, branch.call.replace('offer)', 'otherOffer)'), branch);
    for (const [before, after] of [
      ['owner: completionOwner', 'owner: otherOwner'],
      ['session: receipt', 'session: restoredReceipt'],
      ['currentAttempt: activeAttemptRef.current', 'currentAttempt: otherAttempt'],
      ['durableHistory: recoveryStateRef.current.challengeHistory', 'durableHistory: []'],
      ['!local.eligible', 'false'],
      [`${branch.scope} !== undefined && ${branch.scope} !== actionScope`, 'false'],
      [`binding.generation !== ${branch.binding}.configurationGeneration`, 'false'],
      [`binding.scopeEpoch !== ${branch.binding}.scopeEpoch`, 'false'],
    ]) rejects(before, after, branch);
  });
  test(`${branch.name} group grants require exact current receipt and retain restrictions from overlapping guards`, () => {
    const validation = `${branch.validator}(await ${branch.call}, request${branch.name === 'v2' ? ', offer' : ''})`;
    for (const after of [
      `await ${branch.call}`,
      validation.replace(', request', ', otherRequest'),
      '({ accepted: true, effective: true, expiresAt: new Date().toISOString() })',
    ]) rejects(validation, after, branch);
    if (branch.name === 'v2') rejects(validation, validation.replace(', request, offer)', ', request, otherOffer)'), branch);
    for (const [before, after] of [
      ['if (!native?.accepted)', 'if (false)'],
      ['if (!native.effective)', 'if (false)'],
      ['if (Date.parse(native.expiresAt!) <= Date.now())', 'if (false)'],
      [`${branch.receipt} = Object.freeze(native)`, `${branch.receipt} = Object.freeze(otherReceipt)`],
      [`const native = ${validation};\n        if (!isCurrent()) return false;`, `const native = ${validation};`],
    ]) rejects(before, after, branch);
    rejects(`const native = ${validation};`, `${branch.receipt} = Object.freeze({ accepted: true });\n        const native = ${validation};`, branch);
  });
  test(`${branch.name} retries reuse original immutable request and cannot fall through to legacy grant`, () => {
    rejects(`if (!${branch.request})`, 'if (true)', branch);
    rejects(`const request = ${branch.request}`, 'const request = local.request', branch);
    rejects(`${branch.request} = local.request`, `${branch.request} = { ...local.request, expiresAt: otherExpiry }`, branch);
    rejects(`${branch.scope} = actionScope`, `${branch.scope} = otherScope`, branch);
    rejects('return true;', '/* missing terminal return */', branch);
    rejects('} catch {', '} catch { await ' + legacyCall + ';', branch);
    rejects('setChallengeBreakNotice(appI18n.t(', 'persistRecoveryState(state => state); setChallengeBreakNotice(appI18n.t(', branch);
  });
}
test('comments and strings are not executable wiring or restoration authority', () => {
  assert.equal(safe(surface + '\n// getActiveNativeEarnedUnlock(recoveryState.earnedUnlocks, Platform.OS)\nconst harmless = "activeNativeUnlock.nativeInterventionId";'), true);
  rejects('getCompletedBreakAttempt(sessionId);', 'null; /* getCompletedBreakAttempt(sessionId) */');
  rejects('if (groupScope && origin.earnedTime)', 'if (false)');
  rejects('    if (groupScope) {', '    if (false) {');
});
