const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const ts = require("typescript");
const { inspectNativeTabLabels } = require("./lib/native-tab-label-contract");

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function check(id, condition, evidence) {
  return {
    id,
    status: condition ? "pass" : "fail",
    evidence
  };
}

/** Source precheck only. OS accessibility and native navigation still need runtime evidence. */
function inspectNativeAccessibilitySources(sources) {
  const parse = (text) => ts.createSourceFile("source.tsx", text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const find = (node, predicate) => {
    const matches = [];
    const visit = (child) => { if (predicate(child)) matches.push(child); ts.forEachChild(child, visit); };
    visit(node);
    return matches;
  };
  const tag = (node) => node.tagName.getText();
  const attribute = (node, name) => node.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.getText() === name)?.initializer;
  const literalAttribute = (node, name) => {
    const value = attribute(node, name);
    return value && ts.isStringLiteral(value) ? value.text : null;
  };
  const imported = (ast, modules, name) => ast.statements.some(node => ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly &&
    ts.isStringLiteral(node.moduleSpecifier) && modules.includes(node.moduleSpecifier.text) && node.importClause?.namedBindings &&
    ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => !item.isTypeOnly &&
      item.name.text === name && (item.propertyName?.text ?? item.name.text) === name)) &&
    find(ast, node => (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) &&
      node.name && ts.isIdentifier(node.name) && node.name.text === name).length === 0;
  const namedRenderer = (ast, name) => ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name &&
    node.modifiers?.some(item => item.kind === ts.SyntaxKind.ExportKeyword));
  const returnedExpressions = declaration => declaration?.body?.statements.filter(ts.isReturnStatement).map(node => node.expression).filter(Boolean) ?? [];
  const renderedJsx = (expression, name) => {
    const opening = ts.isJsxElement(expression) ? expression.openingElement : ts.isJsxSelfClosingElement(expression) ? expression : undefined;
    if (opening) {
      const hidden = opening.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText() === "accessibilityElementsHidden");
      if (hidden && (!hidden.initializer || (ts.isJsxExpression(hidden.initializer) && hidden.initializer.expression?.kind === ts.SyntaxKind.TrueKeyword))) return false;
      if (literalAttribute(opening, "importantForAccessibility") === "no-hide-descendants") return false;
      const style = attribute(opening, "style");
      if (style && ts.isJsxExpression(style) && style.expression && ts.isObjectLiteralExpression(style.expression) &&
        style.expression.properties.some(item => ts.isPropertyAssignment(item) && item.name.getText() === "display" && ts.isStringLiteral(item.initializer) && item.initializer.text === "none")) return false;
    }
    if (opening && tag(opening) === name) return true;
    // Follow actual returned JSX/fragment children, never dead locals, comments or a false && branch.
    if (!ts.isJsxElement(expression) && !ts.isJsxFragment(expression)) return false;
    return expression.children.some(child => (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child) || ts.isJsxFragment(child)) && renderedJsx(child, name));
  };
  const expected = { today: "Today", shield: "Protect", progress: "Progress", profile: "Profile" };
  const labels = inspectNativeTabLabels(sources.tabs);
  const tabsNamed = Boolean(labels && labels.length === 4 && Object.entries(expected).every(([id, label], index) => labels[index].id === id && labels[index].label === label));

  const support = parse(sources.urgeSupport);
  const trustedController = imported(support, ["@/features/freed-app"], "useFreedAppController") && imported(support, ["@/components/Localized", "./Localized"], "Pressable");
  const consumesControllerAction = find(support, (node) => ts.isVariableDeclaration(node) && ts.isObjectBindingPattern(node.name))
    .some((node) => node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "useFreedAppController" && node.name.elements.some((element) => ts.isIdentifier(element.name) && element.name.text === "startPanicIntervention"));
  const supportButtons = returnedExpressions(namedRenderer(support, "UrgeSupportButton")).filter(expression => renderedJsx(expression, "Pressable")).flatMap(expression => find(expression, node => ts.isJsxElement(node) && tag(node.openingElement) === "Pressable"));
  const namedAction = supportButtons.some((node) => {
    const opening = node.openingElement;
    const onPress = attribute(opening, "onPress");
    return literalAttribute(opening, "accessibilityRole") === "button" &&
      /urge support/i.test(literalAttribute(opening, "accessibilityLabel") ?? "") &&
      /without an ad/i.test(literalAttribute(opening, "accessibilityHint") ?? "") &&
      onPress && ts.isJsxExpression(onPress) && onPress.expression && ts.isIdentifier(onPress.expression) && onPress.expression.text === "startPanicIntervention";
  });
  const controller = parse(sources.controller);
  const action = find(controller, (node) => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "startPanicIntervention")
    .find((node) => node.initializer && ts.isCallExpression(node.initializer) && node.initializer.arguments[0] && ts.isArrowFunction(node.initializer.arguments[0]));
  const calls = action ? find(action.initializer.arguments[0].body, ts.isCallExpression) : [];
  const createsAttempt = action && find(action.initializer.arguments[0].body, (node) => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "attempt")
    .some((node) => node.initializer && ts.isCallExpression(node.initializer) && ts.isIdentifier(node.initializer.expression) && node.initializer.expression.text === "createPanicInterventionAttempt");
  const setsAttempt = calls.some((call) => ts.isIdentifier(call.expression) && call.expression.text === "setActiveAttempt" && call.arguments.length === 1 && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === "attempt");
  const opensIntercept = calls.some((call) => ts.isIdentifier(call.expression) && call.expression.text === "setScreen" && call.arguments[0] && ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text === "intercept");
  const exportedAction = find(controller, (node) => ts.isJsxElement(node) && tag(node.openingElement) === "FreedAppContext.Provider")
    .some((node) => {
      const value = attribute(node.openingElement, "value");
      return value && ts.isJsxExpression(value) && value.expression && ts.isObjectLiteralExpression(value.expression) && value.expression.properties.some((property) => ts.isShorthandPropertyAssignment(property) && property.name.text === "startPanicIntervention");
    });
  const navigation = parse(sources.navigation);
  const interceptRoutable = find(navigation, (node) => ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === "flows")
    .some((node) => node.initializer && ts.isArrayLiteralExpression(node.initializer) && node.initializer.elements.some((element) => ts.isStringLiteral(element) && element.text === "intercept"));
  // The canonical module is resolved when older callers omit an injectable fixture.
  // A matching wrapper tag/import alone is never proof that SOS is rendered.
  const toolbar = parse(sources.rootToolbar ?? read("src/components/RootToolbarActions.tsx"));
  const toolbarHasSupport = !toolbar.parseDiagnostics.length && imported(toolbar, ["./UrgeSupportButton", "@/components/UrgeSupportButton"], "UrgeSupportButton") &&
    returnedExpressions(namedRenderer(toolbar, "RootToolbarActions")).some(expression => renderedJsx(expression, "UrgeSupportButton"));
  const everyHeaderHasSupport = sources.tabStacks.length === 4 && sources.tabStacks.every(text => {
    const ast = parse(text);
    if (ast.parseDiagnostics.length || !imported(ast, ["expo-router", "expo-router/stack"], "Stack")) return false;
    const rootLayout = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.modifiers?.some(item => item.kind === ts.SyntaxKind.DefaultKeyword));
    const stack = returnedExpressions(rootLayout).find(expression => ts.isJsxElement(expression) && tag(expression.openingElement) === "Stack");
    if (!stack) return false;
    const objectOptions = opening => {
      const value = attribute(opening, opening.tagName.getText() === "Stack" ? "screenOptions" : "options");
      return value && ts.isJsxExpression(value) && value.expression && ts.isObjectLiteralExpression(value.expression) ? value.expression : undefined;
    };
    const property = (object, name) => object?.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText() === name)?.initializer;
    const roots = stack.children.filter(node => ts.isJsxSelfClosingElement(node) && tag(node) === "Stack.Screen" && literalAttribute(node, "name") === "index");
    if (roots.length !== 1) return false;
    const globalOptions = objectOptions(stack.openingElement);
    const localOptions = objectOptions(roots[0]);
    const safeOptions = object => !object || (!object.properties.some(ts.isSpreadAssignment) && ["headerRight", "headerShown"].every(name =>
      object.properties.filter(node => ts.isPropertyAssignment(node) && node.name.getText() === name).length <= 1));
    if (!safeOptions(globalOptions) || !safeOptions(localOptions)) return false;
    const localShown = property(localOptions, "headerShown");
    const shown = localShown ?? property(globalOptions, "headerShown");
    if (shown?.kind === ts.SyntaxKind.FalseKeyword) return false;
    const right = property(localOptions, "headerRight") ?? property(globalOptions, "headerRight");
    if (!right || (!ts.isArrowFunction(right) && !ts.isFunctionExpression(right))) return false;
    const expressions = ts.isBlock(right.body) ? right.body.statements.filter(ts.isReturnStatement).map(node => node.expression).filter(Boolean) : [right.body];
    const direct = imported(ast, ["@/components/UrgeSupportButton"], "UrgeSupportButton") && expressions.some(expression => renderedJsx(expression, "UrgeSupportButton"));
    const shared = imported(ast, ["@/components/RootToolbarActions"], "RootToolbarActions") && toolbarHasSupport && expressions.some(expression => renderedJsx(expression, "RootToolbarActions"));
    return direct || shared;
  });
  const noAdRoute = !calls.some(call => ts.isIdentifier(call.expression) && (
    (call.expression.text === "setScreen" && call.arguments[0] && ts.isStringLiteral(call.arguments[0]) && call.arguments[0].text === "ad") ||
    /Rewarded|showAd|startAd/.test(call.expression.text)
  ));
  return { tabsNamed, urgeSupportWired: Boolean(trustedController && consumesControllerAction && namedAction && createsAttempt && setsAttempt && opensIntercept && noAdRoute && exportedAction && interceptRoutable && everyHeaderHasSupport) };
}

