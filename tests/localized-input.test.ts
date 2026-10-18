import test from 'node:test';
import assert from 'node:assert/strict';
import { asciiDigits, normalizeClockTimeInput } from '../src/lib/localized-input';
test('clock forms accept Arabic, Bengali, Devanagari and full-width digits without weakening time validation', () => {
  for (const input of ['19:30', '١٩:٣٠', '۱۹:۳۰', '१९:३०', '১৯:৩০', '１９：３０', '\u200f١٩:٣٠\u200f']) assert.equal(normalizeClockTimeInput(input), '19:30');
  for (const input of ['٢٤:٠٠', '১৯:৬০', '१२:०', '19:30 tomorrow']) assert.equal(normalizeClockTimeInput(input), null);
  assert.equal(asciiDigits('private reflection'), 'private reflection');
});
