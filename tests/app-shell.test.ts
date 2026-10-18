import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import * as ts from "typescript";
import { ROOT_DESTINATIONS } from "../src/design-system/navigation";
import { getProtectionSetupReadiness } from "../src/lib/protection-readiness";
import { parseFreedRoute, planFreedNavigation } from "../src/lib/native-navigation";
const { inspectNativeTabLabels } = require("../scripts/lib/native-tab-label-contract");

const source = readFileSync(resolve(process.cwd(), "src/features/freed-app.tsx"), "utf8");

assert.match(source, /import \{ ROOT_DESTINATIONS, type RootDestinationId \} from "@\/design-system\/navigation"/);
assert.match(source, /type Tab = RootDestinationId/);
const nativeTabsSource = readFileSync(resolve(process.cwd(), "app/(tabs)/_layout.tsx"), "utf8");
assertNativeRootConfiguration(nativeTabsSource);
assert.throws(() => assertNativeRootConfiguration(nativeTabsSource.replace(/<NativeTabs.Trigger name="profile">[\s\S]*?<\/NativeTabs.Trigger>/, "")), /native root|Profile|profile/i);
assert.throws(() => assertNativeRootConfiguration(nativeTabsSource.replace('name="profile"', 'name="today"')), /native root|duplicate|profile/i);
for (const destination of ROOT_DESTINATIONS) {
  assert.deepEqual(parseFreedRoute(`/${destination.id}`), { screen: "main", tab: destination.id });
  assert.equal(planFreedNavigation("/flow/checkin", "main", destination.id).action, "reset");
  assert.ok(readFileSync(resolve(process.cwd(), `app/(tabs)/${destination.id}/index.tsx`), "utf8").includes(`tab="${destination.id}"`), `${destination.id} route must render its own native root.`);
}
assert.doesNotMatch(source, /\["home", Home\][\s\S]*\["library", BookOpen\]/);
assert.match(source, /screen === "library"/);
const librarySource = readFileSync(resolve(process.cwd(), "src/features/library-screen.tsx"), "utf8");
const buttonSource = readFileSync(resolve(process.cwd(), "src/components/ui/Button.tsx"), "utf8");
assert.match(source, /import \{ LibraryScreen \} from ['"]@\/features\/library-screen['"]/);
assert.match(librarySource, /<Button label="Back to Today" variant="ghost" onPress=\{props\.onBack\}/);
assert.match(buttonSource, /accessibilityRole="button"/);
assert.match(buttonSource, /accessibilityLabel=\{accessibilityLabel \?\? label\}/);
assertLibraryBackIntegration(source);
assert.throws(() => assertLibraryBackIntegration(source.replace('setTab("today");\n                setScreen("main");', 'setTab("profile");\n                setScreen("main");')), /Library back/);

const shieldSource = namedFunctionSource(source, "ShieldScreen");
const profileSource = namedFunctionSource(source, "ProfileScreen");
assert.doesNotMatch(source, /function BottomNav\(/, "Native tabs must not be duplicated by a custom bottom navigation shell.");
assertFocusShieldReleasePresentation(shieldSource);
for(const [before,after] of [
 ['section === "focus-shield"','section === "unused"'],
 ['title="Focus Shield unavailable"','title="Focus Shield active"'],
 ['router.push("/shield/apps")','router.push("/shield/dns")']
]) assert.throws(()=>assertFocusShieldReleasePresentation(shieldSource.replace(before,after)),/Focus Shield release/);
assert.match(shieldSource, /onOpenProtectionSetup/);
assert.doesNotMatch(profileSource, /FocusShieldSection/);
assert.doesNotMatch(profileSource, /requestProtectionAuthorization|applyAdultContentFilter|presentFamilyActivityPicker/);
const overviewSource = readFileSync(resolve(process.cwd(), "src/components/ProtectOverview.tsx"), "utf8");
assert.match(source, /import \{ getProtectionSetupReadiness \} from "@\/lib\/protection-readiness"/);
assert.match(source, /import \{ ProtectOverview \} from "@\/components\/ProtectOverview"/);
assertProtectionPresentation(shieldSource, overviewSource);
const mutate = (text: string, before: string, after: string) => {
  assert.ok(text.includes(before), `Present mutation target: ${before}`);
  const changed = text.replace(before, after); assert.notEqual(changed, text); return changed;
};
for (const [before, after] of [
  ["getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'websites').websiteProtection", "getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'websites').appLimits"],
  ["getProtectionSetupReadiness(protectionCapability, protectionStatus, disciplineSettings.blockedAppPackages.length, 'websites')", "getProtectionSetupReadiness(protectionCapability, null, disciplineSettings.blockedAppPackages.length, 'websites')"],
  ["translateSource(websiteReadiness.status)", "translateSource('On')"],
  ["detail: websiteReadiness.explanation", 'detail: "Everything is protected"'],
  ['title={protectionHealth.title}', 'title={"Protection is active"}'],
  ['description={protectionHealth.detail}', 'description={"Everything is protected"}'],
  ["onPress={() => onOpenProtectionSetup('websites')}", "onPress={undefined}"],
  ["onPress={() => onOpenProtectionSetup('websites')}", "onPress={() => onOpenProtectionSetup('apps')}"],
  ['websiteReadiness.ready ? "shield" : "repair"', 'true ? "shield" : "repair"'],
  ['{healthCard}', '{null}'],
  ['status={protectionStatus} settings={disciplineSettings} onSetup={onOpenProtectionSetup}', 'status={null} settings={disciplineSettings} onSetup={onOpenProtectionSetup}']
]) assert.throws(() => assertProtectionPresentation(mutate(shieldSource, before, after), overviewSource), /Protection presentation/);
function overviewId(node: ts.JsxOpeningLikeElement, suffix: string) { return node.attributes.properties.some(item =>
  ts.isJsxAttribute(item) && item.name.getText() === "testID" && item.initializer && ts.isJsxExpression(item.initializer) &&
  item.initializer.expression && ts.isTemplateExpression(item.initializer.expression) &&
  item.initializer.expression.head.text === "protect-" && item.initializer.expression.templateSpans.length === 1 &&
  ts.isIdentifier(item.initializer.expression.templateSpans[0].expression) &&
  (item.initializer.expression.templateSpans[0].expression as ts.Identifier).text === "intent" &&
  item.initializer.expression.templateSpans[0].literal.text === suffix); }
const readinessArgument = (node: ts.Node, index: number) => Boolean(node.parent && ts.isCallExpression(node.parent) &&
  ts.isIdentifier(node.parent.expression) && node.parent.expression.text === "getProtectionSetupReadiness" &&
  node.parent.arguments[index] === node);
const featureExpression = (node: ts.Node, key: string) => ts.isPropertyAccessExpression(node) &&
  ts.isIdentifier(node.expression) && node.expression.text === "feature" && node.name.text === key && ts.isJsxExpression(node.parent);
const setupAttribute = (node: ts.Node) => ts.isJsxAttribute(node) && node.name.getText() === "onPress" &&
  (ts.isJsxOpeningElement(node.parent.parent) || ts.isJsxSelfClosingElement(node.parent.parent)) && overviewId(node.parent.parent, "-setup");
const overviewMutations: Array<[string, (node: ts.Node) => boolean, string]> = [
  ["missing native status", node => readinessArgument(node, 1), "null"],
  ["missing native capability", node => readinessArgument(node, 0), "null"],
  ["omitted website card", node => ts.isArrayLiteralExpression(node) && node.elements.length === 2 &&
    node.elements.every((item, index) => ts.isStringLiteral(item) && item.text === ["websites", "apps"][index]), "['apps']"],
  ["wrong website readiness", node => Boolean(node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name) &&
    node.parent.name.text === "feature" && node.parent.initializer === node), "website ? readiness.appLimits : readiness.appLimits"],
  ["false On status", node => featureExpression(node, "status"), '"On"'],
  ["omitted status", node => ts.isJsxElement(node) && overviewId(node.openingElement, "-status"), "{null}"],
  ["false protection explanation", node => featureExpression(node, "explanation"), '"Everything is protected"'],
  ["omitted scope", node => ts.isJsxElement(node) && node.children.some(child => ts.isJsxExpression(child) &&
    child.expression && featureExpression(child.expression, "scope")), "{null}"],
  ["omitted primary action", setupAttribute, "onPress={() => undefined}"],
  ["wrong primary action intent", setupAttribute, "onPress={() => onSetup('apps')}"],
  ["false action label", node => ts.isIdentifier(node) && node.text === "action" && ts.isJsxExpression(node.parent), '"On"'],
  ["missing readiness action binding", node => Boolean(node.parent && ts.isVariableDeclaration(node.parent) && ts.isIdentifier(node.parent.name) &&
    node.parent.name.text === "action" && node.parent.initializer === node), '"Check"'],
  ["false Off action meaning", node => ts.isStringLiteral(node) && node.text === "Set up" && ts.isReturnStatement(node.parent), '"Check"'],
  ["wrong website action accessibility meaning", node => ts.isStringLiteral(node) && node.text === "Review adult website protection", '"Review app protection"'],
  ["omitted returned card", node => ts.isJsxElement(node) && overviewId(node.openingElement, "-card"), "null"]
];
overviewMutations.push(
  ["early website return omits its card", node => ts.isVariableStatement(node) && node.declarationList.declarations.some(item =>
    ts.isIdentifier(item.name) && item.name.text === "website"), "if (intent === 'websites') return null; const website = intent === 'websites';"],
  ["unreachable details through a no-op toggle", node => ts.isJsxAttribute(node) && node.name.getText() === "onPress" &&
    ts.isJsxOpeningElement(node.parent.parent) && overviewId(node.parent.parent, "-details-toggle"), "onPress={() => undefined}"],
  ["Advanced expanded by default", node => ts.isJsxAttribute(node) && node.name.getText() === "initiallyExpanded" &&
    ts.isJsxOpeningElement(node.parent.parent) && node.parent.parent.attributes.properties.some(item =>
      ts.isJsxAttribute(item) && item.name.getText() === "testID" && item.initializer && ts.isStringLiteral(item.initializer) &&
      item.initializer.text === "protect-advanced"), "initiallyExpanded={true}"]
);
for (const [name, select, replacement] of overviewMutations) {
  const ast = ts.createSourceFile("overview.tsx", overviewSource, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const targets: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (select(node)) targets.push(node); ts.forEachChild(node, visit); };
  visit(ast);
  assert.equal(targets.length, 1, `Present unique overview mutation target: ${name}`);
  const target = targets[0];
  const changed = overviewSource.slice(0, target.getStart(ast)) + replacement + overviewSource.slice(target.end);
  assert.notEqual(changed, overviewSource, `Overview mutation must change source: ${name}`);
  assert.throws(() => assertProtectionPresentation(shieldSource, changed), /Protection presentation/, name);
}
// Formatting and literal quote style cannot determine native readiness truth.
assertProtectionPresentation(shieldSource, mutate(overviewSource,
  "getProtectionSetupReadiness(capability, status, settings.blockedAppPackages.length, 'both', settings.appGuardMode)",
  'getProtectionSetupReadiness(\n capability,\n status,\n settings.blockedAppPackages.length,\n "both",\n settings.appGuardMode\n)'
));
assertProtectionSetupIntegration(source);
for (const [before, after] of [
  ['setProtectionIntent(intent); setScreen("protectionSetup");', 'setScreen("protectionSetup");'],
  ['setProtectionIntent(intent); setScreen("protectionSetup");', 'setProtectionIntent(intent); setScreen("main");'],
  ['onOpenProtectionSetup={(intent = "both") => { setProtectionIntent(intent); setScreen("protectionSetup"); }}', 'onOpenProtectionSetup={() => undefined}']
]) assert.throws(() => assertProtectionSetupIntegration(mutate(source, before, after)), /Protection setup/);
assert.equal(getProtectionSetupReadiness(null, null, 0, 'websites').websiteProtection.ready, false);
assert.equal(getProtectionSetupReadiness(null, null, 0, 'websites').websiteProtection.status, 'Unavailable');
const availableWebsite = { platform: 'android', localVpnFallback: true, dnsFiltering: true } as Parameters<typeof getProtectionSetupReadiness>[0];
assert.equal(getProtectionSetupReadiness(availableWebsite, null, 0, 'websites').websiteProtection.status, 'Off',
  'Missing native status must never present a ready website filter.');

assert.match(profileSource, /<RecoveryBackupCard/);
assert.match(profileSource, /pendingFirebaseEmailLink=\{pendingFirebaseEmailLink\}/);
assert.match(profileSource, /onPendingFirebaseEmailLinkHandled=\{onPendingFirebaseEmailLinkHandled\}/);
assert.match(profileSource, /<PrivacySupportCard/);
assert.match(profileSource, /<ReminderSettingsCard/);
assert.match(profileSource, /<AccountabilitySettingsCard/);
assert.doesNotMatch(profileSource, /label="Complete email sign-in"/);

const backupSource = namedFunctionSource(source, "RecoveryBackupCard");
assert.match(backupSource, /\.completeEmailLink\(\{ email: authEmail, emailLink: url \}\)/);
assert.match(backupSource, /if \(!result\.ok\)/);
assert.match(backupSource, /onPendingFirebaseEmailLinkHandled\(\);/);

function namedFunctionSource(text: string, name: string): string {
  const ast = ts.createSourceFile("freed-app.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declaration = ast.statements.find((statement): statement is ts.FunctionDeclaration => ts.isFunctionDeclaration(statement) && statement.name?.text === name);
  assert.ok(declaration, `${name} must be present for its UI integration contract.`);
  return declaration.getText(ast);
}

function assertNativeRootConfiguration(text: string) {
  const roots = inspectNativeTabLabels(text);
  assert.deepEqual(roots, ROOT_DESTINATIONS.map(({ id, compactLabel }) => ({ id, label: compactLabel })), "All four native roots must appear exactly once in the declared order with their matching labels.");
}

function assertFocusShieldReleasePresentation(text:string) {
 const ast=ts.createSourceFile('shield.tsx',text,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
 let routed=false,unavailable=false,alternative=false;
 const visit=(node:ts.Node)=>{
  if(ts.isConditionalExpression(node)&&node.condition.getText(ast)==='section === "focus-shield"'){
   routed=true;
   const inspect=(child:ts.Node)=>{
    if(ts.isJsxAttribute(child)&&child.name.getText(ast)==='title'&&child.initializer&&ts.isStringLiteral(child.initializer)&&child.initializer.text==='Focus Shield unavailable')unavailable=true;
    if(ts.isJsxAttribute(child)&&child.name.getText(ast)==='onPress'&&child.initializer&&ts.isJsxExpression(child.initializer)&&child.initializer.expression&&ts.isArrowFunction(child.initializer.expression)){
     const body=child.initializer.expression.body;
     if(ts.isCallExpression(body)&&body.expression.getText(ast)==='router.push'&&body.arguments.length===1&&ts.isStringLiteral(body.arguments[0])&&body.arguments[0].text==='/shield/apps')alternative=true;
    }
    ts.forEachChild(child,inspect);
   };inspect(node.whenTrue);
  }
  ts.forEachChild(node,visit);
 };visit(ast);
 assert.ok(routed&&unavailable&&alternative&&!/FocusShieldSection/.test(text),'Focus Shield release must show its unavailable route and a working whole-app alternative.');
}

function assertLibraryBackIntegration(text: string) {
  const ast = ts.createSourceFile("freed-app.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let valid = false;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "LibraryScreen") {
      const back = node.attributes.properties.find((property): property is ts.JsxAttribute => ts.isJsxAttribute(property) && property.name.getText(ast) === "onBack")?.initializer;
      if (back && ts.isJsxExpression(back) && back.expression && ts.isArrowFunction(back.expression) && ts.isBlock(back.expression.body)) {
        const calls = back.expression.body.statements.filter(ts.isExpressionStatement).map(statement => statement.expression);
        valid = ["setTab:today", "setScreen:main"].every((expected, index) => {
          const call = calls[index];
          return call && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0]) && `${call.expression.text}:${call.arguments[0].text}` === expected;
        });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.ok(valid, "Library back must return through the Today root and main screen.");
}

console.log("app shell native root and profile integration contracts passed");

/** Trace current feature truth to returned JSX and its native setup handler. */
function assertProtectionPresentation(text: string, overviewText: string) {
  const ast = ts.createSourceFile("shield.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const overviewAst = ts.createSourceFile("overview.tsx", overviewText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const all = (root: ts.Node, predicate: (node: ts.Node) => boolean) => {
    const result: ts.Node[] = [];
    const visit = (node: ts.Node) => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
    visit(root); return result;
  };
  const variable = (root: ts.Node, name: string) => {
    const declarations = all(root, node => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === name) as ts.VariableDeclaration[];
    return declarations.length === 1 ? declarations[0].initializer : undefined;
  };
  const code = (node: ts.Node | undefined, file = ast) => node?.getText(file);
  const property = (node: ts.Expression | undefined, key: string) => node && ts.isObjectLiteralExpression(node)
    ? node.properties.find((item): item is ts.PropertyAssignment => ts.isPropertyAssignment(item) && code(item.name) === key)?.initializer : undefined;
  const attribute = (node: ts.JsxOpeningLikeElement, name: string, file = ast) => node.attributes.properties.find(
    (item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText(file) === name
  )?.initializer;
  const expression = (node: ts.JsxAttributeValue | undefined) => node && ts.isJsxExpression(node) ? node.expression : undefined;
  const callIs = (node: ts.Node | undefined, name: string, args: string[], file = ast) => Boolean(node && ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) && node.expression.text === name && node.arguments.length === args.length &&
    node.arguments.every((arg, index) => arg.getText(file) === args[index]));
  const actionIs = (node: ts.Node | undefined, name: string, argument: string, file = ast) => Boolean(node && ts.isArrowFunction(node) &&
    callIs(node.body, name, [argument], file));
  const returns = (node: ts.FunctionDeclaration | ts.ArrowFunction) => node.body && ts.isBlock(node.body)
    ? node.body.statements.filter(ts.isReturnStatement).map(statement => statement.expression).filter((item): item is ts.Expression => Boolean(item)) : [];
  // Follow actual rendered JSX. Dead locals, comments and literal false branches are not proof.
  const renders = (node: ts.Node | undefined, predicate: (node: ts.Node) => boolean): boolean => {
    if (!node) return false;
    if (predicate(node)) return true;
    if (ts.isParenthesizedExpression(node)) return renders(node.expression, predicate);
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return node.children.some(child => renders(child, predicate));
    if (ts.isJsxExpression(node)) return renders(node.expression, predicate);
    if (ts.isConditionalExpression(node)) return node.condition.kind === ts.SyntaxKind.FalseKeyword ? renders(node.whenFalse, predicate)
      : node.condition.kind === ts.SyntaxKind.TrueKeyword ? renders(node.whenTrue, predicate) : renders(node.whenTrue, predicate) || renders(node.whenFalse, predicate);
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) return node.left.kind !== ts.SyntaxKind.FalseKeyword && renders(node.right, predicate);
    return false;
  };
  const shield = ast.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ShieldScreen");
  const website = variable(ast, "websiteReadiness");
  const modelBound = Boolean(website && ts.isPropertyAccessExpression(website) && website.name.text === "websiteProtection" &&
    callIs(website.expression, "getProtectionSetupReadiness", ["protectionCapability", "protectionStatus", "disciplineSettings.blockedAppPackages.length", "'websites'"]));
  const health = variable(ast, "protectionHealth"), title = property(health, "title");
  const titleBound = Boolean(title && ts.isTemplateExpression(title) && title.templateSpans.length === 1 &&
    callIs(title.templateSpans[0].expression, "translateSource", ["websiteReadiness.status"]));
  const healthBound = titleBound && code(property(health, "detail")) === "websiteReadiness.explanation";
  const healthCard = variable(ast, "healthCard");
  const card = healthCard && ts.isJsxElement(healthCard) ? healthCard : undefined;
  const headerBound = Boolean(card && code(card.openingElement.tagName) === "MomentumPageHeader" &&
    code(expression(attribute(card.openingElement, "title"))) === "protectionHealth.title" &&
    code(expression(attribute(card.openingElement, "description"))) === "protectionHealth.detail" &&
    code(expression(attribute(card.openingElement, "pose"))) === 'websiteReadiness.ready ? "shield" : "repair"');
  const setupBound = Boolean(card && card.children.some(child => ts.isJsxSelfClosingElement(child) && code(child.tagName) === "PillButton" &&
    attribute(child, "label") && ts.isStringLiteral(attribute(child, "label")!) && (attribute(child, "label") as ts.StringLiteral).text === "Review website protection" &&
    actionIs(expression(attribute(child, "onPress")), "onOpenProtectionSetup", "'websites'")));
  const actualReturns = shield ? returns(shield) : [];
  const cardRendered = actualReturns.some(returned => renders(returned, node => ts.isConditionalExpression(node) &&
    code(node.condition) === 'section === "dns"' && renders(node.whenTrue, child => ts.isIdentifier(child) && child.text === "healthCard")));
  const overviewForwarded = Boolean(shield?.body?.statements.some(node => ts.isIfStatement(node) && code(node.expression) === "!section" &&
    ts.isReturnStatement(node.thenStatement) && node.thenStatement.expression && ts.isJsxSelfClosingElement(node.thenStatement.expression) &&
    code(node.thenStatement.expression.tagName) === "ProtectOverview" && [
      ["capability", "protectionCapability"], ["status", "protectionStatus"], ["settings", "disciplineSettings"], ["onSetup", "onOpenProtectionSetup"]
    ].every(([name, expected]) => code(expression(attribute(node.thenStatement.expression as ts.JsxSelfClosingElement, name))) === expected)));

  const overview = overviewAst.statements.find((node): node is ts.FunctionDeclaration => ts.isFunctionDeclaration(node) && node.name?.text === "ProtectOverview");
  const readiness = overview ? variable(overview, "readiness") : undefined;
  const overviewModelBound = Boolean(readiness && ts.isCallExpression(readiness) && ts.isIdentifier(readiness.expression) &&
    readiness.expression.text === "getProtectionSetupReadiness" && readiness.arguments.length === 5 &&
    ["capability", "status", "settings.blockedAppPackages.length"].every((arg, index) => code(readiness.arguments[index], overviewAst) === arg) &&
    ts.isStringLiteral(readiness.arguments[3]) && readiness.arguments[3].text === "both" &&
    code(readiness.arguments[4], overviewAst) === "settings.appGuardMode");
  const mapCalls = overview ? returns(overview).flatMap(returned => all(returned, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "map")) as ts.CallExpression[] : [];
  const map = mapCalls.find(node => {
    let receiver = (node.expression as ts.PropertyAccessExpression).expression;
    while (ts.isAsExpression(receiver) || ts.isParenthesizedExpression(receiver)) receiver = receiver.expression;
    return ts.isArrayLiteralExpression(receiver) && receiver.elements.length === 2 && receiver.elements.every((item, index) => ts.isStringLiteral(item) && item.text === ["websites", "apps"][index]);
  });
  const callback = map?.arguments[0];
  const feature = callback && ts.isArrowFunction(callback) ? variable(callback, "feature") : undefined;
  const websiteChoice = callback && ts.isArrowFunction(callback) ? variable(callback, "website") : undefined;
  const featureBound = Boolean(websiteChoice && ts.isBinaryExpression(websiteChoice) && ts.isIdentifier(websiteChoice.left) &&
    websiteChoice.left.text === "intent" && websiteChoice.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
    ts.isStringLiteral(websiteChoice.right) && websiteChoice.right.text === "websites" && feature && ts.isConditionalExpression(feature) &&
    code(feature.condition, overviewAst) === "website" && code(feature.whenTrue, overviewAst) === "readiness.websiteProtection" && code(feature.whenFalse, overviewAst) === "readiness.appLimits");
  const cards = callback && ts.isArrowFunction(callback) ? returns(callback) : [];
  const renderedCards = cards.flatMap(returned => all(returned, node => ts.isJsxElement(node) &&
    code(node.openingElement.tagName, overviewAst) === "MomentumSection" && overviewId(node.openingElement, "-card") &&
    renders(returned, child => child === node))) as ts.JsxElement[];
  const overviewCardBound = renderedCards.length === 1 && code(expression(attribute(renderedCards[0].openingElement, "key", overviewAst)), overviewAst) === "intent";
  const callbackStatements = callback && ts.isArrowFunction(callback) && ts.isBlock(callback.body) ? callback.body.statements : undefined;
  // Admit a straight-line callback ending in the actual card. A nested early return
  // or a conditional final return cannot prove that both enumerated intents render.
  const overviewEveryIntentCardBound = Boolean(callback && ts.isArrowFunction(callback) && callback.parameters.length === 1 &&
    ts.isIdentifier(callback.parameters[0].name) && callback.parameters[0].name.text === "intent" && callbackStatements &&
    callbackStatements.every((statement, index) => index === callbackStatements.length - 1
      ? ts.isReturnStatement(statement) : ts.isVariableStatement(statement)) &&
    cards.length === 1 && ts.isJsxElement(cards[0]) && cards[0] === renderedCards[0]);
  const overviewStatusBound = renderedCards.some(card => renders(card, node => ts.isJsxElement(node) &&
    code(node.openingElement.tagName, overviewAst) === "Text" && overviewId(node.openingElement, "-status") &&
    renders(node, child => ts.isPropertyAccessExpression(child) && code(child, overviewAst) === "feature.status")));
  const overviewDetailBound = renderedCards.some(card => renders(card, node => ts.isConditionalExpression(node) &&
    code(node.condition, overviewAst) === "details === intent" && renders(node.whenTrue, child => ts.isJsxElement(child) &&
      overviewId(child.openingElement, "-details") && ["feature.scope", "feature.explanation"].every(expected =>
        renders(child, detail => ts.isPropertyAccessExpression(detail) && code(detail, overviewAst) === expected)))));
  const componentStatements = overview?.body?.statements;
  const firstRender = componentStatements?.findIndex(ts.isReturnStatement) ?? -1;
  const detailsState = firstRender >= 0 ? componentStatements!.slice(0, firstRender).filter(ts.isVariableStatement)
    .flatMap(statement => statement.declarationList.declarations).filter(node => ts.isArrayBindingPattern(node.name) &&
      node.name.elements.length === 2 && node.name.elements.every((item, index) => ts.isBindingElement(item) &&
        ts.isIdentifier(item.name) && item.name.text === ["details", "setDetails"][index])) : [];
  const stateInitializer = detailsState.length === 1 ? detailsState[0].initializer : undefined;
  const overviewDetailsInitiallyCollapsed = Boolean(stateInitializer && ts.isCallExpression(stateInitializer) &&
    ts.isPropertyAccessExpression(stateInitializer.expression) && ts.isIdentifier(stateInitializer.expression.expression) &&
    stateInitializer.expression.expression.text === "React" && stateInitializer.expression.name.text === "useState" &&
    stateInitializer.arguments.length === 1 && stateInitializer.arguments[0].kind === ts.SyntaxKind.NullKeyword);
  const detailToggles = renderedCards.flatMap(card => all(card, node => ts.isJsxElement(node) &&
    code(node.openingElement.tagName, overviewAst) === "Pressable" && overviewId(node.openingElement, "-details-toggle") &&
    renders(card, child => child === node))) as ts.JsxElement[];
  const detailsHandler = detailToggles.length === 1 ? expression(attribute(detailToggles[0].openingElement, "onPress", overviewAst)) : undefined;
  let overviewDetailsToggleBound = false;
  try {
    if (detailsHandler && ts.isArrowFunction(detailsHandler)) {
      const js = ts.transpileModule(`const press = ${detailsHandler.getText(overviewAst)};`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022 }
      }).outputText;
      // Execute the real handler with a state setter, not an expected-code string.
      // Each intent must open from null, close itself, and switch from the other card.
      overviewDetailsToggleBound = ["websites", "apps"].every(intent => [null, "websites", "apps"].every(initial => {
        let next = initial, writes = 0;
        const setDetails = (update: string | null | ((value: string | null) => string | null)) => {
          writes += 1; next = typeof update === "function" ? update(next) : update;
        };
        const press = new Function("intent", "details", "setDetails", `${js}\nreturn press;`)(intent, initial, setDetails) as () => void;
        press();
        return writes === 1 && next === (initial === intent ? null : intent);
      }));
    }
  } catch { overviewDetailsToggleBound = false; }
  const overviewAdvancedCollapsed = Boolean(overview && returns(overview).some(returned => renders(returned, node => {
    if (!ts.isJsxElement(node) || code(node.openingElement.tagName, overviewAst) !== "MomentumSection") return false;
    const id = attribute(node.openingElement, "testID", overviewAst);
    const collapsible = node.openingElement.attributes.properties.some(item => ts.isJsxAttribute(item) &&
      item.name.getText(overviewAst) === "collapsible" && (!item.initializer || expression(item.initializer)?.kind === ts.SyntaxKind.TrueKeyword));
    return Boolean(id && ts.isStringLiteral(id) && id.text === "protect-advanced" && collapsible &&
      expression(attribute(node.openingElement, "initiallyExpanded", overviewAst))?.kind === ts.SyntaxKind.FalseKeyword);
  })));
  const overviewMapRendered = Boolean(map && overview && returns(overview).some(returned => renders(returned, node => node === map)));
  const action = callback && ts.isArrowFunction(callback) ? variable(callback, "action") : undefined;
  const actionLabel = callback && ts.isArrowFunction(callback) ? variable(callback, "actionLabel") : undefined;
  const overviewActionBound = callIs(action, "actionFor", ["feature"], overviewAst) &&
    callIs(actionLabel, "actionAccessibilityLabel", ["feature", "website"], overviewAst) && renderedCards.some(card => renders(card, node => {
      if (!ts.isJsxElement(node) || code(node.openingElement.tagName, overviewAst) !== "Pressable") return false;
      const opening = (node as ts.JsxElement).openingElement;
      return overviewId(opening, "-setup") &&
        actionIs(expression(attribute(opening, "onPress", overviewAst)), "onSetup", "intent", overviewAst) &&
        code(expression(attribute(opening, "accessibilityLabel", overviewAst)), overviewAst) === "actionLabel" &&
        renders(node, child => ts.isIdentifier(child) && child.text === "action");
    }));
  // Run only the component's two pure label helpers, independently of React/native imports.
  // Concrete expectations keep misleading "On"/"Fix"/"Check" mutations from validating themselves.
  const labelHelper = (name: string) => {
    const declaration = overviewAst.statements.find((node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === name);
    if (!declaration) return undefined;
    const js = ts.transpileModule(declaration.getText(overviewAst), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    return new Function(`${js}\nreturn ${name};`)() as (feature: { status: string }, website?: boolean) => string;
  };
  let overviewLabelsBound = false;
  try {
    const actionFor = labelHelper("actionFor"), accessibilityLabel = labelHelper("actionAccessibilityLabel");
    const expected = [
      ["Off", "Set up", "Set up adult website protection", "Set up app protection"],
      ["On", "Check", "Review adult website protection", "Review app protection"],
      ["Needs attention", "Fix", "Fix adult website protection", "Fix app protection"],
      ["Unavailable", "Check", "Check device support", "Check device support"]
    ];
    overviewLabelsBound = Boolean(actionFor && accessibilityLabel && expected.every(([status, action, website, apps]) =>
      actionFor({ status }) === action && accessibilityLabel({ status }, true) === website && accessibilityLabel({ status }, false) === apps));
  } catch { overviewLabelsBound = false; }
  assert.ok(!ast.parseDiagnostics.length && !overviewAst.parseDiagnostics.length && modelBound && healthBound && headerBound && setupBound && cardRendered &&
    overviewForwarded && overviewModelBound && overviewMapRendered && featureBound && overviewCardBound && overviewEveryIntentCardBound && overviewStatusBound && overviewDetailBound &&
    overviewDetailsInitiallyCollapsed && overviewDetailsToggleBound && overviewAdvancedCollapsed && overviewActionBound && overviewLabelsBound,
    "Protection presentation must trace native website health into returned detail/overview renderers and the matching setup action.");
}

function assertProtectionSetupIntegration(text: string) {
  const ast = ts.createSourceFile("controller.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let bindings = 0;
  const visit = (node: ts.Node) => {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(ast) === "ShieldScreen") {
      const value = node.attributes.properties.find((item): item is ts.JsxAttribute => ts.isJsxAttribute(item) && item.name.getText(ast) === "onOpenProtectionSetup")?.initializer;
      if (value && ts.isJsxExpression(value) && value.expression && ts.isArrowFunction(value.expression) && ts.isBlock(value.expression.body)) {
        const calls = value.expression.body.statements.filter(ts.isExpressionStatement).map(statement => statement.expression);
        if (calls.length === 2 && calls.every(ts.isCallExpression) && calls[0].expression.getText(ast) === "setProtectionIntent" &&
          calls[0].arguments.length === 1 && calls[0].arguments[0].getText(ast) === "intent" && calls[1].expression.getText(ast) === "setScreen" &&
          calls[1].arguments.length === 1 && ts.isStringLiteral(calls[1].arguments[0]) && calls[1].arguments[0].text === "protectionSetup") bindings += 1;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  assert.equal(bindings, 1, "Protection setup must preserve the chosen feature intent and open its native setup route.");
}
