import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import vm from 'node:vm';
const {buildSync}=createRequire(resolve('package.json'))('esbuild') as typeof import('esbuild');
function bridge(native:unknown){
 const code=buildSync({entryPoints:['modules/freed-protection/src/index.ts'],bundle:true,platform:'node',format:'cjs',write:false,external:['expo-modules-core','react-native']}).outputFiles[0].text;
 const box={module:{exports:{} as any},setTimeout,clearTimeout,require:(name:string)=>name==='react-native'?{Platform:{OS:'ios'}}:{requireNativeModule:()=>native}};vm.runInNewContext(code,box);return box.module.exports;
}
const id='11111111-1111-4111-8111-111111111111';
const readback={version:1,operationId:id,stage:'dns-save-readback',configurationGeneration:4,freshPreferencesLoaded:true,managerHasSettings:true,managerIsEnabled:false,protocolMatches:true,serverURLMatches:true,serversMatch:true,matchDomainsMatch:true,matchDomainsNoSearchMatch:true,onDemandRulesMatch:true,allowFailoverSupported:true,allowFailoverMatch:true,configurationValid:true};
const saved={supported:true,releaseEnabled:true,configured:true,enabled:false,healthy:null,provider:'cloudflare-families',requiresSettings:true,reason:'ios-dns-settings-enable-required',configurationReadback:readback};
test('actual DNS bridge retains safe successful readback and removes raw diagnostic domains/URLs/tokens',async()=>{
 const api=bridge({configureEncryptedDns:async()=>({...saved,operationAccepted:true,operationReason:null,configurationReadback:{...readback,url:'https://private.example',domains:['private.example'],token:'opaque'}})});
 const result=await api.configureEncryptedDns({enabled:true,provider:'cloudflare-families'});
 assert.deepEqual(JSON.parse(JSON.stringify(result.configurationReadback)),readback);assert.equal(result.enabled,false);
 assert.equal(JSON.stringify(result).includes('private.example'),false);assert.equal(JSON.stringify(result).includes('opaque'),false);
});
test('actual DNS bridge never trusts malformed or mismatching fresh routing despite matching endpoint flags',async()=>{
 for(const rb of [{...readback,onDemandRulesMatch:false,configurationValid:false},{...readback,freshPreferencesLoaded:false,configurationValid:false},{...readback,operationId:'account-id'},{...readback,configurationValid:true,matchDomainsMatch:false}]){
  const api=bridge({getEncryptedDnsStatus:async()=>({...saved,enabled:true,healthy:true,configurationReadback:rb})});const result=await api.getEncryptedDnsStatus();
  assert.equal(result.configured,false);assert.equal(result.enabled,false);assert.equal(result.healthy,null);
 }
});
test('old native DNS binary reports unknown diagnostics without inventing fresh-load evidence',async()=>{
 const {configurationReadback:_,...old}=saved;const result=await bridge({getEncryptedDnsStatus:async()=>old}).getEncryptedDnsStatus();
 assert.equal(result.configurationReadback,undefined);assert.equal(result.enabled,false);
});
test('Settings bridge waits for actual completion metadata and retains Boolean failure without fabricated NSError',async()=>{
 let finish!:(value:unknown)=>void;const pending=new Promise(resolve=>{finish=resolve;});const api=bridge({openProtectionSettings:()=>pending});let returned=false;
 const action=api.openProtectionSettings().then((value:unknown)=>{returned=true;return value;});await Promise.resolve();assert.equal(returned,false);
 finish({authorized:true,active:false,settingsHandoff:{version:1,operationId:id,kind:'settings',opened:false,url:'https://private.example'}});
 const result:any=await action;assert.equal(JSON.stringify(result.settingsHandoff),JSON.stringify({version:1,operationId:id,kind:'settings',opened:false}));assert.equal(result.settingsHandoff.errorDomain,undefined);
});
test('Settings bridge omits unknown old or malformed handoff claims',async()=>{
 for(const raw of [undefined,{version:1,operationId:'private-id',kind:'settings',opened:true},{version:1,operationId:id,kind:'settings',opened:'yes'}]){
  const result=await bridge({openProtectionSettings:async()=>({authorized:true,active:false,settingsHandoff:raw})}).openProtectionSettings();assert.equal(result.settingsHandoff,undefined);
 }
});
