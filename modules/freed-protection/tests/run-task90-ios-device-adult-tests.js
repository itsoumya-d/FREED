const fs=require('node:fs'),path=require('node:path');
const out=path.resolve('.superpowers/sdd/2026-10-13-publishable-recovery/task-90/'+(process.argv.find(a=>a.startsWith('--name='))?.slice(7)||'ios'));fs.mkdirSync(out,{recursive:true});
const original=fs.readFileSync('modules/freed-protection/tests/AdultLockIntegrationCases.swift','utf8');
const fixture=path.join(out,'IntegrationFixtures.swift');
fs.writeFileSync(fixture,original.replace('static func main() async throws {','static func main() async throws {\n    try await runTask90Cases(FileManager.default.temporaryDirectory.appendingPathComponent("freed90-"+UUID().uuidString));return\n'));
let runner=fs.readFileSync('modules/freed-protection/tests/run-ios-adult-lock-integration-tests.js','utf8');
runner=runner.replace("'modules/freed-protection/tests/AdultLockIntegrationCases.swift'",JSON.stringify(fixture));
runner=runner.replace("sources.push('modules/freed-protection/ios/FreedAccountProtectionCleanup.swift'","sources.push('modules/freed-protection/tests/Task90DeviceAdultCases.swift','modules/freed-protection/ios/FreedAccountProtectionCleanup.swift'");
runner=runner.replace("x==='--task82-only'||","x==='--task90-status-only'||x==='--task82-only'||");
// The inherited runner extracts the current production runtime/providers; only OS API / I/O seams are fixtures.
new Function('require',runner)(require);
