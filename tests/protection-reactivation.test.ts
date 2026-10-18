import assert from 'node:assert/strict';
import {test} from 'node:test';
import {resumeProtectionAfterReset} from '../src/lib/protection-reactivation';
import {createDefaultDisciplineSettings,createDefaultRecoveryState,hydrateRecoveryState} from '../src/lib/recovery-state';
test('missing/rejected activation acknowledgment or retained reset latch never syncs saved rules',async()=>{
 for(const proof of [{},{protectionConfigurationActivationAccepted:false},{protectionConfigurationActivationAccepted:true,protectionConfigurationResetDisabled:true}]){let synced=false,refreshed=false;await assert.rejects(resumeProtectionAfterReset(async()=>proof,async()=>{synced=true},async()=>{refreshed=true}));assert.equal(synced,false);assert.equal(refreshed,false)}
});
test('acknowledged fresh activation orders sync then actual status without inventing protection',async()=>{
 const events:string[]=[];const actual={active:false,authorized:false};const result=await resumeProtectionAfterReset(async()=>{events.push('userActivation');return{protectionConfigurationActivationAccepted:true,protectionConfigurationResetDisabled:false}},async()=>{events.push('rules')},async()=>{events.push('status');return actual});assert.deepEqual(events,['userActivation','rules','status']);assert.equal(result,actual);assert.equal(result.active,false);
});
test('new/deleted profiles have no opted-in timed guards while stored choices survive hydration',()=>{
 const defaults=createDefaultDisciplineSettings();assert.equal(defaults.sleepModeEnabled,false);assert.equal(defaults.workHoursEnabled,false);assert.equal(defaults.weekendModeEnabled,false);
 const saved=hydrateRecoveryState({...createDefaultRecoveryState(),disciplineSettings:{...defaults,sleepModeEnabled:true,weekendModeEnabled:true}});assert.equal(saved.disciplineSettings.sleepModeEnabled,true);assert.equal(saved.disciplineSettings.weekendModeEnabled,true);
});
