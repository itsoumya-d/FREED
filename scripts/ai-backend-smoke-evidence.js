#!/usr/bin/env node
/* AI backend smoke capture packets are setup handoffs only; evidenceSatisfied: false. */
const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
const contract=require('./lib/google-clara-release-evidence');
const {assertSafeArtifactOutputDir}=require('./lib/evidence-output-safety');
const {envFilePathIssue}=require('./lib/env-file-safety');const {loadEnvFile}=require('./lib/env-file-loader');
const SOURCE_ARTIFACT_PATHS=['docs/validation/templates/ai-backend-smoke.template.json','scripts/ai-backend-smoke-evidence.js','scripts/ai-backend-smoke.ts','scripts/ai-safety-eval.ts','scripts/lib/google-clara-release-evidence.js'];
function parseArgs(args){
 const o={runId:new Date().toISOString().replace(/[:.]/g,'-'),planOnly:false,selfTest:false,envFile:process.env.FREED_RELEASE_ENV_FILE||''};
 for(let i=0;i<args.length;i++){
  const arg=args[i];if(['--plan-only','--self-test'].includes(arg)){o[arg==='--plan-only'?'planOnly':'selfTest']=true;continue;}
  const value=args[++i];if(!value)throw new Error('Missing option value');
  if(arg==='--challenge-endpoint'||arg==='--retention-endpoint')throw new Error('Removed endpoint: challenges and retention are LOCAL');
  if(arg==='--coach-endpoint')contract.validateEndpoint(value);
  else if(arg==='--model'){if(value!==contract.IDENTITY.model)throw new Error('Wrong Google CLARA model');}
  else if(arg==='--release-env-file')o.envFile=value;
  else if(arg==='--output-dir')o.outputDir=value;
  else if(arg==='--run-id'){if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(value))throw new Error('Unsafe run ID');o.runId=value;}
  else throw new Error('Unsupported option');
 }
 if(o.envFile){const issue=envFilePathIssue(o.envFile,'--release-env-file');if(issue)throw new Error(issue);const loaded=loadEnvFile(o.envFile,'--release-env-file');o.inactiveLegacyOptions=['EXPO_PUBLIC_AI_COACH_ENDPOINT','EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT','EXPO_PUBLIC_RETENTION_ENDPOINT'].filter(k=>Boolean(loaded[k]||process.env[k]));}
 o.outputDir=assertSafeArtifactOutputDir(o.outputDir||`docs/validation/artifacts/${o.runId}/ai-backend-smoke-capture`,'--output-dir');return o;
}
function manifestFor(o){return{schemaVersion:'freed-google-clara-capture-plan-v2',generatedAt:new Date().toISOString(),sanitizedOnly:true,evidenceSatisfied:false,status:'BLOCKED',identity:contract.IDENTITY,architecture:contract.ARCHITECTURE,releaseEnvFileLoaded:Boolean(o.envFile),inactiveLegacyOptions:o.inactiveLegacyOptions||['EXPO_PUBLIC_AI_COACH_ENDPOINT','EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT','EXPO_PUBLIC_RETENTION_ENDPOINT'].filter(k=>Boolean(process.env[k])),sourceArtifacts:SOURCE_ARTIFACT_PATHS.map(p=>({path:p,sha256:contract.sha(fs.readFileSync(p))})),requiredCaptures:contract.REQUIRED_RESULT_IDS.map(kind=>({kind,source:kind==='deployment'?'production-deployment':'production-native',status:'BLOCKED',requiredProof:contract.PROOFS[kind]})),evidenceBoundary:'Fresh signed native and attached runtime deployment captures required. Owner-token HTTP200, unauthenticated401, offline fixtures and configuration are context only.'};}
function main(){const o=parseArgs(process.argv.slice(2));if(o.selfTest){assert.throws(()=>parseArgs(['--retention-endpoint','https://invalid']));assert.throws(()=>parseArgs(['--output-dir','docs/validation/evidence']));assert.equal(manifestFor(o).evidenceSatisfied,false);console.log('ai-backend-smoke-evidence self-test: pass (offline)');return;}
 const manifest=manifestFor(o);if(!o.planOnly){fs.mkdirSync(o.outputDir,{recursive:true});fs.writeFileSync(path.join(o.outputDir,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');const fill=JSON.parse(fs.readFileSync('docs/validation/templates/ai-backend-smoke.template.json'));fill.checks=Object.fromEntries(contract.CHECKS.map(k=>[k,false]));fill.ai={smokeReportArtifact:'',smokeReportSha256:''};fill.templateStatus='pending-manual-qa';fs.writeFileSync(path.join(o.outputDir,'ai-backend-smoke-evidence-fill-template.json'),JSON.stringify(fill,null,2)+'\n');}
 console.log(JSON.stringify(manifest,null,2));}
try{main();}catch(error){console.error(error instanceof Error?error.message:'Invalid capture arguments');process.exitCode=1;}
