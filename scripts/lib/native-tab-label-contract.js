const ts = require('typescript');

/** Source precheck for our route/label boundary, not proof of OS accessibility. */
function inspectNativeTabLabels(source) {
  const ast = ts.createSourceFile('tabs.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  if (ast.parseDiagnostics.length) return null;
  const find = predicate => {
    const result = [];
    const visit = node => { if (predicate(node)) result.push(node); ts.forEachChild(node, visit); };
    visit(ast);
    return result;
  };
  const importsBinding = (moduleName, bindingName) => ast.statements.some(node =>
    ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly && ts.isStringLiteral(node.moduleSpecifier) && node.moduleSpecifier.text === moduleName &&
    node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) &&
    node.importClause.namedBindings.elements.some(item => !item.isTypeOnly && item.name.text === bindingName && (item.propertyName?.text ?? item.name.text) === bindingName));
  const shadowsBinding = name => find(node =>
    ((ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node) || ts.isBindingElement(node)) && node.name && ts.isIdentifier(node.name) && node.name.text === name)).length > 0;
  if (!importsBinding('expo-router/unstable-native-tabs', 'NativeTabs') || shadowsBinding('NativeTabs')) return null;
  const trustedTranslator = importsBinding('@/i18n/runtime', 'translateSource') && !shadowsBinding('translateSource');
  const text = node => {
    if (ts.isJsxText(node)) return node.text.trim();
    if (!trustedTranslator || !ts.isJsxExpression(node) || !node.expression) return null;
    const call = node.expression;
    return ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === 'translateSource' &&
      call.arguments.length === 1 && ts.isStringLiteral(call.arguments[0]) ? call.arguments[0].text : null;
  };
  const triggers = find(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'NativeTabs.Trigger');
  const roots = [];
  for (const trigger of triggers) {
    const names = trigger.openingElement.attributes.properties.filter(property => ts.isJsxAttribute(property) && property.name.getText(ast) === 'name');
    const labels = trigger.children.filter(node => ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'NativeTabs.Trigger.Label');
    if (names.length !== 1 || !names[0].initializer || !ts.isStringLiteral(names[0].initializer) || labels.length !== 1) return null;
    const children = labels[0].children.filter(node => !ts.isJsxText(node) || node.text.trim());
    if (children.length !== 1) return null;
    const label = text(children[0]);
    if (!label) return null;
    roots.push({ id: names[0].initializer.text, label });
  }
  return roots;
}

module.exports = { inspectNativeTabLabels };
