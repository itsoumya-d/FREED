const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const out=path.resolve(__dirname,'../../../.superpowers/sdd/2026-10-13-publishable-recovery/task-87/core');fs.mkdirSync(out,{recursive:true});
let source=fs.readFileSync(path.join(__dirname,'run-android-adult-executor-tests.js'),'utf8');
source=source.replace("path.join(root,'.superpowers/sdd/2026-10-13-publishable-recovery/task-85-android-enrolled-executor')",JSON.stringify(out));
source=source.replace("path.join(__dirname,'AndroidAdultExecutorCases.kt')",`writeCases87()`);
source=source.replace("const jar=", `function writeCases87(){const p=path.join(generated,'Cases87.kt');fs.writeFileSync(p,(process.argv.includes('--cleanup-only')?'package app.freed.protection\\nfun main(){privateCleanupCoreCases()}':fs.readFileSync(path.join(__dirname,'AndroidAdultExecutorCases.kt'),'utf8').replace('fun main() {','fun main() {\\n privateCleanupCoreCases()')));files.push(path.join(__dirname,'AndroidPrivateCleanupCoreCases.kt'));return p;}\nconst jar=`);
const mod=new Module(path.join(__dirname,'task87-core-runner.js'),module);mod.filename=path.join(__dirname,'task87-core-runner.js');mod.paths=module.paths;mod._compile(source,mod.filename);
