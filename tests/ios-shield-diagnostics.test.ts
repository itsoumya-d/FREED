import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {buildSync}=createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
const code=buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
function bridge(native:unknown){const sandbox={module:{exports:{} as any},setTimeout,clearTimeout,require:(n:string)=>n==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>native}};vm.runInNewContext(code,sandbox);return sandbox.module.exports;}
async function run(){
 const now=Date.now()/1000;
 const event={version:1,role:'configuration',callback:'site',phase:'return',action:'none',outcome:'configured',elapsedMilliseconds:12,timestamp:now,binaryVersion:'16'};
 const valid={enabled:true,status:'diagnostic',binaryVersion:'16',records:[event]};
 const api=bridge({getShieldRuntimeDiagnostics:async()=>({...valid,records:[{...event,domain:'private',token:'private'}],owner:'private'})});
 assert.equal(typeof api.getShieldRuntimeDiagnostics,'function','read-only shield diagnostics bridge must exist');
 assert.equal(JSON.stringify(await api.getShieldRuntimeDiagnostics()),JSON.stringify(valid),'only allowlisted fields cross JS bridge');
 for(const changed of [{role:['configuration']},{callback:['site']},{phase:['return']},{action:['none']},{outcome:['configured']},{role:'other'},{callback:'domain-name'},{action:'private'},{outcome:'private'},{elapsedMilliseconds:-1},{timestamp:now+60},{timestamp:now-86401},{binaryVersion:'15'},{version:2},{binaryVersion:'private version'}]){
  const result=await bridge({getShieldRuntimeDiagnostics:async()=>({...valid,records:[{...event,...changed}]})}).getShieldRuntimeDiagnostics();assert.equal(result.status,'unknown');assert.equal(result.records.length,0);
 }
 for(const raw of [null,{...valid,enabled:false},{...valid,records:Array(13).fill(event)},{...valid,status:'private'},{...valid,binaryVersion:'secret'}]){
  const result=await bridge({getShieldRuntimeDiagnostics:async()=>raw}).getShieldRuntimeDiagnostics();assert.equal(result.records.length,0);assert.equal(result.status,'unknown');
 }
 const entry={...event,role:'action',phase:'entry',action:'none',outcome:'none',elapsedMilliseconds:0};
 const mixed=await bridge({getShieldRuntimeDiagnostics:async()=>({...valid,records:[event,entry]})}).getShieldRuntimeDiagnostics();
 assert.equal(JSON.stringify(mixed.records),JSON.stringify([event]),'corrupt action/entry/none must be rejected while valid neighboring record stays visible');
 for(const action of ['primary','secondary','unknown']){
  const result=await bridge({getShieldRuntimeDiagnostics:async()=>({...valid,records:[event,{...entry,action}]})}).getShieldRuntimeDiagnostics();
  assert.equal(result.records.length,2,`valid ${action} entry retained`);
 }
 const configurationEntry={...entry,role:'configuration'};
 const configuration=await bridge({getShieldRuntimeDiagnostics:async()=>({...valid,records:[event,configurationEntry]})}).getShieldRuntimeDiagnostics();
 assert.equal(configuration.records.length,2,'configuration none entry retained');
 let mutations=0;const refused=bridge({getShieldRuntimeDiagnostics:async()=>{throw Error('private');},mutateWebsiteRecoveryProbe:()=>{mutations++;}});
 assert.equal((await refused.getShieldRuntimeDiagnostics()).status,'unknown');assert.equal(mutations,0);
 assert.equal((await bridge({}).getShieldRuntimeDiagnostics()).status,'unknown');
 console.log('PASS sanitized diagnostic parser: enum/time/version/bounds, unavailable and failure remain unknown; read-only');
}
void run().catch(e=>{console.error(e);process.exitCode=1;});
