import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { CHALLENGE_TEMPLATES } from '../src/data/challenge-templates';
import { challengeLibrary } from '../src/lib/recovery-engine';
import { configureNativeMonetizationProvider, createRewardedResetSession, completeRewardedResetSession, getMonetizationConfig, type RewardedResetSession } from '../src/lib/monetization';
import { createNativeMonetizationAdapter, createAdMobRewardedAdapter } from '../src/lib/native-monetization-adapter';

// Immutable reviewed expectations; the private task receipt is provenance only.
import baseline from './fixtures/current-app-copy-baseline.json';
const structural = (c: any) => ({id:c.id,category:c.category,durationSec:c.durationSec,intensity:c.intensity,premium:c.premium,icon:c.icon,verification:c.verification,families:c.families,contexts:c.contexts,tags:c.tags});
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

test('copy edits preserve every generated catalog identity and versioned rule', () => {
  assert.equal(CHALLENGE_TEMPLATES.length, baseline.catalogCount);
  assert.equal(hash(CHALLENGE_TEMPLATES.map(structural)), baseline.catalogWithoutTitleStructuralHash);
  assert.equal(hash(challengeLibrary.map(structural)), baseline.legacyWithoutTitleStructuralHash);
  assert.equal(hash(CHALLENGE_TEMPLATES.map(c=>({id:c.id,title:c.title}))),baseline.approvedCatalogTitleHash);
  assert.equal(hash(challengeLibrary.map(c=>({id:c.id,title:c.title}))),baseline.approvedLegacyTitleHash);
});

test('all generated and legacy instructions avoid unsupported body and craving outcome claims', () => {
  const claims = /adrenaline|endorphins|dopamine|BDNF|prefrontal cortex|oxytocin|neurochemistry|alpha state|floods|rewires|craving-incompatible|collapses craving|weakens the loop permanently|fastest known|cannot survive a recipe|medicine that|dive reflex|autonomic|chemistry toward|chemical of craving|physically signals safety|resonance of your heart and brain/i;
  for (const c of [...CHALLENGE_TEMPLATES, ...challengeLibrary]) assert.doesNotMatch([c.why,...c.steps].join(' '), claims, c.id);
});

test('legacy breathing choices give permission to skip holds and switch comfortably', () => {
  for (const c of [...CHALLENGE_TEMPLATES,...challengeLibrary].filter(c => /^(?:breathing-478|box-breathing|wim-hof-rounds)(?:--|$)/.test(c.id))) {
    assert.match([c.why,...c.steps].join(' '), /optional|if comfortable/i, c.id);
    assert.match([c.why,...c.steps].join(' '), /skip|switch|another reset/i, c.id);
    assert.doesNotMatch(c.steps.join(' '), /Hold the breath for 7 counts\.|Hold for seven\.|Hold for 15 seconds\. Repeat|30 full breaths|forcefully/i, c.id);
  }
});

test('physical instructions remain voluntary with fewer reps and quiet or seated alternatives', () => {
  for (const c of [...CHALLENGE_TEMPLATES,...challengeLibrary].filter(c=>c.category==='physical')) {
    assert.match(c.why, /optional/i, c.id);
    assert.match(c.why, /comfortable/i, c.id);
    assert.match(c.why, /fewer|seated|quiet/i, c.id);
    assert.doesNotMatch(c.steps.join(' '), /explosively|stay submerged|immerse|face into|push through|isometric burn/i, c.id);
  }
});

const ready: RewardedResetSession = {id:'missing-ad',provider:'native',status:'ready',durationSeconds:1,message:'Ready'};
function unavailable(result: {message: string; rewardGranted?: boolean}) {
  if ('rewardGranted' in result) assert.equal(result.rewardGranted, false);
  assert.doesNotMatch(result.message, /unlocked|starts a brief no-ad|complete|success/i);
  assert.match(result.message, /unavailable|could not|retry/i);
  assert.match(result.message, /Basic help/i);
}
test('actual unavailable and failing fallback results never promise challenge access', async t => {
  configureNativeMonetizationProvider(null);
  t.after(()=>configureNativeMonetizationProvider(null));
  const session=createRewardedResetSession({mode:'native',platform:'web'});
  assert.equal(session.status,'fallback'); unavailable(session);
  unavailable(await completeRewardedResetSession(session));
  configureNativeMonetizationProvider({completeRewardedResetSession:async()=>{throw new Error('provider unavailable');}});
  unavailable(await completeRewardedResetSession(ready));
  const config=getMonetizationConfig({mode:'native',platform:'web'});
  const provider=createNativeMonetizationAdapter({rewardedAds:{createSession:()=>ready,completeSession:async()=>{throw new Error('bridge failure');}}});
  unavailable(await provider.completeRewardedResetSession!(ready,config));
  const adapter=createAdMobRewardedAdapter({createRewardedAd:()=>({}),showRewardedAd:async()=>false});
  unavailable(await adapter.completeSession(ready,config));
});

