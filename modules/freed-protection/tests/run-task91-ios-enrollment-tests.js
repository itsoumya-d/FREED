const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('.superpowers/sdd/2026-10-13-publishable-recovery/task-91/ios');fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync('modules/freed-protection/tests/AdultLockIntegrationCases.swift','utf8');
const fixture=path.join(out,'IntegrationFixtures.swift');
fs.writeFileSync(fixture,original.replace('static func main() async throws {','static func main() async throws {\n    try await runTask91Cases(FileManager.default.temporaryDirectory.appendingPathComponent("freed91-"+UUID().uuidString));return\n').replaceAll('!FreedProtectionConfigurationLock.isInsideExclusiveAccess, "Protected friend record read must precede configuration exclusion"','!FreedProtectionConfigurationLock.isInsideExclusiveAccess || FriendLockEnrollmentPublication.active, "Protected friend record read must precede configuration exclusion except explicit enrollment commit"'));
let runner=fs.readFileSync('modules/freed-protection/tests/run-ios-adult-lock-integration-tests.js','utf8');
runner=runner.replace("'modules/freed-protection/tests/AdultLockIntegrationCases.swift'",JSON.stringify(fixture));
runner=runner.replace("sources.push('modules/freed-protection/ios/FreedAccountProtectionCleanup.swift'","sources.push('modules/freed-protection/tests/Task91EnrollmentCases.swift','modules/freed-protection/ios/FreedAccountProtectionCleanup.swift'");
runner=runner.replace('static var enabled=true;static var reloadError:', 'static var enabled=true;static var stateError:Error?;static var reloadError:');
runner=runner.replace('completionHandler(SFContentBlockerState(enabled),nil)', 'completionHandler(stateError == nil ? SFContentBlockerState(enabled):nil,stateError)');
if(process.argv.includes('--red-stale')) {
 const source='modules/freed-protection/ios/FreedAdultProtectionLockCoordinator.swift';
 const selected=path.join(out,'CoordinatorWithoutEnrollmentFences.swift');
 fs.writeFileSync(selected,fs.readFileSync(source,'utf8').replace('guard before == after, try enrollmentJournal()', 'guard try enrollmentJournal()').replace('guard try FreedAdultNativeScope.capture(defaults) == scope,','guard true,'));
 runner=runner.replace("'"+source+"'",JSON.stringify(selected));
}
new Function('require',runner)(require);
