// Current production session, Store, cleanup + preserved earned-time assertion bodies.
const fs=require('node:fs');const {join}=require('node:path');const Module=require('node:module');
const root=join(__dirname,'../../..');const out=join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-87');fs.mkdirSync(out,{recursive:true});
const support=require('./android-private-session-fixture-support');
const loop=require('./android-private-session-native-loop')(root);
const expoInputs=require('./android-private-session-expo-fixture')(root);
expoInputs['ModuleFixture87.kt']=require('./android-private-session-module-fixture')(root);
let source=fs.readFileSync(join(__dirname,'run-android-earned-time-v2-tests.js'),'utf8');
source=source.replace("require('./android-retained-fixture-support')", "require('./android-private-session-fixture-support')");
source=source.replace("const cases = fixture(", `const nativeLoop=fixture('NativeLoop.kt',${JSON.stringify(loop)});const expo=fixture('Expo.kt',${JSON.stringify(expoInputs['Expo.kt'])});const shared=fixture('Shared.kt',${JSON.stringify(expoInputs['Shared.kt'])});const binding=fixture('Binding.kt',${JSON.stringify(support.binding)});const sessionCases=fixture('AndroidPrivateSessionCleanupCases.kt',fs.readFileSync(join(__dirname,'AndroidPrivateSessionCleanupCases.kt'),'utf8'));\n  const extraExpo=${JSON.stringify(Object.entries(expoInputs).filter(([name])=>!['Expo.kt','Shared.kt'].includes(name)))}.map(([name,body])=>fixture(name,body));\n  const cases = fixture(`);
const mainPrefix='fun main() {\n moduleExportCases87()\n expoConversionCases87()\n privateSessionCleanupCases()\n earnedChallengeRound1Cases()';
source=source.replace("const jar = join(workspace, 'store.jar');", `fs.writeFileSync(cases,fs.readFileSync(cases,'utf8').replace('fun main() {',${JSON.stringify(mainPrefix)}));
  const jar=join(${JSON.stringify(out)},'session-cleanup.jar');
  const generated=join(${JSON.stringify(out)},'generated-session');fs.mkdirSync(generated,{recursive:true});for(const name of fs.readdirSync(workspace))fs.copyFileSync(join(workspace,name),join(generated,name));`);
source=source.replace('[android, ops, usage, clock, settings, runtime, sensors, permission, packageManager, activity, evidencePhoto, cases,','[android, ops, usage, clock, settings, runtime, sensors, permission, packageManager, activity, evidencePhoto, cases, expo, shared, binding, sessionCases, nativeLoop, ...extraExpo,');
source=source.replace("['FreedInstalledAppPolicy',", "['FreedPrivateAccountSession','FreedInstalledAppPolicy',");
source=source.replace("run('java', ['-classpath', jar + ':' + json, 'app.freed.protection.AndroidEarnedAppTimeV2CasesKt']);", `run('java',['-classpath',jar+':'+json,'app.freed.protection.AndroidEarnedAppTimeV2CasesKt']);`);
const runner=new Module(join(__dirname,'task87-generated-runner.js'),module);runner.filename=join(__dirname,'task87-generated-runner.js');runner.paths=module.paths;runner._compile(source,runner.filename);
