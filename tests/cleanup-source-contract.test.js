const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');
const { inspectConfirmedNativeCleanup, syntheticQaIsDevOnlyOrRemoved, inspectRevocationRecovery } = require('../scripts/lib/cleanup-source-contract');
const controller = readFileSync('src/features/freed-app.tsx', 'utf8');
const helper = readFileSync('src/lib/confirmed-cleanup.ts', 'utf8');
test('cleanup source precheck follows the current trusted helper and literal native acknowledgement', () => {
  assert.equal(inspectConfirmedNativeCleanup(controller, helper), true);
  for (const [before, after] of [
    ['return status.protectionConfigurationResetAccepted === true;', 'return true;'],
    ['return status.protectionConfigurationResetAccepted === true;', 'return Boolean(status.active);'],
    ['await resetProtectionConfiguration()', 'await getProtectionStatus()'],
    ['from "@/lib/confirmed-cleanup"', 'from "./fake-cleanup"'],
    ['const status = await resetProtectionConfiguration();', 'persistRecoveryState(createDefaultRecoveryState()); const status = await resetProtectionConfiguration();'],
  ]) {
    assert.ok(controller.includes(before), before);
    assert.equal(inspectConfirmedNativeCleanup(controller.replace(before, after), helper), false, before);
  }
});
test('cleanup helper cannot erase on false or bypass the awaited confirmation', () => {
  for (const [before, after] of [
    ['if (await clear() !== true)', 'if (false)'],
    ['return erase();', 'return Promise.resolve();'],
  ]) {
    assert.ok(helper.includes(before));
    assert.equal(inspectConfirmedNativeCleanup(controller, helper.replace(before, after)), false);
  }
});
test('owner cleanup rejects stale asynchronous erase, forged owner and unknown helper returns', () => {
  const start=controller.indexOf('  const deleteLocalRecoveryData ='),end=controller.indexOf('  const cleanupDeletedOwner =',start),callback=controller.slice(start,end);
  assert.ok(start>=0 && end>start);
  for (const [before, after] of [
    ['const owner = trustedPrivateOwner(getFirebaseAuthSnapshot(), getFirebaseAccountScope());', 'const owner = arbitraryOwner;'],
    ['const operation = accountOperationGate.current.begin();', 'const operation = { assertCurrent() {} };'],
    ['await appConfigQueue.current?.whenIdle(); operation.assertCurrent();', 'await appConfigQueue.current?.whenIdle();'],
    ['await resetProtectionConfiguration(); operation.assertCurrent();', 'await resetProtectionConfiguration();'],
    ['await disableAutomaticBackup(owner ?? undefined); operation.assertCurrent();', 'await disableAutomaticBackup(owner ?? undefined);'],
    ['await purgeJournalOwner(createJournalRepository({ storage: localStorage, ownerId: owner }), journalMedia); operation.assertCurrent();', 'await purgeJournalOwner(createJournalRepository({ storage: localStorage, ownerId: owner }), journalMedia);'],
    ['return afterConfirmedCleanup(async () => {', 'persistRecoveryState(createDefaultRecoveryState()); return afterConfirmedCleanup(async () => {'],
    ['return afterConfirmedCleanup(async () => {', 'return Promise.resolve(true); afterConfirmedCleanup(async () => {'],
  ]) { assert.ok(callback.includes(before), before); const changed = controller.slice(0,start)+callback.replace(before, after)+controller.slice(end); assert.notEqual(changed, controller); assert.equal(inspectConfirmedNativeCleanup(changed, helper), false, before); }
});
test('membership Manage forwards to the actual paywall and rejects disconnected or wrong destinations', () => {
  const { inspectMembershipManagementRoute } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(Boolean(inspectMembershipManagementRoute(controller)),true);
  const start=controller.indexOf('  const openPaywall ='),end=controller.indexOf('  const returnFromPaywall =',start);assert.ok(start>=0&&end>start);
  const wrongDestination=controller.slice(0,start)+controller.slice(start,end).replace('setScreen("paywall")','setScreen("main")')+controller.slice(end);
  for(const changed of [
    controller.replace('onManagePlan={() => openProfilePaywall(profileSection)}','onManagePlan={() => {}}'),
    controller.replace('onManagePlan={() => openProfilePaywall(profileSection)}','onManagePlan={() => null}'),
    controller.replace('onManagePlan={() => openProfilePaywall(profileSection)}','onManagePlan={() => setPremium(true)}'),
    controller.replace('openPaywall();','void 0;'),wrongDestination,
  ]) {assert.notEqual(changed,controller);assert.equal(Boolean(inspectMembershipManagementRoute(changed+'\n// onManagePlan={() => openProfilePaywall(profileSection)}')),false);}
});
test('Manage rejects unreachable forwarding and destination calls in the actual wrappers', () => {
  const { inspectMembershipManagementRoute } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(Boolean(inspectMembershipManagementRoute(controller)),true);
  for(const [name,endName,before,after] of [
    ['openProfilePaywall','postPaywallScreen','openPaywall();','return; openPaywall();'],
    ['openPaywall','returnFromPaywall','setScreen("paywall");','return; setScreen("paywall");'],
    ['openProfilePaywall','postPaywallScreen','openPaywall();','const openPaywall = () => {}; openPaywall();'],
    ['openPaywall','returnFromPaywall','setScreen("paywall");','const setScreen = () => {}; setScreen("paywall");'],
  ]) {
    const start=controller.indexOf(`  const ${name} =`),end=controller.indexOf(`  const ${endName} =`,start),span=controller.slice(start,end);assert.ok(start>=0&&end>start);assert.ok(span.includes(before));
    const changed=controller.slice(0,start)+span.replace(before,after)+controller.slice(end);assert.notEqual(changed,controller);assert.equal(Boolean(inspectMembershipManagementRoute(changed)),false,after);
  }
});
test('encrypted backup decoder must be a unique unshadowed value import in the actual download', () => {
  const ts=require('typescript'),source=readFileSync('scripts/privacy-safety-audit.js','utf8');
  const ast=ts.createSourceFile('audit.js',source,ts.ScriptTarget.Latest,true);
  const oracle=ast.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='inspectEncryptedClientRestore');assert.equal(oracle.length,1);
  const inspect=new Function('require',`return (${oracle[0].getText(ast)});`)(require);
  const backup=readFileSync('src/lib/recovery-backup-client-sync.ts','utf8'),tree=ts.createSourceFile('backup.ts',backup,ts.ScriptTarget.Latest,true);
  const fn=tree.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='downloadEncryptedRecoveryBackup');assert.ok(fn?.body);assert.equal(inspect(backup),true);
  const parameter='config: RecoveryBackupClientSyncConfig = {}',fake='restoreEncryptedRecoveryBackupContent = async () => ({ state: {} as RecoveryState, journal: undefined })';
  const span=fn.getText(tree);assert.ok(span.includes(parameter));
  const changedParameter=backup.slice(0,fn.getStart(tree))+span.replace(parameter,parameter+', '+fake)+backup.slice(fn.end);
  const insertion=fn.body.getStart(tree)+1;
  const changedLocal=backup.slice(0,insertion)+'\n const '+fake+';\n'+backup.slice(insertion);
  const imported=tree.statements.find(node=>ts.isImportDeclaration(node)&&node.moduleSpecifier.text==='@/lib/recovery-backup');assert.ok(imported);
  const typeImport=backup.slice(0,imported.getStart(tree))+imported.getText(tree).replace('import {','import type {')+backup.slice(imported.end);
  for(const changed of [changedParameter,changedLocal,typeImport,backup+'\n'+span]) {assert.notEqual(changed,backup);assert.equal(inspect(changed),false);}
});
test('removed QA controls pass while an unguarded or fake development gate fails', () => {
  assert.equal(syntheticQaIsDevOnlyOrRemoved(controller), true);
  const fixture = 'const showQaControls = typeof __DEV__ !== "undefined" && __DEV__; function Screen(){ return showQaControls ? <Button label="Simulate adult attempt (QA)"/> : null; }';
  assert.equal(syntheticQaIsDevOnlyOrRemoved(fixture), true);
  assert.equal(syntheticQaIsDevOnlyOrRemoved(fixture.replace('showQaControls ? ', 'true ? ')), false);
  assert.equal(syntheticQaIsDevOnlyOrRemoved(fixture.replace('typeof __DEV__ !== "undefined" && __DEV__', 'true')), false);
  assert.equal(syntheticQaIsDevOnlyOrRemoved('function Screen(){return <Button label="Simulate adult attempt (QA)"/>;}'), false);
});
test('revocation clears native activation after refresh while retaining access to local tools', () => {
  assert.equal(inspectRevocationRecovery(controller), true);
  for (const [before, after] of [
    ['if (!protectionRefreshCompleted) return;', 'if (false) return;'],
    ['hasProtectionActivationForPlatform(current, platform) ? clearProtectionActivation(current) : current', 'current'],
    ['setProtectionSyncMessage("Protection was turned off or changed in system settings.', 'setScreen("protectionSetup"); setProtectionSyncMessage("Protection was turned off or changed in system settings.'],
  ]) {
    assert.ok(controller.includes(before), before);
    assert.equal(inspectRevocationRecovery(controller.replace(before, after)), false);
  }
});
test('native monetization guard rejects mock mode in production and internal distribution', () => {
  const { inspectNativeMonetizationDefaults } = require('../scripts/lib/cleanup-source-contract');
  const source = readFileSync('src/lib/monetization.ts', 'utf8');
  assert.equal(inspectNativeMonetizationDefaults(source), true);
  for (const [before, after] of [
    ['isProductionRuntime() ||', 'isProductionRuntime() &&'],
    ['isProductionRuntime() ||', 'false ||'],
    ['["production", "internal-testflight"]', '["production"]'],
    ['? "mock" : "native"', '? "native" : "mock"'],
    ['return "native";', 'return "mock";'],
  ]) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectNativeMonetizationDefaults(source.replace(before, after)), false, before);
  }
});
test('setup local configuration check runs the guarded action without fabricating activation', () => {
  const { inspectSetupConfigurationCheck } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(inspectSetupConfigurationCheck(controller), true);
  for (const [before, after] of [
    ['if (advance.action === "test")', 'if (true)'],
    ['Running the local configuration check now.', 'Physical-device protection verified.'],
    ['runActivationTest();\n      return;', 'markProtectionActivated();\n      return;'],
    ['testTriggered: true', 'testTriggered: false'],
  ]) {
    assert.ok(controller.includes(before), before);
    assert.equal(inspectSetupConfigurationCheck(controller.replace(before, after)), false, before);
  }
});
const rewardedSources = {
  live: readFileSync('src/lib/live-earned-app-time.ts', 'utf8'),
  offer: readFileSync('src/components/GuidedResetOffer.tsx', 'utf8'),
  hook: readFileSync('src/hooks/useGuidedResetAccess.ts', 'utf8'),
  access: readFileSync('src/lib/guided-reset-access.ts', 'utf8'),
  runtime: readFileSync('src/lib/native-monetization-runtime.ts', 'utf8'),
  adapter: readFileSync('src/lib/native-monetization-adapter.ts', 'utf8'),
  monetization: readFileSync('src/lib/monetization.ts', 'utf8'),
};
test('current explicit rewarded wiring rejects automatic, stale, fake and unsaved access mutations', () => {
  const { inspectRewardedResetChoice } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(inspectRewardedResetChoice(controller, rewardedSources), true);
  for (const [file, before, after] of [
    ['controller', "from '@/hooks/useGuidedResetAccess'", "from './fake-access'"],
    ['controller', 'if (await guidedAccess.watch(offerEligible)) reveal(selectedOffer ?? undefined);', 'reveal(selectedOffer ?? undefined);'],
    ['controller', 'if (guidedAccess.repair()) reveal();', 'if (true) reveal();'],
    ['controller', 'guidedAccess.watch(offerEligible)', 'guidedAccess.watch(offerEligible)'],
    ['offer', "tier === 'free' ?", 'true ?'],
    ['offer', "action('Help now', onHelp)", "action('Help now', onWatch)"],
    ['offer', "action('Back to safety', onSafety)", "action('Back to safety', onWatch)"],
    ['hook', "from '../lib/monetization'", "from './fake-monetization'"],
    ['hook', 'getFirebaseAccountScope() === live.current.ownerUid', 'true'],
    ['hook', "live.current.active && AppState.currentState === 'active'", 'true'],
    ['hook', 'const watch = async (offerEligible?: () => boolean) => {', 'React.useEffect(() => { void controller?.watch(); }, [controller]); const watch = async (offerEligible?: () => boolean) => {'],
    ['hook', 'requestContext: () => live.current.contextKey', 'requestContext: () => ""'],
    ['controller', 'if (!await recheckEarnedOffer()) return;', 'if (false) return;'],
    ['controller', 'const recheckEarnedOffer = async (beforeAd = true)', 'const recheckEarnedOffer = async (beforeAd = false)'],
    ['live', 'EARNED_TIME_AD_HEADROOM_MS=150_000', 'EARNED_TIME_AD_HEADROOM_MS=0'],
    ['live', 'Math.min(Date.parse(offer.validUntil),Date.parse(budget.nextResetAt))', 'Infinity'],
    ['live', "budget.clockState==='verified'", 'true'],
    ['controller', 'earnedOffer.isBound(selectedOffer) && isEarnedOfferAdFeasible(selectedOffer.receipt, Date.now())', 'true'],
    ['controller', 'isEarnedOfferAdFeasible(selection.receipt, Date.now(), beforeAd ? undefined : 0)', 'true'],
    ['controller', 'presentedOffer && earnedOffer.isBound(presentedOffer)', 'presentedOffer'],
    ['controller', 'lookup: getEarnedAppTimeGrant', 'lookup: grantEarnedAppTimeBreak'],
    ['hook', 'const result = await controller.watch(offerEligible);', 'const result = await controller.watch();'],
    ['access', '(wasPresented || offerCurrent())', 'true'],
    ['access', '(wasPresented || offerCurrent())', 'offerCurrent()'],
    ['access', 'return offerEligible?.() !== false;', 'return true;'],
    ['access', "o.currentTier() !== 'free') return 'denied'", "false) return 'denied'"],
    ['access', 'request === generation && o.requestContext?.() === context', 'true'],
    ['access', "refreshed === 'paid' || refreshed === 'review'", 'false'],
    ['access', "session.provider !== 'native' || session.status !== 'ready'", 'false'],
    ['access', "result.rewardGranted !== true", 'false'],
    ['access', 'o.storage.setItem(key, JSON.stringify(value));\n    grant = value;', 'grant = value;\n    o.storage.setItem(key, JSON.stringify(value));'],
    ['access', 'earned.request !== generation', 'false'],
    ['access', "if (result.provider !== 'native' || result.status !== 'completed' || result.rewardGranted !== true) return 'unavailable' as const;\n        earned = { access: make('reward'), request, context, awaitingSdkForeground: wasPresented && !o.isForeground(), presented: wasPresented };", "earned = { access: make('reward'), request, context, awaitingSdkForeground: wasPresented && !o.isForeground(), presented: wasPresented };\n        if (result.provider !== 'native' || result.status !== 'completed' || result.rewardGranted !== true) return 'unavailable' as const;"],
    ['access', 'persist(earned.access);', 'grant = earned.access;'],
    ['access', "o.currentTier() !== 'free') return 'pending-eligibility'", "false) return 'pending-eligibility'"],
    ['runtime', 'consentInfo?.canRequestAds === true', 'true'],
    ['runtime', 'if (!canRequestAds) {', 'if (false) {'],
    ['runtime', 'entry.presented && isEligible()', 'true'],
    ['runtime', 'requestNonPersonalizedAdsOnly: true', 'requestNonPersonalizedAdsOnly: false'],
    ['adapter', 'await bridge.showRewardedAd(ad, session, config, isEligible, lifecycle)', 'await Promise.resolve({ rewardGranted: true })'],
  ]) {
    const original = file === 'controller' ? controller : rewardedSources[file];
    assert.ok(original.includes(before), before);
    const changed = before === after
      ? original + '\nfunction autoAd(){ guidedAccess.watch(); }'
      : original.replace(before, after) + '\n/* original contract: ' + before + ' */';
    const passed = file === 'controller' ? inspectRewardedResetChoice(changed, rewardedSources) : inspectRewardedResetChoice(controller, { ...rewardedSources, [file]: changed });
    assert.equal(passed, false, file + ': ' + before);
  }
});
test('picker install requires real readback before guarded success and resolves empty/failure cases', () => {
  const { inspectIosPickerInstallation } = require('../scripts/lib/cleanup-source-contract');
  const source = readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift', 'utf8');
  assert.equal(inspectIosPickerInstallation(source), true);
  for (const [before, after] of [
    ['try self.installConfiguredAppGuard()', 'try self.installSelectedAppLimitMonitoring()'],
    ['installationSucceeded = self.isAppGuardReady()', 'installationSucceeded = true'],
    ['if selectedTargetCount > 0 && installationSucceeded {', 'if selectedTargetCount > 0 {'],
    ['catch { installationSucceeded = false }', 'catch { installationSucceeded = true }'],
    ['guard self.saveFamilyActivitySelection(selection) else { return }', 'self.saveFamilyActivitySelection(selection)'],
    ['if !saved {', 'if false {'],
    ['No Screen Time targets were selected.', 'Protection ready.'],
  ]) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectIosPickerInstallation(source.slice(0, source.indexOf('AsyncFunction("presentFamilyActivityPicker")')) + source.slice(source.indexOf('AsyncFunction("presentFamilyActivityPicker")')).replace(before, after) + '\n// ' + before), false, before);
  }
});
test('public privacy uses the trusted rendered Android disclosure and current photo/Google boundaries', () => {
  const { inspectPublicPrivacyComposition } = require('../scripts/lib/cleanup-source-contract');
  const source = readFileSync('src/features/legal-pages.tsx', 'utf8');
  const catalog = JSON.parse(readFileSync('src/i18n/native-android-catalog.json', 'utf8'));
  assert.equal(inspectPublicPrivacyComposition(source, catalog), true);
  for (const [before, after] of [
    ["from '@/i18n/native-android-catalog.json'", "from './fake-catalog.json'"],
    ['nativeAndroidCopy.freed_accessibility_description,', '"Android Accessibility",'],
    ['Photos are not uploaded.', 'Photos may be uploaded.'],
    ['ML Kit may send operational SDK metrics.', 'No SDK data leaves this device.'],
    ['Browsing activity, journal entries, photos and Screen Time data are not automatically attached.', 'Recovery records are automatically attached.'],
    ['Google processing and retention follow the applicable service terms and configuration.', 'Google never retains any data.'],
    ['Turning cloud chat off stops future messages; a request already sent may finish. Built-in guidance remains available.', 'Cloud chat is always enabled.'],
  ]) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectPublicPrivacyComposition(source.replace(before, after) + '\n// ' + before, catalog), false, before);
  }
  assert.equal(inspectPublicPrivacyComposition(source, { ...catalog, freed_accessibility_description: 'Android Accessibility' }), false);
});
test('public legal routes preserve web deletion and the native controller confirmation path', () => {
  const { inspectPublicPrivacyComposition } = require('../scripts/lib/cleanup-source-contract');
  const source = readFileSync('src/features/legal-pages.tsx', 'utf8'), catalog = JSON.parse(readFileSync('src/i18n/native-android-catalog.json', 'utf8'));
  const context = {
    routes: Object.fromEntries([['PrivacyPolicyPage','privacy'],['SupportPage','support'],['AccountDeletionPage','account-deletion']].map(([name,path]) => [name,readFileSync(`app/${path}.tsx`,'utf8')])),
    locales: Object.fromEntries(['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans'].map(locale => [locale,JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`,'utf8'))])),
    website: readFileSync('website/build-legal-pages.js','utf8'),
  };
  assert.equal(inspectPublicPrivacyComposition(source,catalog,context),true);
  for (const [before,after] of [
    ["Platform.OS === 'web'", 'true'],
    ['<AccountDeletionPage /> : <NativeAccountDeletion />', '<NativeAccountDeletion /> : <AccountDeletionPage />'],
    ['return controller.renderAccountDeletion();', 'return null;'],
    ["from '@/features/freed-app'", "from './fake-controller'"],
  ]) { const route=context.routes.AccountDeletionPage;assert.ok(route.includes(before),before);const changed=route.replace(before,after);assert.notEqual(changed,route);assert.equal(inspectPublicPrivacyComposition(source,catalog,{...context,routes:{...context.routes,AccountDeletionPage:changed+'\n// '+before}}),false,before); }
});
test('mode-aware readiness rejects authorization, target, native-ready and saved-mode bypass', () => {
  const { inspectModeAwareReadiness } = require('../scripts/lib/cleanup-source-contract');
  const readiness = readFileSync('src/lib/protection-readiness.ts', 'utf8');
  const guard = readFileSync('src/lib/app-guard.ts', 'utf8');
  assert.equal(inspectModeAwareReadiness(readiness, guard), true);
  assert.equal(inspectModeAwareReadiness(readiness.replace('const appInterventionReady = appGuard.ready;', 'const appInterventionReady = true;'), guard), false);
  for (const [before, after] of [
    ['targets > 0 && authorized && configured', 'true'],
    ['status?.appGuardReady === true', 'true'],
    ['status.appGuardMode === expectedMode', 'true'],
    ['status?.appSchedulesServiceConnected === true', 'true'],
  ]) {
    assert.ok(guard.includes(before));
    assert.equal(inspectModeAwareReadiness(readiness, guard.replace(before, after) + '\n// ' + before), false, before);
  }
});
test('setup completion requires refreshed native status, signature and exact checked diagnostics', () => {
  const { inspectPermissionActivation } = require('../scripts/lib/cleanup-source-contract');
  const helper = readFileSync('src/lib/protection-setup-completion.ts', 'utf8');
  assert.equal(inspectPermissionActivation(controller, helper), true);
  for (const [before, after] of [
    ['if (canFinishProtectionSetup(activationTest, fresh.activationReady, signature)) onContinue();', 'if (activationComplete) onContinue();'],
    ['activationTest?.statusSignature === currentProtectionActivationSignature', 'true'],
    ['nativeReady: freshReadiness.activationReady && nativeDiagnostics.nativeChecksPassed', 'nativeReady: true'],
    ['nativeChecked: nativeDiagnostics.checkedNativeLayer', 'nativeChecked: true'],
  ]) {
    assert.ok(controller.includes(before));
    assert.equal(inspectPermissionActivation(controller.replace(before, after) + '\n// ' + before, helper), false, before);
  }
  for (const before of ['test.nativeChecked === true', 'test.nativeReady === true', 'test.statusSignature === freshSignature']) {
    assert.ok(helper.includes(before));
    assert.equal(inspectPermissionActivation(controller, helper.replace(before, 'true') + '\n// ' + before), false, before);
  }
});
test('localized Usage Access rationale is rendered with deliberate return and back actions', () => {
  const { inspectUsageAccessRationale } = require('../scripts/lib/cleanup-source-contract');
  const activity = readFileSync('modules/freed-protection/android/src/main/java/app/freed/protection/FreedUsageAccessConfigActivity.kt', 'utf8');
  const strings = readFileSync('modules/freed-protection/android/src/main/res/values/strings.xml', 'utf8');
  assert.equal(inspectUsageAccessRationale(activity, strings), true);
  for (const [before, after] of [
    ['R.string.freed_usage_access_reason', 'R.string.freed_usage_title'],
    ['R.string.freed_usage_note', 'R.string.freed_usage_title'],
    ['setOnClickListener { openFreedSetup() }', 'setOnClickListener { finishCleanly() }'],
    ['setOnClickListener { finishCleanly() }', 'setOnClickListener { openFreedSetup() }'],
  ]) {
    assert.ok(activity.includes(before));
    assert.equal(inspectUsageAccessRationale(activity.replace(before, after) + '\n// ' + before, strings), false, before);
  }
  assert.equal(inspectUsageAccessRationale(activity, strings.replace('does not read screen contents, messages, keystrokes, browsing history, or raw usage events', 'reads screen contents and browsing history')), false);
});

const ts = require('typescript');
function replaceNamedBody(source, name, replacement) {
  const ast = ts.createSourceFile('mutation.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let body;
  const visit = node => {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === name && node.initializer && ts.isArrowFunction(node.initializer)) body = node.initializer.body;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(body, name);
  return source.slice(0, body.getStart(ast)) + replacement + source.slice(body.end);
}
function replaceNamedDeclaration(source, name, replacement) {
  const line = source.split('\n').find(line => line.trimStart().startsWith('const ' + name + ' ='));
  assert.ok(line, name);
  return source.replace(line, '  const ' + name + ' = ' + replacement + ';') + '\n// ' + line;
}
test('review reward data flow rejects fabricated adapter and resolved SDK reward', () => {
  const { inspectRewardedResetChoice } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(inspectRewardedResetChoice(controller, rewardedSources), true);
  for (const [file, before, after] of [
    ['adapter', 'const rewardGranted = typeof result === "boolean" ? result : result.rewardGranted;', 'const rewardGranted = true;'],
    ['runtime', 'resolve({ rewardGranted: accepted, message });', 'resolve({ rewardGranted: true, message });'],
    ['adapter', 'status: rewardGranted ? "completed" : "failed",\n          rewardGranted,', 'status: rewardGranted ? "completed" : "failed",\n          rewardGranted: true,'],
  ]) {
    assert.ok(rewardedSources[file].includes(before));
    assert.equal(inspectRewardedResetChoice(controller, { ...rewardedSources, [file]: rewardedSources[file].replace(before, after) + '\n// ' + before }), false, file);
  }
});
test('review guided authority preserves live origin, active route, forwarding, refresh and finite freshness', () => {
  const { inspectRewardedResetChoice } = require('../scripts/lib/cleanup-source-contract');
  assert.equal(inspectRewardedResetChoice(controller, rewardedSources), true);
  const context = '`${activeAttempt?.nativeInterventionId ?? activeAttempt?.detectedAt ?? "manual"}:${activeAttempt?.source ?? "manual"}:${JSON.stringify(activeAttempt?.scope ?? null)}:${selectedChallenge?.id ?? "recommended"}:${guidedRouteFeature ?? "none"}`';
  const active = 'screen === "ad" || screen === "challenge" || screen === "intercept" || (screen === "feature" && guidedRouteFeature === "guided-reset")';
  for (const [file, before, after] of [
    ['hook', '...(authority ? { refreshEligibility: (isCurrent: () => boolean) => live.current.authority!.refreshEligibility(isCurrent) } : {}),', ''],
    ['hook', 'live.current = { ownerUid, tier, active, contextKey, recheckTier, authority };', 'live.current = { ownerUid, tier, active: true, contextKey: "constant-origin", recheckTier, authority };'],
    ['access', 'freshUntil = o.now() + GUIDED_AD_FRESHNESS_MS;', 'freshUntil = Infinity;'],
    ['access', 'GUIDED_AD_FRESHNESS_MS = 30000', 'GUIDED_AD_FRESHNESS_MS = Infinity'],
    ['controller', context, '"constant-origin"'],
    ['controller', active, 'true'],
    ['controller', 'if (!isCurrent() || getFirebaseAccountScope() !== owner || review?.ownerUid !== owner) return "unknown";', 'if (false) return "unknown";'],
  ]) {
    const original = file === 'controller' ? controller : rewardedSources[file];
    assert.ok(original.includes(before), before);
    const changed = original.replace(before, after) + '\n/* original: ' + before + ' */';
    assert.equal(file === 'controller' ? inspectRewardedResetChoice(changed, rewardedSources) : inspectRewardedResetChoice(controller, { ...rewardedSources, [file]: changed }), false, before);
  }
  assert.equal(inspectRewardedResetChoice(replaceNamedBody(controller, 'refreshGuidedEligibility', '{ return "free"; }'), rewardedSources), false);
});
test('review native readiness binds capability, selected targets, configuration and actual returned ready', () => {
  const { inspectModeAwareReadiness } = require('../scripts/lib/cleanup-source-contract');
  const readiness = readFileSync('src/lib/protection-readiness.ts', 'utf8');
  const guard = readFileSync('src/lib/app-guard.ts', 'utf8');
  assert.equal(inspectModeAwareReadiness(readiness, guard), true);
  for (const [name, value] of [['authorized', 'true'], ['targets', '1'], ['configured', 'true'], ['modern', 'false'], ['knownMode', 'true']]) {
    assert.equal(inspectModeAwareReadiness(readiness, replaceNamedDeclaration(guard, name, value)), false, name);
  }
  const returned = 'return { mode, targets, authorized, configured, ready, scope,';
  assert.ok(guard.includes(returned));
  assert.equal(inspectModeAwareReadiness(readiness, guard.replace(returned, 'return { mode, targets, authorized, configured, ready: true, scope,')), false);
});
test('review legal policy requires sections and supplied body paragraphs in the actual returned render tree', () => {
  const { inspectPublicPrivacyComposition } = require('../scripts/lib/cleanup-source-contract');
  const source = readFileSync('src/features/legal-pages.tsx', 'utf8');
  const catalog = JSON.parse(readFileSync('src/i18n/native-android-catalog.json', 'utf8'));
  assert.equal(inspectPublicPrivacyComposition(source, catalog), true);
  for (const [before, after] of [
    ['                  {paragraph}\n', '                  {null}\n'],
    ['sections.map((section)', '[].map((section)'],
    ['section.body.map((paragraph)', '[].map((paragraph)'],
    ['{sections.map((section)', '{false && sections.map((section)'],
    ['{section.body.map((paragraph)', '{false && section.body.map((paragraph)'],
  ]) {
    assert.ok(source.includes(before), before);
    assert.equal(inspectPublicPrivacyComposition(source.replace(before, after) + '\n// ' + before, catalog), false, before);
  }
});
