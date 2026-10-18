const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const base = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
test('authored Android activities attach a lifecycle-controlled companion with Reduce Motion and localized greeting', () => {
  assert.ok(fs.existsSync(`${base}FreedNativeCompanion.kt`), 'Native companion presenter is missing');
  const source = fs.readFileSync(`${base}FreedNativeCompanion.kt`,'utf8');
  assert.match(source,/ANIMATOR_DURATION_SCALE/);
  assert.match(source,/stopMotion/);
  assert.match(source,/freed_companion_hello/);
  for(const file of ['FreedInterventionActivity.kt','FreedUsageAccessConfigActivity.kt']) {
    const activity=fs.readFileSync(base+file,'utf8');
    assert.match(activity,/FreedNativeCompanion\(this/);
    assert.match(activity,/override fun onResume/);
    assert.match(activity,/override fun onPause/);
    assert.match(activity,/stopMotion/);
  }
});
