const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{buildSync}=require('esbuild');
const packet=path.resolve('.superpowers/sdd/2026-10-13-publishable-recovery/task-91/'+(process.argv.find(a=>a.startsWith('--name='))?.slice(7)||'ts'));fs.mkdirSync(packet,{recursive:true});
const red=process.argv.includes('--red');
const options={entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,metafile:true,external:['expo-modules-core','react-native']};
if(red) options.plugins=undefined;
let code,result;
if(red){
 const original=fs.readFileSync('modules/freed-protection/src/index.ts','utf8');
 const pre=fs.readFileSync('.superpowers/sdd/2026-10-13-publishable-recovery/task-91/preimages/modules/freed-protection/src/index.ts','utf8');
 // Compile captured preimage as stdin with the original resolver directory; no workspace mutation.
 result=buildSync({...options,entryPoints:undefined,stdin:{contents:pre,resolveDir:path.resolve('modules/freed-protection/src'),sourcefile:'Task90CapturedIndex.ts',loader:'ts'}});
}else result=buildSync(options);
code=result.outputFiles[0].text;
fs.writeFileSync(path.join(packet,red?'red-index.cjs':'green-index.cjs'),code);
fs.writeFileSync(path.join(packet,red?'red-inputs.json':'green-inputs.json'),JSON.stringify({bundleSHA256:crypto.createHash('sha256').update(code).digest('hex'),inputs:Object.fromEntries(Object.keys(result.metafile.inputs).filter(p=>fs.existsSync(p)).map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')]))},null,2));
function bridge(native){let privateCalls=0;const sandbox={module:{exports:{}},setTimeout,clearTimeout,require:name=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>{if(native===null)throw Error('missing');return {...native,prepareAccountBindingV2:()=>{privateCalls++;throw Error('private')},getStatus:()=>{privateCalls++;throw Error('legacy')}}}}};vm.runInNewContext(code,sandbox);return {api:sandbox.module.exports.deviceAdultProtection,privateCalls:()=>privateCalls}}
const id='a'.repeat(32),status={schema:1,kind:'status',platform:'ios',credential:'enrolled',bridgeAvailable:true,mutationAvailability:'unknown',mutationReason:'baselineUnobserved',enrollmentAvailable:false,enrollmentReason:'integrationDisabled',actions:['continuousOff','dnsOff','adultOff','adultReset'],pendingKnown:true,pendingOperationIDs:[],observations:{dns:'unknown',continuous:'unknown'}};
const prepared={schema:1,kind:'operation',operationID:id,action:'continuousOff',phase:'prepared',authorization:'awaitingSecret',generation:'1',lockRevision:'1',authorizationGeneration:'0',accepted:null,observation:'unknown',historicalReceipt:true,currentStatus:'unknown',historicalResultStale:null,layers:{continuous:'untouched'}};
const complete={...prepared,phase:'completed',authorization:'completed',accepted:true,observation:'settled',layers:{continuous:'observedApplied'}};
const plain=v=>JSON.parse(JSON.stringify(v));
test('enrollment forwards exact transient PIN twice only after coherent native readiness',async()=>{
 const calls=[];const ready={...status,credential:'notEnrolled',mutationAvailability:'unavailable',mutationReason:'notEnrolled',enrollmentAvailable:true,enrollmentReason:'nativeReady'};
 const key='e'.repeat(64);const {api}=bridge({deviceAdultBridge:async(c,r)=>{calls.push([c,plain(r)]);return c==='enroll'?{schema:1,kind:'enrollment',credential:'enrolled',keyPresentation:'required',lockRevision:'1',recoveryKey:key,uid:'drop'}:ready}});
 const result=await api.enroll({pin:'123456',confirmation:'123456'});assert.equal(result.recoveryKey,key);assert.equal(result.keyPresentation,'required');assert.equal('uid' in result,false);
 assert.deepEqual(calls,[['status',{}],['enroll',{pin:'123456',confirmation:'123456'}]]);
 assert.equal(JSON.stringify(await api.status()).includes(key),false);
});
test('disabled/missing/malformed enrollment readiness never invokes enrollment',async()=>{
 for(const raw of [null,{},status,{...status,enrollmentAvailable:true}, {...status,enrollmentReason:'alreadyEnrolled',credential:'notEnrolled'}, {...status,enrollmentReason:'nativeReady'}]){
  const calls=[];const {api}=bridge({deviceAdultBridge:async(c)=>{calls.push(c);return raw}});assert.equal((await api.enroll({pin:'123456',confirmation:'123456'})).kind,'error');assert.deepEqual(calls,['status']);
 }
 const {api}=bridge(null);assert.equal((await api.enroll({pin:'123456',confirmation:'123456'})).code,'unavailable');
});
test('invalid and oversize PIN/confirmation or injected baseline rejected before native',async()=>{
 const calls=[];const {api}=bridge({deviceAdultBridge:async(c)=>{calls.push(c);return status}});
 for(const input of [null,{pin:'12345',confirmation:'123456'},{pin:'１２３４５６',confirmation:'１２３４５６'},{pin:'123456',confirmation:'654321'},{pin:'x'.repeat(1000),confirmation:'123456'},{pin:'123456',confirmation:'123456',baseline:'forged'}])assert.equal((await api.enroll(input)).kind,'error');
 assert.deepEqual(calls,[]);
});
test('unknown result and lost key never auto retry or lookup',async()=>{
 const calls=[];const ready={...status,credential:'notEnrolled',mutationAvailability:'unavailable',mutationReason:'notEnrolled',enrollmentAvailable:true,enrollmentReason:'nativeReady'};
 const {api}=bridge({deviceAdultBridge:async(c)=>{calls.push(c);if(c==='enroll')throw Error('123456 raw-secret');return calls.length===1?ready:{...status,enrollmentReason:'alreadyEnrolled'}}});
 assert.equal((await api.enroll({pin:'123456',confirmation:'123456'})).code,'unavailable');
 assert.equal((await api.status()).credential,'enrolled');assert.equal((await api.enroll({pin:'123456',confirmation:'123456'})).code,'alreadyEnrolled');
 assert.deepEqual(calls,['status','enroll','status','status']);
});
test('malformed direct key or presentation envelope returns sanitized error only',async()=>{
 const ready={...status,credential:'notEnrolled',mutationAvailability:'unavailable',mutationReason:'notEnrolled',enrollmentAvailable:true,enrollmentReason:'nativeReady'};
 for(const reply of [{schema:1,kind:'enrollment',credential:'enrolled',lockRevision:'1',recoveryKey:'e'.repeat(64)},{schema:1,kind:'enrollment',credential:'enrolled',keyPresentation:'required',lockRevision:'0',recoveryKey:'plaintext'}]){
  const {api}=bridge({deviceAdultBridge:async c=>c==='status'?ready:reply});assert.deepEqual(plain(await api.enroll({pin:'123456',confirmation:'123456'})),{schema:1,kind:'error',code:'malformedReceipt'});
 }
});
