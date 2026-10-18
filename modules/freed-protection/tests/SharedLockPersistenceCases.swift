import Foundation
import Darwin

@main struct SharedLockPersistenceCases {
 static func main() throws {
  let domain="app.freed.tests.post-persistence.\(UUID().uuidString)",directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-lock-persistence-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  defer{UserDefaults(suiteName:domain)?.removePersistentDomain(forName:domain);try? FileManager.default.removeItem(at:directory)}
  var callbacks=0
  let value=try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:{(value:Int) in
   callbacks += 1;precondition(value==42)
   let descriptor=open(directory.appendingPathComponent("freed-protection-configuration.lock").path,O_RDWR);precondition(descriptor>=0);defer{close(descriptor)}
   precondition(flock(descriptor,LOCK_EX | LOCK_NB) != 0 && (errno==EWOULDBLOCK || errno==EAGAIN),"Commit callback must still own exclusion")
   let data=try! Data(contentsOf:directory.appendingPathComponent("freed-enforcement-state.v1.plist"));let state=try! PropertyListSerialization.propertyList(from:data,format:nil) as! [String:Any]
   precondition((state["values"] as! [String:Any])["freed.appLimit.dailyMinutes"] as? Int==42,"External effects follow observable durable publication")
  }){d in d.set(42,forKey:"freed.appLimit.dailyMinutes");return 42}
  precondition(value==42 && callbacks==1)
  callbacks=0
  do {_ = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:{(_:Int) in callbacks += 1}){d in d.set(7,forKey:"freed.appLimit.dailyMinutes");try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path);return 7};preconditionFailure("Failed file commit must throw")}catch{}
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
  precondition(callbacks==0,"Failed commit causes zero external side effects")
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){outer in
   precondition(outer.integer(forKey:"freed.appLimit.dailyMinutes")==42)
   try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){inner in precondition(outer===inner);inner.set(8,forKey:"freed.appLimit.dailyMinutes")}
   do {_ = try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain,afterSuccessfulPersistence:{(_:Int) in callbacks += 1}){_ in 9};preconditionFailure("Nested callback cannot precede outer commit")}catch FreedProtectionConfigurationLock.AccessError.unavailable{}
  }
  precondition(callbacks==0)
  try FreedProtectionConfigurationLock.withExclusiveAccess(containerOverride:directory,domain:domain){d in precondition(d.integer(forKey:"freed.appLimit.dailyMinutes")==8)}
  print("Real atomic commit callback exclusion, failed write zero callbacks and nested transaction cases passed")
 }
}
