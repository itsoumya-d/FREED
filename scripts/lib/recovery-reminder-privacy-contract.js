const ts = require('typescript');

function inspectRecoveryReminderPrivacySources({ reminders, hook, controller }) {
  const parse = (name, source) => ts.createSourceFile(name, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const ast = parse('recovery-reminders.ts', reminders);
  const hookAst = parse('use-recovery-reminders.ts', hook);
  const controllerAst = parse('recovery-reminder-controller.ts', controller);
  if ([ast, hookAst, controllerAst].some(file => file.parseDiagnostics.length)) return false;
  const compact = (node, file) => node.getText(file).replace(/\s+/g, '');
  const propertyName = node => ts.isIdentifier(node) || ts.isStringLiteral(node) ? node.text : null;
  const properties = object => {
    if (!ts.isObjectLiteralExpression(object)) return null;
    const entries = object.properties.filter(ts.isPropertyAssignment);
    if (entries.length !== object.properties.length) return null;
    const names = entries.map(entry => propertyName(entry.name));
    if (names.some(name => !name) || new Set(names).size !== names.length) return null;
    return Object.fromEntries(entries.map((entry, index) => [names[index], entry.initializer]));
  };
  const calls = [], ownerGetters = [], syncCalls = [], ownerKeys = [];
  let sensitiveCopy = false;
  const walk = (node, visit) => { visit(node); ts.forEachChild(node, child => walk(child, visit)); };
  walk(ast, node => {
    if ((ts.isStringLiteralLike(node) || [ts.SyntaxKind.TemplateHead, ts.SyntaxKind.TemplateMiddle, ts.SyntaxKind.TemplateTail].includes(node.kind)) && /porn|adult|nsfw|explicit/i.test(node.text)) sensitiveCopy = true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'scheduleNotificationAsync') calls.push(node);
  });
  if (sensitiveCopy || calls.length !== 2) return false;
  let scheduled = 0, test = 0;
  for (const call of calls) {
    if (compact(call.expression, ast) !== 'notifications.scheduleNotificationAsync' || call.arguments.length !== 1) return false;
    const request = properties(call.arguments[0]);
    const content = request?.content && properties(request.content);
    const data = content?.data;
    if (!data || !ts.isObjectLiteralExpression(data)) return false;
    const entries = data.properties.filter(ts.isPropertyAssignment);
    const names = entries.map(entry => propertyName(entry.name));
    if (names.some(name => !name) || new Set(names).size !== names.length) return false;
    const values = Object.fromEntries(entries.map((entry, index) => [names[index], entry.initializer]));
    if (!values.route || !ts.isStringLiteral(values.route) || values.route.text !== 'checkin' || !values.freedReminderVersion || !ts.isNumericLiteral(values.freedReminderVersion) || values.freedReminderVersion.text !== '2') return false;
    const spreads = data.properties.filter(ts.isSpreadAssignment);
    if (entries.length + spreads.length !== data.properties.length) return false;
    if (compact(values.kind || data, ast) === 'item.key') {
      scheduled++;
      if (names.sort().join(',') !== 'freedReminderVersion,kind,reminderTimezone,route' || compact(values.reminderTimezone, ast) !== 'timezone' || spreads.length !== 1) return false;
      let conditional = spreads[0].expression;
      while (ts.isParenthesizedExpression(conditional)) conditional = conditional.expression;
      if (!ts.isConditionalExpression(conditional) || compact(conditional.condition, ast) !== 'options?.ownerKey') return false;
      const owned = properties(conditional.whenTrue), empty = properties(conditional.whenFalse);
      if (!owned || !empty || Object.keys(empty).length || Object.keys(owned).sort().join(',') !== 'reminderOwnerKey,reminderRevision') return false;
      if (compact(owned.reminderOwnerKey, ast) !== 'options.ownerKey' || compact(owned.reminderRevision, ast) !== 'preferences.revision') return false;
    } else if (values.kind && ts.isStringLiteral(values.kind) && values.kind.text === 'test') {
      test++;
      if (names.sort().join(',') !== 'freedReminderVersion,kind,route' || spreads.length) return false;
    } else return false;
  }
  walk(hookAst, node => {
    if (ts.isPropertyAssignment(node) && propertyName(node.name) === 'getOwnerKey') ownerGetters.push(node.initializer);
  });
  const getter = ownerGetters[0];
  if (scheduled !== 1 || test !== 1 || ownerGetters.length !== 1 || !ts.isArrowFunction(getter) || getter.parameters.length !== 1 || getter.parameters[0].name.getText(hookAst) !== 'ownerId' || !ts.isBlock(getter.body)) return false;
  const statements = getter.body.statements;
  if (statements.length !== 2 || compact(statements[0], hookAst) !== "constCrypto=require('expo-crypto')astypeofimport('expo-crypto');" || compact(statements[1], hookAst) !== 'returnCrypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,`freed-reminder-owner-v1:${ownerId}`);') return false;
  walk(controllerAst, node => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ownerKey') ownerKeys.push(node.initializer);
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'syncRecoveryReminders') syncCalls.push(node);
  });
  const trustedSyncImport = controllerAst.statements.some(node => ts.isImportDeclaration(node) && node.moduleSpecifier.text === '@/lib/recovery-reminders' && node.importClause?.namedBindings && ts.isNamedImports(node.importClause.namedBindings) && node.importClause.namedBindings.elements.some(item => item.name.text === 'syncRecoveryReminders' && !item.propertyName && !item.isTypeOnly));
  return trustedSyncImport && ownerKeys.length === 1 && ownerKeys[0] && compact(ownerKeys[0], controllerAst) === 'context.ownerId&&dependencies.getOwnerKey?awaitdependencies.getOwnerKey(context.ownerId):dependencies.options?.ownerKey'
    && syncCalls.length === 1 && syncCalls[0].arguments.length === 2 && compact(syncCalls[0].arguments[1], controllerAst) === '{...dependencies.options,ownerKey,requestPermission,timezone,forceReplace:forceOwnerReplacement,isCurrent}';
}

module.exports = { inspectRecoveryReminderPrivacySources };
