const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');const{spawnSync}=require('node:child_process');
const source=fs.readFileSync('modules/freed-protection/ios/FreedProtectionModule.swift','utf8');
function block(marker){let start=source.indexOf(marker),open=source.indexOf('{',start),depth=1,end=open+1;for(;depth&&end<source.length;end++){if(source[end]==='{')depth++;if(source[end]==='}')depth--;}return source.slice(start,end).replaceAll('private ','');}
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-public-scope-'));
try{
 const input=path.join(scratch,'Cases.swift'),exe=path.join(scratch,'cases');
 fs.writeFileSync(input,'import Foundation\nfinal class NativeScopeHarness {\n'+block('  private struct InterventionScope')+'\n'+block('  private func scopePayload(')+'\nfunc sanitizeHostForStorage(_ value:String?) -> String? { value }\n}\n'+`
 let h=NativeScopeHarness(),token=Data("native-private-token-data".utf8).base64EncodedString()
 for type in ["application","category","domain"] {
  let scope=NativeScopeHarness.InterventionScope(kind:"ios-token",tokenType:type,token:token,domain:nil)
  let payload=h.scopePayload(scope)!
  precondition(payload["kind"] as? String=="ios-screen-time" && payload["tokenType"] as? String==type)
  precondition(Set(payload.keys)==Set(["kind","tokenType"]))
  precondition(!String(describing:payload).contains(token))
 }
 let group=NativeScopeHarness.InterventionScope(kind:"ios-token",tokenType:"application",token:token,domain:nil,groupId:"native-group",groupRevision:2,configurationGeneration:3,scopeEpoch:4)
 let payload=h.scopePayload(group)!
 precondition(payload["kind"] as? String=="ios-app-group" && payload["groupId"] as? String=="native-group")
 precondition(payload["token"]==nil && payload.count==6)
 print("Actual native public scope serialization: legacy3types and group metadata never export token bytes; private scope remains native")
 `);
 for(const[cmd,args]of[['xcrun',['swiftc','-swift-version','5',input,'-o',exe]],[exe,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);}
}finally{fs.rmSync(scratch,{recursive:true,force:true})}
