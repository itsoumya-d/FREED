const ts = require('typescript');
const parse = text => ts.createSourceFile('source.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function nodes(root, predicate) {
  const result = []; const visit = node => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); }; visit(root); return result;
}
function trustedImport(ast, name, module) {
  return ast.statements.some(node => ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === module && !node.importClause?.isTypeOnly && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => !item.isTypeOnly && item.name.text === name && (item.propertyName?.text ?? item.name.text) === name)) &&
    !nodes(ast, node => (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === name).length;
}
const callName = node => node && ts.isCallExpression(node) && ts.isIdentifier(node.expression) ? node.expression.text : null;
function inspectConfirmedNativeCleanup(controller, helper) {
  const ast = parse(controller), contract = parse(helper);
  if (ast.parseDiagnostics.length || contract.parseDiagnostics.length || !trustedImport(ast, 'afterConfirmedCleanup', '@/lib/confirmed-cleanup') || !trustedImport(ast, 'resetProtectionConfiguration', 'freed-protection') || !trustedImport(ast, 'Platform', 'react-native')) return false;
  const declaration = nodes(ast, n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'deleteLocalRecoveryData');
  if (declaration.length !== 1) return false;
  const initializer = declaration[0].initializer;
  if (!initializer || !ts.isCallExpression(initializer) || !ts.isPropertyAccessExpression(initializer.expression) || initializer.expression.getText() !== 'React.useCallback') return false;
  const callback = initializer.arguments[0];
  if (!callback || !ts.isArrowFunction(callback) || !ts.isBlock(callback.body)) return false;
  const [ownerCapture, operationCapture, finishCleanup] = callback.body.statements;
  if (callback.body.statements.length !== 3 ||
    compactNode(ownerCapture) !== compactText('const owner = trustedPrivateOwner(getFirebaseAuthSnapshot(), getFirebaseAccountScope());') ||
    compactNode(operationCapture) !== compactText('const operation = accountOperationGate.current.begin();') ||
    !trustedImport(ast, 'trustedPrivateOwner', '@/lib/trusted-private-owner') ||
    !ts.isReturnStatement(finishCleanup) || callName(finishCleanup.expression) !== 'afterConfirmedCleanup') return false;
  const [clear, erase] = finishCleanup.expression.arguments;
  if (finishCleanup.expression.arguments.length !== 2) return false;
  if (!clear || !erase || !ts.isArrowFunction(clear) || !ts.isBlock(clear.body) || !ts.isArrowFunction(erase)) return false;
  const destructive = new Set(['createDefaultRecoveryState', 'persistRecoveryState', 'purgeRecoveryDrafts', 'clearCompanionPresentationHistory', 'disableAutomaticBackup']);
  if (nodes(clear.body, ts.isCallExpression).some(call => destructive.has(callName(call)) || (ts.isPropertyAccessExpression(call.expression) && call.expression.name.text === 'abandon'))) return false;
  const status = nodes(clear.body, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ts.isAwaitExpression(node.initializer) && callName(node.initializer.expression) === 'resetProtectionConfiguration');
  if (status.length !== 1) return false;
  const returns = nodes(clear.body, ts.isReturnStatement);
  const strict = returns.some(node => node.expression && ts.isBinaryExpression(node.expression) && node.expression.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && ts.isPropertyAccessExpression(node.expression.left) && node.expression.left.getText() === `${status[0].name.text}.protectionConfigurationResetAccepted` && node.expression.right.kind === ts.SyntaxKind.TrueKeyword);
  if (!strict) return false;
  if (nodes(clear.body, ts.isCallExpression).filter(call => call.expression.getText() === 'operation.assertCurrent' && call.arguments.length === 0).length !== 3 ||
    !compactNode(clear.body).includes('awaitappConfigQueue.current?.whenIdle();operation.assertCurrent();') ||
    !compactNode(clear.body).includes('awaitresetProtectionConfiguration();operation.assertCurrent();')) return false;
  if (returns.some(node => !node.expression || (![
    `${status[0].name.text}.protectionConfigurationResetAccepted===true`, 'true', 'false',
  ].includes(compactNode(node.expression))))) return false;
  for (const node of returns.filter(n => n.expression?.kind === ts.SyntaxKind.TrueKeyword)) {
    const parent = node.parent;
    if (!ts.isIfStatement(parent) || parent.expression.getText().replace(/\s/g, '') !== "Platform.OS!=='ios'&&Platform.OS!=='android'") return false;
  }
  const eraseCalls = nodes(erase.body, ts.isCallExpression).map(callName);
  if (!eraseCalls.includes('createDefaultRecoveryState') || !eraseCalls.includes('persistRecoveryState')) return false;
  if (!compactNode(erase.body).includes('awaitdisableAutomaticBackup(owner??undefined);operation.assertCurrent();') ||
    !compactNode(erase.body).includes('awaitpurgeJournalOwner(createJournalRepository({storage:localStorage,ownerId:owner}),journalMedia);operation.assertCurrent();')) return false;
  const renderer = contract.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'afterConfirmedCleanup' && n.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword));
  const [guard, finish] = renderer?.body?.statements ?? [];
  return Boolean(renderer?.body?.statements.length === 2 && guard && ts.isIfStatement(guard) && guard.expression.getText().replace(/\s/g, '') === 'awaitclear()!==true' && ts.isThrowStatement(guard.thenStatement) && finish && ts.isReturnStatement(finish) && callName(finish.expression) === 'erase');
}
function syntheticQaIsDevOnlyOrRemoved(source) {
  const ast = parse(source); if (ast.parseDiagnostics.length) return false;
  const labels = nodes(ast, n => (ts.isStringLiteral(n) && n.text === 'Simulate adult attempt (QA)') || (ts.isJsxText(n) && n.text.trim() === 'Simulate adult attempt (QA)'));
  if (!labels.length) return true;
  const gate = nodes(ast, n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'showQaControls');
  if (gate.length !== 1 || gate[0].initializer?.getText().replace(/\s/g, '') !== 'typeof__DEV__!=="undefined"&&__DEV__') return false;
  return labels.every(label => {
    let current = label.parent;
    while (current) { if (ts.isConditionalExpression(current) && current.condition.getText() === 'showQaControls' && label.pos >= current.whenTrue.pos && label.end <= current.whenTrue.end) return true; current = current.parent; }
    return false;
  });
}
function inspectRevocationRecovery(source) {
  const ast = parse(source);
  if (ast.parseDiagnostics.length || !trustedImport(ast, 'clearProtectionActivation', '@/lib/recovery-state')) return false;
  const effects = nodes(ast, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.getText() === 'React.useEffect' && n.arguments[0] && ts.isArrowFunction(n.arguments[0]) && ts.isBlock(n.arguments[0].body));
  return effects.some(effect => {
    const body = effect.arguments[0].body;
    const calls = nodes(body, ts.isCallExpression);
    if (!calls.some(c => callName(c) === 'hasNativeProtectionActivationRevoked') || !calls.some(c => callName(c) === 'clearProtectionActivation')) return false;
    const refreshed = nodes(body, ts.isIfStatement).some(statement => ts.isPrefixUnaryExpression(statement.expression) && statement.expression.operator === ts.SyntaxKind.ExclamationToken && statement.expression.operand.getText() === 'protectionRefreshCompleted' && ts.isReturnStatement(statement.thenStatement));
    return refreshed && !calls.some(c => callName(c) === 'setScreen');
  });
}
function inspectNativeMonetizationDefaults(source) {
  const ast = parse(source);
  const fn = ast.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveMode');
  const [declaration, guard, finish] = fn?.body?.statements ?? [];
  const compact = n => n?.getText(ast).replace(/\s/g, '');
  return !ast.parseDiagnostics.length && fn?.body?.statements.length === 3 &&
    compact(declaration) === 'constrequestedMode=mode??(process.env.EXPO_PUBLIC_MONETIZATION_MODE==="mock"?"mock":"native");' &&
    ts.isIfStatement(guard) && compact(guard.expression) === 'requestedMode==="mock"&&(isProductionRuntime()||["production","internal-testflight"].includes(readEnv("EXPO_PUBLIC_BUILD_CHANNEL")??""))' &&
    ts.isReturnStatement(guard.thenStatement) && compact(guard.thenStatement.expression) === '"native"' &&
    ts.isReturnStatement(finish) && compact(finish.expression) === 'requestedMode';
}
function inspectSetupConfigurationCheck(source) {
  const ast = parse(source);
  const branch = nodes(ast, n => ts.isIfStatement(n) && n.expression.getText(ast).replace(/\s/g, '') === 'advance.action==="test"');
  if (ast.parseDiagnostics.length || branch.length !== 1 || !ts.isBlock(branch[0].thenStatement)) return false;
  const body = branch[0].thenStatement;
  const calls = nodes(body, ts.isCallExpression);
  return calls.some(c => callName(c) === 'runActivationTest' && c.arguments.length === 0) &&
    calls.some(c => callName(c) === 'setNotice' && c.arguments.length === 1 && ts.isStringLiteral(c.arguments[0]) && c.arguments[0].text === 'All required setup rows are ready. Running the local configuration check now.') &&
    !calls.some(c => ['recordBlockingAttempt', 'recordEarnedUnlock', 'markProtectionActivated'].includes(callName(c))) &&
    body.statements.some(n => ts.isExpressionStatement(n) && n.expression.getText(ast).replace(/\s/g, '') === 'setupAutoAdvanceRef.current={fromStepId:completedStep.id,testTriggered:true}') &&
    ts.isReturnStatement(body.statements.at(-1));
}
// Compare executable AST nodes, never comment or string substrings. Contracts deliberately
// follow the current small guarded flow; source changes require a new mutation receipt.
const compactNode = node => node?.getText().replace(/\s/g, '');
const compactText = text => text.replace(/\s/g, '');
const syntax = (root, text) => nodes(root, node => compactNode(node) === compactText(text)).length === 1;
const allSyntax = (root, texts) => texts.every(text => syntax(root, text));
function namedFunction(ast, name) {
  const matches = nodes(ast, n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  return matches.length === 1 ? matches[0] : null;
}
function namedArrow(root, name) {
  const matches = nodes(root, n => ts.isVariableDeclaration(n) && n.name.getText() === name && n.initializer && ts.isArrowFunction(n.initializer));
  return matches.length === 1 ? matches[0].initializer : null;
}
function namedPropertyArrow(root, name) {
  const matches = nodes(root, n => ts.isPropertyAssignment(n) && n.name.getText() === name && ts.isArrowFunction(n.initializer));
  return matches.length === 1 ? matches[0].initializer : null;
}
// Scope the value chain to the actual bridge/adapter return methods. A correct
// unused declaration elsewhere must never authorize a fabricated returned reward.
function inspectSdkRewardReturn(runtime, adapter) {
  const bridge = namedFunction(runtime, 'adMobBridgeFromModule');
  const adapterFn = namedFunction(adapter, 'createAdMobRewardedAdapter');
  const show = bridge && namedPropertyArrow(bridge, 'showRewardedAd');
  const complete = adapterFn && namedPropertyArrow(adapterFn, 'completeSession');
  const settle = show && namedArrow(show, 'settle');
  if (!show || !complete || !settle || !ts.isBlock(show.body) || !ts.isBlock(complete.body)) return false;
  if (compactNode(settle.body) !== compactText(`{
    if (settled) return;
    settled = true;
    if (timeout !== undefined) clearTimeout(timeout);
    const accepted = rewardGranted && isEligible();
    entry.presented = false;
    lifecycle?.onDismissed();
    resolve({ rewardGranted: accepted, message });
  }`)) return false;
  const resolved = nodes(show, n => callName(n) === 'resolve');
  const promises = show.body.statements.filter(n => ts.isReturnStatement(n) && n.expression && ts.isNewExpression(n.expression) && n.expression.expression.getText() === 'Promise');
  if (resolved.length !== 1 || promises.length !== 1 || settle.pos < promises[0].pos || settle.end > promises[0].end || promises[0] !== show.body.statements.at(-1)) return false;
  const tryStatement = complete.body.statements.find(ts.isTryStatement);
  if (!tryStatement || complete.body.statements.length !== 3 || compactNode(complete.body.statements[0]) !== 'constad=activeAds.get(session.id);' || !allSyntax(tryStatement.tryBlock, [
    'const result = await bridge.showRewardedAd(ad, session, config, isEligible, lifecycle);',
    'const rewardGranted = typeof result === "boolean" ? result : result.rewardGranted;',
  ])) return false;
  const returned = tryStatement.tryBlock.statements.at(-1);
  if (!returned || !ts.isReturnStatement(returned) || !ts.isObjectLiteralExpression(returned.expression)) return false;
  const fields = returned.expression.properties;
  const reward = fields.find(n => n.name?.getText() === 'rewardGranted');
  return nodes(tryStatement.tryBlock, ts.isReturnStatement).length === 1 && reward && ts.isShorthandPropertyAssignment(reward) &&
    syntax(returned.expression, 'status: rewardGranted ? "completed" : "failed"') && syntax(returned.expression, 'provider: "native"') &&
    syntax(complete.body.statements[1], 'rewardGranted: false') &&
    nodes(complete, n => ts.isVariableDeclaration(n) && n.name.getText() === 'rewardGranted').length === 1;
}
function inspectGuidedAuthority(ast, hook, access, accessCall) {
  if (!['getFirebaseCallableContracts', 'getFirebaseAccountScope'].every(name => trustedImport(ast, name, '@/lib/firebase-native')) ||
    !['sanitizePremiumEntitlement', 'hasVerifiedPremium'].every(name => trustedImport(ast, name, '@/lib/premium-entitlement')) ||
    !trustedImport(ast, 'hasReviewAccess', '@/lib/review-access')) return false;
  const args = accessCall.arguments;
  if (args.length !== 7 || compactNode(args[3]) !== compactText('screen === "ad" || screen === "challenge" || screen === "intercept" || (screen === "feature" && guidedRouteFeature === "guided-reset")') ||
    compactNode(args[4]) !== compactText('`${activeAttempt?.nativeInterventionId ?? activeAttempt?.detectedAt ?? "manual"}:${activeAttempt?.source ?? "manual"}:${JSON.stringify(activeAttempt?.scope ?? null)}:${selectedChallenge?.id ?? "recommended"}:${guidedRouteFeature ?? "none"}`')) return false;
  const refresh = namedArrow(ast, 'refreshGuidedEligibility');
  if (!refresh || compactNode(refresh.body) !== compactText(`{
    const owner = journeyOwner;
    if (!owner || getFirebaseAccountScope() !== owner || !isCurrent()) return "unknown";
    const contracts = await getFirebaseCallableContracts({ ensureGuest: false });
    if (!contracts || !isCurrent()) return "unknown";
    const [membership, review] = await Promise.all([contracts.getPremiumEntitlement(), reviewAccess.refresh()]);
    if (!isCurrent() || getFirebaseAccountScope() !== owner || review?.ownerUid !== owner) return "unknown";
    const evidence = sanitizePremiumEntitlement(membership.entitlement);
    if (membership.entitlement !== null && !evidence) return "unknown";
    const paid = hasVerifiedPremium(evidence, Date.now());
    const inactive = !evidence || evidence.status !== "verified" || (evidence.expiresAt !== null && Date.parse(evidence.expiresAt) <= Date.now());
    if (!paid && !inactive) return "unknown";
    setRecoveryState(current => setVerifiedPremiumEntitlement(current, evidence ? { ...evidence, ownerUid: owner } : null));
    setJourneyMembership({ ownerUid: owner, status: paid ? "verified-premium" : "free" });
    return hasReviewAccess(review, owner, Date.now()) ? "review" : paid ? "paid" : "free";
  }`)) return false;
  const hookFn = namedFunction(hook, 'useGuidedResetAccess');
  const controllerCalls = hookFn && nodes(hookFn, n => callName(n) === 'createGuidedResetAccessController');
  const options = controllerCalls?.[0]?.arguments[0];
  if (!options || !ts.isObjectLiteralExpression(options) || options.properties.map(n => ts.isSpreadAssignment(n) ? 'authority-spread' : n.name.getText()).join(',') !== 'ownerUid,storage,currentOwner,currentTier,requestContext,isChecking,authority-spread,isForeground,now,createId,createReward,completeReward') return false;
  if (!hookFn || controllerCalls.length !== 1 || !allSyntax(options, [
    '...(authority ? { refreshEligibility: (isCurrent: () => boolean) => live.current.authority!.refreshEligibility(isCurrent) } : {})',
    'isChecking: () => live.current.authority?.isChecking?.() ?? false',
  ]) || !allSyntax(hookFn, [
    'const live = React.useRef({ ownerUid, tier, active, contextKey, recheckTier, authority });',
    'live.current = { ownerUid, tier, active, contextKey, recheckTier, authority };',
  ])) return false;
  const controller = namedFunction(access, 'createGuidedResetAccessController');
  const watch = controller && nodes(controller, n => ts.isMethodDeclaration(n) && n.name.getText() === 'watch')[0];
  if (!watch || !allSyntax(access, ['export const GUIDED_AD_FRESHNESS_MS = 30000;', 'export const GUIDED_PREFLIGHT_TIMEOUT_MS = 8000;'])) return false;
  const preflight = nodes(watch, n => ts.isIfStatement(n) && n.expression.getText() === 'o.refreshEligibility');
  if (preflight.length !== 1 || !allSyntax(preflight[0], [
    'freshUntil = o.now() + GUIDED_AD_FRESHNESS_MS;',
    "if (!current() || !o.isForeground()) return 'denied' as const;",
  ])) return false;
  const assignment = nodes(watch, n => ts.isBinaryExpression(n) && n.left.getText() === 'freshUntil' && n.operatorToken.kind === ts.SyntaxKind.EqualsToken);
  return assignment.length === 1 && syntax(watch, 'let freshUntil = o.refreshEligibility ? 0 : Infinity;') &&
    preflight[0].end <= nodes(watch, n => compactNode(n) === compactText("if (!eligible()) return 'denied' as const;"))[0]?.pos;
}
function inspectRewardedResetChoice(source, sources = {}) {
  const ast = parse(source);
  let liveSource = sources.live;
  if (typeof liveSource !== 'string') { try { liveSource = require('node:fs').readFileSync('src/lib/live-earned-app-time.ts', 'utf8'); } catch { return false; } }
  const live = parse(liveSource);
  const offer = parse(sources.offer ?? ''), hook = parse(sources.hook ?? ''), access = parse(sources.access ?? ''), runtime = parse(sources.runtime ?? ''), adapter = parse(sources.adapter ?? ''), monetization = parse(sources.monetization ?? '');
  if ([ast, offer, hook, access, runtime, adapter, monetization, live].some(tree => tree.parseDiagnostics.length)) return false;
  if (!trustedImport(ast, 'GuidedResetOffer', '@/components/GuidedResetOffer') || !trustedImport(ast, 'useGuidedResetAccess', '@/hooks/useGuidedResetAccess') ||
    !trustedImport(hook, 'createGuidedResetAccessController', '../lib/guided-reset-access') ||
    !trustedImport(hook, 'getFirebaseAccountScope', '../lib/firebase-native') ||
    !['createRewardedResetSession', 'completeRewardedResetSession'].every(name => trustedImport(hook, name, '../lib/monetization'))) return false;
  const offers = nodes(ast, node => ts.isJsxSelfClosingElement(node) && node.tagName.getText() === 'GuidedResetOffer');
  if (offers.length !== 1) return false;
  const attrs = offers[0].attributes;
  if (!allSyntax(attrs, [
    `onWatch={() => { void (async () => {
          if (!await recheckEarnedOffer()) return;
          const selectedOffer = needsEarnedOffer ? earnedOffer.current() : null;
          if (needsEarnedOffer && !selectedOffer) return;
          const offerEligible = () => !selectedOffer || (earnedOffer.isBound(selectedOffer) && isEarnedOfferAdFeasible(selectedOffer.receipt, Date.now()));
          if (await guidedAccess.watch(offerEligible)) reveal(selectedOffer ?? undefined);
        })(); }}`,
    'onRepair={() => { if (guidedAccess.repair()) reveal(); else { retryAccess(); reviewAccess.retry(); } }}',
    'onStart={() => { void (async () => { if (!await recheckEarnedOffer(false)) return; if (sessionAllowed || canChoose || accessSession?.phase === "completed" || guidedAccess.startLicensed()) reveal(); })(); }}',
    'onSafety={abandonActiveProtectionFlow}',
    'onHelp={() => { guidedAccess.invalidate(); if (activeAttempt) { setBasicHelpContext(helpContext); setScreen("intercept"); } else setScreen("breathing"); }}',
  ])) return false;
  const reveal = namedArrow(ast, 'reveal');
  if (!reveal || !syntax(reveal.body, 'if (accessSession?.phase !== "completed" && !guidedAccess.canEnter()) return;')) return false;
  // The selected original offer remains part of the actual SDK eligibility closure.
  // Presentation preserves a genuine guided reward, not authority to start an expired app break.
  if (!trustedImport(ast, 'isEarnedOfferAdFeasible', '@/lib/live-earned-app-time') ||
    !trustedImport(ast, 'recoverEarnedTimeReference', '@/lib/earned-time-reference') ||
    !['getEarnedAppTimeGrant', 'prepareEarnedAppTimeOffer', 'setAppGroupActionScope'].every(name => trustedImport(ast, name, 'freed-protection'))) return false;
  const recheck = namedArrow(ast, 'recheckEarnedOffer');
  if (!recheck || recheck.parameters.length !== 1 || recheck.parameters[0].name.getText() !== 'beforeAd' || recheck.parameters[0].initializer?.kind !== ts.SyntaxKind.TrueKeyword || !allSyntax(recheck, [
    'if (!needsEarnedOffer) return true;', 'if (!earnedOffer.seconds) return false;',
    'await earnedOffer.select(earnedOffer.seconds);', 'const selection = earnedOffer.current();',
    'const feasible = Boolean(selection && isEarnedOfferAdFeasible(selection.receipt, Date.now(), beforeAd ? undefined : 0));',
    'return feasible;',
  ]) || !allSyntax(reveal, [
    'const selectedOffer = earnedAppOrigin && !accessSession ? earnedOffer.current() ?? (presentedOffer && earnedOffer.isBound(presentedOffer) ? presentedOffer : null) : null;',
    'if (earnedAppOrigin && !accessSession && !selectedOffer && !challengeBreakOrigin.current?.earnedTime) return;',
  ])) return false;
  const feasible = namedFunction(live, 'isEarnedOfferAdFeasible');
  if (!syntax(live, 'export const EARNED_TIME_AD_HEADROOM_MS=150_000;') || !feasible || feasible.parameters[2]?.initializer?.getText() !== 'EARNED_TIME_AD_HEADROOM_MS' || !syntax(feasible,
    "return Boolean(receipt.accepted&&receipt.supported&&offer&&budget&&budget.clockState==='verified'&&budget.dayKey===offer.budgetDay&&budget.remainingSeconds>=offer.requestedSeconds&&Number.isFinite(now)&&Number.isFinite(headroomMs)&&headroomMs>=0&&Math.min(Date.parse(offer.validUntil),Date.parse(budget.nextResetAt))-now>offer.requiredActiveSeconds*1000+headroomMs);")) return false;
  const recoveryCalls = nodes(ast, n => callName(n) === 'recoverEarnedTimeReference');
  if (recoveryCalls.length !== 1 || !allSyntax(recoveryCalls[0], [
    'bind: setAppGroupActionScope', 'prepare: prepareEarnedAppTimeOffer', 'lookup: getEarnedAppTimeGrant',
  ])) return false;
  let recoveryEffect = recoveryCalls[0].parent;
  while (recoveryEffect && !(ts.isArrowFunction(recoveryEffect) && ts.isCallExpression(recoveryEffect.parent) && recoveryEffect.parent.expression.getText() === 'React.useEffect')) recoveryEffect = recoveryEffect.parent;
  if (!recoveryEffect || nodes(recoveryEffect, n => ts.isCallExpression(n) && ['grantEarnedAppTimeBreak', 'grantResetAppGroupBreak', 'applyEarnedUnlockWindow'].includes(n.expression.getText())).length) return false;
  const accessCall = nodes(ast, n => callName(n) === 'useGuidedResetAccess');
  if (accessCall.length !== 1 || accessCall[0].arguments[0]?.getText() !== 'journeyOwner' || !syntax(accessCall[0], '{ refreshEligibility: refreshGuidedEligibility, isChecking: () => membershipSnapshot.status === "checking" }') || !syntax(accessCall[0], 'resolveGuidedTier(owner, currentMembership, reviewAccess.snapshot, Date.now())')) return false;
  if (!inspectGuidedAuthority(ast, hook, access, accessCall[0]) || !inspectSdkRewardReturn(runtime, adapter)) return false;
  // Ads cannot move to an effect, lifecycle callback or timer, even if the original handler remains.
  const watchCalls = nodes(ast, n => ts.isCallExpression(n) && n.expression.getText() === 'guidedAccess.watch');
  if (watchCalls.length !== 1 || watchCalls[0].pos < attrs.pos || watchCalls[0].end > attrs.end) return false;
  const offerFn = namedFunction(offer, 'GuidedResetOffer');
  if (!offerFn || !allSyntax(offerFn, [
    "action('Back to safety', onSafety)", "action('Help now', onHelp)",
    "action('Retry saving access', onRepair, true, busy)", "action('Retry access check', onRetry, false, busy)",
  ])) return false;
  const adActions = nodes(offerFn, n => callName(n) === 'action' && n.arguments[1]?.getText() === 'onWatch');
  if (adActions.length !== 1) return false;
  let parent = adActions[0].parent, freeBranch = false;
  while (parent && parent !== offerFn) {
    if (ts.isConditionalExpression(parent) && compactNode(parent.condition) === "tier==='free'" && adActions[0].pos >= parent.whenTrue.pos && adActions[0].end <= parent.whenTrue.end) freeBranch = true;
    parent = parent.parent;
  }
  if (!freeBranch || nodes(offerFn, n => ts.isCallExpression(n) && ['onWatch', 'setInterval', 'setTimeout'].includes(callName(n))).length) return false;
  if (!allSyntax(hook, [
    'currentOwner: () => getFirebaseAccountScope() === live.current.ownerUid ? live.current.ownerUid : null',
    'currentTier: () => live.current.recheckTier?.() ?? live.current.tier',
    'requestContext: () => live.current.contextKey',
    "isForeground: () => live.current.active && AppState.currentState === 'active'",
    'createReward: () => createRewardedResetSession({ platform, premium: false })',
    'completeReward: (session, isEligible, lifecycle) => completeRewardedResetSession(session, { platform, isEligible, lifecycle })',
    'if (live.current.ownerUid !== ownerUid || currentController.current !== controller) return false;',
    'const result = await controller.watch(offerEligible);',
    'if (!active) { controller?.invalidate(); setRepairNeeded(false); setBusy(false); }',
    'React.useEffect(() => { controller?.invalidate(); setRepairNeeded(false); }, [contextKey, controller]);', 'controller?.dispose();',
  ])) return false;
  const hookWatch = namedArrow(hook, 'watch');
  if (!hookWatch || hookWatch.parameters.length !== 1 || hookWatch.parameters[0].name.getText() !== 'offerEligible' || !syntax(hookWatch, "return result === 'granted';")) return false;
  if (nodes(hook, n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression) && n.expression.expression.getText() === 'controller' && n.expression.name.text === 'watch').length !== 1 || nodes(hook, n => callName(n) === 'watch').length) return false;
  if (!['createAdMobRewardedAdapter', 'createNativeMonetizationAdapter'].every(name => trustedImport(runtime, name, '@/lib/native-monetization-adapter'))) return false;
  const sdkCalls = nodes(hook, n => ['createRewardedResetSession', 'completeRewardedResetSession'].includes(callName(n)));
  if (sdkCalls.length !== 2) return false;
  const controller = namedFunction(access, 'createGuidedResetAccessController');
  if (!controller || !allSyntax(controller, [
    'const owned = () => !disposed && o.currentOwner() === o.ownerUid;',
    'const key = GUIDED_ACCESS_STORAGE_PREFIX + encodeURIComponent(o.ownerUid);',
    'o.storage.setItem(key, JSON.stringify(value));', 'grant = value;',
    "if (!owned() || !hydrated || busy || grant || earned || !o.isForeground() || o.currentTier() !== 'free') return 'denied' as const;",
    'const request = ++generation;', 'const context = o.requestContext?.();',
    'const ownsRequest = () => owned() && request === generation && o.requestContext?.() === context;',
    "const current = () => ownsRequest() && (o.currentTier() === 'free' || (wasPresented && o.currentTier() === 'unknown'));",
    'const offerCurrent = () => { try { return offerEligible?.() !== false; } catch { return false; } };',
    'const eligible = () => current() && (o.isForeground() || presenting) && (presenting || o.now() < freshUntil) && (wasPresented || offerCurrent());',
    'o.refreshEligibility(ownsRequest)',
    "if (refreshed === 'paid' || refreshed === 'review') return 'access-changed' as const;",
    "if (refreshed === 'unknown') return 'eligibility-unavailable' as const;",
    "if (!eligible()) return 'denied' as const;", 'const session = o.createReward();',
    "if (session.provider !== 'native' || session.status !== 'ready') return 'unavailable' as const;",
    "if (!current() || (!o.isForeground() && !wasPresented)) return 'denied' as const;",
    "if (result.provider !== 'native' || result.status !== 'completed' || result.rewardGranted !== true) return 'unavailable' as const;",
    "earned = { access: make('reward'), request, context, awaitingSdkForeground: wasPresented && !o.isForeground(), presented: wasPresented };",
    'return repair();',
  ])) return false;
  const persist = namedArrow(controller, 'persist'), repair = namedArrow(controller, 'repair');
  if (!persist || compactNode(persist.body) !== '{o.storage.setItem(key,JSON.stringify(value));grant=value;}' || !repair || !allSyntax(repair, [
    "if (!owned() || !earned || earned.request !== generation || earned.context !== o.requestContext?.() || o.currentTier() === 'paid' || o.currentTier() === 'review' || (o.currentTier() === 'unknown' && !earned.presented)) { earned = null; return 'denied' as const; }",
    "if (!o.isForeground()) return 'pending-foreground' as const;",
    "if (o.currentTier() !== 'free') return 'pending-eligibility' as const;",
    "try { persist(earned.access); earned = null; return 'granted' as const; } catch { return 'save-failed' as const; }",
  ])) return false;
  const rewardCalls = nodes(controller, n => ts.isCallExpression(n) && ['o.createReward', 'o.completeReward'].includes(n.expression.getText()));
  const watch = nodes(controller, n => ts.isMethodDeclaration(n) && n.name.getText() === 'watch')[0];
  if (!watch || watch.parameters.length !== 1 || watch.parameters[0].name.getText() !== 'offerEligible' || rewardCalls.length !== 2 || !rewardCalls.every(call => call.pos >= watch.pos && call.end <= watch.end)) return false;
  const ordered = [
    'const session = o.createReward();',
    "if (session.provider !== 'native' || session.status !== 'ready') return 'unavailable' as const;",
    "if (!current() || (!o.isForeground() && !wasPresented)) return 'denied' as const;",
    "if (result.provider !== 'native' || result.status !== 'completed' || result.rewardGranted !== true) return 'unavailable' as const;",
    "earned = { access: make('reward'), request, context, awaitingSdkForeground: wasPresented && !o.isForeground(), presented: wasPresented };",
    'return repair();',
  ].map(text => nodes(watch, n => compactNode(n) === compactText(text))[0]);
  if (ordered.some((node, index) => !node || index > 0 && node.pos <= ordered[index - 1].pos) || rewardCalls[1].pos <= ordered[1].pos || rewardCalls[1].end >= ordered[2].pos) return false;
  if (nodes(runtime, n => ts.isBinaryExpression(n) && n.left.getText() === 'entry.rewardGranted' && n.operatorToken.kind === ts.SyntaxKind.EqualsToken).length !== 1) return false;
  // The only accepted reward originates in the SDK event after presentation and consent.
  return nodes(runtime, n => ts.isIfStatement(n) && compactNode(n.expression) === '!canRequestAds' && ts.isBlock(n.thenStatement) && n.thenStatement.statements.some(ts.isReturnStatement)).length === 1 && allSyntax(runtime, [
    'canRequestAds = consentInfo?.canRequestAds === true;', 'await initialize.call(instance);',
    'if (canRequestAds && isEligible()) entry.ad.load?.();',
    'const canRequestAds = await (entry.consentAllowsAds ?? prepareAds());',
    'requestNonPersonalizedAdsOnly: true',
    'entry.ad.addAdEventListener?.("rewarded_earned_reward", () => { if (entry.presented && isEligible()) entry.rewardGranted = true; })',
    'let canRequestAds = false;',
    'rewardedAds: rewardedAds ? createAdMobRewardedAdapter(rewardedAds) : undefined',
    'const rewardedAds = adMobBridgeFromModule(adMobModule);',
    'settle(entry.rewardGranted, entry.rewardGranted ? "Rewarded reset completed." : "Rewarded ad closed before completion.");',
    'timeout = setTimeout(() => settle(false, "Rewarded ad timed out."), 120_000);',
  ]) && syntax(runtime, 'const accepted = rewardGranted && isEligible();') &&
    allSyntax(adapter, ['const ad = activeAds.get(session.id);', 'const result = await bridge.showRewardedAd(ad, session, config, isEligible, lifecycle);', 'status: rewardGranted ? "completed" : "failed"']) &&
    allSyntax(monetization, ['const result = await nativeProvider.completeRewardedResetSession(session, getMonetizationConfig(options), options.isEligible, options.lifecycle);']) && inspectNativeMonetizationDefaults(sources.monetization);
}