function privacyMismatch(app:string): string[] {
  const required=[/absolute UTC-day counts of check-ins and completed challenges/,/schema and consent versions/,/lineage, revision and snapshot identifiers/,/authenticated account UID/,/rates, streak summaries and challenge categories stay local/,/configured 14-day expiry/,/physical deletion may occur later/,/account-linked quota and request deduplication metadata/,/configured 7-day expiry/,/does not promise a fixed Google retention period or zero retention/,/server-side account and account-linked data deletion before clearing this device and signing out/,/accepted request means deletion is in progress/,/native acknowledgment/,/provider authorization revocation/];
  return required.filter(pattern=>!pattern.test(app)).map(String);
}
test('active app privacy discloses real snapshots, service metadata and deletion boundaries', () => {
  const app=readFileSync('src/features/legal-pages.tsx','utf8');
  assert.deepEqual(privacyMismatch(app),[]);
  assert.doesNotMatch(app,/until authenticated self-service account deletion is live|counts, rates, streak summaries, and challenge completion categories|optional AI audit summaries/);
});
test('privacy assertions reject loss of UID, TTL delay or deletion acceptance boundary',()=>{
  const app=readFileSync('src/features/legal-pages.tsx','utf8');
  for(const phrase of ['authenticated account UID','physical deletion may occur later','accepted request means deletion is in progress']) assert.ok(privacyMismatch(app.replaceAll(phrase,'missing boundary')).length>0,phrase);
});
test('privacy facts are bound to active local source and reviewed website references',()=>{
 const analytics=readFileSync('functions/src/aggregate-analytics.ts','utf8'),quota=readFileSync('functions/src/clara-quota.ts','utf8'),website=readFileSync('website/build-legal-pages.js','utf8'),profile=readFileSync('src/features/freed-app.tsx','utf8');
 assert.match(analytics,/ANALYTICS_RETENTION_MS = 14 \* DAY_MS/); assert.match(analytics,/\{ uid, schemaVersion/);
 assert.match(analytics,/checkIns/); assert.match(analytics,/completedChallenges/); assert.match(analytics,/userOptedInAt/);
 assert.match(quota,/idempotencyTtlMs:7\*86400000/); assert.match(website,/physical deletion may occur later/);
 assert.ok(profile.indexOf('await contracts.requestAccountDeletion')<profile.indexOf('try { await deleteLocalRecoveryData(); await signOutFirebaseAccount(); }'));
 assert.match(profile,/result.status !== "deleting"/);
});

test('new authored copy and changed generated titles translate in all ten locales with opaque URLs preserved', async () => {
  const { translateAuthoredSource }=await import('../src/i18n/source-translation');
  const batch=JSON.parse(readFileSync('src/i18n/batches/current-app-truthful-copy-20261005.json','utf8'));
  const changed=CHALLENGE_TEMPLATES.filter(c=>c.id.startsWith('wim-hof-rounds--')||c.id.startsWith('cold-water--')||c.id==='cold-water'||c.id.startsWith('cold-face-dunk--')||c.id.startsWith('splash-cold-water-on-face--')||c.id==='extra-shower-cold-warm'||c.id==='premium-cold-plunge');
  for (const locale of ['hi','es','pt','fr','de','ar','ja','ko','zh-Hans']) {
    const resource=JSON.parse(readFileSync(`src/i18n/locales/${locale}.json`,'utf8')).source;
    for(const entry of batch.entries) assert.equal(resource[entry.source],entry.translations[locale],`${locale}: ${entry.source}`);
    for(const c of changed) {
      const translated=translateAuthoredSource(c.title,resource,0,locale);
      assert.notEqual(translated,c.title,`${locale}: ${c.title}`);
      assert.doesNotMatch(translated,/comfortable breathing pause|seated device movement pause|comfortable water pause/i,`${locale}: partially translated ${c.title}`);
    }
    const url='https://freed-landing.web.app/account-deletion';
    const translated=translateAuthoredSource(`The public account deletion URL is ${url}. Contact support if you cannot access the app.`,resource,0,locale);
    assert.ok(translated.includes(url));assert.doesNotMatch(translated,/\{\{/);
    assert.equal(translateAuthoredSource('Private recovery text: this is my personal note.',resource,0,locale),'Private recovery text: this is my personal note.');
  }
});

test('copy corrections preserve selection and monetization algorithms outside approved catalog display assembly', async()=>{
  const ts=await import('typescript');const printer=ts.createPrinter({removeComments:true});
  const observed: Record<string,string>={};
  const files=[...new Set(Object.keys(baseline.algorithmFunctionHashes).map(key=>key.split('#')[0]))];
  for(const file of files){
    const source=readFileSync(file,'utf8').replaceAll(JSON.stringify('Rewarded ads are unavailable. Retry later or open Basic help.'),'"COPY_MESSAGE"');
    const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
    for(const node of ast.statements){
      if(!ts.isFunctionDeclaration(node)||!node.name||['buildTemplatesFromSeed','buildAll'].includes(node.name.text))continue;
      const rendered=printer.printNode(ts.EmitHint.Unspecified,node,ast);
      observed[file+'#'+node.name.text]=createHash('sha256').update(rendered).digest('hex');
    }
  }
  assert.deepEqual(observed,baseline.algorithmFunctionHashes);
});
