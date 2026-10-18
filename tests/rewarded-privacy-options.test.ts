import assert from 'node:assert/strict';
import { createNativeSdkMonetizationProvider } from '../src/lib/native-monetization-runtime';
import { configureNativeMonetizationBuild } from '../src/lib/monetization';
(async()=>{
 configureNativeMonetizationBuild(false);
 Object.assign(process.env,{NODE_ENV:'production',EXPO_PUBLIC_BUILD_CHANNEL:'internal-testflight',EXPO_PUBLIC_MONETIZATION_MODE:'native',EXPO_PUBLIC_ADMOB_USE_TEST_ADS:'true',EXPO_PUBLIC_ADMOB_APP_ID_IOS:'ca-app-pub-1234567890123456~1234567890'});
 let status:unknown={privacyOptionsRequirementStatus:'REQUIRED'},current=true,fail=false,flip=false,forms=0,requests=0;
 const provider=await createNativeSdkMonetizationProvider({platform:'ios',loader:async name=>name==='react-native-google-mobile-ads'?{
  TestIds:{REWARDED:'ca-app-pub-3940256099942544/1712485313'},RewardedAd:{createForAdRequest:()=>{requests++;throw Error('not expected');}},default:()=>({initialize:async()=>{throw Error('not expected');}}),
  AdsConsent:{getConsentInfo:async()=>{if(flip)current=false;if(status instanceof Error)throw status;return status;},showPrivacyOptionsForm:async()=>{forms++;if(fail)throw {code:'consent-form-error',message:'PRIVATE'};return {canRequestAds:false};}}
 }:null});assert.ok(provider);
 assert.equal(await provider.getAdPrivacyOptionsRequired!(),true);
 assert.equal(await provider.showAdPrivacyOptions!(()=>current),true);assert.equal(forms,1);assert.equal(requests,0);
 fail=true;assert.equal(await provider.showAdPrivacyOptions!(()=>current),false);assert.equal(forms,2);
 fail=false;flip=true;assert.equal(await provider.showAdPrivacyOptions!(()=>current),false);assert.equal(forms,2);
 current=true;flip=false;status={privacyOptionsRequirementStatus:'NOT_REQUIRED'};assert.equal(await provider.getAdPrivacyOptionsRequired!(),false);assert.equal(await provider.showAdPrivacyOptions!(),false);assert.equal(forms,2);
 status=Error('PRIVATE');assert.equal(await provider.getAdPrivacyOptionsRequired!(),null);assert.equal(await provider.showAdPrivacyOptions!(),false);assert.equal(forms,2);assert.equal(requests,0);
 console.log('actual adapter/runtime privacy required, revoked, unavailable, failure and stale foreground guards passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
