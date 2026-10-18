import assert from 'node:assert/strict';
import test from 'node:test';
import {generateCoachReply} from '../src/lib/recovery-engine';
test('built-in guidance avoids hormone/receptor claims, fixed urge deadlines and compulsory exercise',()=>{
 for(const input of ['I feel an urge','I feel stressed','I am lonely','Explain dopamine and my brain','Help me breathe','I cannot sleep']){
  const reply=generateCoachReply(input,[]);
  assert.doesNotMatch(reply,/D2 receptors|cortisol|within 3 to 7|dopamine traps|15 brisk squats|4-7-8|physiological shift/i,input);
  assert.ok(reply.length>20);
 }
});
