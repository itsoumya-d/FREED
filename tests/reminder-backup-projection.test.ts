import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState } from '../src/lib/recovery-state';
import { buildPortableRecoveryState } from '../src/lib/recovery-backup';
test('portable reminder intention retains chosen time but carries no scheduling authority or device timezone',()=>{
 const state=createDefaultRecoveryState();state.reminders={...state.reminders,enabled:true,revision:4,morningTime:'09:15',permissionStatus:'authorized',effectiveStatus:'active',scheduledIds:['old-native-request'],timezone:'Asia/Kolkata',lastScheduledAt:new Date().toISOString()};
 const output=buildPortableRecoveryState(state);
 assert.equal(output.reminders.enabled,true);assert.equal(output.reminders.morningTime,'09:15');assert.equal(output.reminders.revision,4);
 assert.deepEqual(output.reminders.scheduledIds,[]);assert.equal(output.reminders.permissionStatus,'undetermined');assert.equal(output.reminders.effectiveStatus,'pending');assert.equal(output.reminders.timezone,null);
});
