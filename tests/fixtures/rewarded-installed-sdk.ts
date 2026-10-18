import assert from 'node:assert/strict';
import { RewardedAd } from '../../node_modules/react-native-google-mobile-ads/src/ads/RewardedAd';
import { AdsConsent } from '../../node_modules/react-native-google-mobile-ads/src/AdsConsent';
import MobileAds from '../../node_modules/react-native-google-mobile-ads/src/MobileAds';
import { TestIds } from '../../node_modules/react-native-google-mobile-ads/src/TestIds';
import { configureNativeMonetizationBuild, getMonetizationConfig } from '../../src/lib/monetization';
import { createNativeSdkMonetizationProvider } from '../../src/lib/native-monetization-runtime';
import { createGuidedResetAccessController, type GuidedTier } from '../../src/lib/guided-reset-access';
const fixture = (globalThis as any).__rewardedNativeFixture;
const platform: 'ios' | 'android' = (globalThis as any).__rewardedRN.Platform.OS;
const sampleUnit = platform === 'ios' ? 'ca-app-pub-3940256099942544/1712485313' : 'ca-app-pub-3940256099942544/5224354917';
(async () => {
  configureNativeMonetizationBuild(false);
  Object.assign(process.env, { NODE_ENV: 'production', EXPO_PUBLIC_BUILD_CHANNEL: 'internal-testflight', EXPO_PUBLIC_MONETIZATION_MODE: 'native', EXPO_PUBLIC_ADMOB_USE_TEST_ADS: 'true', EXPO_PUBLIC_ADMOB_APP_ID_IOS: 'ca-app-pub-1234567890123456~1234567890', EXPO_PUBLIC_ADMOB_APP_ID_ANDROID: 'ca-app-pub-1234567890123456~1234567890' });
  for (const mode of ['immediate', 'consent31', 'paid', 'review', 'unknown', 'refresh-error', 'owner', 'context', 'background', 'inactive-return', 'offer-expired', 'ump-current-true', 'ump-current-false', 'ump-current-missing', 'early-no-fill', 'show-nil-vc', 'skip', 'storage'] as const) {
    let now = 100000, foreground = true, owner = 'owner', context = 'a', refreshes = 0, loads = 0, shows = 0, initializations = 0, storageFails = mode === 'storage';
    let controller: ReturnType<typeof createGuidedResetAccessController>;
    const saved = new Map<string, string>();
    const info = { canRequestAds: true, status: 'OBTAINED', privacyOptionsRequirementStatus: 'REQUIRED', isConsentFormAvailable: true };
    const emit = (requestId: number, adUnitId: string, type: string, error?: unknown) => fixture.events.emit('rnapp_google_mobile_ads_rewarded_event', { requestId, adUnitId, body: { type, ...(error ? {error} : {}), data: { amount: 1, type: 'fixture' } } });
    fixture.scenario = {
      update: async () => { if(mode.startsWith('ump-current')) throw {code:'consent-update-failed',message:'PRIVATE'}; return info; },
      form: async () => {
        if(mode==='consent31') now += 31000;
        if(mode==='owner') owner='another';
        if(mode==='context') context='b';
        if(mode==='background') {foreground=false;controller.background();foreground=true;controller.foreground();}
        if(mode==='inactive-return') {foreground=false;controller.background('inactive');foreground=true;controller.foreground();now+=31000;}
        if(mode==='offer-expired') now+=31000;
        return info;
      },
      info: async () => mode==='ump-current-missing' ? null : {...info,canRequestAds:mode!=='ump-current-false'},
      privacy: async () => info,
      init: async () => {initializations++;return [{name:'PRIVATE adapter identifier',description:'PRIVATE description',state:1}];},
      load: (id:number,unit:string,options:unknown) => {
        loads++;assert.equal(unit,sampleUnit);
        assert.deepEqual(options,{requestAgent:'rn-invertase-16.3.3',requestNonPersonalizedAdsOnly:true,networkExtras:{ft_ctype:'video_app_install'}});
        emit(id,unit,mode==='early-no-fill'?'error':'rewarded_loaded',mode==='early-no-fill'?{code:'no-fill',message:'PRIVATE'}:undefined);
      },
      show: async(id:number,unit:string) => {
        shows++;if(mode==='show-nil-vc') throw {code:'googleMobileAds/nil-vc',message:'PRIVATE'};
        emit(id,unit,'opened');if(mode!=='skip')emit(id,unit,'rewarded_earned_reward');emit(id,unit,'closed');
      }
    };
    const config=getMonetizationConfig({platform});
    const provider=await createNativeSdkMonetizationProvider({platform,config,loader:async name=>name==='react-native-google-mobile-ads'?{RewardedAd,AdsConsent,default:MobileAds,TestIds}:null});
    assert.ok(provider);
    controller=createGuidedResetAccessController({ownerUid:'owner',storage:{getItem:k=>saved.get(k)??null,setItem:(k,v)=>{if(storageFails)throw Error('disk');saved.set(k,v);},removeItem:k=>{saved.delete(k);}},currentOwner:()=>owner,currentTier:()=> 'free',requestContext:()=>context,isForeground:()=>foreground,now:()=>now,createId:()=> 'session',refreshEligibility:async()=>{refreshes++;if(refreshes===2&&mode==='refresh-error')throw Error('offline');return refreshes===2&&['paid','review','unknown'].includes(mode)?mode as GuidedTier:'free';},createReward:()=>provider.createRewardedResetSession!(config)!,completeReward:(session,eligible,lifecycle)=>provider.completeRewardedResetSession!(session,config,eligible,lifecycle)});
    controller.hydrate();
    const outcome=await controller.watch(()=>mode!=='offer-expired'||now<130000);
    const success=['immediate','consent31','inactive-return','ump-current-true'].includes(mode);
    assert.equal(outcome==='granted',success,mode);
    if(success){assert.equal(loads,1,mode);assert.equal(shows,1,mode);assert.equal(refreshes,2,mode);assert.equal(saved.size,1,mode);}
    else if(!['early-no-fill','show-nil-vc','skip','storage'].includes(mode)){assert.equal(loads,0,mode);assert.equal(shows,0,mode);assert.equal(saved.size,0,mode);}
    if(mode==='early-no-fill')assert.ok(controller.diagnostic().events.some(e=>e.stage==='load'&&e.nativeCode==='no-fill'));
    if(mode==='show-nil-vc')assert.ok(controller.diagnostic().events.some(e=>e.stage==='show'&&e.nativeCode==='nil-vc'));
    if(mode==='storage'){assert.equal(outcome,'save-failed');storageFails=false;assert.equal(controller.repair(),'granted');assert.equal(shows,1);}
    if(mode==='ump-current-false'||mode==='ump-current-missing')assert.equal(initializations,0);
    assert.ok(!JSON.stringify(controller.diagnostic()).includes('PRIVATE'));
    assert.ok(controller.diagnostic().events.length<=32);
    console.log(JSON.stringify({platform,mode,outcome,loads,shows,refreshes,initializations}));
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
