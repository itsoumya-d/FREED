/** Google CLARA callable evidence importer. Never sends legacy /api/clara, /api/challenges or /api/retention requests. */
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
const contract = require('./lib/google-clara-release-evidence');
const {assertSafeReportPath} = require('./lib/report-path-safety');
function parseArgs(args:string[]){
 const options:{report?:string;capture?:string;selfTest:boolean}={selfTest:false};
 for(let i=0;i<args.length;i++){
  const arg=args[i];
  if(arg==='--self-test')options.selfTest=true;
  else if(arg==='--report'||arg==='--native-capture'){const value=args[++i];if(!value)throw new Error('Missing option value');if(arg==='--report')options.report=assertSafeReportPath(value);else options.capture=value;}
  else if(arg==='--coach-endpoint'){contract.validateEndpoint(args[++i]);}
  else if(arg==='--challenge-endpoint'||arg==='--retention-endpoint')throw new Error('Removed endpoint: challenges and retention are LOCAL');
  else if(arg==='--help'){console.log('Usage: smoke:ai-backend [--native-capture <sanitized-report>] [--report <path>] [--self-test]');process.exit(0);}
  else throw new Error('Unsupported option; tokens and provider credentials are forbidden');
 }
 return options;
}
function runSelfTest(){
 assert.equal(contract.validateEndpoint(contract.ENDPOINT),contract.ENDPOINT);
 for(const suffix of ['?token=secret','#secret'])assert.throws(()=>contract.validateEndpoint(contract.ENDPOINT+suffix));
 assert.throws(()=>parseArgs(['--challenge-endpoint','https://invalid']));
 assert.throws(()=>parseArgs(['--report','docs/validation/evidence/report.json']));
 assert.ok(contract.reportIssues({schemaVersion:'ai-backend-smoke-v1'}).length);
 console.log('ai-backend-smoke self-test: pass (offline; no production-native proof)');
}
function main(){
 const options=parseArgs(process.argv.slice(2));if(options.selfTest)return runSelfTest();
 const inactiveLegacyOptions=['EXPO_PUBLIC_AI_COACH_ENDPOINT','EXPO_PUBLIC_AI_CHALLENGE_ENDPOINT','EXPO_PUBLIC_RETENTION_ENDPOINT'].filter(key=>Boolean(process.env[key]));
 const report=options.capture?contract.importReport(options.capture):{
  schemaVersion:contract.REPORT_SCHEMA,generatedAt:new Date().toISOString(),sanitized:true,source:'terminal-blocked',identity:contract.IDENTITY,architecture:contract.ARCHITECTURE,
  inactiveLegacyOptions,transport:{endpoint:contract.ENDPOINT,requestEnvelope:'data',requestKeys:['clientEventId','consentVersion','locale','input','conversation'],responseKeys:['text','provider','serviceState','action','quota'],limitedUseAppCheckToken:true,contractAcquisitionTimeoutMs:15000,callableRequestTimeoutMs:15000,providerTimeoutMs:11000,networkRequests:0},
  results:contract.REQUIRED_RESULT_IDS.map((id:string)=>({id,status:'BLOCKED'})),summary:{passCount:0,failCount:contract.REQUIRED_RESULT_IDS.length}
 };
 if(options.report){mkdirSync(dirname(options.report),{recursive:true});writeFileSync(options.report,JSON.stringify(report,null,2)+'\n');}
 console.log(JSON.stringify(report,null,2));if(!options.capture)process.exitCode=1;
}
try{main();}catch{console.error('CLARA evidence rejected: invalid/missing sanitized current capture, endpoint, or safe report path. No credentials or raw response logged.');process.exitCode=1;}
