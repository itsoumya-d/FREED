import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createDefaultRecoveryState, hydrateRecoveryState, getRecoveryChallengeCounts } from '../src/lib/recovery-state';
import { recordToolCompletion } from '../src/lib/tool-completion';
import { buildRecoveryDaySnapshot } from '../src/lib/recovery-day-snapshot';
const at = new Date(2026,9,3,12), startedAt=new Date(at.getTime()-90_000).toISOString();
const input = {sessionId:'tool-session-1',toolId:'breathing',title:'Guided breathing',category:'breathing' as const,startedAt,activeDurationSec:60,dateKey:'2026-10-03'};
test('observed completion creates one honest reset with unknown helpfulness and no protection or unlock event',()=>{
  const previous = createDefaultRecoveryState(); const state=recordToolCompletion(previous,input,at);
  assert.equal(state.toolCompletions.length,1); assert.equal(state.toolCompletions[0].activeDurationSec,60);
  assert.equal(state.challengeHistory[0].durationSec,60); assert.equal(state.challengeHistory[0].source,'tool');
  assert.equal(state.challengeHistory[0].outcome,'unknown'); assert.equal(state.completedChallenges,1);
  assert.equal(state.earnedUnlocks.length,0); assert.equal(state.attempts.length,0); assert.equal(state.lastProtectedAt,previous.lastProtectedAt);
  assert.equal(state.dailyHabits.length,0);
  const snapshot=buildRecoveryDaySnapshot(state,at,at); assert.equal(snapshot.resets,1); assert.equal(snapshot.toolReceipts.length,1); assert.equal(snapshot.resetRecords.length,1);
});
test('session dedup survives hydration and detail pruning without applying a second explicit practice',()=>{
  let state=recordToolCompletion(createDefaultRecoveryState(),{...input,practiceKey:'meditation',helpfulness:'helped'},at);
  assert.equal(state.dailyHabits.find(h=>h.key==='meditation')?.completed,true);
  const hydrated=hydrateRecoveryState({...state,toolCompletions:[],challengeHistory:[]});
  state=recordToolCompletion(hydrated,{...input,practiceKey:'exercise'},at);
  assert.equal(state,hydrated); assert.equal(state.dailyHabits.some(h=>h.key==='exercise'),false);
  assert.equal(getRecoveryChallengeCounts(state).completed,1);
});
test('completion rejects a midnight-stale date, impossible duration, backward clock and empty session identity',()=>{
  const state=createDefaultRecoveryState();
  assert.throws(()=>recordToolCompletion(state,input,new Date(2026,9,4)),/date-changed/);
  assert.throws(()=>recordToolCompletion(state,{...input,activeDurationSec:100},at),/duration-invalid/);
  assert.throws(()=>recordToolCompletion(state,{...input,startedAt:new Date(at.getTime()+1000).toISOString()},at),/duration-invalid/);
  assert.throws(()=>recordToolCompletion(state,{...input,sessionId:''},at),/tool-invalid/);
});

test('authored tool dates survive timezone changes and both detail caps, with exact UTC aggregate counts',()=>{
  const { getRecoveryUtcAnalyticsDayCounts } = require('../src/lib/recovery-state');
  const originalZone=process.env.TZ;
  try {
    process.env.TZ='Asia/Kolkata';
    const first=new Date(2026,9,3,0,15);
    let state=createDefaultRecoveryState();
    for(let index=0;index<401;index++){
      const completed=new Date(first.getTime()+index*60_000);
      state=recordToolCompletion(state,{...input,sessionId:`archived-tool-${index}`,dateKey:'2026-10-03',startedAt:new Date(completed.getTime()-90_000).toISOString()},completed);
    }
    assert.equal(state.toolCompletions.length,400);
    assert.equal(state.challengeHistory.length,200);
    state=hydrateRecoveryState(state);
    process.env.TZ='America/Los_Angeles';
    const snapshot=buildRecoveryDaySnapshot(state,new Date(2026,9,3,12),new Date(2026,9,4,12));
    assert.equal(snapshot.resets,401);
    assert.equal(snapshot.resetRecords.length,200);
    assert.equal(snapshot.toolReceipts.length,400);
    assert.equal(getRecoveryChallengeCounts(state,'2026-10-02','2026-10-02').completed,0);
    const utc=getRecoveryUtcAnalyticsDayCounts(state,new Date('2026-10-04T12:00:00Z'));
    assert.equal(utc.reduce((sum:number,day:{completedChallenges:number})=>sum+day.completedChallenges,0),401);
    assert.equal(recordToolCompletion(state,{...input,sessionId:'archived-tool-0',dateKey:'2026-10-04'},new Date(2026,9,4,12)),state);
  } finally { if(originalZone===undefined) delete process.env.TZ; else process.env.TZ=originalZone; }
});
