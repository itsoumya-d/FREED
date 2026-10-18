import Foundation

// Production monitor + real atomic files/flock. Framework-only objects are the
// same deterministic boundaries used by native guard tests, with observed writes.
@main struct MonitorPublicationCases {
 struct Frame:Equatable {
  var apps:Set<ApplicationToken>?,categories:GuardCategoryPolicy?,domains:Set<WebDomainToken>?,domainCategories:GuardCategoryPolicy?,web:Bool
  init(_ h:DeviceActivityMonitorExtension){apps=h.store.shield.applications;categories=h.store.shield.applicationCategories;domains=h.store.shield.webDomains;domainCategories=h.store.shield.webDomainCategories;web=h.store.webContent.blockedByFilter != nil}
 }
 static func main()throws {
  let op=CommandLine.arguments[1],directory=FileManager.default.temporaryDirectory.appendingPathComponent("freed-monitor-fix2-\(UUID().uuidString)")
  try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
  RuntimeLock.directory=directory;RuntimeLock.domain="app.freed.tests.monitor-fix2.\(UUID().uuidString)"
  defer{UserDefaults(suiteName:RuntimeLock.domain)?.removePersistentDomain(forName:RuntimeLock.domain);try? FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path);try? FileManager.default.removeItem(at:directory)}
  let h=DeviceActivityMonitorExtension(),token=ApplicationToken(id:"opaque-application"),category=ActivityCategoryToken(id:"opaque-category"),domain=WebDomainToken(id:"opaque-domain")
  var selected=FamilyActivitySelection();selected.applicationTokens=[token];selected.categoryTokens=[category];selected.webDomainTokens=[domain]
  let file=directory.appendingPathComponent(FreedProtectionConfigurationLock.stateFileName)
  let daily=op.hasPrefix("daily-"),dailyEnd=op.hasPrefix("daily-end"),night=op.hasPrefix("night-") || op=="daily-end-night-overlap",expired=["schedule-start","schedule-end","earned-start","earned-end"].contains(op)
  let scope=DeviceActivityMonitorExtension.InterventionScope(kind:"ios-token",tokenType:"application",token:try JSONEncoder().encode(token).base64EncodedString(),domain:nil)
  try RuntimeLock.withExclusiveAccess{d in
   d.set(false,forKey:"freed.protectionConfiguration.reset");d.set(true,forKey:"freed.adultFilterActive");d.set(try JSONEncoder().encode(selected),forKey:"freed.familyActivitySelection")
   d.set(daily ? "daily-limit":"before-use",forKey:"freed.appGuard.mode");d.set(daily,forKey:"freed.appLimit.active")
   if dailyEnd{d.set(h.localDateKey(),forKey:"freed.appLimit.reachedDate")}
   if op=="daily-start"{d.set("2000-01-01",forKey:"freed.appLimit.reachedDate")}
   d.set(night,forKey:"freed.riskWindowActive");d.set(op=="night-end" || op=="daily-end-night-overlap",forKey:"freed.riskWindow.currentlyActive")
   if op=="daily-end-strict-overlap" || op=="daily-end-schedule-overlap" {
    let minute=Calendar.current.component(.hour,from:Date())*60+Calendar.current.component(.minute,from:Date())
    let schedules=op=="daily-end-schedule-overlap" ? [FreedAppGuardSchedule(id:"work",enabled:true,startMinute:(minute+1439)%1440,endMinute:(minute+30)%1440,days:Array(0...6),packages:[],allDay:false)]:[]
    let configuration=FreedAppGuardScheduleConfiguration(version:1,targetScope:"selected-applications",schedules:schedules,strictGuard:op=="daily-end-strict-overlap")
    d.set(try JSONEncoder().encode(configuration),forKey:FreedAppGuardSchedulePolicy.configurationKey)
    for plan in FreedAppGuardSchedulePolicy.registrations(configuration) {DeviceActivityCenter.registered[.init(plan.name)] = .init(intervalStart:plan.intervalStart,intervalEnd:plan.intervalEnd,repeats:true)}
   }
   if expired || op=="readonly-render" {
    d.set("ios-screen-time",forKey:"freed.earnedUnlock.source");d.set(UUID().uuidString,forKey:"freed.earnedUnlock.interventionId");d.set(try JSONEncoder().encode(scope),forKey:"freed.earnedUnlock.scope")
    let expiry=Date().addingTimeInterval(op=="readonly-render" ? 120:-60)
    d.set(ISO8601DateFormatter().string(from:expiry),forKey:"freed.earnedUnlock.expiresAt")
   }
   if op.hasPrefix("reset-"){d.set(true,forKey:"freed.protectionConfiguration.reset")}
  }
  h.store.webContent.blockedByFilter = .auto([],except:[])
  if dailyEnd || ["daily-start","night-end"].contains(op) || op.hasPrefix("reset-") {h.store.shield.applications=[token];h.store.shield.applicationCategories = .specific([category]);h.store.shield.webDomains=[domain];h.store.shield.webDomainCategories = .specific([category])}
  func invoke(){switch op {
   case "daily-end","daily-end-night-overlap","daily-end-strict-overlap","daily-end-schedule-overlap":h.intervalDidEnd(for:.init("freed.selectedAppDailyLimit"))
   case "daily-start":h.intervalDidStart(for:.init("freed.selectedAppDailyLimit"))
   case "daily-threshold":h.eventDidReachThreshold(.init("freed.selectedAppDailyLimitReached"),activity:.init("freed.selectedAppDailyLimit"))
   case "night-end":h.intervalDidEnd(for:.init("freed.nightGuard"))
   case "night-start":h.intervalDidStart(for:.init("freed.nightGuard"))
   case "schedule-start","readonly-render":h.intervalDidStart(for:.init(FreedAppGuardSchedulePolicy.activityPrefix+"work.daily"))
   case "schedule-end":h.intervalDidEnd(for:.init(FreedAppGuardSchedulePolicy.activityPrefix+"work.daily"))
   case "earned-start":h.intervalDidStart(for:.init("freed.earnedUnlockWindow"))
   case "earned-end":h.intervalDidEnd(for:.init("freed.earnedUnlockWindow"))
   case "reset-start":h.intervalDidStart(for:.init("unrelated"))
   case "reset-end":h.intervalDidEnd(for:.init("unrelated"))
   case "reset-threshold":h.eventDidReachThreshold(.init("unrelated"),activity:.init("unrelated"))
   case "ignored-start":h.intervalDidStart(for:.init("unrelated"))
   case "ignored-end":h.intervalDidEnd(for:.init("unrelated"))
   default:h.eventDidReachThreshold(.init("wrong"),activity:.init("freed.selectedAppDailyLimit"))
  }}
  let before=try Data(contentsOf:file),frame=Frame(h)
  if op=="readonly-render" {
   let expiresAt=RuntimeLock.sharedDefaults().string(forKey:"freed.earnedUnlock.expiresAt")!,expiry=ISO8601DateFormatter().date(from:expiresAt)!
   let plan=FreedAppGuardSchedulePolicy.relockRegistration(expiresAt:expiry),n=DeviceActivityName("freed.earnedUnlockWindow")
   DeviceActivityCenter.registered[n] = .init(intervalStart:plan.intervalStart,intervalEnd:plan.intervalEnd,repeats:false)
   DeviceActivitySchedule.nextIntervalQueryCount=0;DeviceActivitySchedule.shiftAtQuery=2
   GuardShield.observeWrites={
    precondition(RuntimeLock.sharedDefaults().string(forKey:"freed.earnedUnlock.expiresAt")==expiresAt,"Post-commit renderer must not erase lease authority when OS readback changes")
   }
   invoke();GuardShield.observeWrites=nil
   let after=try Data(contentsOf:file);precondition(before==after && h.store.shield.applications==[token]);precondition(DeviceActivitySchedule.nextIntervalQueryCount>=2)
   print("PASS readonly-render: changed OS relock readback fails closed without post-commit preference mutation");return
  }
  if op.hasPrefix("ignored-") {
   GuardShield.writeCount=0;GuardWebContent.writeCount=0;invoke()
   let after=try Data(contentsOf:file);precondition(before==after && Frame(h)==frame && GuardShield.writeCount==0 && GuardWebContent.writeCount==0)
   print("PASS \(op): unrelated events preserve state and OS with zero publication");return
  }
  if op.hasPrefix("reset-") {
   try FileManager.default.setAttributes([.posixPermissions:0],ofItemAtPath:file.path);invoke()
   try FileManager.default.setAttributes([.posixPermissions:0o600],ofItemAtPath:file.path)
   let denied=try Data(contentsOf:file);precondition(denied==before && Frame(h)==frame,"Unavailable state cannot clear previous OS protection")
   invoke();let after=try Data(contentsOf:file);precondition(before==after && h.store.shield.applications==nil && h.store.shield.applicationCategories==nil && h.store.shield.webDomains==nil && h.store.webContent.blockedByFilter==nil)
   print("PASS \(op): failed state read preserves OS; durable reset renders readonly after retry");return
  }
  try FileManager.default.setAttributes([.posixPermissions:0o500],ofItemAtPath:directory.path)
  GuardShield.writeCount=0;GuardWebContent.writeCount=0
  invoke()
  let denied=try Data(contentsOf:file);precondition(before==denied,"Rejected \(op) commit must preserve exact previous state bytes")
  precondition(Frame(h)==frame,"Rejected \(op) commit must preserve every previous OS shield/filter")
  precondition(GuardShield.writeCount==0 && GuardWebContent.writeCount==0,"Rejected \(op) commit must publish zero OS shield/filter writes")
  try FileManager.default.setAttributes([.posixPermissions:0o700],ofItemAtPath:directory.path)
  var observed=false
  GuardShield.observeWrites={
   let committed=try! Data(contentsOf:file);precondition(committed != before,"OS publication must follow durable state replacement for \(op)");observed=true
  }
  invoke();GuardShield.observeWrites=nil
  let state=RuntimeLock.sharedDefaults();precondition(observed)
  switch op {
  case "daily-end","daily-start":precondition(state.string(forKey:"freed.appLimit.reachedDate")==nil && h.store.shield.applications==nil && h.store.shield.applicationCategories==nil && h.store.shield.webDomains==nil)
  case "daily-end-night-overlap":precondition(state.string(forKey:"freed.appLimit.reachedDate")==nil && h.store.shield.applications==[token] && h.store.shield.applicationCategories == .specific([category]) && h.store.shield.webDomains==[domain])
  case "daily-end-strict-overlap","daily-end-schedule-overlap":precondition(state.string(forKey:"freed.appLimit.reachedDate")==nil && h.store.shield.applications==[token] && h.store.shield.applicationCategories==nil && h.store.shield.webDomains==nil)
  case "daily-threshold":precondition(state.string(forKey:"freed.appLimit.reachedDate")==h.localDateKey() && h.store.shield.applications==[token] && h.store.shield.applicationCategories == .specific([category]) && h.store.shield.webDomains==[domain])
  case "night-end":precondition(!state.bool(forKey:"freed.riskWindow.currentlyActive") && h.store.shield.applications==[token] && h.store.shield.applicationCategories==nil && h.store.shield.webDomains==nil)
  case "night-start":precondition(state.bool(forKey:"freed.riskWindow.currentlyActive") && h.store.shield.applications==[token] && h.store.shield.applicationCategories == .specific([category]) && h.store.shield.webDomains==[domain])
  default:precondition(state.object(forKey:"freed.earnedUnlock.expiresAt")==nil && state.data(forKey:"freed.familyActivitySelection") != nil && h.store.shield.applications==[token])
  }
  precondition(h.store.webContent.blockedByFilter != nil,"Independent adult policy must remain configured")
  print("PASS \(op): rejected save preserves exact file/OS; writable retry publishes matching readonly policy after durability")
 }
}
