import Foundation
import Darwin

// Catches lost migration, late legacy publication, partial/throwing writes and
// cross-process stale caches using the actual App Group file/lock implementation.
@main struct AtomicEnforcementStateCases {
 enum Aborted: Error { case registration }
 static func main() throws {
  if CommandLine.arguments.count > 1 {
   let directory=URL(fileURLWithPath:CommandLine.arguments[2]),domain=CommandLine.arguments[3]
   try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in
    if CommandLine.arguments[1]=="reset" {FreedProtectionConfigurationLock.invalidateForReset(d);d.removeObject(forKey:"freed.familyActivitySelection")}
    else {precondition(!FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:0));precondition(d.data(forKey:"freed.familyActivitySelection")==nil);precondition(d.integer(forKey:FreedProtectionConfigurationLock.generationKey)==1)}
   };return
  }
  let directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-atomic-state-\(UUID().uuidString)")
  let domain="app.freed.tests.atomic.\(UUID().uuidString)",legacy=UserDefaults(suiteName:domain)!
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  defer{legacy.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  legacy.set(true,forKey:"freed.adultFilterActive");legacy.set(Data([1,2,3]),forKey:"freed.familyActivitySelection");legacy.set("private-journal-preserved",forKey:"freed.journal.entry")
  let file=directory.appendingPathComponent("freed-enforcement-state.v1.plist")
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in precondition(d.bool(forKey:"freed.adultFilterActive"));precondition(d.data(forKey:"freed.familyActivitySelection")==Data([1,2,3]))}
  precondition(FileManager.default.fileExists(atPath:file.path),"First transaction must atomically migrate enforcement intent to a versioned file")
  let migrated=try Data(contentsOf:file)
  let plist=try PropertyListSerialization.propertyList(from:migrated,format:nil) as! [String:Any]
  precondition(plist["version"] as? Int==1);precondition((plist["values"] as! [String:Any])["freed.journal.entry"]==nil,"Private journal must not join enforcement storage")
  legacy.set(false,forKey:"freed.adultFilterActive")
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in precondition(d.bool(forKey:"freed.adultFilterActive"),"Committed file wins over stale legacy defaults")}
  do {try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in d.set(false,forKey:"freed.adultFilterActive");d.set(Data([9]),forKey:"freed.familyActivitySelection");precondition(FreedProtectionConfigurationLock.persist(d));throw Aborted.registration};preconditionFailure("throwing transaction must fail")}catch Aborted.registration{}
  let afterAbort=try Data(contentsOf:file);precondition(afterAbort==migrated,"Failed registration must preserve exact prior durable file")
  precondition(legacy.string(forKey:"freed.journal.entry")=="private-journal-preserved")
  // Real filesystem refusal before commit cannot publish a partial replacement.
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
  do {try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in d.set(false,forKey:"freed.adultFilterActive")};preconditionFailure("Read-only container commit must reject")}catch{}
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
  let afterWrite=try Data(contentsOf:file);precondition(afterWrite==migrated,"Failed write must retain working configuration")
  func child(_ op:String)throws{let p=Process();p.executableURL=URL(fileURLWithPath:CommandLine.arguments[0]);p.arguments=[op,directory.path,domain];try p.run();p.waitUntilExit();precondition(p.terminationStatus==0)}
  try child("reset");try child("late-callback")
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in precondition(!FreedProtectionConfigurationLock.permitsPublication(d,capturedGeneration:0));precondition(d.data(forKey:"freed.familyActivitySelection")==nil)}
  let intact=try Data(contentsOf:file)
  let corrupt=Data([0,255,12]);try corrupt.write(to:file)
  var invoked=false
  do {try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){_ in invoked=true};preconditionFailure("Unreadable file must reject instead of remigrating legacy")}catch FreedProtectionConfigurationLock.AccessError.stateUnreadable{}
  let afterCorrupt=try Data(contentsOf:file);precondition(!invoked && afterCorrupt==corrupt)
  let future=try PropertyListSerialization.data(fromPropertyList:["version":2,"revision":0,"values":[String:Any]()],format:.binary,options:0);try future.write(to:file)
  do {try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){_ in invoked=true};preconditionFailure("Unsupported version must not be replaced")}catch FreedProtectionConfigurationLock.AccessError.stateVersionUnsupported{}
  let afterFuture=try Data(contentsOf:file);precondition(!invoked && afterFuture==future);try intact.write(to:file)
  let migrationDirectory=directory.appendingPathComponent("failed-migration"),migrationDomain=domain+".migration",old=UserDefaults(suiteName:domain+".migration")!
  try FileManager.default.createDirectory(at:migrationDirectory,withIntermediateDirectories:true)
  defer{old.removePersistentDomain(forName:migrationDomain)}
  old.set(Data([4,5]),forKey:"freed.familyActivitySelection")
  let lock=open(migrationDirectory.appendingPathComponent("freed-protection-configuration.lock").path,O_CREAT | O_RDWR,S_IRUSR | S_IWUSR);precondition(lock>=0);close(lock)
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:migrationDirectory.path)
  do {try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:migrationDirectory,domain:migrationDomain){_ in invoked=true};preconditionFailure("Failed migration must reject before invoking consumer")}catch let error as FreedProtectionConfigurationLock.AccessError{precondition(error.stage=="state-commit" && error.posixCode==EACCES)}
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:migrationDirectory.path)
  precondition(!invoked && old.data(forKey:"freed.familyActivitySelection")==Data([4,5]))
  precondition(!FileManager.default.fileExists(atPath:migrationDirectory.appendingPathComponent("freed-enforcement-state.v1.plist").path))
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:migrationDirectory,domain:migrationDomain){d in precondition(d.data(forKey:"freed.familyActivitySelection")==Data([4,5]))}
  print("Atomic filesystem migration/retry, private separation, failed write + explicit-commit rollback, corrupt/future version rejection, restart and late reset cases passed")
 }
}
