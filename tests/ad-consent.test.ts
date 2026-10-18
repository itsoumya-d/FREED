import assert from "node:assert/strict";
import { createAdMobPreparation } from "../src/lib/native-monetization-runtime";
import { createRewardedResetSession, completeRewardedResetSession, configureNativeMonetizationProvider } from "../src/lib/monetization";
async function run(){
  let initialized=0;
  let fallbackInit=0;
  const nativePermitted=createAdMobPreparation({AdsConsent:{gatherConsent:async()=>{throw Object.assign(Error('private'),{code:'consent-update-failed'});},getConsentInfo:async()=>({canRequestAds:true,status:'OBTAINED',privacyOptionsRequirementStatus:'REQUIRED'})},default:()=>({initialize:async()=>{fallbackInit++;}})});
  assert.equal(await nativePermitted(),true,'native current permission allows init after UMP update error');
  assert.equal(fallbackInit,1);
  for(const info of [{canRequestAds:false},{canRequestAds:'true'},null]) {
    const denied=createAdMobPreparation({AdsConsent:{gatherConsent:async()=>{throw Error('private');},getConsentInfo:async()=>info},default:()=>({initialize:async()=>{throw Error('must not initialize');}})});
    assert.equal(await denied(),false);
  }

  const prepare=createAdMobPreparation({AdsConsent:{gatherConsent:async()=>{throw new Error("offline");}},default:()=>({initialize:async()=>{initialized++;}})});
  assert.equal(await prepare(),false,"failed consent lookup must not request an ad");
  assert.equal(initialized,0,"SDK initialization waits for allowed consent");
  const permitted=createAdMobPreparation({AdsConsent:{gatherConsent:async()=>({canRequestAds:true})},default:()=>({initialize:async()=>{initialized++;}})});
  assert.equal(await permitted(),true);
  assert.equal(await permitted(),true);
  assert.equal(initialized,1,"SDK initializes once across reset requests");
  let attempts=0,retryInitializations=0;
  const retry=createAdMobPreparation({AdsConsent:{gatherConsent:async()=>{attempts++;if(attempts===1)throw new Error('offline');return {canRequestAds:true};}},default:()=>({initialize:async()=>{retryInitializations++;}})});
  assert.equal(await retry(),false);
  assert.equal(await retry(),true,"a failed consent lookup must be retryable when connectivity returns");
  assert.equal(await retry(),true);
  assert.equal(attempts,2,"successful preparation remains shared");
  assert.equal(retryInitializations,1);
  let resolveConsent!: (value:{canRequestAds:boolean})=>void;
  let concurrentAttempts=0,concurrentInitializations=0;
  const concurrent=createAdMobPreparation({AdsConsent:{gatherConsent:()=>{concurrentAttempts++;return new Promise(resolve=>{resolveConsent=resolve;});}},default:()=>({initialize:async()=>{concurrentInitializations++;}})});
  const first=concurrent(),second=concurrent();
  assert.equal(concurrentAttempts,1,"concurrent requests share preparation");
  resolveConsent({canRequestAds:true});
  assert.deepEqual(await Promise.all([first,second]),[true,true]);
  assert.equal(concurrentInitializations,1);
  configureNativeMonetizationProvider(null);
  const fallback=await completeRewardedResetSession(createRewardedResetSession({mode:"native",platform:"android"}),{mode:"native",platform:"android"});
  assert.equal(fallback.status,"fallback");
  assert.equal(fallback.rewardGranted,false,"a no-ad recovery fallback cannot invent an SDK reward");
  console.log("ad consent failure and SDK initialization tests passed");
}
void run().catch(error=>{console.error(error);process.exitCode=1;});
