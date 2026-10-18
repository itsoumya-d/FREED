from pathlib import Path
import sys,re,json,hashlib
root=Path.cwd();out=Path(sys.argv[1]);out.mkdir(parents=True,exist_ok=True)
before='--before' in sys.argv
source=(root/'.superpowers/sdd/2026-10-07-activation-repair/task-a-fix2-before' if before else root)/'ios/FREEDDeviceActivityMonitor/DeviceActivityMonitorExtension.swift'
boundary=(root/'modules/freed-protection/tests/AppGuardCases.swift').read_text().split('enum FreedProtectionConfigurationLock')[0]
boundary=boundary.replace('final class GuardShield {','final class GuardShield {\n  static var observeWrites:(()->Void)?;static var writeCount=0')
boundary=re.sub(r'(var (?:applications|applicationCategories|webDomains|webDomainCategories):[^\n]+)',r'\1 { didSet {Self.writeCount += 1;Self.observeWrites?()} }',boundary)
boundary=boundary.replace('final class GuardWebContent { var blockedByFilter: GuardWebFilter? }','final class GuardWebContent { static var writeCount=0;var blockedByFilter: GuardWebFilter? {didSet{Self.writeCount += 1}} }')
boundary=boundary.replace('  static var shiftNextIntervalOnce = false','  static var shiftNextIntervalOnce = false\n  static var nextIntervalQueryCount=0,shiftAtQuery=0').replace('  var nextInterval: DateInterval? {','  var nextInterval: DateInterval? {\n    Self.nextIntervalQueryCount += 1\n    if Self.nextIntervalQueryCount==Self.shiftAtQuery{Self.shiftNextIntervalOnce=true}')
adapter='''
enum RuntimeLock {
 static var directory:URL!;static var domain:String!
 static func sharedDefaults()->UserDefaults{FreedProtectionConfigurationLock.sharedDefaults(containerOverride:directory,domain:domain)}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,_ body:(UserDefaults)throws->T)throws->T{try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:afterSuccessfulPersistence,body)}
}
enum FreedAppGroupsPolicy{static let prefix="freed.group."}
final class FreedAppGroupsRuntime{static let shared=FreedAppGroupsRuntime();static func legacyAppsAdopted(_ d:UserDefaults)->Bool{false};func callback(activity:String,event:String?=nil){}}
'''
monitor=re.sub(r'^import (?:DeviceActivity|FamilyControls|ManagedSettings)\n','',source.read_text(),flags=re.M).replace('private ','').replace('FreedProtectionConfigurationLock','RuntimeLock')
text=boundary+adapter+monitor+(root/'modules/freed-protection/tests/MonitorPublicationCases.swift').read_text()
(out/'Cases.swift').write_text(text)
(out/'harness-receipt.json').write_text(json.dumps({'monitorSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'harnessSha256':hashlib.sha256(text.encode()).hexdigest(),'transformations':['Complete monitor copied; only unavailable Apple imports removed and access modifiers exposed','Actual state helper routed to temporary directory/domain','Existing guard framework boundaries observe OS writes and optional relock readback changes'],'physicalProof':False},indent=2)+'\n')