const appSurface = read("src/features/freed-app.tsx");
const premiumOffer = read("src/components/PremiumOffer.tsx");
const protectionSetupView = read("src/components/ProtectionSetupView.tsx");
const nativeAccessibility = inspectNativeAccessibilitySources({
  tabs: read("app/(tabs)/_layout.tsx"),
  urgeSupport: read("src/components/UrgeSupportButton.tsx"),
  rootToolbar: read("src/components/RootToolbarActions.tsx"),
  controller: appSurface,
  navigation: read("src/lib/native-navigation.ts"),
  tabStacks: ["today", "shield", "progress", "profile"].map((tab) => read(`app/(tabs)/${tab}/_layout.tsx`))
});

const checks = [
  check(
    "shared-pill-buttons-are-named",
    appSurface.includes('accessibilityRole="button"') &&
      appSurface.includes("accessibilityLabel={accessibilityLabel ?? label}") &&
      appSurface.includes("accessibilityState={{ disabled: Boolean(disabled) }}"),
    "Shared pill buttons expose button role, label text, and disabled state."
  ),
  check(
    "onboarding-choices-are-radios",
    inspectQuizAccessibilitySource(appSurface),
    "Onboarding answer choices expose radio semantics and selected state."
  ),
  check(
    "paywall-plans-are-named-radios",
    inspectPremiumOfferAccessibilitySource(premiumOffer),
    "Extracted Premium offer choices expose plan name, actual price, hint, checked/selected state, and busy state."
  ),
  check(
    "bottom-navigation-tabs-are-named",
    nativeAccessibility.tabsNamed,
    "NativeTabs registers exactly Today, Protect, Progress and Profile with visible labels; runtime OS accessibility remains to verify."
  ),
  check(
    "panic-action-is-explicit",
    nativeAccessibility.urgeSupportWired,
    "Every root header exposes a named SOS button bound through the controller to the supported interception route; runtime operation remains to verify."
  ),
  check(
    "icon-only-controls-have-purpose",
    appSurface.includes('accessibilityLabel="Go back"') &&
      premiumOffer.includes('accessibilityLabel="Close Premium offer and continue with Free"'),
    "Key icon-only onboarding and paywall controls expose spoken labels."
  ),
  check(
    "shared-setup-action-and-progress-are-named",
    appSurface.includes("onContinue={handleAndroidWizardPrimary}") &&
      protectionSetupView.includes("accessibilityLabel={presentation.action}") &&
      protectionSetupView.includes("accessibilityState={{ disabled: busy, busy }}") &&
      protectionSetupView.includes('accessibilityRole="progressbar"') &&
      protectionSetupView.includes("accessibilityValue={{ min: 0, max: presentation.total, now: presentation.stage }}"),
    "The shared setup action exposes its current purpose and busy state; progress exposes its range and current step."
  )
];

