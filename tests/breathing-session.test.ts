import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createBreathingSession, BREATHING_SESSION_KEY } from '../src/lib/breathing-session';
test('new sessions begin with gentle breathing and existing saved patterns retain their identity',()=>{
 const disk=storage();const fresh=createBreathingSession(disk,1000);assert.equal(fresh.mode,'gentle');
 disk.setItem(BREATHING_SESSION_KEY,JSON.stringify({id:'old-session',mode:'478',startedAt:500,observedMs:100,pending:null}));
 const old=createBreathingSession(disk,1000);assert.equal(old.mode,'478');assert.equal(old.id,'old-session');
});
const storage = () => { const data = new Map<string,string>(); return { getItem: (key:string) => data.get(key) ?? null, setItem: (key:string,value:string) => data.set(key,value), removeItem: (key:string) => data.delete(key) }; };
test('restored breathing retains observed time and starts paused', () => {
  const disk = storage(); const first = createBreathingSession(disk, 10000);
  first.resume(100); first.checkpoint(2100); first.pause(3100);
  const restored = createBreathingSession(disk, 20000);
  assert.equal(restored.elapsed(900000), 3000); assert.equal(restored.id, first.id);
  restored.resume(900000); assert.equal(restored.elapsed(902000), 5000);
});
test('background and pause time never contributes', () => {
  const session = createBreathingSession(storage(), 10000); session.resume(100); session.pause(1100);
  assert.equal(session.elapsed(800000),1000); session.resume(800000); session.pause(801000); assert.equal(session.elapsed(999999),2000);
});
test('mode change starts a new session and removes previous active time', () => {
  const disk = storage(); const session = createBreathingSession(disk, 10000); const previous = session.id;
  session.resume(0); session.pause(1000); session.reset('box', 20000);
  assert.equal(session.mode,'box'); assert.notEqual(session.id, previous); assert.equal(session.elapsed(90000),0);
});
test('corrupt and future persisted timestamps cannot create activity', () => {
  const disk = storage(); disk.setItem(BREATHING_SESSION_KEY,JSON.stringify({id:'fake',mode:'box',startedAt:30000,observedMs:20000}));
  const session = createBreathingSession(disk,10000); assert.equal(session.elapsed(20000),0);
});
test('finishing clears private resume state only when asked', () => {
  const disk = storage(); const session = createBreathingSession(disk,10000); session.resume(0); session.pause(1000);
  assert.notEqual(disk.getItem(BREATHING_SESSION_KEY),null); session.clear(); assert.equal(disk.getItem(BREATHING_SESSION_KEY),null);
});

test('pending completion preserves finish date and time across restart', () => {
 const disk = storage(); const first = createBreathingSession(disk,10000); first.resume(100);
 const pending = first.finish(3100,13000,'2026-10-03');
 assert.deepEqual(pending,{at:13000,dateKey:'2026-10-03',seconds:3});
 const restored = createBreathingSession(disk,900000);
 assert.deepEqual(restored.pending,pending); assert.equal(restored.elapsed(900000),3000);
 assert.deepEqual(restored.finish(900000,910000,'2026-10-04'),pending);
});
