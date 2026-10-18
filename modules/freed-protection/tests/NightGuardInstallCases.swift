import Foundation
@main struct Cases {
 static func main()throws{
  let h=NightHarness(),d=FreedProtectionConfigurationLock.defaults,n=DeviceActivityName("freed.nightGuard")
  precondition(h.start(22,7,0,0)["nightGuardOperationAccepted"] as? Bool==true)
  precondition(d.data(forKey:"freed.riskWindow.expected.v1") != nil,"native acknowledged save must retain intended boundaries")
  precondition(h.start(22,7,0,0)["nightGuardOperationAccepted"] as? Bool==true)
  let original=d.data(forKey:"freed.riskWindow.expected.v1"),schedule=DeviceActivityCenter().schedule(for:n)
  DeviceActivityCenter.failNext=true;_=h.start(9,10,0,0)
  precondition(d.data(forKey:"freed.riskWindow.expected.v1")==original && DeviceActivityCenter().schedule(for:n)==schedule && d.bool(forKey:"freed.riskWindowActive"))
  let mismatched=DeviceActivitySchedule(intervalStart:DateComponents(hour:8,minute:0),intervalEnd:DateComponents(hour:9,minute:0),repeats:true)
  DeviceActivityCenter.replaceNextSchedule=mismatched;let rejected=h.start(9,10,0,0)
  precondition(rejected["nightGuardOperationAccepted"] as? Bool==false)
  precondition((rejected["nativeConfigurationDiagnostics"] as? [String:Any])?["stage"] as? String=="monitor-readback","Rejected native schedule must report the actual failed stage")
  precondition(d.data(forKey:"freed.riskWindow.expected.v1")==original && DeviceActivityCenter().schedule(for:n)==schedule)
  d.failAt=d.synchronizeCount+2;let finalFlush=h.start(9,10,0,0)
  precondition(finalFlush["nightGuardOperationAccepted"] as? Bool==false)
  precondition(d.data(forKey:"freed.riskWindow.expected.v1")==original && DeviceActivityCenter().schedule(for:n)==schedule)
  precondition(ManagedSettingsStore.adultProtected)
  d.set(true,forKey:"reset");_=h.start(9,10,0,0)
  precondition(d.data(forKey:"freed.riskWindow.expected.v1")==original && DeviceActivityCenter().schedule(for:n)==schedule)
  d.set(false,forKey:"reset")
  DeviceActivityCenter.afterNextStart={d.set(true,forKey:"reset");d.set(1,forKey:"generation");d.removeObject(forKey:"freed.riskWindow.expected.v1");d.set(false,forKey:"freed.riskWindowActive");DeviceActivityCenter().stopMonitoring([n])}
  let reset=h.start(9,10,0,0)
  precondition(reset["nightGuardOperationAccepted"] as? Bool==false && d.data(forKey:"freed.riskWindow.expected.v1")==nil && DeviceActivityCenter().schedule(for:n)==nil)
  print("Actual native Night Guard installer retains acknowledged intent, rejects failed/reset writes and preserves prior monitor/adult policy")
 }
}
