import {getJourneyOwner} from '../src/lib/user-journey';
import {createAccountOperationGate} from '../src/lib/account-operation';
import {isAppGroupBindingConfirmed} from '../modules/freed-protection/src/app-group-binding';
import {clearEarnedTimeReference} from '../src/lib/earned-time-reference';
import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import ts from 'typescript';
import { createPaywallNavigationSession } from '../src/lib/paywall-navigation';
import { sanitizePremiumEntitlement, hasVerifiedPremium } from '../src/lib/premium-entitlement';
import { hasReviewAccess } from '../src/lib/review-access';
import { setVerifiedPremiumEntitlement } from '../src/lib/recovery-state';
import { createGuidedResetAccessController } from '../src/lib/guided-reset-access';
import { createChallengeSessionController } from '../src/lib/challenge-session';
import { createDefaultRecoveryState, recordChallengeCompletion, recordEarnedUnlock } from '../src/lib/recovery-state';
import { getProtectionChallengeCompletionDecision } from '../src/lib/protection-capabilities';
import { canonicalAppBreakStartedAt, nativeGrantConfirmsUnlock, requiresNativeUnlockConfirmation } from '../src/lib/native-unlock-confirmation';
import { createNativeInterventionAttempt, unlockSourceForAttempt } from '../src/lib/native-intervention';
import { parseFeatureId } from '../src/lib/feature-catalogue';
// Evaluate the actual root controller closures; service/route IO is supplied at its boundary.
const source = fs.readFileSync('src/features/freed-app.tsx', 'utf8');
const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function productionClosure(name: string, deps: Record<string, unknown>) {
    let declaration: ts.VariableDeclaration | undefined;
    function visit(node: ts.Node) { if (ts.isVariableDeclaration(node) && node.name.getText(tree) === name)
        declaration = node;
    else
        ts.forEachChild(node, visit); }
    visit(tree);
    assert.ok(declaration?.initializer, name);
    const code = ts.transpileModule(`const closure = ${declaration.initializer.getText(tree)}; exports.closure = closure;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React } }).outputText;
    const out: any = {};
    new Function(...Object.keys(deps), 'exports', code)(...Object.values(deps), out);
    return out.closure;
}
test('root Watch request is active only for the focused guided feature and binds its route context', () => {
  let call: ts.CallExpression | undefined;
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && node.expression.getText(tree) === 'useGuidedResetAccess') call = node;
    ts.forEachChild(node, visit);
  }
  visit(tree); assert.ok(call);
  const evaluate = (index: number, feature: string) => {
    const deps = { screen: 'feature', guidedRouteFeature: feature, activeAttempt: null, selectedChallenge: null };
    const code = ts.transpileModule(`exports.value = ${call!.arguments[index].getText(tree)};`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const out: any = {}; new Function(...Object.keys(deps), 'exports', code)(...Object.values(deps), out); return out.value;
  };
  assert.equal(evaluate(3, 'guided-reset'), true);
  assert.equal(evaluate(3, 'monthly-report'), false);
  assert.notEqual(evaluate(4, 'guided-reset'), evaluate(4, 'monthly-report'));
});
test('production shared standalone gateway opens offer, preserves selected activity and resumes existing session', () => {
    const routes: string[] = [], selected: any[] = [];
    let existing: any = null;
    let cleared = false;
    const start = productionClosure('startChallenge', { React: { useCallback: (f: any) => f }, challengeSession: { getSnapshot: () => ({ session: existing }) }, setProtectionSyncMessage: () => { }, setChallengeBreakNotice: () => { }, setSelectedChallenge: (c: any) => selected.push(c), setScreen: (s: string) => routes.push(s) });
    const standalone = productionClosure('startStandaloneChallenge', { React: { useCallback: (f: any) => f }, challengeBreakOrigin:{current:null},journeyOwner:'owner',ownerLease:null,hydrated:true,storageReady:true,guidedAccess:{grant:null,canEnter:()=>false},setActiveAttempt: (v: any) => { cleared = v === null; }, startChallenge: start });
    standalone({ id: 'chosen' });
    assert.deepEqual(routes, ['ad']);
    assert.equal(selected[0].id, 'chosen');
    assert.equal(cleared, true);
    existing = { phase: 'paused', challenge: { id: 'ongoing' } };
    standalone({ id: 'another' });
    assert.equal(selected[1].id, 'ongoing');
    existing = { phase: 'completed' };
    standalone();
    assert.equal(routes.length, 2);
});
test('actual focused guided feature Go Pro returns exactly on free exit or purchase token', () => {
  for (const purchased of [false, true]) {
    const nav = createPaywallNavigationSession<'feature'|'paywall'|'ad'>('feature');
    const pushes: any[] = []; const screens: string[] = [];
    const deps = { paywallNavigationRef: { current: nav }, setScreen: (screen: any) => { screens.push(screen); nav.update(screen); }, parseFeatureId,
      getJourneyOwner,getFirebaseAuthSnapshot:()=>({status:'ready',signedIn:true,anonymous:false,ownerUid:'owner',email:null}),getFirebaseAccountScope:()=> 'owner',accountOperationGate:{current:createAccountOperationGate(()=> 'owner')},replaceFeature:(feature:string,current:()=>boolean)=>{if(current())pushes.push({pathname:'/flow/feature',params:{feature}});},profilePaywallOrigin:{current:null},router: { replace: (href: any) => pushes.push(href) }, postPaywallScreen: (screen: string) => screen };
    const openPaywall = productionClosure('openPaywall', deps);
    // Execute the actual offer's onPro callback with the focused route parameter.
    let onPro: ts.Expression | undefined;
    function find(node: ts.Node) {
      if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && node.tagName.getText(tree) === 'GuidedResetOffer') {
        const attr = node.attributes.properties.find(a => ts.isJsxAttribute(a) && a.name.getText(tree) === 'onPro') as ts.JsxAttribute;
        onPro = (attr.initializer as ts.JsxExpression).expression;
      }
      ts.forEachChild(node, find);
    }
    find(tree); assert.ok(onPro);
    const js = ts.transpileModule(`exports.open = ${onPro.getText(tree)}`, {compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.CommonJS}}).outputText;
    const exported: any = {}; new Function('openPaywall','parseFeatureId','featureId','exports',js)(openPaywall,parseFeatureId,'guided-reset',exported);
    exported.open(); assert.deepEqual(screens,['paywall']);
    const purchaseToken = nav.capture(); assert.equal(purchaseToken?.featureId,'guided-reset');
    const back = productionClosure('returnFromPaywall',deps);
    if (purchased) back(purchaseToken); else back();
    assert.deepEqual(pushes,[{pathname:'/flow/feature',params:{feature:'guided-reset'}}]);
    nav.update('ad'); openPaywall(); back(purchaseToken);
    assert.equal(pushes.length,1); // An old successful checkout cannot reuse feature context.
    back(); assert.equal(screens.at(-1),'ad');
  }
});
test('production safe exit remains available on cleanup failure and retains the saved receipt', () => {
    let ended = false, abandoned = false, route = 'challenge';
    let receipt: any = { phase: 'paused', id: 'session' };
    const exit = productionClosure('abandonActiveProtectionFlow', { React: { useCallback: (f: any) => f }, challengeSession: { getSnapshot: () => ({ session: receipt }), pause: () => {}, abandon: () => { abandoned = true; receipt = null; } }, persistRecoveryState: () => { }, recordChallengeCompletion: () => { }, challengeBreakOrigin: { current: null }, discardChallengeSession: () => { if (!ended) return false; abandoned = true; receipt = null; return true; }, setProtectionSyncMessage: () => { }, setActiveAttempt: () => { }, setSelectedChallenge: () => { }, setScreen: (s: string) => route = s });
    exit();
    assert.equal(abandoned, false);
    assert.equal(route, 'main');
    ended = true;
    exit();
    assert.equal(abandoned, true);
    assert.equal(route, 'main');
});
test('earned repair retry refreshes uncertain access without requesting another ad', () => {
  let eligible = false, reveals = 0, membershipChecks = 0, reviewChecks = 0;
  const repair = jsxCallback('GuidedResetOffer', 'onRepair', {
    guidedAccess: { repair: () => eligible }, reveal: () => { reveals++; },
    retryAccess: () => { membershipChecks++; }, reviewAccess: { retry: () => { reviewChecks++; } }
  });
  repair(); assert.equal(reveals, 0); assert.equal(membershipChecks, 1); assert.equal(reviewChecks, 1);
  eligible = true; repair(); assert.equal(reveals, 1); assert.equal(membershipChecks, 1); assert.equal(reviewChecks, 1);
});

function jsxCallback(component: string, attribute: string, deps: Record<string,unknown>) {
 let expression: ts.Expression|undefined;
 function visit(node: ts.Node) {
  if((ts.isJsxSelfClosingElement(node)||ts.isJsxOpeningElement(node))&&node.tagName.getText(tree)===component){
   const attr=node.attributes.properties.find(p=>ts.isJsxAttribute(p)&&p.name.getText(tree)===attribute) as ts.JsxAttribute;
   if(attr?.initializer&&ts.isJsxExpression(attr.initializer)) expression=attr.initializer.expression;
  }
  ts.forEachChild(node,visit);
 }
 visit(tree);assert.ok(expression);const out:any={};const code=ts.transpileModule(`exports.callback = ${expression.getText(tree)}`,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 new Function(...Object.keys(deps),'exports',code)(...Object.values(deps),out);return out.callback;
}
function completionHarness(accepted=true) {
 const challenge={id:'completed',title:'Breathe',category:'breathing',durationSec:2,intensity:'calm',premium:false,icon:'Waves',why:'Pause.',steps:['Inhale.','Exhale.']} as const;
 const timestamp=Date.now();let receipt:any={id:'session',ownerId:'owner',phase:'completed',challenge,elapsedMs:1500,completion:{outcome:'unknown',completedAtMs:timestamp}};
 const attempt=createNativeInterventionAttempt({host:'com.google.android.youtube',sourcePackage:'com.google.android.youtube',matchedRule:'configured-app:com.google.android.youtube',reason:'Selected app paused.',detectedAt:new Date(timestamp).toISOString(),interventionId:'11111111-1111-4111-8111-111111111111',scope:{kind:'android-package',packageName:'com.google.android.youtube'}});
 const origin:any={current:{ownerUid:'owner',sessionId:'session',attempt}};const state={current:createDefaultRecoveryState()};let calls=0;const notices:string[]=[];
 const deps:any={getProtectionActionScope:()=> '["owner",1]',captureProtectionActionTicket:()=>({isCurrent:()=>true}),accountFlowFence:{current:{isActive:()=>false}},isAppGroupBindingConfirmed,setAppGroupActionScope:async()=>({version:1,operationId:'c0c660e3-55bf-4930-a729-a1728ec2fc1f',supported:true,accepted:true,bindingCurrent:true,ownerVerified:true,stage:'complete',reason:null,generation:1,scopeEpoch:1,errorCode:null,errorDomain:null}),journeyOwner:'owner',getFirebaseAccountScope:()=> 'owner',challengeSession:{getSnapshot:()=>({session:receipt})},challengeBreakOrigin:origin,activeAttemptRef:{current:attempt},recoveryStateRef:state,
  persistRecoveryState:(update:any)=>{state.current=update(state.current)},recordChallengeCompletion,recordEarnedUnlock,unlockSourceForAttempt,getProtectionChallengeCompletionDecision,canonicalAppBreakStartedAt,requiresNativeUnlockConfirmation,nativeGrantConfirmsUnlock,
  Platform:{OS:'android'},guidedAccess:{end:()=>true},setProtectionSyncMessage:(v:string)=>notices.push(v),setChallengeBreakNotice:(v:string)=>notices.push(v),setProtectionStatus:()=>{},refreshProtectionStatus:async()=>{},
  applyEarnedUnlockWindow:async(expiresAt:string,_source:string,id:string)=>{calls++;return{nativeUnlockGrantAccepted:accepted,nativeUnlockGrantInterventionId:id,activeUnlockInterventionId:id,activeUnlockExpiresAt:expiresAt,activeUnlockSourcePackage:'com.google.android.youtube'}},
  applyFocusShieldEarnedUnlock:async()=>{throw Error('wrong scope')},discardChallengeSession:()=>{receipt=null;return true},setActiveAttempt:()=>{},setSelectedChallenge:()=>{},setScreen:()=>{}};
 const save=productionClosure('saveCompletedChallenge',deps);const get=productionClosure('getCompletedBreakAttempt',deps);const request=productionClosure('requestCompletedAppBreak',{...deps,getCompletedBreakAttempt:get});const feedback=jsxCallback('ChallengeScreen','onFeedback',deps);
 return {save:()=>save(challenge,'unknown',{id:'session',completedAtMs:timestamp}),request:()=>request('session'),feedback:(outcome:string)=>feedback('session',outcome),calls:()=>calls,state,origin,notices};
}
test('actual completion saves neutral activity without native mutation; explicit app-break action requests once',async()=>{
 const h=completionHarness();assert.equal(h.save(),true);assert.equal(h.calls(),0);assert.equal(h.state.current.challengeHistory.length,1);assert.equal(h.state.current.challengeHistory[0].observedActiveSec,1.5);assert.equal(h.state.current.earnedUnlocks.length,0);
 const first=h.request();const second=h.request();assert.equal(await first,true);assert.equal(await second,false);assert.equal(h.calls(),1);assert.equal(h.state.current.earnedUnlocks.length,1);assert.equal(h.save(),true);assert.equal(await h.request(),false);assert.equal(h.calls(),1);
});
for(const outcome of ['helped','still-urging','unknown'])test(`actual ${outcome} feedback cannot request or renew app access`,async()=>{
 const h=completionHarness();h.save();assert.equal(h.feedback(outcome),true);assert.equal(h.calls(),0);assert.equal(await h.request(),false);assert.equal(h.state.current.challengeHistory.length,1);
});
test('native break rejection retains completion, never saves an unlock or retries automatically',async()=>{
 const h=completionHarness(false);h.save();assert.equal(await h.request(),false);assert.equal(h.calls(),1);assert.equal(h.state.current.challengeHistory.length,1);assert.equal(h.state.current.earnedUnlocks.length,0);assert.match(h.notices.at(-1)!,/unavailable/);assert.equal(await h.request(),false);assert.equal(h.calls(),1);
});
test('restored completion without the original live binding cannot request a native break',async()=>{
 const h=completionHarness();h.origin.current=null;assert.equal(h.save(),true);assert.equal(await h.request(),false);assert.equal(h.calls(),0);assert.equal(h.state.current.challengeHistory.length,1);
});

for(const failure of ['activity','access'])test(`actual discard transaction survives ${failure} removal failure and restart`,()=>{
 const values=new Map<string,string>();let fail:string|null=null;let accessRemoves=0;
 const storage={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>{values.set(key,value)},removeItem:(key:string)=>{if(key.startsWith('freed.guided'))accessRemoves++;if((fail==='activity'&&key==='activity')||(fail==='access'&&key.startsWith('freed.guided')))throw Error('disk');values.delete(key)}};
 const makeAccess=()=>createGuidedResetAccessController({ownerUid:'u',storage,currentOwner:()=> 'u',currentTier:()=> 'paid',isForeground:()=>true,now:()=>Date.now(),createId:()=> 'same',createReward:()=>{throw Error()},completeReward:async()=>{throw Error()}});
 let access=makeAccess();access.hydrate();access.startLicensed();
 const makeActivity=()=>createChallengeSessionController({ownerId:'u',storage,storageKey:'activity',wallNow:Date.now,monotonicNow:()=>0,createId:()=> 'same',access});
 let activity=makeActivity();activity.hydrate();activity.start({id:'one',title:'Breathe',category:'breathing',durationSec:2,intensity:'calm',premium:false,icon:'Waves',why:'Pause.',steps:['Inhale.','Exhale.'],verification:{version:1,kind:'timer'}});
 const transaction=()=>productionClosure('discardChallengeSession',{clearEarnedTimeReference,localStorage:storage,earnedResumeEpoch:{current:0},challengeBreakOrigin:{current:null},React:{useCallback:(f:any)=>f},challengeSession:{getSnapshot:()=>activity.read(),abandon:()=>{try{return activity.abandon()}catch{return activity.read()}}},guidedAccess:{beginDiscard:(id:string)=>{try{return access.beginDiscard(id)}catch{return false}},clear:()=>{try{access.clear();return true}catch{return false}}}});
 fail=failure;assert.equal(transaction()(),false);assert.equal(access.read()?.state,'discarding');assert.equal(access.startLicensed(),false);if(failure==='activity'){assert.equal(accessRemoves,0);assert.equal(activity.read().session?.id,'same')}else{assert.equal(activity.read().session,null);assert.equal(accessRemoves,1)}
 activity.dispose();access.dispose();access=makeAccess();access.hydrate();activity=makeActivity();activity.hydrate();assert.equal(access.read()?.state,'discarding');assert.equal(access.canEnter(),false);assert.equal(access.startLicensed(),false);
 fail=null;assert.equal(transaction()(),true);assert.equal(activity.read().session,null);assert.equal(access.read(),null);assert.equal(access.startLicensed(),true);
});

for(const classification of ['free','paid','review','unknown'])test(`production Watch preflight reads authoritative owner membership and review before ${classification} classification`,async()=>{
 const owner='owner',now=Date.now(),calls:string[]=[],updates:any[]=[];
 const evidence=classification==='paid'?{productId:'freed_premium_monthly',platform:'android',expiresAt:new Date(now+60000).toISOString(),verifiedAt:new Date(now).toISOString(),status:'verified'}:null;
 const review=classification==='unknown'?null:{reviewAccessVersion:1,ownerUid:owner,access:classification==='review'?'review':'none',expiresAt:classification==='review'?new Date(now+60000).toISOString():null,capabilities:classification==='review'?['ad-free','premium-features']:[]};
 const refresh=productionClosure('refreshGuidedEligibility',{journeyOwner:owner,getFirebaseAccountScope:()=>owner,getFirebaseCallableContracts:async()=>({getPremiumEntitlement:async()=>{calls.push('membership');return{entitlement:evidence}}}),reviewAccess:{refresh:async()=>{calls.push('review');return review}},sanitizePremiumEntitlement,hasVerifiedPremium,hasReviewAccess,setVerifiedPremiumEntitlement,setRecoveryState:(fn:any)=>updates.push(fn(createDefaultRecoveryState())),setJourneyMembership:(v:any)=>updates.push(v)});
 assert.equal(await refresh(()=>true),classification);assert.deepEqual(calls.sort(),['membership','review']);assert.equal(updates.length,classification==='unknown'?0:2);
});
test('late authoritative Watch preflight cannot update membership after owner/request context invalidation',async()=>{
 let current=true,resolve!:(v:any)=>void;const updates:any[]=[];
 const refresh=productionClosure('refreshGuidedEligibility',{journeyOwner:'owner',getFirebaseAccountScope:()=> 'owner',getFirebaseCallableContracts:async()=>({getPremiumEntitlement:()=>new Promise(r=>{resolve=r})}),reviewAccess:{refresh:async()=>({reviewAccessVersion:1,ownerUid:'owner',access:'none',expiresAt:null,capabilities:[]})},sanitizePremiumEntitlement,hasVerifiedPremium,hasReviewAccess,setVerifiedPremiumEntitlement,setRecoveryState:(v:any)=>updates.push(v),setJourneyMembership:(v:any)=>updates.push(v)});
 const result=refresh(()=>current);await Promise.resolve();current=false;resolve({entitlement:null});assert.equal(await result,'unknown');assert.deepEqual(updates,[]);
});
