const test = require('node:test');
const assert = require('node:assert/strict');
const {validateSubmitProfile,APPROVAL_ENV,APPROVAL_TOKEN}=require('../scripts/eas-submit-guard');
function config(track='internal',releaseStatus='draft',ios={}){return{cli:{appVersionSource:'remote'},build:{internal:{},production:{},custom:{}},submit:{internal:{android:{track,releaseStatus},ios},production:{android:{track,releaseStatus},ios},custom:{android:{track,releaseStatus},ios}}};}
test('the existing production approval token cannot override missing minimum declared recovery evidence',()=>{
 const result=validateSubmitProfile(config('production','completed',{submitForReview:true}),'production',{[APPROVAL_ENV]:APPROVAL_TOKEN});
 assert.match(result.issues.join('\n'),/minimum declared recovery coverage.*Safari\/iOS.*Chrome\/Android.*app-limit journeys/i);
});
test('private draft/internal handoff remains available for testing',()=>{
 assert.deepEqual(validateSubmitProfile(config(),'internal',{}).issues,[]);
 assert.deepEqual(validateSubmitProfile(config(),'production',{}).issues,[]);
});
test('a custom submit profile cannot evade the declared recovery requirement',()=>{
 const result=validateSubmitProfile(config('production','completed'),'custom',{[APPROVAL_ENV]:APPROVAL_TOKEN});
 assert.match(result.issues.join('\n'),/minimum declared recovery coverage/i);
});

test('submission explains the version 3 minimum while remaining blocked without API and device proof', () => {
 const result=validateSubmitProfile(config('production','completed',{submitForReview:true}),'production',{[APPROVAL_ENV]:APPROVAL_TOKEN});
 assert.ok(result.issues.some((issue) => /Safari\/iOS and Chrome\/Android recovery/.test(issue)));
 assert.ok(result.issues.some((issue) => /source\/binary\/device\/OS\/artifact evidence/.test(issue)));
});
