import assert from 'node:assert/strict';
import { getFreedFlowPresentation } from '../src/lib/flow-presentation';
for (const flow of ['account', 'paywall', 'protectionSetup', 'checkin', 'slip', 'customChallenge', 'coach']) assert.equal(getFreedFlowPresentation(flow), 'modal');
for (const flow of ['intercept', 'ad', 'challenge', 'breathing']) assert.equal(getFreedFlowPresentation(flow), 'fullScreenModal');
assert.equal(getFreedFlowPresentation(undefined), 'card');
assert.equal(getFreedFlowPresentation('unknown'), 'card');
console.log('Self-contained tasks and full-attention recovery flows use native presentations.');
