const assert = require('node:assert/strict');
const { test } = require('node:test');
const { inspectQuizAccessibilitySource } = require('../scripts/accessibility-safety-audit');
const source = 'function QuizScreen() { return options.map(answer => { const chosen = value === answer; return <Pressable accessibilityRole="radio" accessibilityLabel={answer} accessibilityState={{ selected: chosen }} />; }); }';

test('quiz radio semantics follow option labels and selected value without a lexical variable-name dependency', () => {
  assert.equal(inspectQuizAccessibilitySource(source), true);
  assert.equal(inspectQuizAccessibilitySource(source.replace('const chosen = value === answer;', 'const selected = value === answer;').replace('selected: chosen', 'selected')), true);
});
test('missing or empty radio role, label and selected state fail the source gate', () => {
  for (const missing of [' accessibilityRole="radio"', ' accessibilityLabel={answer}', ' accessibilityState={{ selected: chosen }}']) assert.equal(inspectQuizAccessibilitySource(source.replace(missing, '')), false, missing);
  assert.equal(inspectQuizAccessibilitySource(source.replace('accessibilityLabel={answer}', 'accessibilityLabel=""')), false);
});
test('comments or constant selected states cannot satisfy accessible option selection', () => {
  assert.equal(inspectQuizAccessibilitySource('function QuizScreen(){ /* <Pressable accessibilityRole="radio" accessibilityLabel={answer} accessibilityState={{selected:true}}/> */ return null; }'), false);
  assert.equal(inspectQuizAccessibilitySource(source.replace('selected: chosen', 'selected: false')), false);
});
