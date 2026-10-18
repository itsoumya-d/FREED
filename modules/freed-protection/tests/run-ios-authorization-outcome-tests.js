'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const out=process.argv.find(v=>v.startsWith('--evidence-dir='))?.slice(15);assert(out);fs.mkdirSync(out,{recursive:true});
const input=process.argv.includes('--before')?'.superpowers/sdd/2026-10-13-publishable-recovery/task-134/preimages/modules/freed-protection/ios/FreedProtectionModule.swift':'modules/freed-protection/ios/FreedProtectionModule.swift',source=fs.readFileSync(input,'utf8');
function block(marker){const at=source.indexOf(marker);assert(at>=0);let start=source.indexOf('{',at),end=start+1,depth=1;while(depth){if(source[end]==='{')depth++;if(source[end]==='}')depth--;end++;}return source.slice(at,end);}
const raw=block('    AsyncFunction("requestAuthorization")'),body=raw.slice(raw.indexOf(' in\n')+4,raw.lastIndexOf('}')).replace('#if canImport(FamilyControls)','#if true');
const helper=source.includes('private func authorizationOutcomePayload(')?block('  private func authorizationOutcomePayload').replace('private func','func'):'';
const swift=`import Foundation
enum FamilyControlsError:Error{case authorizationCanceled,restricted}
enum AuthorizationKind{case individual}
final class AuthorizationCenter{static let shared=AuthorizationCenter();var approved=false;var failure:Error?;func requestAuthorization(for kind:AuthorizationKind)async throws{if let failure{throw failure}}}
final class Host{func isAuthorized()->Bool{AuthorizationCenter.shared.approved}
func isAdultFilterActive()->Bool{false};func isRiskWindowMonitoringActive()->Bool{false}
func statusPayload(authorized:Bool,active:Bool,scheduled:Bool=false,message:String)->[String:Any]{["authorized":authorized,"active":active,"mode":"screen-time","message":message]}
func readDevicePublicStatus()async->[String:Any]{["statusReadAccepted":false,"statusReadError":"native-status-unavailable","authorized":false,"active":false,"mode":"screen-time","message":"Read unavailable"]}
${helper}
func request()async->[String:Any]{${body}}
}
@main struct Cases{static func main()async throws{let h=Host(),system=AuthorizationCenter.shared
system.approved=true;let granted=await h.request();precondition(granted["authorizationOutcome"] as? String=="granted" && granted["authorized"] as? Bool==true,"Actual request export preserves successful authorization independently of status read failure")
system.approved=false;let denied=await h.request();precondition(denied["authorizationOutcome"] as? String=="denied","Observed denial is preserved")
system.failure=FamilyControlsError.authorizationCanceled;let cancelled=await h.request();precondition(cancelled["authorizationOutcome"] as? String=="cancelled","Actual SDK cancellation branch is distinct")
system.failure=NSError(domain:"private-owner-token",code:7,userInfo:[NSLocalizedDescriptionKey:"private journal text"]);let failed=await h.request();precondition(failed["authorizationOutcome"] as? String=="error" && failed["authorizationErrorDomain"]==nil && failed["authorizationErrorCode"]==nil,"Unknown native errors expose no raw domain/code");let text=String(data:try JSONSerialization.data(withJSONObject:failed),encoding:.utf8)!;precondition(!text.contains("private journal text") && !text.contains("private-owner-token"),"LocalizedDescription/private data must not escape")
system.failure=NSError(domain:"FamilyControls.FamilyControlsError",code:2);let known=await h.request();precondition(known["authorizationErrorDomain"] as? String=="FamilyControls.FamilyControlsError" && known["authorizationErrorCode"] as? Int==2,"Allowlisted native domain/code retained")
system.failure=NSError(domain:"FamilyControls.FamilyControlsError",code:999);let unknown=await h.request();precondition(unknown["authorizationErrorDomain"]==nil && unknown["authorizationErrorCode"]==nil,"Out-of-range code omitted")
print("Actual requestAuthorization export/helper: granted, denial, cancellation, independent status failure, allowlisted error pairs and private-description omission passed")}}
`;
const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-authorization-')),file=path.join(scratch,'Cases.swift'),binary=path.resolve(out,'native-fixture'),logs=[];fs.writeFileSync(file,swift);fs.writeFileSync(path.join(out,'Cases.swift'),swift);fs.writeFileSync(path.join(out,'source-bindings.json'),JSON.stringify({input,sha256:crypto.createHash('sha256').update(source).digest('hex'),boundary:'Actual native requestAuthorization closure and outcome helper. AuthorizationCenter and device-status read are explicit OS/storage stand-ins; no OS prompt/device proof.'},null,2));
try{for(const[cmd,args]of[['xcrun',['swiftc','-parse-as-library','-swift-version','5',file,'-o',binary]],[binary,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:60000});logs.push({command:[cmd,...args],exitCode:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(logs,null,2));process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0);}}finally{fs.rmSync(scratch,{recursive:true,force:true});}
