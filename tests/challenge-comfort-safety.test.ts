import assert from 'node:assert/strict';
import test from 'node:test';
import { CHALLENGE_TEMPLATES } from '../src/data/challenge-templates';
import { challengeLibrary } from '../src/lib/recovery-engine';
const { inspectChallengeComfortCopy } = require('../scripts/lib/challenge-photo-safety-contract');

test('runtime copy gate accepts actual assembled catalog and retained legacy display instructions', () => {
  assert.ok(CHALLENGE_TEMPLATES.length > 1000);
  assert.ok(challengeLibrary.length > 0);
  assert.equal(inspectChallengeComfortCopy(CHALLENGE_TEMPLATES, challengeLibrary), true);
});

test('actual catalog/legacy copy mutations fail without private receipts or metadata tags as copy', () => {
  const records = [CHALLENGE_TEMPLATES, challengeLibrary];
  const unsupported = ['impossible to fake', 'helps discharge the craving', 'real movement evidence', 'This releases dopamine.', 'Push through the burn.', 'Stay submerged.'];
  for (const [index, current] of records.entries()) {
    for (const why of unsupported) {
      const changed = current.map((record, n) => n === 0 ? {...record, why} : record);
      assert.notDeepEqual(changed, current);
      assert.equal(inspectChallengeComfortCopy(index === 0 ? changed : CHALLENGE_TEMPLATES, index === 1 ? changed : challengeLibrary), false, `${index}: ${why}`);
    }
  }
  const physical = CHALLENGE_TEMPLATES.find(c => c.category === 'physical')!;
  for (const phrase of ['Optional', 'comfortable', 'device movement']) {
    assert.ok(physical.why.includes(phrase));
    const changed = CHALLENGE_TEMPLATES.map(c => c.id === physical.id ? {...c, why:c.why.replaceAll(phrase,'removed')} : c);
    assert.equal(inspectChallengeComfortCopy(changed,challengeLibrary),false,phrase);
  }
  const breathing = CHALLENGE_TEMPLATES.find(c => c.id.startsWith('wim-hof-rounds--'))!;
  assert.ok(breathing);
  const changed = CHALLENGE_TEMPLATES.map(c => c.id === breathing.id ? {...c,title:'Impossible to fake breathing',steps:['30 full breaths forcefully.']} : c);
  assert.notDeepEqual(changed,CHALLENGE_TEMPLATES);
  assert.equal(inspectChallengeComfortCopy(changed,challengeLibrary),false);
});
