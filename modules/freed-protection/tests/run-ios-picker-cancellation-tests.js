const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{spawnSync}=require('node:child_process');
const out=process.argv.find(x=>x.startsWith('--evidence-dir='))?.slice(15);assert(out);fs.mkdirSync(out,{recursive:true});const before=process.argv.includes('--before'),prefix=before?'.superpowers/sdd/2026-10-13-publishable-recovery/task-86/fix1/preimages/':'';const scratch=fs.mkdtempSync(path.join(os.tmpdir(),'freed-picker-residual-')),logs=[];
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function block(s,start){let open=s.indexOf('{',start),depth=1,end=open+1;while(depth){if(s[end]==='{')depth++;if(s[end]==='}')depth--;end++;}return s.slice(start,end);}
try{
 const bindings={};let generated='import Foundation\n';
 generated+=`final class FixtureView{var window:AnyObject?=NSObject()}
 final class FixtureHost{var presentingViewController:AnyObject?=NSObject();var isBeingPresented=false;var isBeingDismissed=true;var viewIfLoaded:FixtureView?=FixtureView();var requests=0;var callback:(()->Void)?;func dismiss(animated:Bool,completion:(()->Void)?=nil){requests += 1;callback=completion};func markAbsent(){presentingViewController=nil;isBeingPresented=false;isBeingDismissed=false;viewIfLoaded?.window=nil};func complete(_ absent:Bool){if absent{markAbsent()};callback?()}}
 final class FixtureContinuation{var resumes=0;func resume(returning:[String:Any]){resumes += 1}}
 struct FixturePresentation{let finish:([String:Any])->Void;let continuation:FixtureContinuation}
 final class FixtureRuntime{func snapshot(_ scope:String)->[String:Any]{["supported":true]}}
 func cancellationState(_ r:(matched:Bool,requested:Bool))->String{r.requested ? "pending":r.matched ? "unavailable":"notApplicable"}
 func cancellationState(_ r:(matched:Bool,requested:Bool,pending:Bool,unavailable:Bool))->String{r.unavailable ? "unavailable":r.pending || r.requested ? "pending":"notApplicable"}
 `;
 for(const [name,kind] of [['FreedAppGroupViews.swift','Group'],['FreedWebsiteProbePicker.swift','Website']]){
  const file=prefix+'modules/freed-protection/ios/'+name,s=fs.readFileSync(file,'utf8'),enumName=kind==='Group'?'FreedAppGroupPicker':'FreedWebsiteProbePicker',start=s.indexOf('enum '+enumName+' {'),open=s.indexOf('{',start),end=s.indexOf(kind==='Group'?' private static func presenter()':'  static func present(revision:',open),members=s.slice(open+1,end).replaceAll('private ',''),present=s.indexOf(kind==='Group'?' static func present(request:':'  static func present(revision:',end);
  const finishStart=s.indexOf('let finish:',present),finish=block(s,finishStart),match=s.slice(finishStart+finish.length).match(/\bcancel\s*=\s*\{\s*finish/);assert(match);const cancelStart=finishStart+finish.length+match.index,cancelAssignment=block(s,cancelStart);
  const modern=members.includes('DismissalResidual');bindings[file]={sha256:hash(file),finishSha256:crypto.createHash('sha256').update(finish).digest('hex'),cancelAssignmentSha256:crypto.createHash('sha256').update(cancelAssignment).digest('hex'),modern};
  const gate=modern?'pruneDismissalHistory(currentBinding: owner);if !force {guard cancel==nil,dismissals.values.allSatisfy({$0.state == .settled}),dismissals.count<dismissalCapacity,cancellationTargets.count<dismissalCapacity,cancellationTargets[owner]==nil else{return nil}}':'if !force&&cancel != nil{return nil}';
  generated+=`@MainActor enum ${enumName}{${members}
  static func fixtureInstall(owner:String,identity:UUID,providedHost:FixtureHost?,force:Bool=false)->FixturePresentation?{
   ${gate}
   bindingID=owner;presentationID=identity
   var finished=false;var host=providedHost;let continuation=FixtureContinuation();let runtime=FixtureRuntime();let scope="fixture-opaque";var ownerObserver:NSObjectProtocol?
   ${finish}
   ${cancelAssignment}
   return FixturePresentation(finish:finish,continuation:continuation)
  }
  static func fixtureReset(){cancel=nil;bindingID=nil;presentationID=nil;${modern?'dismissals=[:];cancellationTargets=[:]':''}}
  static func fixtureCount()->Int{${modern?'dismissals.count':'0'}}
  static func fixturePrune(_ currentBinding:String){${modern?'pruneDismissalHistory(currentBinding:currentBinding)':''}}
 }
 `;
 }
 const boundary=path.join(scratch,'ActualPickerBoundary.swift');fs.writeFileSync(boundary,generated);const cases='modules/freed-protection/tests/PickerCancellationResidualCases.swift',binary=path.resolve(out,'native-fixture');fs.copyFileSync(boundary,path.join(out,'ActualPickerBoundary.swift'));fs.copyFileSync(cases,path.join(out,path.basename(cases)));fs.writeFileSync(path.join(out,'source-bindings.json'),JSON.stringify({before,inputs:bindings,cases:{path:cases,sha256:hash(cases)},runner:hash(__filename),generatedSha256:hash(boundary),boundary:'Actual complete native picker member prefix, actual finish closure and cancellation assignment from both production presenters. Fixture install models already-admitted native presentation setup; private fields are exposed only in generated input. UIKit host/dismissal completion/properties and continuation are scripted; no policy/Auth/OS dismissal or device claim.'},null,2));
 for(const [cmd,args] of [['xcrun',['swiftc','-parse-as-library','-swift-version','5',boundary,cases,'-o',binary]],[binary,[]]]){const r=spawnSync(cmd,args,{encoding:'utf8',timeout:120000});logs.push({command:[cmd,...args],exitCode:r.status,signal:r.signal,stdout:r.stdout,stderr:r.stderr});fs.writeFileSync(path.join(out,'commands.json'),JSON.stringify(logs,null,2));process.stdout.write(r.stdout+r.stderr);assert.equal(r.status,0);}
 console.log('fixtureBinarySHA256='+hash(binary));
}finally{fs.rmSync(scratch,{recursive:true,force:true});}
