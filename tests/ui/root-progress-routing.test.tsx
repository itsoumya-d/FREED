import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { challengeLibrary } from '@/lib/recovery-engine';

function fixture() {
  const source = readFileSync('src/features/freed-app.tsx', 'utf8');
  const tree = ts.createSourceFile('freed-app.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = ['canRepeatReset', 'onStartReset', 'onBrowseResets'];
  const expressions: Record<string, string> = {};
  const callbacks: Record<string, string> = {};
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer && ['startChallenge', 'startStandaloneChallenge'].includes(node.name.text)) {
      callbacks[node.name.text] = node.initializer.getText(tree);
    }
    if (ts.isJsxAttribute(node) && names.includes(node.name.getText(tree)) && node.initializer && ts.isJsxExpression(node.initializer) && node.initializer.expression) {
      const text = node.initializer.expression.getText(tree);
      if (text.includes('challengeSession')) expressions[node.name.getText(tree)] = text;
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  expect(Object.keys(expressions).sort()).toEqual(names.sort());
  let existing: any = null;
  const selected = jest.fn(), screen = jest.fn(), attempt = jest.fn(), notice = jest.fn();
  const challengeSession = { getSnapshot: () => ({ session: existing }), get session() { return existing; } };
  const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const routeDeps={React:{useCallback:(fn:unknown)=>fn},challengeSession,setProtectionSyncMessage:notice,setChallengeBreakNotice:notice,setSelectedChallenge:selected,setScreen:screen,setActiveAttempt:attempt,challengeBreakOrigin:{current:null},journeyOwner:'owner',ownerLease:null,hydrated:true,storageReady:true,guidedAccess:{grant:null,canEnter:()=>false}};
  expect(Object.keys(callbacks).sort()).toEqual(['startChallenge', 'startStandaloneChallenge']);
  // Only the callbacks under test belong to this fixture; a neighboring mounted
  // link hook must not be accidentally executed by a source-range slice.
  const standalone = new Function(...Object.keys(routeDeps), compile(`const startChallenge = (${callbacks.startChallenge}); return (${callbacks.startStandaloneChallenge});`))(...Object.values(routeDeps));
  const deps = { challengeSession, journeyOwner: 'owner', privateLockedRef: { current: false }, getFirebaseAccountScope: () => 'owner', challengeLibrary, customChallenges: [], startStandaloneChallenge: standalone };
  const props = () => new Function(...Object.keys(deps), compile(`return ({${Object.entries(expressions).map(([key, value]) => `${key}: (${value})`).join(',')}});`))(...Object.values(deps));
  return { props, selected, screen, attempt, setSession: (value: unknown) => { existing = value; } };
}
test('Root repeats the exact existing template through its actual startChallenge path', () => {
  const f = fixture(), reset = challengeLibrary[0], p = f.props();
  expect(p.canRepeatReset(reset)).toBe(true);
  p.onStartReset(reset);
  expect(f.selected).toHaveBeenCalledWith(reset); expect(f.screen).toHaveBeenCalledWith('ad');
});
test('Root preserves a different interrupted session and does not advertise repeat or choice', () => {
  const f = fixture(), reset = challengeLibrary[0];
  const existing = { phase: 'paused', challenge: challengeLibrary[1] };
  f.setSession(existing);
  const p = f.props();
  expect(p.canRepeatReset(reset)).toBe(false); expect(p.onBrowseResets).toBeUndefined();
  p.onStartReset(reset);
  expect(f.selected).not.toHaveBeenCalled(); expect(f.attempt).not.toHaveBeenCalled(); expect(f.screen).not.toHaveBeenCalled();
});
test('a session arriving after render prevents a stale Repeat tap from substituting or discarding it', () => {
  const f = fixture(), reset = challengeLibrary[0], p = f.props();
  expect(p.canRepeatReset(reset)).toBe(true);
  f.setSession({ phase: 'paused', challenge: challengeLibrary[1] });
  p.onStartReset(reset); p.onBrowseResets();
  expect(f.selected).not.toHaveBeenCalled(); expect(f.attempt).not.toHaveBeenCalled(); expect(f.screen).not.toHaveBeenCalled();
});
