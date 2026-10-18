const ts = require('typescript');

// Supplemental wiring guard, not a substitute for controller/adapter execution or
// native device evidence. Inspect executable AST nodes so comments and strings
// cannot stand in for the gates or import bindings below.
function sourceModel(source) {
  const ast = ts.createSourceFile('controller.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const printer = ts.createPrinter({ removeComments: true });
  const code = node => node ? printer.printNode(ts.EmitHint.Unspecified, node, ast).replace(/\s+/g, '') : '';
  const same = (node, expected) => code(node) === expected.replace(/\s+/g, '');
  const find = (root, predicate) => {
    const results = [];
    const visit = node => { if (predicate(node)) results.push(node); ts.forEachChild(node, visit); };
    if (root) visit(root);
    return results;
  };
  const calls = (root, name) => find(root, node => ts.isCallExpression(node) && same(node.expression, name));
  const declaration = (root, name) => {
    const matches = find(root, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name);
    return matches.length === 1 ? matches[0] : undefined;
  };
  const fn = name => {
    const init = declaration(ast, name)?.initializer;
    return init && ts.isArrowFunction(init) && ts.isBlock(init.body) ? init : undefined;
  };
  const imported = (name, from) => ast.statements.some(node => ts.isImportDeclaration(node) &&
    ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === from &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some(binding => binding.name.text === name && (binding.propertyName?.text ?? name) === name));
  return { ast, valid: ast.parseDiagnostics.length === 0, code, same, find, calls, declaration, fn, imported };
}
const returns = (node, kind) => Boolean(node && ts.isReturnStatement(node) && node.expression?.kind === kind);
const returnsFalse = node => returns(ts.isBlock(node) ? node.statements.at(-1) : node, ts.SyntaxKind.FalseKeyword);
function directVariable(body, name) {
  return body?.statements.filter(ts.isVariableStatement).flatMap(node => [...node.declarationList.declarations])
    .find(node => ts.isIdentifier(node.name) && node.name.text === name);
}
function guardIndex(model, statements, condition) {
  return statements.findIndex(node => ts.isIfStatement(node) && model.same(node.expression, condition) && returnsFalse(node.thenStatement));
}
function assignmentIndex(model, statements, expression) {
  return statements.findIndex(node => ts.isExpressionStatement(node) && model.same(node.expression, expression));
}
function contains(parent, node) { return Boolean(parent && node && node.pos >= parent.pos && node.end <= parent.end); }

function inspectCompletedOrigin(model, request) {
  const origin = model.fn('getCompletedBreakAttempt');
  if (!origin || !request) return false;
  const guard = origin.body.statements.find(node => ts.isIfStatement(node) && returns(node.thenStatement, ts.SyntaxKind.NullKeyword));
  const expected = `!journeyOwner || getFirebaseAccountScope() !== journeyOwner || !origin?.saved || (!includeRequested && origin.breakRequested) ||
    origin.ownerUid !== journeyOwner || origin.sessionId !== sessionId || receipt?.id !== sessionId || receipt.ownerId !== journeyOwner || receipt.phase !== "completed" || !receipt.completion ||
    origin.attempt?.nativeInterventionId !== currentAttempt?.nativeInterventionId || JSON.stringify(origin.attempt?.scope) !== JSON.stringify(currentAttempt?.scope) ||
    !recoveryStateRef.current.challengeHistory.some(entry => entry.sessionId === sessionId && entry.completedAt === new Date(receipt.completion!.completedAtMs).toISOString()) ||
    !getProtectionChallengeCompletionDecision(origin.attempt, "unknown").grantEarnedUnlock`;
  return Boolean(guard && model.same(guard.expression, expected) &&
    model.same(directVariable(origin.body, 'receipt')?.initializer, 'challengeSession.getSnapshot().session') &&
    model.same(directVariable(origin.body, 'origin')?.initializer, 'challengeBreakOrigin.current') &&
    model.same(directVariable(origin.body, 'currentAttempt')?.initializer, 'activeAttemptRef.current') &&
    model.same(directVariable(request.body, 'completionAttempt')?.initializer, 'getCompletedBreakAttempt(sessionId)') &&
    model.same(directVariable(request.body, 'receipt')?.initializer, 'challengeSession.getSnapshot().session') &&
    model.same(directVariable(request.body, 'origin')?.initializer, 'challengeBreakOrigin.current') &&
    model.same(directVariable(request.body, 'completionOwner')?.initializer, 'journeyOwner') &&
    guardIndex(model, request.body.statements, '!completionAttempt || !receipt || !origin || !completionOwner || origin.breakInFlight') >= 0 &&
    model.same(directVariable(request.body, 'isCurrent')?.initializer,
      '() => actionTicket.isCurrent() && challengeBreakOrigin.current === origin && !accountFlowFence.current.isActive() && getCompletedBreakAttempt(sessionId, true) === completionAttempt'));
}

function inspectGroupBranch(model, branch, version) {
  if (!branch || !ts.isBlock(branch.thenStatement)) return false;
  const body = branch.thenStatement;
  const v2 = version === 2;
  const prepare = v2 ? 'prepareLiveEarnedAppTimeGrant' : 'prepareLiveResetGroupReward';
  const method = v2 ? 'isEarnedAppTimeAvailable' : 'isResetAppGroupRewardMethodAvailable';
  const requestRef = v2 ? 'earned.request' : 'origin.rewardRequest';
  const scopeRef = v2 ? 'earned.actionScope' : 'origin.rewardActionScope';
  const receiptRef = v2 ? 'earned.grantReceipt' : 'origin.rewardReceipt';
  const bindingRef = v2 ? 'offer' : 'request';
  const grant = v2 ? 'grantEarnedAppTimeBreak' : 'grantResetAppGroupBreak';
  const validator = v2 ? 'validateEarnedAppTimeGrantReceipt' : 'validateResetAppGroupRewardReceipt';
  if (!model.imported(prepare, v2 ? '@/lib/live-earned-app-time' : '@/lib/live-reset-reward') ||
    !model.imported(validator, v2 ? '../../modules/freed-protection/src/earned-app-time' : '../../modules/freed-protection/src/reset-app-group-reward')) return false;
  if (v2 && (!model.same(directVariable(body, 'earned')?.initializer, 'origin.earnedTime') ||
    !model.same(directVariable(body, 'offer')?.initializer, 'earned.receipt.offer'))) return false;
  const local = directVariable(body, 'local');
  if (!model.same(local?.initializer, `${prepare}({ origin, session: receipt, owner: completionOwner, ownerLease: appConfigReadScope.current.ownerLease,
    storageReady: appConfigReadScope.current.hydrated && appConfigReadScope.current.storageReady, currentAttempt: activeAttemptRef.current,
    durableHistory: recoveryStateRef.current.challengeHistory, methodAvailable: ${method}() })`)) return false;
  const eligibility = guardIndex(model, body.statements, `${v2 ? '!offer || ' : ''}!local.eligible || (${scopeRef} !== undefined && ${scopeRef} !== actionScope)`);
  const retain = body.statements.findIndex(node => ts.isIfStatement(node) && model.same(node.expression, `!${requestRef}`) &&
    ts.isBlock(node.thenStatement) && node.thenStatement.statements.length === 2 && !node.elseStatement &&
    assignmentIndex(model, node.thenStatement.statements, `${requestRef} = local.request`) === 0 &&
    assignmentIndex(model, node.thenStatement.statements, `${scopeRef} = actionScope`) === 1);
  const request = directVariable(body, 'request');
  const requestWrites = model.find(body, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && model.same(node.left, requestRef));
  if (eligibility < 0 || retain <= eligibility || requestWrites.length !== 1 || !model.same(request?.initializer, requestRef) || request.pos <= body.statements[retain].pos) return false;
  // All routes in either group branch terminate, including failed requests. A
  // missing return must never feed the legacy nongroup grant below this branch.
  const attempt = body.statements.at(-1);
  if (!attempt || !ts.isTryStatement(attempt) || !attempt.catchClause || !returnsFalse(attempt.catchClause.block) ||
    !returns(attempt.tryBlock.statements.at(-1), ts.SyntaxKind.TrueKeyword) ||
    model.find(attempt.finallyBlock, ts.isReturnStatement).length || model.calls(body, 'persistRecoveryState').length ||
    model.calls(body, 'applyEarnedUnlockWindow').length || model.calls(body, 'applyFocusShieldEarnedUnlock').length) return false;
  const statements = attempt.tryBlock.statements;
  const native = directVariable(attempt.tryBlock, 'native');
  const nativeIndex = statements.findIndex(node => contains(node, native));
  const validation = `${validator}(await ${grant}(request, actionScope${v2 ? ', offer' : ''}), request${v2 ? ', offer' : ''})`;
  const bindIndex = guardIndex(model, statements, `!isAppGroupBindingConfirmed(binding) || binding.generation !== ${bindingRef}.configurationGeneration || binding.scopeEpoch !== ${bindingRef}.scopeEpoch`);
  const acceptedIndex = guardIndex(model, statements, '!native?.accepted');
  const recordIndex = assignmentIndex(model, statements, `${receiptRef} = Object.freeze(native)`);
  const requestedIndex = assignmentIndex(model, statements, 'origin.breakRequested = true');
  const expiryIndex = guardIndex(model, statements, 'Date.parse(native.expiresAt!) <= Date.now()');
  const effectiveIndex = guardIndex(model, statements, '!native.effective');
  const receiptWrites = model.find(body, node => ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && model.same(node.left, receiptRef));
  return Boolean(model.same(directVariable(attempt.tryBlock, 'binding')?.initializer, 'await setAppGroupActionScope(actionScope)') &&
    guardIndex(model, statements, '!isCurrent()') > 0 && bindIndex > guardIndex(model, statements, '!isCurrent()') && nativeIndex > bindIndex &&
    model.same(native?.initializer, validation) && model.calls(body, grant).length === 1 && model.calls(body, validator).length === 1 &&
    guardIndex(model, statements.slice(nativeIndex + 1, acceptedIndex), '!isCurrent()') >= 0 && acceptedIndex > nativeIndex &&
    receiptWrites.length === 1 && recordIndex > acceptedIndex && requestedIndex > recordIndex && expiryIndex > requestedIndex && effectiveIndex > expiryIndex &&
    statements.slice(0, effectiveIndex).every(node => !returns(node, ts.SyntaxKind.TrueKeyword)));
}

function inspectLegacyRequest(model, request, groupBranches) {
  if (!request) return { bound: false, deferred: false };
  const body = request.body;
  const attempt = body.statements.find(ts.isTryStatement);
  const groupScope = directVariable(body, 'groupScope');
  const groupOrder = groupBranches.every(branch => branch && body.statements.indexOf(branch) < body.statements.indexOf(attempt)) &&
    body.statements.indexOf(groupBranches[0]) < body.statements.indexOf(groupBranches[1]);
  const status = directVariable(attempt?.tryBlock, 'status');
  const staged = directVariable(body, 'staged');
  const requested = directVariable(body, 'requestedUnlock');
  const bound = Boolean(attempt && groupOrder &&
    model.same(groupScope?.initializer, "completionAttempt.scope?.kind === 'android-app-group' || completionAttempt.scope?.kind === 'ios-app-group' ? completionAttempt.scope : null") &&
    model.same(directVariable(body, 'actionScope')?.initializer, 'getProtectionActionScope()') &&
    guardIndex(model, body.statements, 'actionScope === null') >= 0 &&
    model.same(directVariable(body, 'actionTicket')?.initializer, 'captureProtectionActionTicket(actionScope)') &&
    model.same(staged?.initializer, `recordEarnedUnlock(current, receipt.challenge, {
      startedAt: canonicalAppBreakStartedAt(new Date().toISOString(), Platform.OS), durationMinutes: current.disciplineSettings.unlockDurationMinutes,
      nativeInterventionId: completionAttempt.nativeInterventionId,
      sourceAttemptHost: completionAttempt.scope?.kind === "android-surface" ? undefined : unlockSourceForAttempt(completionAttempt) })`) &&
    model.same(requested?.initializer, 'staged.earnedUnlocks.find(unlock => !current.earnedUnlocks.some(existing => existing.id === unlock.id))') &&
    guardIndex(model, body.statements, '!requestedUnlock || !requiresNativeUnlockConfirmation(requestedUnlock, Platform.OS)') >= 0 &&
    model.same(status?.initializer, `completionDecision.applyFocusShieldScope && completionAttempt.scope?.kind === "android-surface"
      ? await applyFocusShieldEarnedUnlock(requestedUnlock.expiresAt, completionAttempt.scope, requestedUnlock.nativeInterventionId)
      : await applyEarnedUnlockWindow(requestedUnlock.expiresAt, requestedUnlock.sourceAttemptHost, requestedUnlock.nativeInterventionId)`));
  if (!attempt) return { bound, deferred: false };
  const statements = attempt.tryBlock.statements;
  const statusIndex = statements.findIndex(node => contains(node, status));
  const current = guardIndex(model, statements, '!isCurrent()');
  const grant = guardIndex(model, statements, '!nativeGrantConfirmsUnlock(requestedUnlock, status, Platform.OS)');
  const writes = model.calls(body, 'persistRecoveryState');
  const writeIndex = statements.findIndex(node => contains(node, writes[0]));
  const durable = writes[0]?.arguments[0];
  const durableGuard = durable && ts.isArrowFunction(durable) && ts.isBlock(durable.body) ? durable.body.statements[0] : null;
  const deferred = Boolean(statusIndex >= 0 && current > statusIndex && grant > current && writes.length === 1 && writeIndex > grant &&
    durableGuard && ts.isIfStatement(durableGuard) && model.same(durableGuard.expression,
      '!state.challengeHistory.some(entry => entry.sessionId === sessionId) || state.earnedUnlocks.some(unlock => unlock.id === requestedUnlock.id) || Date.parse(requestedUnlock.expiresAt) <= Date.now()') &&
    model.same(durableGuard.thenStatement, 'return state;') && model.same(durable.body.statements.at(-1),
      'return recordEarnedUnlock(state, receipt.challenge, { startedAt: requestedUnlock.startedAt, durationMinutes: requestedUnlock.durationMinutes, sourceAttemptHost: requestedUnlock.sourceAttemptHost, nativeInterventionId: requestedUnlock.nativeInterventionId });'));
  return { bound, deferred };
}

function inspectNativeUnlockWiring(surface, confirmation) {
  const model = sourceModel(surface);
  const request = model.fn('requestCompletedAppBreak');
  const statements = request?.body.statements ?? [];
  const v2 = statements.find(node => ts.isIfStatement(node) && model.same(node.expression, 'groupScope && origin.earnedTime'));
  const v1 = statements.find(node => ts.isIfStatement(node) && model.same(node.expression, 'groupScope'));
  const groupAcknowledgment = model.valid && inspectGroupBranch(model, v2, 2) && inspectGroupBranch(model, v1, 1);
  const legacy = inspectLegacyRequest(model, request, [v2, v1]);
  const confirm = sourceModel(confirmation);
  const acknowledgments = confirm.find(confirm.ast, node => ts.isFunctionDeclaration(node) && node.name?.text === 'nativeGrantConfirmsUnlock');
  const acknowledgment = acknowledgments.length === 1 ? acknowledgments[0] : null;
  const strictAcknowledgment = confirm.valid && confirm.same(acknowledgment?.body?.statements.at(-1),
    'return Boolean(id && evidence?.nativeUnlockGrantAccepted === true && sanitizeNativeInterventionId(evidence.nativeUnlockGrantInterventionId) === id && nativeWindowMatchesUnlock(unlock, evidence, platform, nowMs));');
  const grantNames = ['grantEarnedAppTimeBreak', 'grantResetAppGroupBreak', 'applyEarnedUnlockWindow', 'applyFocusShieldEarnedUnlock'];
  const onlyLiveGrants = grantNames.every(name => {
    const calls = model.calls(model.ast, name);
    return calls.length === 1 && contains(request, calls[0]);
  });
  return {
    trustedProjection: model.valid && ['getPresentedEarnedUnlock', 'nativeGrantConfirmsUnlock'].every(name => model.imported(name, '@/lib/native-unlock-confirmation')),
    currentNativeEvidence: model.valid && model.calls(model.ast, 'getPresentedEarnedUnlock').some(call => model.same(call, 'getPresentedEarnedUnlock(recoveryState.earnedUnlocks, protectionStatus, Platform.OS, unlockClockMs)')),
    completionBoundRequest: model.valid && legacy.bound && groupAcknowledgment && onlyLiveGrants,
    groupAcknowledgment: Boolean(groupAcknowledgment),
    deferredNativeRecord: model.valid && legacy.deferred,
    completedOriginBound: model.valid && inspectCompletedOrigin(model, request),
    strictAcknowledgment: Boolean(strictAcknowledgment),
    restorationDoesNotGrant: model.valid && onlyLiveGrants && !model.calls(model.ast, 'getActiveNativeEarnedUnlock').some(call => model.same(call.arguments[0], 'recoveryState.earnedUnlocks')) &&
      !model.find(model.ast, node => ts.isPropertyAccessExpression(node) && model.same(node, 'activeNativeUnlock.nativeInterventionId')).length,
  };
}
module.exports = { inspectNativeUnlockWiring };
