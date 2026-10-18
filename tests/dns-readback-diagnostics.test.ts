import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createEncryptedDnsController, normalizeEncryptedDnsStatus } from '../src/lib/encrypted-dns';
import * as operations from '../src/lib/website-protection-operations';
const id='11111111-1111-4111-8111-111111111111';
const readback={version:1,operationId:id,stage:'dns-save-readback',configurationGeneration:4,freshPreferencesLoaded:true,managerHasSettings:true,managerIsEnabled:false,protocolMatches:true,serverURLMatches:true,serversMatch:true,matchDomainsMatch:true,matchDomainsNoSearchMatch:true,onDemandRulesMatch:true,allowFailoverSupported:true,allowFailoverMatch:true,configurationValid:true};
const saved={supported:true,releaseEnabled:true,configured:true,enabled:false,healthy:null,provider:'cloudflare-families',requiresSettings:true,reason:'ios-dns-settings-enable-required',configurationReadback:readback};
test('successful real controller retains privacy-safe save/readback diagnostic after ordinary and queued reads',async()=>{
 const c=createEncryptedDnsController({readStatus:async()=>({...saved,configurationReadback:{...readback,operationId:'22222222-2222-4222-8222-222222222222',stage:'dns-status-readback'}} as any),configure:async()=>({...saved,operationAccepted:true,operationReason:null} as any),now:()=>1});
 assert.equal((await c.configure(true)).accepted,true);await c.refresh();
 assert.deepEqual((c.getSnapshot().operationDiagnostic as any)?.readback,readback);
 assert.equal(c.getSnapshot().status.enabled,false);assert.equal(c.getSnapshot().status.healthy,null);
});
test('endpoint-only agreement cannot assert current configuration when explicit fresh routing readback disagrees',()=>{
 for(const key of ['matchDomainsMatch','matchDomainsNoSearchMatch','onDemandRulesMatch','allowFailoverMatch']){
  const status=normalizeEncryptedDnsStatus({...saved,enabled:true,healthy:true,configurationReadback:{...readback,[key]:false,configurationValid:false}});
  assert.equal(status.configured,false);assert.equal(status.enabled,false);assert.equal(status.healthy,null);
 }
 const old=normalizeEncryptedDnsStatus({...saved,configurationReadback:undefined});assert.equal((old as any).configurationReadback,undefined,'Old binaries must not invent readback evidence');
});
test('privacy-safe HTTPS helper retains real error identity, skips stale publication and excludes URL-bearing fields',async()=>{
 const create=(operations as any).createWebsiteHandoffController;assert.equal(typeof create,'function');
 let scope='A';let reject!:(e:unknown)=>void;const pending=new Promise<void>((_,no)=>{reject=no;});
 const c=create({getScope:()=>scope,open:()=>pending,operationId:()=>id});
 const action=c.open('https://example.com');scope='B';reject({code:'EUNSPECIFIED',domain:'NSURLErrorDomain',nativeErrorCode:-1009,message:'Unable to open https://private.example'});
 assert.equal(await action,null);assert.equal(c.getSnapshot(),null);
 const failure=create({getScope:()=>scope,operationId:()=>id,open:async()=>{throw {code:'EUNSPECIFIED',domain:'NSURLErrorDomain',nativeErrorCode:-1009,message:'Unable to open https://private.example',url:'https://private.example'};}});
 assert.deepEqual(await failure.open('https://example.com'),{version:1,operationId:id,kind:'https-test',opened:false,bridgeErrorCode:'EUNSPECIFIED',errorDomain:'NSURLErrorDomain',errorCode:-1009});
 assert.equal(JSON.stringify(failure.getSnapshot()).includes('private.example'),false);
});
test('HTTPS helper records opening success only and never fabricates NSError for Boolean rejection',async()=>{
 const create=(operations as any).createWebsiteHandoffController;assert.equal(typeof create,'function');
 const c=create({getScope:()=> 'A',operationId:()=>id,open:async()=>true});
 assert.deepEqual(await c.open('https://example.com'),{version:1,operationId:id,kind:'https-test',opened:true});
 const no=create({getScope:()=> 'A',operationId:()=>id,open:async()=>false});assert.deepEqual(await no.open('https://example.com'),{version:1,operationId:id,kind:'https-test',opened:false});
});
test('distinct HTTPS taps share a publication fence so a late first handoff cannot replace the second',async()=>{
 const open=(operations as any).openWebsiteTestHandoff;assert.equal(typeof open,'function');
 let first!:(v:boolean)=>void;const pending=new Promise<boolean>(resolve=>{first=resolve;});
 const a=open({url:'https://example.com',getScope:()=> 'same',open:()=>pending});
 const b=await open({url:'https://example.com',getScope:()=> 'same',open:async()=>false});
 first(true);assert.equal(await a,null);assert.equal(b.opened,false);
});
