'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');
const source=fs.readFileSync('ios/FREEDSafariFocusShield/safari-observation/check.js','utf8');
const manifest=JSON.parse(fs.readFileSync('ios/FREEDSafariFocusShield/manifest.json','utf8'));
function deferred(){let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function popup(options={}){
 const elements={},events={},requests=[],messages=[],timers=[];let gesture=false,lateWrites=0,closed=false;
 for(const id of ['check','allow','status','permission-status','intro','scope-label','scope-list']){let value='';elements[id]={disabled:false,attributes:{},get textContent(){return value;},set textContent(v){if(closed)lateWrites++;value=v;},setAttribute(k,v){this.attributes[k]=v;},addEventListener(name,f){this[name]=f;}};}
 const browser={runtime:{getManifest:()=>options.manifest??manifest,sendMessage:p=>{messages.push(JSON.parse(JSON.stringify(p)));return options.check?.(p)??Promise.resolve({persisted:true});}},permissions:{request:p=>{assert.equal(gesture,true,'request must run before click loses user activation');requests.push(JSON.parse(JSON.stringify(p)));return options.request?.(p)??Promise.resolve(true);}}};
 if(options.noAPI)delete browser.permissions.request;
 const context={navigator:{language:options.language??'en'},document:{documentElement:{},getElementById:id=>elements[id]},browser,addEventListener:(n,f)=>events[n]=f,setTimeout:(f,ms)=>{const t={f,ms,cleared:false};timers.push(t);return t;},clearTimeout:t=>{if(t)t.cleared=true;}};
 vm.runInNewContext(source,context);
 return {elements,requests,messages,timers,document:context.document,get lateWrites(){return lateWrites;},click(id){gesture=true;try{return elements[id].click?.();}finally{gesture=false;}},close(){closed=true;events.pagehide?.();}};
}
test('actual popup asks only exact packaged origins synchronously after explicit choice; grant never claims enforcement',async()=>{
 const pending=deferred(),f=popup({request:()=>pending.promise});assert.equal(f.requests.length,0);assert.equal(f.messages.length,0);assert.match(f.elements.allow.textContent,/Allow website access/);
 const action=f.click('allow');assert.deepEqual(f.requests,[{origins:manifest.host_permissions}]);assert.equal(f.messages.length,0);assert.equal(f.elements.allow.disabled,true);assert.equal(f.elements.check.disabled,true);
 f.click('allow');f.click('check');assert.equal(f.requests.length,1);pending.resolve(true);await action;
 assert.deepEqual(f.messages,[{version:1,type:'check-safari-configuration'}]);assert.match(f.elements['permission-status'].textContent,/allowed/i);assert.match(f.elements.status.textContent,/remain unverified/i);assert.equal(f.elements.allow.disabled,false);assert.equal(f.elements.check.disabled,false);
});
test('actual popup denial/cancellation, API failure and nonboolean reply stay explicit and recheck actual configuration',async()=>{
 for(const request of [()=>Promise.resolve(false),()=>Promise.reject(Error('private native error')),()=>{throw Error('private native error');},()=>Promise.resolve('yes')]){const f=popup({request});await f.click('allow');assert.equal(f.messages.length,1);assert.match(f.elements['permission-status'].textContent,/not allowed|cancel|could not/i);assert.ok(!f.elements['permission-status'].textContent.includes('private native error'));assert.equal(f.elements.allow.disabled,false);}
});
test('unavailable API and invalid/wide manifest never request; manual check stays usable',async()=>{
 for(const options of [{noAPI:true},{manifest:{host_permissions:['<all_urls>']}},{manifest:{host_permissions:['*://*/*']}},{manifest:{host_permissions:[]}},{manifest:{host_permissions:['https://example.com/path']}}]){const f=popup(options);await f.click('allow');assert.equal(f.requests.length,0);assert.match(f.elements['permission-status'].textContent,/settings|unavailable/i);await f.click('check');assert.equal(f.messages.length,1);assert.equal(f.elements.check.disabled,false);}
});
test('check failure, rejection, timeout and retry use real fixed observation message without granting anything',async()=>{
 for(const check of [()=>Promise.resolve({persisted:false}),()=>Promise.reject(Error('lost reply'))]){const f=popup({check});await f.click('check');assert.match(f.elements.status.textContent,/confirm|again/i);await f.click('check');assert.equal(f.messages.length,2);assert.equal(f.requests.length,0);assert.equal(f.elements.check.disabled,false);}
 const d=deferred(),f=popup({check:()=>d.promise});const action=f.click('check');assert.equal(f.timers.length,1);f.timers[0].f();await action;assert.equal(f.elements.check.disabled,false);const status=f.elements.status.textContent;d.resolve({persisted:true});await Promise.resolve();assert.equal(f.elements.status.textContent,status);
});
test('closure during permission or observation ignores late results and does not start work after disposal',async()=>{
 const d=deferred(),f=popup({request:()=>d.promise});const action=f.click('allow');f.close();d.resolve(true);await action;assert.equal(f.messages.length,0);assert.equal(f.lateWrites,0);
 const c=deferred(),g=popup({check:()=>c.promise});const check=g.click('check');g.close();c.resolve({persisted:true});await check;assert.equal(g.lateWrites,0);assert.ok(g.timers.every(t=>t.cleared));
});
test('ten locales retain explicit consent, scope disclosure and separate observation; Arabic is RTL',()=>{
 for(const language of ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans']){const f=popup({language});for(const id of ['allow','check','intro','scope-label','status'])assert.ok(f.elements[id].textContent.length>0,language+':'+id);assert.equal(f.elements['scope-list'].textContent,manifest.host_permissions.join('\n'));assert.equal(f.requests.length,0);assert.equal(f.document.documentElement.dir,language==='ar'?'rtl':'ltr');}
});
test('packaged extra declared scope is shown and requested without fetching, browsing or adding origins',async()=>{const declared={...manifest,host_permissions:[...manifest.host_permissions,'https://nudity.testcategory.com/*']};const f=popup({manifest:declared});await f.click('allow');assert.deepEqual(f.requests,[{origins:declared.host_permissions}]);assert.equal(f.elements['scope-list'].textContent,declared.host_permissions.join('\n'));});

test('permission action remains serialized until genuine observation resolves and failed persistence stays failed',async()=>{
 const d=deferred(),f=popup({check:()=>d.promise});const action=f.click('allow');await new Promise(resolve=>setImmediate(resolve));assert.equal(f.messages.length,1);f.click('allow');f.click('check');assert.equal(f.requests.length,1);assert.equal(f.messages.length,1);d.resolve({persisted:false});await action;assert.match(f.elements.status.textContent,/confirm|again/i);assert.equal(f.elements.allow.disabled,false);
});
test('actual closed package inspector still rejects modified popup resources and unknown files',()=>{
 const path=require('node:path'),os=require('node:os');const {inspectSafariFocusShieldContract}=require('../scripts/lib/ios-safari-focus-shield-contract');const root=path.resolve('ios/FREEDSafariFocusShield'),temporary=fs.mkdtempSync(path.join(os.tmpdir(),'freed-popup-contract-'));
 try {
  fs.cpSync(root,temporary,{recursive:true});const fixture={manifest,info:{},background:fs.readFileSync(path.join(root,'background.js'),'utf8'),content:fs.readFileSync(path.join(root,'content.js'),'utf8'),nativeHandlerBinary:fs.readFileSync(path.join(root,'SafariWebExtensionHandler.swift'),'utf8'),extensionPath:temporary};
  assert.equal(inspectSafariFocusShieldContract(fixture).observationCheckValid,true);
  for(const name of ['check.html','check.js','check.css']){const file=path.join(temporary,'safari-observation',name),before=fs.readFileSync(file);fs.appendFileSync(file,'tampered');assert.equal(inspectSafariFocusShieldContract(fixture).observationCheckValid,false,name);fs.writeFileSync(file,before);}
  fs.writeFileSync(path.join(temporary,'safari-observation','unapproved.js'),'');assert.equal(inspectSafariFocusShieldContract(fixture).observationCheckValid,false);
 }finally{fs.rmSync(temporary,{recursive:true,force:true});}
});
