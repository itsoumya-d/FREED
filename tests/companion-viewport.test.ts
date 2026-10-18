import assert from 'node:assert/strict';
import { isCompanionOnScreen } from '../src/lib/companion-viewport';
assert.equal(isCompanionOnScreen({ x: 16, y: 100, width: 100, height: 100 }, { width: 390, height: 844 }), true);
assert.equal(isCompanionOnScreen({ x: 16, y: 900, width: 100, height: 100 }, { width: 390, height: 844 }), false);
assert.equal(isCompanionOnScreen({ x: 16, y: -101, width: 100, height: 100 }, { width: 390, height: 844 }), false);
assert.equal(isCompanionOnScreen({ x: 16, y: -20, width: 100, height: 100 }, { width: 390, height: 844 }), true);
assert.equal(isCompanionOnScreen({ x: 16, y: 20, width: 0, height: 100 }, { width: 390, height: 844 }), false);
assert.equal(isCompanionOnScreen({ x: NaN, y: 20, width: 100, height: 100 }, { width: 390, height: 844 }), false);
console.log('Companion viewport intersection checks passed.');
