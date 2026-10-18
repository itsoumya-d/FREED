const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),{buildSync}=require('esbuild');
const packet=process.env.FREED_TASK90_TEST_OUTPUT_DIR?path.resolve(process.env.FREED_TASK90_TEST_OUTPUT_DIR):fs.mkdtempSync(path.join(require('node:os').tmpdir(),'freed-task90-ts-'));fs.mkdirSync(packet,{recursive:true});
const red=process.argv.includes('--red');
const options={entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,metafile:true,external:['expo-modules-core','react-native']};
if(red) options.plugins=undefined;
let code,result;
if(red){
 const original=fs.readFileSync('modules/freed-protection/src/index.ts','utf8');
 const pre=fs.readFileSync('.superpowers/sdd/2026-10-13-publishable-recovery/task-90/preimages/modules/freed-protection/src/index.ts','utf8');
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
test('actual public export is account-free and old/absent module is unavailable without legacy fallback',async()=>{
 for(const native of [null,{}, {deviceAdultBridge:null}]){const {api,privateCalls}=bridge(native);assert.ok(api,'new account-free public export missing');assert.equal((await api.status()).code,'unavailable');assert.equal((await api.execute(id)).code,'unavailable');assert.equal(privateCalls(),0)}
});
test('actual public adapter projects positive status and redacts private/native payload fields',async()=>{
 const {api,privateCalls}=bridge({deviceAdultBridge:async(c,r)=>({...status,uid:'private',selectedApps:['secret'],recoveryKey:'must-drop'})});const got=await api.status();assert.equal(got.credential,'enrolled');assert.equal(got.enrollmentAvailable,false);assert.equal('uid'in got,false);assert.equal('recoveryKey'in got,false);assert.equal(privateCalls(),0);
});
test('missing/malformed/old/unsupported status never manufactures unenrolled',async()=>{
 for(const raw of [{...status,bridgeAvailable:false},{...status,mutationAvailability:'available'},{...status,mutationAvailability:'unavailable',mutationReason:'baselineUnobserved'},null,{}, {...status,schema:0}, {...status,credential:null}, {...status,enrollmentAvailable:true}, {...status,actions:['feed']}, {...status,pendingKnown:false,pendingOperationIDs:[id]}]){const {api}=bridge({deviceAdultBridge:async()=>raw});assert.equal((await api.status()).kind,'error')}
 for(const credential of ['notEnrolled','missingEnrolled','corrupt','unavailable','unknown']){const {api}=bridge({deviceAdultBridge:async()=>({...status,credential,mutationAvailability:credential==='enrolled'?'unknown':'unavailable',mutationReason:credential==='enrolled'?'baselineUnobserved':credential==='notEnrolled'?'notEnrolled':'protectedRecordUnavailable'})});assert.equal((await api.status()).credential,credential)}
});
test('capability mismatch and malformed inputs never prepare or authorize an operation',async()=>{
 const calls=[];const {api}=bridge({deviceAdultBridge:async(c,r)=>{calls.push([c,r]);return status}});
 assert.equal((await api.prepare({action:'feed',domains:[]})).code,'unsupportedAction');assert.equal((await api.authorize('private-cleanup-id','123456')).code,'invalidInput');assert.equal((await api.authorize(id,'x'.repeat(500))).code,'invalidInput');assert.deepEqual(calls.map(x=>x[0]),['status']);
});
test('exact prepare/authorize/read/cancel forwards only bounded native authority, never account admission',async()=>{
 const calls=[];const {api,privateCalls}=bridge({deviceAdultBridge:async(c,r)=>{calls.push([c,plain(r)]);return c==='status'?status:{...prepared,uid:'private'}}});
 const first=await api.prepare({action:'continuousOff',uid:'ignored',baseline:'forged'});assert.equal(first.operationID,id);assert.equal('uid'in first,false);
 await api.authorize(id,'123456');await api.read(id);await api.cancel(id);assert.deepEqual(calls,[['status',{}],['prepare',{action:'continuousOff'}],['authorize',{operationID:id,pin:'123456'}],['read',{operationID:id}],['cancel',{operationID:id}]]);assert.equal(privateCalls(),0);
});
test('historical completed receipt retains unknown current observation and exact-ID mismatch fails',async()=>{
 const {api}=bridge({deviceAdultBridge:async()=>complete});const got=await api.read(id);assert.equal(got.accepted,true);assert.equal(got.currentStatus,'unknown');assert.equal(got.historicalResultStale,null);
 for(const raw of [{...complete,operationID:'b'.repeat(32)},{...complete,schema:0},{...complete,currentStatus:'unknown',historicalResultStale:false},{...prepared,accepted:true},{...complete,authorization:'authorized'}, {...complete,layers:{feed:'private-domain-content'}},{...prepared,observation:'settled'},{...prepared,authorization:'authorized'}]){const {api}=bridge({deviceAdultBridge:async()=>raw});assert.equal((await api.read(id)).kind,'error')}
});
test('native errors never expose secret/cause text; throttle vocabulary remains observable',async()=>{
 const {api}=bridge({deviceAdultBridge:async()=>{throw Error('123456 secret recoveryKey')}});assert.equal(JSON.stringify(await api.authorize(id,'123456')).includes('123456'),false);
 const throttled=bridge({deviceAdultBridge:async()=>({schema:1,kind:'error',code:'throttled',message:'secret'})}).api;assert.deepEqual(plain(await throttled.authorize(id,'123456')),{schema:1,kind:'error',code:'throttled'});
});
test('pending execution settles by exact read without another prepare/authorize/execute',async()=>{
 const calls=[];const {api}=bridge({deviceAdultBridge:async(c,r)=>{calls.push([c,plain(r)]);return c==='execute'?{...prepared,phase:'dispatchReserved',authorization:'inFlight',observation:'pending'}:complete}});
 const pending=await api.execute(id);assert.equal(pending.observation,'pending');assert.equal(pending.accepted,null);assert.equal((await api.read(id)).accepted,true);assert.deepEqual(calls.map(x=>x[0]),['execute','read']);
});
test('real JS observer timeout remains outcomeUnknown and only explicit exact lookup follows',async()=>{
 const calls=[];const {api}=bridge({deviceAdultBridge:(c,r)=>{calls.push([c,plain(r)]);return c==='execute'?new Promise(()=>{}):Promise.resolve(complete)}});
 assert.equal((await api.execute(id)).code,'outcomeUnknown');assert.equal((await api.read(id)).operationID,id);assert.deepEqual(calls.map(x=>x[0]),['execute','read']);
});
test('rotation returns ephemeral key directly, with no status/global caching or private fields',async()=>{
 const key='e'.repeat(64);const calls=[];const {api}=bridge({deviceAdultBridge:async(c,r)=>{calls.push([c,plain(r)]);return c==='rotate'?{schema:1,kind:'rotation',lockRevision:'2',recoveryKey:key,uid:'private'}:status}});
 const rotated=await api.rotate('recovery','d'.repeat(64),'654321','654321');assert.equal(rotated.recoveryKey,key);assert.equal('uid'in rotated,false);assert.equal(JSON.stringify(await api.status()).includes(key),false);assert.equal(calls[0][1].secretType,'recovery');
});
