import assert from 'node:assert/strict';
import { createRewardedDiagnosticReceipt, consentDiagnostic, rewardedNativeCode } from '../src/lib/rewarded-ad-diagnostics';
import { readFileSync } from 'node:fs';
const receipt=createRewardedDiagnosticReceipt(()=>1);
for(let i=0;i<100;i++)receipt.record({stage:'load',failure:'native-error',nativeCode:'PRIVATE/domain',...( {message:'PRIVATE',stack:'PRIVATE',uid:'PRIVATE'} as any)});
assert.equal(receipt.read().events.length,32);
assert.ok(!JSON.stringify(receipt.read()).includes('PRIVATE'));
assert.equal(rewardedNativeCode({code:'googleMobileAds/no-fill',message:'PRIVATE'}),'no-fill');
assert.deepEqual(consentDiagnostic({canRequestAds:'true',status:'PRIVATE',privacyOptionsRequirementStatus:'PRIVATE'}),{canRequestAds:false});
for(const language of ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans']){
 const locale=JSON.parse(readFileSync(`src/i18n/locales/${language}.json`,'utf8')).momentum.profileSettings;
 for(const key of ['adPrivacyOptions','adPrivacyDetail','adPrivacyUnavailable','adErrorReference'])assert.ok(typeof locale[key]==='string'&&locale[key].length>0,`${language}.${key}`);
 assert.equal((locale.adErrorReference.match(/{{reference}}/g)||[]).length,1);
}
console.log('bounded diagnostic privacy and ten-language semantic labels passed');
