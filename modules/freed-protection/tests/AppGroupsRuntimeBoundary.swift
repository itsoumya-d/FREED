import Foundation
struct TestToken:Hashable,Codable {let value:String}
typealias ApplicationToken=TestToken
typealias ActivityCategoryToken=TestToken
typealias WebDomainToken=TestToken
struct FamilyActivitySelection:Codable {var applicationTokens:Set<TestToken>=[];var categoryTokens:Set<TestToken>=[];var webDomainTokens:Set<TestToken>=[];init(includeEntireCategory:Bool=false){}}
enum TestAuthorization {case approved,denied}
final class AuthorizationCenter {static let shared=AuthorizationCenter();var authorizationStatus=TestAuthorization.approved}
struct DeviceActivityName:Hashable {let rawValue:String;init(_ value:String){rawValue=value}}
struct DeviceActivitySchedule:Equatable {let intervalStart:DateComponents;let intervalEnd:DateComponents;let repeats:Bool}
struct DeviceActivityEvent:Equatable {struct Name:Hashable {let rawValue:String;init(_ value:String){rawValue=value}};let applications:Set<TestToken>;let threshold:DateComponents;let includesPastActivity:Bool}
final class DeviceActivityCenter {
 static var records:[DeviceActivityName:(DeviceActivitySchedule,[DeviceActivityEvent.Name:DeviceActivityEvent])]=[:]
 static var failNext=false
 static var replaceNextSchedule:DeviceActivitySchedule?
 static var afterNextStart:(()->Void)?
 var activities:[DeviceActivityName]{Array(Self.records.keys)}
 func schedule(for name:DeviceActivityName)->DeviceActivitySchedule?{Self.records[name]?.0}
 func events(for name:DeviceActivityName)->[DeviceActivityEvent.Name:DeviceActivityEvent]{Self.records[name]?.1 ?? [:]}
 func startMonitoring(_ name:DeviceActivityName,during schedule:DeviceActivitySchedule,events:[DeviceActivityEvent.Name:DeviceActivityEvent]=[:])throws{if Self.failNext{Self.failNext=false;throw TestFailure.failed};Self.records[name]=(Self.replaceNextSchedule ?? schedule,events);Self.replaceNextSchedule=nil;let callback=Self.afterNextStart;Self.afterNextStart=nil;callback?()}
 func stopMonitoring(_ names:[DeviceActivityName]){for name in names{Self.records.removeValue(forKey:name)}}
}
enum TestFailure:Error {case failed}
final class TestShield {var applications:Set<TestToken>?;var applicationCategories:Set<TestToken>?;var webDomains:Set<TestToken>?;var webDomainCategories:Set<TestToken>?}
final class ManagedSettingsStore {
 struct Name:Hashable {let rawValue:String;init(_ value:String){rawValue=value}}
 static var shields:[String:TestShield]=[:];static var adultProtected=true
 let shield:TestShield
 init(named:Name=Name("default")){if Self.shields[named.rawValue]==nil{Self.shields[named.rawValue]=TestShield()};shield=Self.shields[named.rawValue]!}
 func clearAllSettings(){shield.applications=nil;shield.applicationCategories=nil;shield.webDomains=nil;shield.webDomainCategories=nil}
}
final class RuntimeDefaults {
 var values:[String:Any]=[:];var failSync=false;var synchronizeCount=0;var failAt:Int?
 func dictionaryRepresentation()->[String:Any]{values}
 func object(forKey key:String)->Any?{values[key]}
 func integer(forKey key:String)->Int{values[key] as? Int ?? 0}
 func persistentDomain(forName name:String)->[String:Any]?{values}
 func data(forKey key:String)->Data?{values[key] as? Data}
 func string(forKey key:String)->String?{values[key] as? String}
 func bool(forKey key:String)->Bool{values[key] as? Bool == true}
 func set(_ value:Any?,forKey key:String){values[key]=value}
 func removeObject(forKey key:String){values.removeValue(forKey:key)}
 func synchronize()->Bool{synchronizeCount += 1;if failAt==synchronizeCount{return false};if failSync{failSync=false;return false};return true}
}
enum FreedProtectionConfigurationLock {
 static func legacyConfiguration(_ d:RuntimeDefaults)->(domain:String,values:[String:Any])?{("fixture-night",[:])}
 static func removeLegacyConfigurationKey(_ key:String,defaults:RuntimeDefaults){}
 static func configurationKeys(_ d:RuntimeDefaults)->[String]{Array(d.values.keys)}
 static var isInsideExclusiveAccess = false
 static func adultMutationEpoch(_ d:RuntimeDefaults)throws->Int{d.integer(forKey:"freed.deviceAdult.mutationEpoch.v1")}
 @discardableResult static func fenceAdultMutations(_ d:RuntimeDefaults)throws->Int{let n=try adultMutationEpoch(d)+1;d.set(n,forKey:"freed.deviceAdult.mutationEpoch.v1");return n}

 enum AccessError:Error {case unavailable;var stage:String{"lock-acquire"};var posixCode:Int32?{nil};var reason:String{"configuration-lock-unavailable"}}
 static func bindingFailure(reason:String,stage:String,supported:Bool=true,operationId:String=UUID().uuidString,generation:Int?=nil,scopeEpoch:Int?=nil,errorCode:Int32?=nil)->[String:Any]{["version":1,"operationId":operationId,"supported":supported,"accepted":false,"bindingCurrent":false,"ownerVerified":false,"stage":stage,"reason":reason,"generation":generation.map{$0 as Any} ?? NSNull(),"scopeEpoch":scopeEpoch.map{$0 as Any} ?? NSNull(),"errorCode":errorCode.map{$0 as Any} ?? NSNull(),"errorDomain":NSNull()]}
 static func persist(_ defaults:RuntimeDefaults)->Bool{defaults.synchronize()}
 static func diagnostics(_ error:Error?=nil,generation:Int?=nil)->[String:Any]{["stage":"native-operation"]}
 static let defaults=RuntimeDefaults();static let resetMarkerKey="reset",generationKey="generation",appGroupIdentifier="fixture-night"
 static func generation(_ d:RuntimeDefaults)->Int{d.values["generation"] as? Int ?? 0}
 static func permitsPublication(_ d:RuntimeDefaults,capturedGeneration:Int?=nil)->Bool{!d.bool(forKey:resetMarkerKey) && (capturedGeneration==nil || capturedGeneration==generation(d))}
 static func withExclusiveAccess<T>(afterSuccessfulPersistence:((T)->Void)?=nil,readOnly: Bool = false, _ body:(RuntimeDefaults)throws->T)throws->T{let result=try body(defaults);guard defaults.synchronize() else{throw TestFailure.failed};afterSuccessfulPersistence?(result);return result}
}