function inspectQuizAccessibilitySource(source) {
  const ast = ts.createSourceFile("quiz.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (ast.parseDiagnostics.length) return false;
  const quiz = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "QuizScreen");
  if (!quiz?.body) return false;
  const candidates = [];
  const visit = node => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && node.tagName.getText(ast) === "Pressable") {
      let ancestor = node.parent;
      while (ancestor && ancestor !== quiz.body) {
        if (ts.isArrowFunction(ancestor) && ts.isCallExpression(ancestor.parent) && ts.isPropertyAccessExpression(ancestor.parent.expression) && ancestor.parent.expression.name.text === "map") {
          const option = ancestor.parameters[0]?.name;
          if (option && ts.isIdentifier(option)) candidates.push({ opening: node, callback: ancestor, option: option.text });
          break;
        }
        ancestor = ancestor.parent;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(quiz.body);
  const attribute = (opening, name) => opening.attributes.properties.find(property => ts.isJsxAttribute(property) && property.name.getText(ast) === name)?.initializer;
  return candidates.length > 0 && candidates.every(({ opening, callback, option }) => {
    const role = attribute(opening, "accessibilityRole");
    const label = attribute(opening, "accessibilityLabel");
    const state = attribute(opening, "accessibilityState");
    if (!role || !ts.isStringLiteral(role) || role.text !== "radio" || !label || !ts.isJsxExpression(label) || !label.expression || !ts.isIdentifier(label.expression) || label.expression.text !== option || !state || !ts.isJsxExpression(state) || !state.expression || !ts.isObjectLiteralExpression(state.expression) || state.expression.properties.some(ts.isSpreadAssignment)) return false;
    const selected = state.expression.properties.find(property => (ts.isShorthandPropertyAssignment(property) || ts.isPropertyAssignment(property)) && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) && property.name.text === "selected");
    if (!selected) return false;
    let value = ts.isShorthandPropertyAssignment(selected) ? selected.name : selected.initializer;
    if (ts.isIdentifier(value)) {
      const declarations = [];
      const resolve = node => { if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === value.text && node.initializer) declarations.push(node.initializer); ts.forEachChild(node, resolve); };
      resolve(callback.body);
      if (declarations.length !== 1) return false;
      value = declarations[0];
    }
    return ts.isBinaryExpression(value) && value.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken && [value.left, value.right].some(operand => ts.isIdentifier(operand) && operand.text === option);
  });
}
function inspectPremiumOfferAccessibilitySource(source) {
  const ast = ts.createSourceFile("premium.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (ast.parseDiagnostics.length) return false;
  const offer = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "PremiumOffer");
  if (!offer?.body) return false;
  const find = (node, predicate) => { const result = []; const walk = child => { if (predicate(child)) result.push(child); ts.forEachChild(child, walk); }; walk(node); return result; };
  const imported = (moduleName, name) => ast.statements.some(node => ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier) &&
    node.moduleSpecifier.text === moduleName && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => !item.isTypeOnly && item.name.text === name && (item.propertyName?.text ?? item.name.text) === name)) &&
    !find(ast, node => (ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === name).length;
  if (!imported("@/i18n/runtime", "translateSource") || !imported("@/components/Localized", "Pressable") || !imported("@/components/Localized", "Text")) return false;
  const attr = (opening, name) => opening.attributes.properties.find(item => ts.isJsxAttribute(item) && item.name.getText(ast) === name)?.initializer;
  const expr = value => value && ts.isJsxExpression(value) ? value.expression : undefined;
  const compact = node => node?.getText(ast).replace(/\s+/g, "") ?? "";
  const id = (node, value) => Boolean(node && ts.isIdentifier(node) && node.text === value);
  const member = (node, owner, name) => Boolean(node && ts.isPropertyAccessExpression(node) && id(node.expression, owner) && node.name.text === name);
  const translated = (node, owner, name) => Boolean(node && ts.isCallExpression(node) && id(node.expression, "translateSource") && node.arguments.length === 1 && member(node.arguments[0], owner, name));
  const property = (object, key) => object && ts.isObjectLiteralExpression(object) && !object.properties.some(ts.isSpreadAssignment)
    ? object.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(ast) === key)?.initializer ?? object.properties.find(node => ts.isShorthandPropertyAssignment(node) && node.name.text === key)?.name : undefined;
  const openings = node => find(node, value => ts.isJsxOpeningElement(value) || ts.isJsxSelfClosingElement(value));
  const literal = (node, value) => Boolean(node && ts.isStringLiteral(node) && node.text === value);
  const maps = find(offer.body, node => ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && id(node.expression.expression, "plans") && node.expression.name.text === "map" && node.arguments[0] && ts.isArrowFunction(node.arguments[0]));
  if (maps.length !== 1) return false;
  const callback = maps[0].arguments[0];
  const plan = callback.parameters[0]?.name;
  if (!plan || !ts.isIdentifier(plan)) return false;
  const declarations = find(callback.body, ts.isVariableDeclaration);
  const presentation = declarations.find(node => node.initializer && member(node.initializer, plan.text, "presentation"));
  const selected = declarations.find(node => node.initializer && compact(node.initializer) === `${plan.text}.id===selectedPlan`);
  if (!presentation || !ts.isIdentifier(presentation.name) || !selected || !ts.isIdentifier(selected.name)) return false;
  const p = presentation.name.text; const selectedName = selected.name.text;
  const returned = ts.isBlock(callback.body) ? callback.body.statements.filter(ts.isReturnStatement).map(node => node.expression).filter(Boolean) : [callback.body];
  const radio = returned.flatMap(openings).filter(opening => opening.tagName.getText(ast) === "Pressable" && literal(attr(opening, "accessibilityRole"), "radio"));
  if (radio.length !== 1) return false;
  const choice = radio[0]; const label = expr(attr(choice, "accessibilityLabel"));
  if (!label || !ts.isTemplateExpression(label) || label.templateSpans.length !== 3 || !translated(label.templateSpans[0].expression, plan.text, "label")) return false;
  const price = label.templateSpans[1].expression;
  if (!ts.isConditionalExpression(price) || !member(price.condition, p, "pricing") || !member(price.whenTrue, p, "headline") || !translated(price.whenFalse, p, "headline")) return false;
  const period = label.templateSpans[2].expression;
  if (!ts.isConditionalExpression(period) || !member(period.condition, p, "cadence") || !ts.isTemplateExpression(period.whenTrue) || period.whenTrue.templateSpans.length !== 1 ||
    !translated(period.whenTrue.templateSpans[0].expression, p, "cadence") || !literal(period.whenFalse, "")) return false;
  const state = expr(attr(choice, "accessibilityState"));
  if (!id(property(state, "checked"), selectedName) || !id(property(state, "selected"), selectedName) || !id(property(state, "disabled"), "busy") || !id(expr(attr(choice, "disabled")), "busy") ||
    compact(expr(attr(choice, "accessibilityHint"))) !== `${p}.detail??undefined` || compact(expr(attr(choice, "onPress"))) !== `()=>onSelectPlan(${plan.text}.id)`) return false;
  const texts = returned.flatMap(node => find(node, child => ts.isJsxElement(child) && child.openingElement.tagName.getText(ast) === "Text"));
  const directChild = (node, owner, name) => node.children.some(child => ts.isJsxExpression(child) && member(child.expression, owner, name));
  if (!texts.some(node => directChild(node, p, "headline") && compact(expr(attr(node.openingElement, "translate"))) === `!${p}.pricing`) || !texts.some(node => directChild(node, p, "cadence"))) return false;
  const ready = find(offer.body, node => ts.isVariableDeclaration(node) && id(node.name, "canSubscribe"))[0];
  if (compact(ready?.initializer) !== 'priceStatus==="ready"&&selectedPresentation?.canPurchase===true') return false;
  const actionLabel = find(offer.body, node => ts.isVariableDeclaration(node) && id(node.name, "primaryActionLabel"))[0];
  const primary = actionLabel && find(actionLabel.initializer, node => ts.isCallExpression(node) && id(node.expression, "t") && literal(node.arguments[0], "Subscribe · {{price}} {{cadence}}"))[0];
  if (!primary || compact(property(primary.arguments[1], "price")) !== "selectedPresentation.pricing.headline" || compact(property(primary.arguments[1], "cadence")) !== "translateSource(selectedPresentation.pricing.cadence)") return false;
  const allOpenings = openings(offer.body);
  const checkout = allOpenings.find(node => node.tagName.getText(ast) === "Pressable" && literal(attr(node, "testID"), "paywall-subscribe"));
  if (!checkout || !literal(attr(checkout, "accessibilityRole"), "button") || !id(expr(attr(checkout, "accessibilityLabel")), "primaryActionLabel") ||
    compact(property(expr(attr(checkout, "accessibilityState")), "disabled")) !== "busy||!canSubscribe" || !id(property(expr(attr(checkout, "accessibilityState")), "busy"), "busy") ||
    compact(expr(attr(checkout, "disabled"))) !== "busy||!canSubscribe" || compact(expr(attr(checkout, "onPress"))) !== "()=>{if(!busy&&canSubscribe)onSubscribe();}") return false;
  const footer = find(offer.body, node => ts.isVariableDeclaration(node) && id(node.name, "footer"))[0];
  if (!footer?.initializer) return false;
  const mainReturn = offer.body.statements.find(ts.isReturnStatement);
  let root = mainReturn?.expression;
  while (root && ts.isParenthesizedExpression(root)) root = root.expression;
  // Core actions must render unconditionally beside the scroll body. Dead locals
  // and a footer hidden behind a conditional are not proof of pinned actions.
  const pinned = root && ts.isJsxElement(root) && root.children.some(node => ts.isJsxExpression(node) && id(node.expression, "footer"));
  if (!pinned || !openings(footer.initializer).includes(checkout)) return false;
  const renewal = find(offer.body, node => ts.isVariableDeclaration(node) && id(node.name, "renewalTerms"))[0];
  if (!renewal?.initializer || !ts.isJsxElement(renewal.initializer) || renewal.initializer.openingElement.tagName.getText(ast) !== "Text" ||
    !renewal.initializer.children.some(node => ts.isJsxExpression(node) && id(node.expression, "terms"))) return false;
  const rendered = node => {
    if (!node) return [];
    if (ts.isJsxElement(node) || ts.isJsxFragment(node)) return [node, ...node.children.flatMap(rendered)];
    if (ts.isJsxExpression(node) || ts.isParenthesizedExpression(node)) return rendered(node.expression);
    if (ts.isConditionalExpression(node)) {
      if (node.condition.kind === ts.SyntaxKind.FalseKeyword) return rendered(node.whenFalse);
      if (node.condition.kind === ts.SyntaxKind.TrueKeyword) return rendered(node.whenTrue);
      return [node, ...rendered(node.whenTrue), ...rendered(node.whenFalse)];
    }
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      return node.left.kind === ts.SyntaxKind.FalseKeyword ? [] : rendered(node.right);
    return [node];
  };
  const termsAt = (nodes, condition) => nodes.some(node => ts.isConditionalExpression(node) && compact(node.condition) === condition &&
    id(node.whenTrue, "renewalTerms") && node.whenFalse.kind === ts.SyntaxKind.NullKeyword);
  // Large text moves the full unchanged disclosure into the body; the complementary
  // small-text branch keeps it by checkout. Neither branch may silently omit it.
  const bodies = root.children.filter(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === "ScrollView");
  return termsAt(rendered(footer.initializer), "!largeText") && bodies.some(body => termsAt(rendered(body), "largeText"));
}
module.exports = { inspectNativeAccessibilitySources, inspectQuizAccessibilitySource, inspectPremiumOfferAccessibilitySource };

if (require.main === module) {
const failed = checks.filter((entry) => entry.status === "fail");

console.log("# FREED accessibility safety audit");
console.log(`Result: ${checks.length - failed.length} pass, ${failed.length} fail`);
console.log("");
console.log("| Status | Gate | Evidence |");
console.log("| --- | --- | --- |");
for (const entry of checks) {
  console.log(`| ${entry.status.toUpperCase()} | ${entry.id} | ${entry.evidence.replace(/\|/g, "/")} |`);
}

if (failed.length > 0) {
  process.exitCode = 1;
}
}
