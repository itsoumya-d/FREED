import assert from 'node:assert/strict';
import { configureNativeMonetizationRuntime } from '../src/lib/native-monetization-runtime';
import { awaitRewardedProvider, configureNativeMonetizationBuild, createRewardedResetSession } from '../src/lib/monetization';
(async()=>{
 configureNativeMonetizationBuild(false);
 Object.assign(process.env,{NODE_ENV:'production',EXPO_PUBLIC_BUILD_CHANNEL:'internal-testflight',EXPO_PUBLIC_MONETIZATION_MODE:'native',EXPO_PUBLIC_ADMOB_USE_TEST_ADS:'true',EXPO_PUBLIC_ADMOB_APP_ID_IOS:'ca-app-pub-1234567890123456~1234567890'});
 let imports=0;
 await configureNativeMonetizationRuntime({platform:'ios',loader:async name=>{
  if(name!=='react-native-google-mobile-ads')return null;
  if(++imports===1)throw Error('transient module failure');
  return {TestIds:{REWARDED:'ca-app-pub-3940256099942544/1712485313'},AdsConsent:{gatherConsent:async()=>({canRequestAds:true})},default:()=>({initialize:async()=>{}}),RewardedAd:{createForAdRequest:()=>({load(){},show:async()=>{},addAdEventListener:()=>()=>{}})}};
 }});
 assert.equal(createRewardedResetSession({platform:'ios'}).status,'fallback');
 await Promise.all([awaitRewardedProvider(),awaitRewardedProvider()]);
 assert.equal(createRewardedResetSession({platform:'ios'}).status,'ready','explicit retry recovers a transient SDK module import failure');
 assert.equal(imports,2,'concurrent retry uses one provider import');
 console.log('native provider retry passed');
})().catch(error=>{console.error(error);process.exitCode=1;});
