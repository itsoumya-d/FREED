import assert from 'node:assert/strict';
import {createRecoveryDnsPilotAdapter,parseRecoveryDnsPilotReceipt} from '../modules/freed-protection/src/recovery-dns-pilot';
async function main(){
const candidate={schema:1,kind:'candidate',supported:true,staged:true,reference:'a'.repeat(32),credentialHash:'b'.repeat(64),audience:'c'.repeat(32),ownerGeneration:'cf046a52-cc45-4d71-9c86-2f52e8a2541d',nativeConfigurationGeneration:3};
const ios=parseRecoveryDnsPilotReceipt({schema:1,kind:'status',supported:true,staged:true,candidate,profileSaved:true,systemEnabled:true,modeActive:true,modeActivationSupported:true,rawSecret:'must-not-escape',browserRecoveryVerified:true});
assert.equal(ios.reference,candidate.reference);assert.equal(ios.audience,candidate.audience);assert.equal(ios.modeActive,true);assert.equal(ios.browserRecoveryVerified,false);assert.equal('rawSecret' in ios,false);
assert.equal(parseRecoveryDnsPilotReceipt({schema:1,kind:'status'}).kind,'error');
const android=parseRecoveryDnsPilotReceipt({...candidate,kind:'status',modeActivationSupported:true,nativeConfigurationGeneration:candidate.ownerGeneration,profileSaved:true,systemEnabled:false,modeActive:true});
assert.equal(android.nativeConfigurationGeneration,candidate.ownerGeneration);assert.equal(android.modeActive,false);
assert.equal(parseRecoveryDnsPilotReceipt({...candidate,ownerGeneration:'bad'}).kind,'error');
let current=true,finish:(value:unknown)=>void=()=>{};
const adapter=createRecoveryDnsPilotAdapter(()=>({getRecoveryDnsPilotStatus:()=>new Promise(resolve=>{finish=resolve;})}),()=>current,100);
const pending=adapter.status('scope');current=false;finish({...candidate,kind:'status'});assert.equal((await pending).kind,'error');
const timeout=createRecoveryDnsPilotAdapter(()=>({getRecoveryDnsPilotStatus:()=>new Promise(()=>{})}),()=>true,2);
assert.equal((await timeout.status('scope')).kind,'error');
console.log('PASS: native DNS DTOs, provenance, owner supersession and timeout');

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
