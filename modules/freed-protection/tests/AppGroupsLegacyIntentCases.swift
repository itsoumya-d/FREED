import Foundation
struct ReviewClock {static var now=Date(timeIntervalSince1970:1_791_331_200)}
@main struct Cases {
 static func main()throws {
  let d=FreedProtectionConfigurationLock.defaults;let r=FreedAppGroupsRuntime();let owner="[\"owner\",1]",token=TestToken(value:"legacy-selected")
  var selection=FamilyActivitySelection();selection.applicationTokens=[token];d.set(try JSONEncoder().encode(selection),forKey:"freed.familyActivitySelection");d.set("scheduled",forKey:"freed.appGuard.mode")
  let tomorrow=(Calendar.current.component(.weekday,from:ReviewClock.now)-1+1)%7
  d.set(try JSONSerialization.data(withJSONObject:["strictGuard":false,"schedules":[["id":"future","enabled":true,"allDay":true,"days":[tomorrow],"startMinute":0,"endMinute":1439]]]),forKey:"freed.appGuard.schedules.v1")
  try DeviceActivityCenter().startMonitoring(.init("freed.appGuard.schedule.future.day\(tomorrow)"),during:.init(intervalStart:DateComponents(hour:0,minute:0,weekday:tomorrow+1),intervalEnd:DateComponents(hour:0,minute:0,weekday:(tomorrow+1)%7+1),repeats:true))
  precondition(r.setScope(owner)["accepted"] as? Bool == true);let outside=r.snapshot(owner),again=r.snapshot(owner);let group=(outside["groups"] as! [[String:Any]])[0]
  precondition(group["enabled"] as? Bool==true,"saved future schedule intent must not migrate permanently Off")
  precondition(group["ready"] as? Bool==true && group["active"] as? Bool==false);precondition(outside["revision"] as? Int==again["revision"] as? Int)
  let compatibility=outside["legacyCompatibility"] as! [String:Any];precondition(compatibility["retained"] as? Bool==true && compatibility["applicationCount"] as? Int==1)
  // Every enabled row is required even before either window is active.
  let outsideDate=ReviewClock.now,later=(tomorrow+1)%7
  let first:[String:Any]=["id":"future","enabled":true,"allDay":true,"days":[tomorrow],"startMinute":0,"endMinute":1439]
  let second:[String:Any]=["id":"later","enabled":true,"allDay":true,"days":[later],"startMinute":0,"endMinute":1439]
  let disabled:[String:Any]=["enabled":false]
  func configuration(_ strict:Bool=false)throws{d.set(try JSONSerialization.data(withJSONObject:["strictGuard":strict,"schedules":[first,second,disabled]]),forKey:"freed.appGuard.schedules.v1")}
  func projected()->[String:Any]{(r.snapshot(owner)["groups"] as! [[String:Any]])[0]}
  try configuration()
  precondition(projected()["ready"] as? Bool==false,"the first registered row cannot acknowledge a second missing enabled monitor")
  DeviceActivityCenter().stopMonitoring(DeviceActivityCenter().activities)
  precondition(projected()["enabled"] as? Bool==true && projected()["ready"] as? Bool==false)
  let firstName=DeviceActivityName("freed.appGuard.schedule.future.day\(tomorrow)"),secondName=DeviceActivityName("freed.appGuard.schedule.later.day\(later)")
  let firstSchedule=DeviceActivitySchedule(intervalStart:DateComponents(hour:0,minute:0,weekday:tomorrow+1),intervalEnd:DateComponents(hour:0,minute:0,weekday:(tomorrow+1)%7+1),repeats:true)
  let secondSchedule=DeviceActivitySchedule(intervalStart:DateComponents(hour:0,minute:0,weekday:later+1),intervalEnd:DateComponents(hour:0,minute:0,weekday:(later+1)%7+1),repeats:true)
  try DeviceActivityCenter().startMonitoring(firstName,during:firstSchedule)
  try DeviceActivityCenter().startMonitoring(secondName,during:secondSchedule)
  precondition(projected()["ready"] as? Bool==true && projected()["active"] as? Bool==false)
  // Registered before-use, strict or night protection does not waive another required monitor.
  d.set(true,forKey:"freed.riskWindowActive")
  precondition(projected()["ready"] as? Bool==false)
  let night=DeviceActivityName("freed.nightGuard"),nightSchedule=DeviceActivitySchedule(intervalStart:DateComponents(hour:22,minute:0),intervalEnd:DateComponents(hour:7,minute:0),repeats:true)
  try DeviceActivityCenter().startMonitoring(night,during:nightSchedule)
  precondition(projected()["ready"] as? Bool==false,"old installed Night Guard without acknowledged expected intent stays unverified")
  d.set(try JSONSerialization.data(withJSONObject:["version":1,"generation":0,"startMinute":1320,"endMinute":420,"repeats":true]),forKey:"freed.riskWindow.expected.v1")
  precondition(projected()["ready"] as? Bool==true)
  try DeviceActivityCenter().startMonitoring(night,during:.init(intervalStart:DateComponents(hour:9,minute:0),intervalEnd:DateComponents(hour:10,minute:0),repeats:true))
  precondition(projected()["ready"] as? Bool==false,"different repeating hours cannot acknowledge intended Night Guard boundaries")
  try DeviceActivityCenter().startMonitoring(night,during:.init(intervalStart:nightSchedule.intervalStart,intervalEnd:nightSchedule.intervalEnd,repeats:false))
  precondition(projected()["ready"] as? Bool==false)
  try DeviceActivityCenter().startMonitoring(night,during:nightSchedule)
  precondition(projected()["ready"] as? Bool==true)
  DeviceActivityCenter().stopMonitoring([secondName]);d.set("before-use",forKey:"freed.appGuard.mode");ManagedSettingsStore().shield.applications=[token]
  precondition(projected()["ready"] as? Bool==false)
  try configuration(true);precondition(projected()["ready"] as? Bool==false)
  try configuration();d.set("scheduled",forKey:"freed.appGuard.mode");d.set(false,forKey:"freed.riskWindowActive");ManagedSettingsStore().shield.applications=nil
  try DeviceActivityCenter().startMonitoring(secondName,during:secondSchedule)
  ReviewClock.now=Calendar.current.date(byAdding:.day,value:2,to:outsideDate)!;ManagedSettingsStore().shield.applications=[token]
  precondition(projected()["ready"] as? Bool==true && projected()["active"] as? Bool==true)
  ReviewClock.now=outsideDate;ManagedSettingsStore().shield.applications=nil
  ReviewClock.now=Calendar.current.date(byAdding:.day,value:1,to:ReviewClock.now)!
  ManagedSettingsStore().shield.applications=[token]
  let inside=r.snapshot(owner),live=(inside["groups"] as! [[String:Any]])[0]
  precondition(live["enabled"] as? Bool==true && live["active"] as? Bool==true)
  precondition(ManagedSettingsStore.adultProtected)
  let remove:[String:Any]=["version":1,"expectedStoreRevision":inside["revision"]!,"id":"legacy-default","expectedRevision":live["revision"]!]
  precondition(r.remove(remove,owner)["accepted"] as? Bool==true)
  let retained=r.snapshot(owner)["legacyCompatibility"] as! [String:Any]
  precondition(retained["retained"] as? Bool==true && retained["applicationCount"] as? Int==1)
  precondition(ManagedSettingsStore().shield.applications==[token] && ManagedSettingsStore.adultProtected)
  print("Actual runtime legacy future schedule retains enabled intent outside and active readback inside its window")
 }
}