// Swift has no TypeScript AST. Strip comments and require the contiguous guarded
// install/readback/result branches inside the actual picker callback.
function inspectIosPickerInstallation(source) {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const start = code.indexOf('AsyncFunction("presentFamilyActivityPicker")');
  const end = code.indexOf('AsyncFunction(', start + 20);
  if (start < 0 || end <= start) return false;
  const picker = code.slice(start, end);
  return picker.includes('withCheckedContinuation') &&
    /guard !didResume else \{ return \}\s*didResume = true/.test(picker) &&
    /controller\.dismiss\(animated: true\) \{\s*continuation\.resume\(returning: payload\)/.test(picker) &&
    /generation\(defaults\) == pickerGeneration else \{ return \}\s*guard self\.saveFamilyActivitySelection\(selection\) else \{ return \}\s*saved = true/.test(picker) &&
    /var installationSucceeded = false\s*do \{\s*try self\.installConfiguredAppGuard\(\)\s*installationSucceeded = self\.isAppGuardReady\(\)\s*\} catch \{ installationSucceeded = false \}\s*self\.applySelectedShieldsForCurrentState\(\)\s*if selectedTargetCount > 0 && installationSucceeded \{\s*finishPicker\(message: "Screen Time targets saved and the selected app guard installed\."\)\s*\} else if selectedTargetCount > 0 \{\s*finishPicker\(message: "Screen Time targets saved\. Native app guard readiness needs attention before activation\."\)\s*\} else \{\s*finishPicker\(message: "No Screen Time targets were selected\. Choose at least one app before activation can finish\."\)/.test(picker) &&
    /if !saved \{\s*finishPicker\(message:/.test(picker);
}
function inspectModeAwareReadiness(readinessSource, guardSource) {
  const readiness = parse(readinessSource), guard = parse(guardSource);
  if (readiness.parseDiagnostics.length || guard.parseDiagnostics.length || !trustedImport(readiness, 'describeAppGuard', './app-guard')) return false;
  const fn = namedFunction(readiness, 'getProtectionSetupReadiness'), describe = namedFunction(guard, 'describeAppGuard');
  return Boolean(fn && describe && allSyntax(fn, [
    'const appGuard = describeAppGuard(protectionCapability, protectionStatus, expectedAppGuardMode);',
    'const appInterventionReady = appGuard.ready;',
    'const appLimitsReady = !resetDisabled && appLimitsSupported && appInterventionReady;',
    "activationReady: !resetDisabled && permissionProgress.ready && (intent === 'websites' ? websiteProtectionReady : intent === 'apps' ? appLimitsReady : adultFilterActive && appInterventionReady)",
  ]) && allSyntax(describe, [
    "const modern = capability?.appGuardModes === true;",
    "const mode: AppGuardMode = modern ? status?.appGuardMode ?? 'daily-limit' : 'daily-limit';",
    "const ios = capability?.platform === 'ios';",
    'const targets = ios ? modern ? status?.selectedApplications ?? 0 : Math.max((status?.selectedApplications ?? 0) + (status?.selectedCategories ?? 0) + (status?.selectedWebDomains ?? 0), status?.selectedScreenTimeTokenCount ?? 0) : status?.blockedApplications ?? 0;',
    "const authorized = ios ? capability?.screenTime === true && capability.managedSettings === true && status?.authorized === true : capability?.platform === 'android' && capability.accessibility === true && capability.usageStats === true && status?.appInterventionAuthorized === true && status?.usageStatsAuthorized === true;",
    "const knownMode = status?.appGuardMode === 'before-use' || status?.appGuardMode === 'daily-limit' || status?.appGuardMode === 'scheduled';",
    'const configured = modern ? knownMode && targets > 0 : ios ? status?.appLimitScheduled === true : targets > 0;',
  ]) && describe.body.statements.filter(ts.isReturnStatement).length === 1 &&
    ['mode', 'targets', 'authorized', 'configured', 'ready'].every(name => {
      const last = describe.body.statements.at(-1);
      return last && ts.isReturnStatement(last) && ts.isObjectLiteralExpression(last.expression) && last.expression.properties.some(n => ts.isShorthandPropertyAssignment(n) && n.name.text === name);
    }) && syntax(describe, "const ready = status?.protectionConfigurationResetDisabled !== true && targets > 0 && authorized && configured && (!modern || knownMode && status?.appGuardReady === true && (!expectedMode || status.appGuardMode === expectedMode)) && (mode !== 'scheduled' || status?.appSchedulesSupported === true && status?.appSchedulesConfigured === true && status?.appSchedulesServiceConnected === true);"));
}
const unwrapParentheses = node => node && ts.isParenthesizedExpression(node) ? unwrapParentheses(node.expression) : node;
function inspectLegalRenderer(ast) {
  const renderer = namedFunction(ast, 'LegalPage');
  if (!renderer || renderer.parameters.length !== 1 || !ts.isObjectBindingPattern(renderer.parameters[0].name) || !renderer.parameters[0].name.elements.some(n => n.name.getText() === 'sections')) return false;
  if (nodes(renderer, n => ts.isVariableDeclaration(n) && n.name.getText() === 'sections').length) return false;
  const returns = renderer.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1 || returns[0] !== renderer.body.statements.at(-1)) return false;
  const root = unwrapParentheses(returns[0].expression);
  if (!root || !ts.isJsxElement(root) || root.openingElement.tagName.getText() !== 'ScrollView') return false;
  const lists = nodes(root, n => ts.isJsxElement(n) && n.openingElement.tagName.getText() === 'View' && n.openingElement.attributes.properties.some(attr => compactNode(attr) === 'style={styles.sectionList}'));
  if (lists.length !== 1) return false;
  const list = lists[0];
  // A retained map in a hidden conditional or unused callback is not rendering.
  for (let parent = list.parent; parent !== root; parent = parent?.parent) {
    if (!parent || (!ts.isJsxElement(parent) && !ts.isJsxExpression(parent))) return false;
  }
  const rendered = list.children.filter(n => ts.isJsxExpression(n) && n.expression);
  if (rendered.length !== 1 || !ts.isCallExpression(rendered[0].expression) || rendered[0].expression.expression.getText() !== 'sections.map') return false;
  const sectionCallback = rendered[0].expression.arguments[0];
  if (!sectionCallback || !ts.isArrowFunction(sectionCallback) || sectionCallback.parameters.length !== 1 || sectionCallback.parameters[0].name.getText() !== 'section') return false;
  const section = unwrapParentheses(sectionCallback.body);
  if (!section || !ts.isJsxElement(section) || section.openingElement.tagName.getText() !== 'MomentumSection') return false;
  const sectionChildren = section.children.filter(n => ts.isJsxExpression(n) && n.expression);
  if (sectionChildren.length !== 1 || !ts.isCallExpression(sectionChildren[0].expression) || sectionChildren[0].expression.expression.getText() !== 'section.body.map') return false;
  const paragraphCallback = sectionChildren[0].expression.arguments[0];
  if (!paragraphCallback || !ts.isArrowFunction(paragraphCallback) || paragraphCallback.parameters.length !== 1 || paragraphCallback.parameters[0].name.getText() !== 'paragraph') return false;
  const text = unwrapParentheses(paragraphCallback.body);
  const output = text && ts.isJsxElement(text) && text.children.filter(n => ts.isJsxExpression(n) && n.expression);
  return Boolean(text && ts.isJsxElement(text) && text.openingElement.tagName.getText() === 'Text' && output.length === 1 && ts.isIdentifier(output[0].expression) && output[0].expression.text === 'paragraph');
}
function inspectPublicPrivacyComposition(source, catalog, context) {
  const ast = parse(source), fn = namedFunction(ast, 'PrivacyPolicyPage');
  const imported = ast.statements.filter(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === '@/i18n/native-android-catalog.json' && n.importClause?.name?.text === 'nativeAndroidCopy' && !n.importClause.isTypeOnly);
  if (ast.parseDiagnostics.length || !fn || !inspectLegalRenderer(ast) || imported.length !== 1 || nodes(ast, n => (ts.isVariableDeclaration(n) || ts.isParameter(n)) && n.name?.getText() === 'nativeAndroidCopy').length) return false;
  const literalParagraphs = [];
  const pages = {};
  for (const name of ['PrivacyPolicyPage', 'SupportPage', 'AccountDeletionPage']) {
    const pageFunction = namedFunction(ast, name);
    if (!pageFunction) return false;
    const returns = nodes(pageFunction, n => ts.isReturnStatement(n));
    if (returns.length !== 1) return false;
    const rendered = nodes(returns[0], n => ts.isJsxSelfClosingElement(n) && n.tagName.getText() === 'LegalPage');
    if (rendered.length !== 1) return false;
    pages[name] = rendered[0];
    const sections = rendered[0].attributes.properties.filter(n => ts.isJsxAttribute(n) && n.name.text === 'sections');
    if (sections.length !== 1 || !ts.isJsxExpression(sections[0].initializer) || !ts.isArrayLiteralExpression(sections[0].initializer.expression)) return false;
    for (const section of sections[0].initializer.expression.elements) {
      if (!ts.isObjectLiteralExpression(section) || section.properties.some(ts.isSpreadAssignment)) return false;
      const body = section.properties.filter(n => ts.isPropertyAssignment(n) && n.name.getText() === 'body');
      if (body.length !== 1 || !ts.isArrayLiteralExpression(body[0].initializer)) return false;
      for (const paragraph of body[0].initializer.elements) {
        if (ts.isStringLiteral(paragraph)) literalParagraphs.push(paragraph.text);
        else if (ts.isPropertyAccessExpression(paragraph) && paragraph.getText() === 'nativeAndroidCopy.freed_accessibility_description') {
          if (name !== 'PrivacyPolicyPage') return false;
        } else if (!ts.isTemplateExpression(paragraph)) return false;
      }
    }
  }
  const paragraph = text => literalParagraphs.some(p => p.includes(text));
  const nativeDescriptionRendered = nodes(pages.PrivacyPolicyPage, n => ts.isPropertyAccessExpression(n) && n.getText() === 'nativeAndroidCopy.freed_accessibility_description').length === 1;
  const facts = typeof catalog?.freed_accessibility_description === 'string' && nativeDescriptionRendered && [
    'openings of selected apps', 'whole-app guards', 'You choose whether to open FREED recovery',
    'Shorts and Reels inspection is experimental and outside the public release',
  ].every(text => catalog.freed_accessibility_description.includes(text)) && [
    'Photos are checked on your device', 'Photos are not uploaded', 'ML Kit may send operational SDK metrics',
    'absolute UTC-day counts of check-ins and completed challenges for a 14-day window',
    'schema and consent versions', 'lineage, revision and snapshot identifiers', 'authenticated account UID',
    'Derived rates, streak summaries and challenge categories stay local',
    "processed by Google Cloud's Gemini service through FREED", 'up to six recent user-authored messages',
    'Browsing activity, journal entries, photos and Screen Time data are not automatically attached',
    'Google processing and retention follow the applicable service terms and configuration',
    'does not promise a fixed Google retention period or zero retention',
    'Turning cloud chat off stops future messages; a request already sent may finish. Built-in guidance remains available',
    'account-linked quota and request deduplication metadata', 'configured 7-day expiry; physical deletion may occur later',
    'configured 14-day expiry', 'day counters expire 14 days after their UTC-day boundary',
    'snapshot and receipt metadata 14 days after writing', 'eligible for TTL deletion; physical deletion may occur later',
    'legal retention', 'native acknowledgment', 'server-side account and account-linked data deletion before clearing this device and signing out',
    'accepted request means deletion is in progress', 'does not automatically cancel App Store or Google Play subscriptions',
    'does not promise instantaneous provider authorization revocation',
  ].every(paragraph) && syntax(pages.PrivacyPolicyPage.attributes, 'eyebrow="Effective date: October 5, 2026"');
  if (!facts) return false;
  const constants = Object.fromEntries(ast.statements.filter(ts.isVariableStatement).flatMap(n => n.declarationList.declarations).filter(n => ts.isIdentifier(n.name) && n.initializer && ts.isStringLiteral(n.initializer)).map(n => [n.name.text,n.initializer.text]));
  if (constants.SUPPORT_EMAIL !== 'soumyadebnath1661@gmail.com' || constants.PRIVACY_URL !== 'https://freed-landing.web.app/privacy' || constants.SUPPORT_URL !== 'https://freed-landing.web.app/support' || constants.ACCOUNT_DELETION_URL !== 'https://freed-landing.web.app/account-deletion') return false;
  if (!allSyntax(namedFunction(ast, 'LegalPage'), ['onPress={() => openUrl(action.url)}']) || !allSyntax(namedFunction(ast,'openUrl'), ['Linking.openURL(url)'])) return false;
  const protectedNames = ['SUPPORT_EMAIL','PRIVACY_URL','SUPPORT_URL','ACCOUNT_DELETION_URL','mailto','openUrl'];
  for (const name of protectedNames) {
    const bindings = nodes(ast, n => (ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n) || ts.isParameter(n) || ts.isBindingElement(n)) && n.name?.getText() === name);
    if (bindings.length !== 1 || (ts.isVariableDeclaration(bindings[0]) ? bindings[0].parent?.parent?.parent !== ast : bindings[0].parent !== ast)) return false;
  }
  const mail = namedFunction(ast,'mailto');
  if (!mail || mail.parameters.length !== 1 || mail.parameters[0].name.getText() !== 'subject' || mail.body?.statements.length !== 1 ||
    compactNode(mail.body.statements[0]) !== compactText('return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(translateSource(subject))}`;') ||
    !trustedImport(ast,'translateSource','@/i18n/runtime')) return false;
  const expectedActions = {
    PrivacyPolicyPage: { 'Email privacy support': ['mailto','FREED privacy request'], 'Account deletion': ['constant','ACCOUNT_DELETION_URL'] },
    SupportPage: { 'Email support': ['mailto','FREED support request'], 'Privacy policy': ['constant','PRIVACY_URL'], 'Account deletion': ['constant','ACCOUNT_DELETION_URL'] },
    AccountDeletionPage: { 'Email deletion request': ['mailto','FREED account deletion request'], 'Privacy policy': ['constant','PRIVACY_URL'], 'Support': ['constant','SUPPORT_URL'] },
  };
  for (const [name,page] of Object.entries(pages)) {
    if (page.attributes.properties.some(ts.isJsxSpreadAttribute)) return false;
    const attributes = page.attributes.properties.filter(n => ts.isJsxAttribute(n) && n.name.text === 'actions');
    if (attributes.length !== 1 || !attributes[0].initializer || !ts.isJsxExpression(attributes[0].initializer) || !ts.isArrayLiteralExpression(attributes[0].initializer.expression)) return false;
    const actions = attributes[0].initializer.expression.elements;
    if (actions.length !== Object.keys(expectedActions[name]).length) return false;
    const seen = new Set();
    for (const action of actions) {
      if (!ts.isObjectLiteralExpression(action) || action.properties.length !== 2 || action.properties.some(p => !ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)))) return false;
      const labels = action.properties.filter(p => p.name.text === 'label'), urls = action.properties.filter(p => p.name.text === 'url');
      if (labels.length !== 1 || urls.length !== 1 || !ts.isStringLiteral(labels[0].initializer)) return false;
      const label = labels[0].initializer.text, expected = expectedActions[name][label], url = urls[0].initializer;
      if (!expected || seen.has(label)) return false;
      seen.add(label);
      if (expected[0] === 'constant') {
        if (!ts.isIdentifier(url) || url.text !== expected[1]) return false;
      } else if (!ts.isCallExpression(url) || !ts.isIdentifier(url.expression) || url.expression.text !== 'mailto' || url.arguments.length !== 1 || !ts.isStringLiteral(url.arguments[0]) || url.arguments[0].text !== expected[1]) return false;
    }
  }
  const renderer = namedFunction(ast,'LegalPage');
  const actionBindings = nodes(renderer, n => (ts.isBindingElement(n) || ts.isVariableDeclaration(n) || ts.isParameter(n)) && n.name?.getText() === 'actions');
  if (actionBindings.length !== 1 || !ts.isBindingElement(actionBindings[0]) || actionBindings[0].propertyName || actionBindings[0].initializer ||
    actionBindings[0].parent !== renderer.parameters[0]?.name) return false;
  const renderReturns = renderer.body.statements.filter(ts.isReturnStatement);
  const actionMaps = renderReturns.length === 1 ? nodes(renderReturns[0], n => ts.isCallExpression(n) && n.expression.getText() === 'actions.map') : [];
  if (actionMaps.length !== 1 || actionMaps[0].arguments.length !== 1 || !ts.isArrowFunction(actionMaps[0].arguments[0])) return false;
  const actionRenderer = actionMaps[0].arguments[0];
  if (actionRenderer.parameters.length !== 1 || actionRenderer.parameters[0].name.getText() !== 'action') return false;
  const renderedAction = unwrapParentheses(actionRenderer.body);
  if (!renderedAction || !ts.isJsxElement(renderedAction) || renderedAction.openingElement.tagName.getText() !== 'Pressable') return false;
  const presses = renderedAction.openingElement.attributes.properties.filter(p => ts.isJsxAttribute(p) && p.name.text === 'onPress');
  if (presses.length !== 1 || compactNode(presses[0]) !== compactText('onPress={() => openUrl(action.url)}')) return false;
  if (!context) return true;
  for (const [name, routeSource] of Object.entries(context.routes)) {
    const route = parse(routeSource);
    if (route.parseDiagnostics.length || !trustedImport(route, name, '@/features/legal-pages')) return false;
    if (name === 'AccountDeletionPage') {
      if (!trustedImport(route, 'Platform', 'react-native') || !trustedImport(route, 'useFreedAppController', '@/features/freed-app')) return false;
      const native = namedFunction(route, 'NativeAccountDeletion'), entry = namedFunction(route, 'AccountDeletionRoute');
      if (!native || !entry || native.parameters.length || entry.parameters.length || native.body?.statements.length !== 2 || entry.body?.statements.length !== 1 ||
        compactNode(native.body.statements[0]) !== compactText('const controller = useFreedAppController();') ||
        compactNode(native.body.statements[1]) !== compactText('return controller.renderAccountDeletion();')) return false;
      const returned = entry.body.statements[0];
      if (!ts.isReturnStatement(returned) || !returned.expression || !ts.isConditionalExpression(returned.expression) ||
        compactNode(returned.expression.condition) !== compactText("Platform.OS === 'web'") ||
        !ts.isJsxSelfClosingElement(returned.expression.whenTrue) || returned.expression.whenTrue.tagName.getText() !== name || returned.expression.whenTrue.attributes.properties.length ||
        !ts.isJsxSelfClosingElement(returned.expression.whenFalse) || returned.expression.whenFalse.tagName.getText() !== 'NativeAccountDeletion' || returned.expression.whenFalse.attributes.properties.length) return false;
    } else {
      const returned = nodes(route, n => ts.isReturnStatement(n) && n.expression && ts.isJsxSelfClosingElement(n.expression) && n.expression.tagName.getText() === name);
      if (returned.length !== 1) return false;
    }
  }
  // Translation inventory and TTL/UID tokens supplement the reviewed locale copy;
  // they cannot certify all ten languages' rendered wording/layout.
  for (const [locale, resource] of Object.entries(context.locales)) {
    for (const text of literalParagraphs) {
      const translated = resource.source?.[text];
      if (typeof translated !== 'string' || !translated.trim() || (locale === 'en' && translated !== text)) return false;
      for (const token of text.includes('configured 14-day expiry') ? ['14','TTL'] : text.includes('configured 7-day expiry') ? ['7','Google'] : text.includes('authenticated account UID') ? ['14','UID'] : []) if (!translated.includes(token)) return false;
    }
  }
  // The hosted English builder independently composes adult eligibility and
  // subscriptions. Do not mistake those facts for all-locale app rendering.
  const website = parse(context.website);
  const declarations = nodes(website,n => ts.isVariableDeclaration(n) && ts.isIdentifier(n.name));
  const variable = name => declarations.find(n => n.name.text === name)?.initializer;
  const eligibility = variable('eligibility'), billing = variable('billing'), cancellation = variable('cancellation'), privacy = variable('privacy'), support = variable('support');
  return Boolean(eligibility && ts.isStringLiteral(eligibility) && eligibility.text.includes('adults 18+') && billing && ts.isStringLiteral(billing) && billing.text.includes('auto-renewing monthly and yearly subscriptions') && cancellation && ts.isStringLiteral(cancellation) && cancellation.text.includes('Cancel in the store account') && privacy && ts.isCallExpression(privacy) && privacy.expression.getText() === 'legalPage' && nodes(privacy,n => ts.isIdentifier(n) && n.text === 'eligibility').length && nodes(privacy,n => ts.isIdentifier(n) && n.text === 'billing').length && support && ts.isCallExpression(support) && support.expression.getText() === 'legalPage' && nodes(support,n => ts.isIdentifier(n) && n.text === 'cancellation').length);
}
function inspectPermissionActivation(source, completionSource) {
  const ast = parse(source), helper = parse(completionSource);
  if (ast.parseDiagnostics.length || helper.parseDiagnostics.length || !trustedImport(ast, 'canFinishProtectionSetup', '@/lib/protection-setup-completion') || !trustedImport(ast, 'getProtectionSetupReadiness', '@/lib/protection-readiness')) return false;
  const handler = nodes(ast, n => ts.isVariableDeclaration(n) && n.name.getText() === 'handleSetupContinue')[0]?.initializer;
  const finish = namedFunction(helper, 'canFinishProtectionSetup');
  return Boolean(handler && finish && allSyntax(handler, [
    "const fresh = getProtectionSetupReadiness(capability, status, selectedAppPackageCount, 'both', appGuardMode);",
    'const signature = buildProtectionActivationSignature(capability, status, selectedAppPackageCount);',
  ]) && nodes(handler, n => ts.isIfStatement(n) && compactNode(n.expression) === 'canFinishProtectionSetup(activationTest,fresh.activationReady,signature)' && compactNode(n.thenStatement) === 'onContinue();' && n.elseStatement && syntax(n.elseStatement, 'setActivationTest(null);')).length === 1 && allSyntax(ast, [
    'const activationTestMatchesCurrentStatus = activationTest?.statusSignature === currentProtectionActivationSignature;',
    'const activationTestPassed = Boolean(activationTest?.adultBlocked && activationTest.normalAllowed && activationTest.nativeChecked && activationTest.nativeReady && activationReady && activationTestMatchesCurrentStatus);',
    'nativeReady: freshReadiness.activationReady && nativeDiagnostics.nativeChecksPassed',
    'nativeChecked: nativeDiagnostics.checkedNativeLayer',
  ]) && syntax(finish, 'return freshReady && test?.adultBlocked === true && test.normalAllowed === true && test.nativeChecked === true && test.nativeReady === true && test.statusSignature === freshSignature;'));
}
function inspectUsageAccessRationale(activitySource, stringsSource) {
  const activity = activitySource.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
  const strings = stringsSource.replace(/<!--[\s\S]*?-->/g, '');
  const resource = name => strings.match(new RegExp('<string name="' + name + '"[^>]*>([^<]*)</string>'))?.[1];
  const reason = resource('freed_usage_access_reason'), note = resource('freed_usage_note');
  return Boolean(reason && note && ['aggregate foreground time for selected app packages', 'does not read screen contents, messages, keystrokes, browsing history, or raw usage events'].every(text => reason.includes(text)) && note.includes('Usage Access is controlled by Android Settings') &&
    /text = FreedNativeCopy\.text\(this@FreedUsageAccessConfigActivity, R\.string\.freed_usage_access_reason\)/.test(activity) &&
    /text = FreedNativeCopy\.text\(this@FreedUsageAccessConfigActivity, R\.string\.freed_usage_note\)/.test(activity) &&
    /setOnClickListener \{ openFreedSetup\(\) \}/.test(activity) && /setOnClickListener \{ finishCleanly\(\) \}/.test(activity));
}
function inspectMembershipManagementRoute(source) {
  const ts = require('typescript');
  const ast = ts.createSourceFile('controller.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map(), handlers = [];
  const visit = node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && ['openProfilePaywall', 'openPaywall'].includes(node.name.text)) {
      const values = declarations.get(node.name.text) ?? []; values.push(node.initializer); declarations.set(node.name.text, values);
    }
    if (ts.isJsxAttribute(node) && node.name.text === 'onManagePlan' && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression && ts.isArrowFunction(node.initializer.expression)) handlers.push(node.initializer.expression);
    ts.forEachChild(node, visit);
  }; visit(ast);
  const fn = name => declarations.get(name)?.length === 1 && declarations.get(name)[0];
  const profile = fn('openProfilePaywall'), paywall = fn('openPaywall');
  const called = (statement, name, args) => ts.isExpressionStatement(statement) && ts.isCallExpression(statement.expression) && statement.expression.expression.getText(ast) === name && statement.expression.arguments.map(arg => arg.getText(ast)).join(',') === args;
  return !ast.parseDiagnostics.length && handlers.length === 1 && handlers[0].parameters.length === 0 &&
    ts.isCallExpression(handlers[0].body) && handlers[0].body.expression.getText(ast) === 'openProfilePaywall' && handlers[0].body.arguments.length === 1 && handlers[0].body.arguments[0].getText(ast) === 'profileSection' &&
    profile && ts.isArrowFunction(profile) && profile.parameters.length === 1 && profile.parameters[0].name.getText(ast) === 'section' && !profile.parameters[0].initializer &&
    ts.isBlock(profile.body) && profile.body.statements.length === 4 &&
    compactNode(profile.body.statements[0]) === compactText('const owner = getJourneyOwner(getFirebaseAuthSnapshot());') && called(profile.body.statements[1], 'openPaywall', '') &&
    paywall && ts.isArrowFunction(paywall) && paywall.parameters.length === 1 && paywall.parameters[0].name.getText(ast) === 'featureId' && !paywall.parameters[0].initializer &&
    ts.isBlock(paywall.body) && paywall.body.statements.length === 2 && called(paywall.body.statements[0], 'paywallNavigationRef.current.open', 'featureId') && called(paywall.body.statements[1], 'setScreen', '"paywall"');
}

module.exports = { inspectConfirmedNativeCleanup, syntheticQaIsDevOnlyOrRemoved, inspectRevocationRecovery, inspectNativeMonetizationDefaults, inspectSetupConfigurationCheck, inspectRewardedResetChoice, inspectIosPickerInstallation, inspectModeAwareReadiness, inspectPublicPrivacyComposition, inspectPermissionActivation, inspectUsageAccessRationale, inspectMembershipManagementRoute };
