const assert=require('node:assert/strict');
const {spawnSync}=require('node:child_process');
const {mkdtempSync,rmSync,existsSync}=require('node:fs');
const {tmpdir}=require('node:os');
const {join,resolve}=require('node:path');
const root=resolve(__dirname,'../../..'),source='modules/freed-protection/ios/FreedShieldRuntimeDiagnostics.swift';
assert.ok(existsSync(join(root,source)),'bounded shield diagnostic implementation must exist');
const tmp=mkdtempSync(join(tmpdir(),'freed-shield-diagnostics-'));
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);}
try{run('xcrun',['swiftc','-parse-as-library','-swift-version','5',source,'modules/freed-protection/tests/ShieldRuntimeDiagnosticCases.swift','-o',join(tmp,'cases')]);run(join(tmp,'cases'),[]);}finally{rmSync(tmp,{recursive:true,force:true});}

// SDK classes cannot run on macOS. Extract the exact owned callback methods,
// keeping diagnostics/storage real; only shield SDK values and business bodies
// are fixtures. The native App Group location is replaced by an isolated file.
const {readFileSync,writeFileSync,mkdirSync}=require('node:fs');
function method(source,needle){const start=source.indexOf(needle);assert.ok(start>=0,needle);let i=source.indexOf('{',start),depth=1;for(i++;depth&&i<source.length;i++){if(source[i]==='{')depth++;if(source[i]==='}')depth--;}return source.slice(start,i).replace(/^  /,'');}
const fixture=mkdtempSync(join(tmpdir(),'freed-shield-callback-'));
try{
 const config=readFileSync(join(root,'ios/FREEDShieldConfiguration/ShieldConfigurationExtension.swift'),'utf8');
 const action=readFileSync(join(root,'ios/FREEDShieldAction/ShieldActionExtension.swift'),'utf8');
 const configMethods=[...config.matchAll(/  override func configuration\(/g)].map(m=>method(config,config.slice(m.index,config.indexOf('{',m.index))));
 const actionMethods=[...action.matchAll(/  override func handle\(/g)].map(m=>method(action,action.slice(m.index,action.indexOf('{',m.index))));
 const suite='freed-task60-callback-'+Date.now();
 const statePath=join(fixture,'freed-enforcement-state.v1.plist');
 const runtime=readFileSync(join(root,source),'utf8').replace('private static let group = "group.app.freed.recovery"',`private static let group = "${suite}"`).replace('FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: group)?.appendingPathComponent("freed-enforcement-state.v1.plist")',`URL(fileURLWithPath: "${statePath}")`);
 writeFileSync(join(fixture,'Runtime.swift'),runtime);
 const harness=`
import Foundation
struct Application {} ; struct ActivityCategory {} ; struct WebDomain {}
struct ApplicationToken {}; struct WebDomainToken {}; struct ActivityCategoryToken {}
enum ShieldAction {case primaryButtonPressed,secondaryButtonPressed,unknown}
enum ShieldActionResponse {case close,\`defer\`,openParentalControlsApp}
struct ShieldConfiguration:Equatable {let website:Bool;let categoryWide:Bool}
class ShieldConfigurationDataSource {
 func configuration(shielding application:Application)->ShieldConfiguration {fatalError()}
 func configuration(shielding application:Application,in category:ActivityCategory)->ShieldConfiguration {fatalError()}
 func configuration(shielding webDomain:WebDomain)->ShieldConfiguration {fatalError()}
 func configuration(shielding webDomain:WebDomain,in category:ActivityCategory)->ShieldConfiguration {fatalError()}
}
final class Configuration:ShieldConfigurationDataSource {
 var constructions=0
 private func recoveryShield(categoryWide:Bool=false,website:Bool=false)->ShieldConfiguration {constructions += 1;return ShieldConfiguration(website:website,categoryWide:categoryWide)}
 ${configMethods.join('\n')}
}
class ShieldActionDelegate {
 func handle(action:ShieldAction,for application:ApplicationToken,completionHandler:@escaping(ShieldActionResponse)->Void){}
 func handle(action:ShieldAction,for webDomain:WebDomainToken,completionHandler:@escaping(ShieldActionResponse)->Void){}
 func handle(action:ShieldAction,for category:ActivityCategoryToken,completionHandler:@escaping(ShieldActionResponse)->Void){}
}
final class ActionDelegate:ShieldActionDelegate {
 var requested:ShieldActionResponse = .close;var decisions=0
 private func response(for action:ShieldAction,context:String,scope:Int?,application:ApplicationToken?=nil,webDomain:WebDomainToken?=nil)->ShieldActionResponse {decisions += 1;return requested}
 private func scopeForApplication(_ a:ApplicationToken)->Int? {nil}
 private func scopeForWebDomain(_ a:WebDomainToken)->Int? {nil}
 private func scopeForCategory(_ a:ActivityCategoryToken)->Int? {nil}
 ${actionMethods.join('\n')}
 ${method(action,'  private func diagnosticAction(')}
 ${method(action,'  private func diagnosticOutcome(')}
}
@main enum Cases {
 static func main() throws {
 let d=UserDefaults(suiteName:"${suite}")!;defer{d.removePersistentDomain(forName:"${suite}")}
 let values:[String:Any] = ["freed.protectionConfiguration.generation":2,"freed.appGroups.v1":try JSONSerialization.data(withJSONObject:["version":1,"ownerDigest":"fixture","generation":2,"scopeEpoch":3]),"freed.selection.websiteRecoveryProbe.v1":try JSONSerialization.data(withJSONObject:["version":1,"identity":["owner":"fixture","generation":2,"epoch":3],"revision":1,"optedIn":true])]
 let packet=try PropertyListSerialization.data(fromPropertyList:["version":1,"revision":1,"values":values],format:.binary,options:0)
 try packet.write(to:URL(fileURLWithPath:"${statePath}"))
 let ctx=FreedShieldRuntimeDiagnostics.context(info:Bundle.main.infoDictionary!,values:values,debug:false)!
 func records()->[FreedShieldRuntimeDiagnostics.Record]{FreedShieldRuntimeDiagnostics.records(context:ctx,now:Date().timeIntervalSince1970,read:{d.data(forKey:$0)})}
 let c=Configuration()
 precondition(c.configuration(shielding:Application()) == ShieldConfiguration(website:false,categoryWide:false))
 precondition(c.configuration(shielding:Application(),in:ActivityCategory()) == ShieldConfiguration(website:false,categoryWide:true))
 precondition(c.configuration(shielding:WebDomain()) == ShieldConfiguration(website:true,categoryWide:false))
 precondition(c.configuration(shielding:WebDomain(),in:ActivityCategory()) == ShieldConfiguration(website:true,categoryWide:false))
 precondition(c.constructions==4)
 precondition(records().count==6,"actual configuration callbacks must publish bounded entry/return records")
 let a=ActionDelegate();var completions=0
 for response in [ShieldActionResponse.close,.defer,.openParentalControlsApp] {
 a.requested=response
 a.handle(action:.primaryButtonPressed,for:ApplicationToken()){precondition($0==response);completions += 1}
 a.handle(action:.secondaryButtonPressed,for:WebDomainToken()){precondition($0==response);completions += 1}
 a.handle(action:.unknown,for:ActivityCategoryToken()){precondition($0==response);completions += 1}
 }
 precondition(a.decisions==9 && completions==9)
 precondition(records().count==12,"actual action callbacks must publish bounded records")
 let before=records().count
 try Data("corrupt".utf8).write(to:URL(fileURLWithPath:"${statePath}"))
 precondition(c.configuration(shielding:WebDomain()).website)
 a.requested = .close;a.handle(action:.primaryButtonPressed,for:WebDomainToken()){precondition($0 == .close);completions += 1}
 precondition(completions==10 && records().count==before,"gate failure neither alters response nor erases prior slots")
 print("PASS exact extracted configuration/action callbacks: returned values, one completion, real bounded adapter records, corrupt gate harmless")
 }
}
`;
 writeFileSync(join(fixture,'Callbacks.swift'),harness);
 const app=join(fixture,'Fixture.app'),contents=join(app,'Contents'),macos=join(contents,'MacOS');mkdirSync(macos,{recursive:true});
 writeFileSync(join(contents,'Info.plist'),`<?xml version="1.0"?><plist version="1.0"><dict><key>CFBundleExecutable</key><string>Fixture</string><key>CFBundleIdentifier</key><string>local.freed.task60.fixture</string><key>CFBundleVersion</key><string>16</string><key>FREEDWebsiteRecoveryProbeEnabled</key><true/><key>FREEDWebsiteRecoveryProbeChannel</key><string>internal-testflight</string><key>FREEDWebsiteRecoveryProbeInternalTestflight</key><true/></dict></plist>`);
 const executable=join(macos,'Fixture');run('xcrun',['swiftc','-parse-as-library','-swift-version','5',join(fixture,'Runtime.swift'),join(fixture,'Callbacks.swift'),'-o',executable]);run(executable,[]);
}finally{rmSync(fixture,{recursive:true,force:true});}

// Exercise the actual registration generator against a throwaway Xcode graph.
// Only unrelated Safari configuration is stubbed; no root project is written.
const {copyFileSync,symlinkSync}=require('node:fs');
const graph=mkdtempSync(join(tmpdir(),'freed-shield-graph-'));
try{
 for(const folder of ['scripts','assets/brand','ios/FREED','ios/FREED.xcodeproj','ios/FREEDSafariFocusShield'])mkdirSync(join(graph,folder),{recursive:true});
 copyFileSync(join(root,'scripts/add-ios-screen-time-extensions.rb'),join(graph,'scripts/add-ios-screen-time-extensions.rb'));
 writeFileSync(join(graph,'scripts/configure-safari-recovery-probe.js'),'process.exit(0);\n');
 copyFileSync(join(root,'assets/brand/freed-symbol.svg'),join(graph,'assets/brand/freed-symbol.svg'));
 copyFileSync(join(root,'ios/FREEDSafariFocusShield/manifest.json'),join(graph,'ios/FREEDSafariFocusShield/manifest.json'));
 symlinkSync(join(root,'node_modules'),join(graph,'node_modules'),'dir');
 for(const folder of ['FREEDShieldConfiguration','FREEDShieldAction','FREEDDeviceActivityMonitor','FREEDSafariContentBlocker'])mkdirSync(join(graph,'ios',folder),{recursive:true});
 for(const folder of ['FREEDShieldConfiguration','FREEDShieldAction','FREEDDeviceActivityMonitor','FREEDSafariContentBlocker','FREEDSafariFocusShield'])copyFileSync(join(root,'ios',folder,'Info.plist'),join(graph,'ios',folder,'Info.plist'));
 const ruby=`require 'xcodeproj'; p=Xcodeproj::Project.new('ios/FREED.xcodeproj');p.new_target(:application,'FREED',:ios,'15.1');p.save`;
 function graphRun(args){const r=spawnSync('ruby',args,{cwd:graph,encoding:'utf8',timeout:60000});assert.equal(r.status,0,r.stdout+r.stderr);process.stdout.write(r.stdout);}
 graphRun(['-e',ruby]);
 for(const channel of ['production','development','internal-testflight']){
  const enabled=channel!=='production',internal=channel==='internal-testflight';
  graphRun(['-rxcodeproj','-e',`Xcodeproj::Plist.write_to_path({'FREEDWebsiteRecoveryProbeEnabled'=>${enabled},'FREEDWebsiteRecoveryProbeChannel'=>'${channel}','FREEDWebsiteRecoveryProbeInternalTestflight'=>${internal}},'ios/FREED/Info.plist')`]);
  graphRun(['scripts/add-ios-screen-time-extensions.rb']);
  graphRun(['-rxcodeproj','-e',`p=Xcodeproj::Project.open('ios/FREED.xcodeproj');app=Xcodeproj::Plist.read_from_path('ios/FREED/Info.plist');['FREEDShieldConfiguration','FREEDShieldAction'].each{|name|t=p.targets.find{|v|v.name==name};abort('shared source missing') unless t.source_build_phase.files_references.count{|r|r.path.end_with?('FreedShieldRuntimeDiagnostics.swift')}==1;abort('CryptoKit missing') unless t.frameworks_build_phase.files_references.any?{|r|r.path.end_with?('CryptoKit.framework')};info=Xcodeproj::Plist.read_from_path("ios/#{name}/Info.plist");['FREEDWebsiteRecoveryProbeEnabled','FREEDWebsiteRecoveryProbeChannel','FREEDWebsiteRecoveryProbeInternalTestflight'].each{|key|abort('gate mismatch') unless info[key]==app[key]}};puts 'PASS generated ${channel} app/configuration/action shared source and exact bundled gates'`]);
 }
}finally{rmSync(graph,{recursive:true,force:true});}
