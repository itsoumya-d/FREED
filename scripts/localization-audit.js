#!/usr/bin/env node
'use strict';

// Read-only inventory. This deliberately distinguishes resource integrity from
// translation coverage: matching resource keys alone never implies a localized app.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const ROOT = path.resolve(__dirname, '..');
const LOCALES = ['en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'];
const SOURCE_FILES = [
  'src/i18n/native-ios-content-blocker-catalog.json', 'src/i18n/native-ios-notification-catalog.json', 'src/i18n/native-android-catalog.json', 'src/features/freed-app.tsx', 'src/features/legal-pages.tsx', 'src/features/library-screen.tsx',
  'src/design-system/navigation.ts', 'src/data/library-articles.ts',
  'src/data/challenge-templates.ts', 'src/data/momentum-resets.ts', 'src/lib/challenge-generator.ts', 'src/lib/challenge-verification.ts',
  'src/lib/protection-setup-presenter.ts', 'src/lib/protection-permissions.ts', 'src/lib/protection-capabilities.ts',
  'src/lib/paywall-presenter.ts', 'src/lib/store-pricing.ts',
  'src/lib/dns-guard-health.ts', 'src/lib/account-access-flow.ts',
  'src/lib/social-login.ts', 'src/lib/social-login-presenter.ts',
  'src/lib/recovery-engine.ts', 'src/lib/ai-coach.ts', 'src/lib/user-facing-error.ts',
  'src/lib/firebase-native.ts', 'src/lib/firebase-client.ts',
  'src/lib/challenge-capability.ts', 'src/lib/automatic-backup.ts',
  'src/hooks/use-recovery-draft.ts', 'src/features/use-review-access.ts', 'src/features/use-guided-reset-access.ts',
  'src/lib/feature-catalogue.ts', 'src/lib/practice-definitions.ts', 'src/lib/app-guard.ts', 'src/lib/guided-reset-access.ts', 'src/lib/review-access.ts',
  'src/lib/purchase-verification.ts', 'functions/src/ai.ts'
];
// Native strings enter the existing exact-English bridge when surfaced by the
// app. Scan only authored output fields and their message helpers, rather than
// package IDs, network constants, selector labels or diagnostic issue codes.
const NATIVE_SOURCE_FILES = [
  'ios/FREEDSafariContentBlocker/ContentBlockerRequestHandler.swift', 'ios/FREEDSafariFocusShield/SafariWebExtensionHandler.swift', 'ios/FREEDShieldAction/ShieldActionExtension.swift', 'modules/freed-protection/ios/FreedProtectionModule.swift',
  'modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt',
  'modules/freed-protection/android/src/main/java/app/freed/protection/FreedDnsGuardPolicy.kt',
  ...['FreedAccessibilityService.kt','FreedVpnService.kt','FreedInterventionActivity.kt','FreedUsageAccessConfigActivity.kt','FreedFocusShieldCalibration.kt','FreedNativeCompanion.kt'].map(file => `modules/freed-protection/android/src/main/java/app/freed/protection/${file}`)
];
const COPY_PROPERTIES = new Set(['title', 'description', 'instruction', 'action', 'label', 'detail', 'subtitle', 'summary', 'why', 'reason', 'message', 'notice', 'headline', 'intro', 'eyebrow', 'tag', 'compactLabel', 'accessibilityLabel', 'accessibilityHint', 'placeholder', 'purpose', 'keywords', 'searchKeywords', 'actionLabel']);
const JSX_COPY_PROPERTIES = new Set(['label', 'title', 'description', 'placeholder', 'accessibilityLabel', 'accessibilityHint', 'eyebrow', 'intro', 'hint', 'sections', 'actions', 'stages', 'benefits', 'options']);
// Unchanged values are allowed only when they are established names or valid
// shared spellings, never for paragraphs or generic untranslated English copy.
const SHARED_VALUES = new Set(['FREED', 'FREED Premium', 'FREED Protection', 'FREED DNS Guard', 'DNS Guard', 'CLARA', 'Focus Shield', 'Google', 'Apple', 'Apple ID', 'Android', 'iOS', 'Safari', 'OISD NSFW Small', 'OK', 'PDF', 'Wi-Fi']);
const SHARED_BY_LOCALE = {es: new Set(['Email', 'General']), de: new Set(['System']), fr: new Set(['Protection'])};
function normalized(value) { return value.replace(/\s+/g, ' ').trim(); }
function templateSignature(value) { return normalized(value).replace(/{{\s*[\w.]+\s*}}/g, '{{}}'); }
function placeholders(value) { return [...value.matchAll(/{{\s*([\w.]+)\s*}}/g)].map(match => match[1]).sort(); }
function flatten(value, prefix = '', result = {}) {
  for (const [key, child] of Object.entries(value)) {
    const next = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result[next] = child;
    else if (child && typeof child === 'object' && !Array.isArray(child)) flatten(child, next, result);
    else result[next] = child;
  }
  return result;
}
function allSourceFiles(root = ROOT) {
  const componentDir = path.join(root, 'src/components');
  const components = fs.existsSync(componentDir) ? fs.readdirSync(componentDir).filter(file => /\.tsx$/.test(file)).map(file => `src/components/${file}`) : [];
  return [...new Set([...SOURCE_FILES, ...NATIVE_SOURCE_FILES, ...components])].filter(file => fs.existsSync(path.join(root, file)));
}

// Photo rule IDs remain stable code values. Only their use in the authored
// display templates makes these nouns copy; expand that finite catalog so a
// translated wrapper cannot conceal an English object name.
function photoTargetDisplayIds(root) {
  const file = path.join(root, 'src/lib/challenge-rules.ts');
  if (!fs.existsSync(file)) return [];
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  let ids = [];
  function visit(node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'LOCAL_PHOTO_TARGETS') {
      let value = node.initializer;
      while (value && (ts.isAsExpression(value) || ts.isSatisfiesExpression(value) || ts.isParenthesizedExpression(value))) value = value.expression;
      if (value && ts.isObjectLiteralExpression(value)) ids = value.properties.filter(ts.isPropertyAssignment).map(item =>
        ts.isIdentifier(item.name) || ts.isStringLiteral(item.name) ? item.name.text : null).filter(Boolean);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return ids;
}

function nativeExpressionEnd(text, start) {
  const stack = [];
  for (let index = start; index < text.length; index++) {
    const char = text[index];
    if (char === '"') { index = nativeString(text, index).end - 1; continue; }
    if (text.startsWith('//', index)) { index = text.indexOf('\n', index); if (index < 0) return text.length; continue; }
    if (text.startsWith('/*', index)) { const end = text.indexOf('*/', index + 2); index = end < 0 ? text.length : end + 1; continue; }
    if ('([{'.includes(char)) stack.push(char);
    else if (')]}'.includes(char)) { if (!stack.length) return index; stack.pop(); }
    else if (char === ',' && !stack.length) return index;
    else if (char === '\n' && !stack.length && !/^[\s]*(?:[?:]|else\b)/.test(text.slice(index + 1))) return index;
  }
  return text.length;
}

function nativeString(text, start) {
  let value = '', index = start + 1, interpolationIndex = 0;
  const alternatives = [], nested = [];
  while (index < text.length && text[index] !== '"') {
    const swift = text.startsWith('\\(', index), kotlin = text.startsWith('${', index);
    if (swift || kotlin) {
      const opening = swift ? '(' : '{', closing = swift ? ')' : '}';
      let cursor = index + 2, depth = 1;
      while (cursor < text.length && depth) {
        if (text[cursor] === '"') { const child = nativeString(text, cursor); nested.push(child, ...child.nested); cursor = child.end; continue; }
        if (text[cursor] === opening) depth++;
        if (text[cursor] === closing) depth--;
        cursor++;
      }
      const expression = text.slice(index + 2, cursor - 1).trim();
      interpolationIndex++;
      // Native count suffixes have only two literal outcomes. Inventory both
      // rendered forms so singular messages do not depend on an empty capture.
      if (/^if\s*\([^)]*==\s*1\)\s*""\s*else\s*"s"$/.test(expression)) {
        const marker = `\u0000plural${interpolationIndex}\u0000`;
        value += marker; alternatives.push(marker);
      } else {
        let name = /^[A-Za-z_]\w*$/.test(expression) ? expression
          : /^(?:error|safariStateError)\b/.test(expression) ? 'error'
          : /\.size\b/.test(expression) ? 'count'
          : `value${interpolationIndex}`;
        value += `{{${name}}}`;
      }
      index = cursor; continue;
    }
    if (text[index] === '$' && /^[A-Za-z_]/.test(text[index + 1] || '')) {
      const name = text.slice(index + 1).match(/^[A-Za-z_]\w*/)[0];
      value += `{{${name}}}`; index += name.length + 1; continue;
    }
    if (text[index] === '\\') {
      const escaped = text[index + 1];
      value += ({n:'\n',r:'\r',t:'\t'}[escaped] ?? escaped ?? ''); index += 2; continue;
    }
    value += text[index++];
  }
  let values = [value];
  for (const marker of alternatives) values = values.flatMap(item => [item.replace(marker, ''), item.replace(marker, 's')]);
  return {start, end: Math.min(index + 1, text.length), values, nested};
}

function collectNativePhrases(file, text, resourceSources = {}) {
  const ranges = [], strings = [];
  // Blank comments without changing positions. Literal contents are skipped by
  // the lexer below, so output-looking words inside strings are not selectors.
  let code = text.split('');
  for (let index = 0; index < text.length; index++) {
    if (text[index] === '"') { const token = nativeString(text, index); strings.push(token, ...token.nested); index = token.end - 1; continue; }
    if (text.startsWith('//', index) || text.startsWith('/*', index)) {
      const block = text[index + 1] === '*';
      const end = block ? text.indexOf('*/', index + 2) : text.indexOf('\n', index + 2);
      const stop = end < 0 ? text.length : end + (block ? 2 : 0);
      for (let cursor = index; cursor < stop; cursor++) if (code[cursor] !== '\n') code[cursor] = ' ';
      index = stop - 1;
    }
  }
  code = code.join('');
  const selectors = /\b(?:message|primaryMessage|fallbackMessage|errorMessage|text|title|description|contentDescription|reason)\s*[:=]|"(?:message|notes)"\s*(?::|to\b)|\b(?:makeFreedError|setContentTitle|setContentText|bigText|setTitle|setMessage)\s*\(/g;
  for (const match of code.matchAll(selectors)) {
    if (strings.some(token => match.index > token.start && match.index < token.end)) continue;
    const start = match.index + match[0].length;
    ranges.push({start, end: nativeExpressionEnd(code, start)});
  }
  // These small helpers return authored text used by the fields above.
  const helpers = /\b(?:func|fun)\s+(?:earnedUnlockMessage|protectionStatusMessage|message)\s*\(/g;
  for (const match of code.matchAll(helpers)) {
    const body = code.indexOf('{', match.index);
    if (body >= 0) ranges.push({start: body, end: nativeExpressionEnd(code, body)});
  }
  // Readable Safari routing errors are propagated to status output. Android
  // route error fallbacks are readable; action IDs and platform error payloads
  // are external diagnostic values and are not authored translations.
  for (const match of code.matchAll(/\berror\s*:\s*|\blastError\s*\?:\s*(?=")/g)) {
    ranges.push({start: match.index + match[0].length, end: nativeExpressionEnd(code, match.index + match[0].length)});
  }
  const literalCopy = strings.filter(token => ranges.some(range => token.start >= range.start && token.end <= range.end) || file.endsWith('FreedFocusShieldCalibration.kt'))
    .flatMap(token => token.values.flatMap(value => value.endsWith('{{privateDnsNote}}') ? [value, value.replace('{{privateDnsNote}}', '')] : [value]).filter(isNaturalLanguage).map(source => ({source: normalized(source), occurrences: [{file, line: text.slice(0, token.start).split('\n').length, kind: source.includes('{{') ? 'template-candidate' : 'native-output', surface: 'native-user-facing-output'}]})));
  const resourceCopy = [...text.matchAll(/\bR\.string\.([a-zA-Z_0-9]+)/g)].filter(match => resourceSources[match[1]]).map(match => ({
    source: resourceSources[match[1]], occurrences: [{file, line: text.slice(0,match.index).split('\n').length, kind: 'native-resource', surface: 'native-user-facing-output'}]
  }));
  return [...literalCopy, ...resourceCopy];
}
function isNaturalLanguage(value) {
  if (/^Bearer\s+{{[^}]+}}$/.test(normalized(value))) return false;
  const trimmed = normalized(value).replace(/{{\s*[\w.]+\s*}}/g, '');
  if (!/[A-Za-z]/.test(trimmed) || trimmed.length < 2) return false;
  if (/^(?:https?:|mailto:|@\/|\.\/|\.\.\/)/.test(trimmed)) return false;
  if (/^(?:#[a-f\d]+|rgba?\(|\d+%|[A-Z_]+_MS$)/i.test(trimmed)) return false;
  if (/^[Mm]\s*-?\d[\d\s.,MmLlCcHhVvSsQqTtAaZz-]+$/.test(trimmed)) return false;
  if (/^[\w.-]+@[\w.-]+\.[A-Za-z]+$/.test(trimmed)) return false;
  if (/^[a-z\d]+(?:[._/-][a-z\d]+)+$/.test(trimmed)) return false;
  return /\s/.test(trimmed) || /^[A-Z][a-z]+$/.test(trimmed) || /^[A-Z]{2,24}$/.test(trimmed);
}
function templateSource(node, source) {
  let text = node.head.text;
  const used = new Set();
  node.templateSpans.forEach((span, index) => {
    const expression = span.expression;
    let name = ts.isIdentifier(expression) ? expression.text : ts.isPropertyAccessExpression(expression) ? expression.name.text : `value${index+1}`;
    if (name === 'length') name = 'count';
    if (used.has(name)) name += index+1;
    used.add(name);
    text += `{{${name}}}${span.literal.text}`;
  });
  return text;
}
function declarationReachability(source) {
  const declarations = new Map(), roots = [];
  for (const statement of source.statements) {
    const names = ts.isFunctionDeclaration(statement) && statement.name ? [statement.name.text]
      : ts.isVariableStatement(statement) ? statement.declarationList.declarations.flatMap(item => ts.isIdentifier(item.name) ? [item.name.text] : []) : [];
    for (const name of names) declarations.set(name, statement);
    if (statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)) roots.push(...names);
  }
  const reached = new Set(), visitQueue = [...roots];
  while (visitQueue.length) {
    const name = visitQueue.pop();
    if (reached.has(name)) continue;
    reached.add(name);
    const declaration = declarations.get(name);
    if (!declaration) continue;
    function references(node) {
      if (ts.isIdentifier(node) && declarations.has(node.text) && !reached.has(node.text)) visitQueue.push(node.text);
      ts.forEachChild(node, references);
    }
    references(declaration);
  }
  return {reached, declarations};
}
function enclosingSurface(node, source) {
  let cursor = node;
  while (cursor.parent && cursor.parent !== source) cursor = cursor.parent;
  if (ts.isFunctionDeclaration(cursor)) return cursor.name?.text ?? 'anonymous';
  if (ts.isVariableStatement(cursor)) return cursor.declarationList.declarations.map(item => item.name.getText(source)).join(',');
  return 'module';
}
function importedName(node, checker, name, moduleName) {
  return checker.getSymbolAtLocation(node)?.declarations?.some(declaration =>
    ts.isImportSpecifier(declaration) && (declaration.propertyName ?? declaration.name).text === name &&
    declaration.parent.parent.parent.moduleSpecifier.text === moduleName) ?? false;
}
function translationCallKind(node, checker) {
  if (!ts.isCallExpression(node)) return null;
  const expression = node.expression;
  if (ts.isIdentifier(expression) && importedName(expression, checker, 'translateSource', '@/i18n/runtime')) return 'source';
  if (ts.isPropertyAccessExpression(expression) && expression.name.text === 't' && ts.isIdentifier(expression.expression) &&
      importedName(expression.expression, checker, 'appI18n', '@/i18n/runtime')) return 'lookup';
  if (ts.isIdentifier(expression)) {
    const declarations = checker.getSymbolAtLocation(expression)?.declarations ?? [];
    for (const declaration of declarations) {
      if (!ts.isBindingElement(declaration) || (declaration.propertyName ?? declaration.name).getText() !== 't') continue;
      const initializer = declaration.parent.parent.initializer;
      if (initializer && ts.isCallExpression(initializer) && ts.isIdentifier(initializer.expression) &&
          importedName(initializer.expression, checker, 'useTranslation', 'react-i18next')) return 'lookup';
    }
  }
  return null;
}
function explicitlyLocalizedComposition(node, checker) {
  if (!ts.isJsxExpression(node.parent) || !ts.isJsxElement(node.parent.parent)) return false;
  const opening = node.parent.parent.openingElement;
  if (!ts.isIdentifier(opening.tagName) || !importedName(opening.tagName, checker, 'Text', './Localized')) return false;
  return opening.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText() === 'translate' &&
    attribute.initializer && ts.isJsxExpression(attribute.initializer) && attribute.initializer.expression?.kind === ts.SyntaxKind.FalseKeyword) &&
    node.templateSpans.some(span => translationCallKind(span.expression, checker) === 'source');
}
function provenNumberLocaleOutput(node, checker, program) {
  if (!ts.isCallExpression(node) || node.arguments.length !== 1 || !ts.isPropertyAccessExpression(node.expression) ||
      node.expression.name.text !== 'toLocaleString') return false;
  const receiver = node.expression.expression, locale = node.arguments[0];
  if (!ts.isIdentifier(receiver) && !ts.isPropertyAccessExpression(receiver) && !ts.isNumericLiteral(receiver)) return false;
  if (!ts.isPropertyAccessExpression(locale) || locale.name.text !== 'language' || !ts.isIdentifier(locale.expression) ||
      !importedName(locale.expression, checker, 'appI18n', '@/i18n/runtime')) return false;
  const type = checker.getTypeAtLocation(receiver), members = type.isUnion() ? type.types : [type];
  if (!members.every(member => member.flags & ts.TypeFlags.NumberLike)) return false;
  const declarations = checker.getSymbolAtLocation(node.expression.name)?.declarations ?? [];
  return declarations.length > 0 && declarations.every(declaration => ts.isMethodSignature(declaration) &&
    ts.isInterfaceDeclaration(declaration.parent) && declaration.parent.name.text === 'Number' &&
    program.isSourceFileDefaultLibrary(declaration.getSourceFile()));
}
function resolvedAuthoredLiterals(node, checker, seen = new Set(), depth = 0) {
  if (depth > 12 || seen.has(node)) return [];
  seen.add(node);
  if (ts.isStringLiteralLike(node)) return [node];
  if (ts.isParenthesizedExpression(node) || ts.isAsExpression(node) || ts.isSatisfiesExpression(node)) {
    return resolvedAuthoredLiterals(node.expression, checker, seen, depth + 1);
  }
  if (ts.isConditionalExpression(node)) return [node.whenTrue, node.whenFalse].flatMap(branch =>
    resolvedAuthoredLiterals(branch, checker, seen, depth + 1));
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return [];
  let symbol = checker.getSymbolAtLocation(node);
  if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
  return (symbol?.declarations ?? []).flatMap(declaration => {
    const initializer = (ts.isVariableDeclaration(declaration) || ts.isPropertyAssignment(declaration)) && declaration.initializer;
    return initializer ? resolvedAuthoredLiterals(initializer, checker, seen, depth + 1) : [];
  });
}
// Keep only one program. Repeated inventory calls share its checker, while
// exact content and resolution-existence checks prevent stale imported copy.
let surfaceProgramCache = null;
function surfaceProgram(root, files, options) {
  const roots = files.filter(file => /\.tsx?$/.test(file)).map(file => path.join(root, file));
  const key = JSON.stringify([root, roots, options]);
  const cached = surfaceProgramCache;
  if (cached?.key === key && [...cached.contents].every(([file, content]) => ts.sys.readFile(file) === content) &&
      [...cached.exists.values()].every(({kind, file, value}) => ts.sys[kind](file) === value)) return cached.program;
  const host = ts.createCompilerHost({...options, noEmit: true}, true);
  const contents = new Map(), exists = new Map();
  for (const name of ['fileExists', 'directoryExists']) {
    const original = host[name];
    host[name] = file => { const value = original(file); exists.set(`${name}:${path.resolve(file)}`, {kind: name, file: path.resolve(file), value}); return value; };
  }
  const readFile = host.readFile;
  host.readFile = file => { const value = readFile(file); contents.set(path.resolve(file), value); return value; };
  const program = ts.createProgram(roots, {...options, noEmit: true}, host);
  program.getTypeChecker();
  for (const source of program.getSourceFiles()) contents.set(path.resolve(source.fileName), ts.sys.readFile(source.fileName));
  surfaceProgramCache = {key, program, contents, exists};
  return program;
}
function finiteNumericValues(node, checker) {
  if (ts.isParenthesizedExpression(node)) return finiteNumericValues(node.expression, checker);
  if (ts.isNumericLiteral(node)) return [Number(node.text)];
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(node.operatorToken.kind)) {
    const left = finiteNumericValues(node.left, checker), right = finiteNumericValues(node.right, checker);
    if (!left || !right || left.length * right.length > 16) return null;
    return [...new Set(left.flatMap(a => right.map(b => node.operatorToken.kind === ts.SyntaxKind.PlusToken ? a + b : a - b)))];
  }
  if (!ts.isIdentifier(node) && !ts.isPropertyAccessExpression(node)) return null;
  const type = checker.getTypeAtLocation(node), members = type.isUnion() ? type.types : [type];
  if (members.length > 16 || !members.every(member => member.flags & ts.TypeFlags.NumberLiteral)) return null;
  return [...new Set(members.map(member => member.value))];
}
function finiteTemplateSources(node, checker) {
  let values = [node.head.text];
  for (const span of node.templateSpans) {
    const numbers = finiteNumericValues(span.expression, checker);
    if (!numbers || values.length * numbers.length > 16) return null;
    values = values.flatMap(value => numbers.map(number => `${value}${number}${span.literal.text}`));
  }
  return values;
}
function collectSurfacePhrases(root = ROOT) {
  const found = new Map();
  const nativeRegistryPath = path.join(root, 'src/i18n/native-android-catalog.json');
  const nativeResources = fs.existsSync(nativeRegistryPath) ? JSON.parse(fs.readFileSync(nativeRegistryPath,'utf8')) : {};
  function record(value, file, node, source, kind) {
    const phrase = normalized(value);
    const approvedTag = file === 'functions/src/ai.ts' && enclosingSurface(node, source) === 'RETENTION_FOCUS_TAG_CATALOG' && ts.isPropertyAssignment(node.parent) && node.parent.initializer === node;
    if (!isNaturalLanguage(phrase) && !approvedTag && kind !== 'uncertain-source-composition' &&
        !(kind === 'resolved-authored-span' && /[A-Za-z]/.test(phrase))) return;
    if (!found.has(phrase)) found.set(phrase, {source: phrase, occurrences: []});
    found.get(phrase).occurrences.push({file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1, kind, surface: enclosingSurface(node, source)});
  }
  const files = allSourceFiles(root);
  // The checker proves imported finite numeric unions and lexical import
  // bindings. No diagnostics, emit, resource writes or network access occur.
  const configPath = path.join(root, 'tsconfig.json');
  const options = fs.existsSync(configPath) ? ts.parseJsonConfigFileContent(ts.readConfigFile(configPath, ts.sys.readFile).config, ts.sys, root).options
    : {baseUrl: root, paths: {'@/*': ['src/*']}, moduleResolution: ts.ModuleResolutionKind.NodeJs, jsx: ts.JsxEmit.ReactJSX};
  const program = surfaceProgram(root, files, options);
  const checker = program.getTypeChecker();
  for (const file of files) {
    if (['src/i18n/native-android-catalog.json','src/i18n/native-ios-notification-catalog.json','src/i18n/native-ios-content-blocker-catalog.json'].includes(file)) {
      const text = fs.readFileSync(path.join(root,file),'utf8');
      const catalog = JSON.parse(text);
      for (const [key, phrase] of Object.entries(catalog)) {
        if (!found.has(phrase)) found.set(phrase,{source:phrase,occurrences:[]});
        found.get(phrase).occurrences.push({file,line:text.slice(0,text.indexOf(JSON.stringify(key))).split('\n').length,kind:'native-resource',surface:file.includes('native-ios') ? 'native-ios-resource' : 'native-android-resource'});
      }
      continue;
    }
    if (NATIVE_SOURCE_FILES.includes(file)) {
      const contents = fs.readFileSync(path.join(root,file),'utf8');
      const items = collectNativePhrases(file,contents,nativeResources);
      const swiftCatalog = file.endsWith('ShieldActionExtension.swift') ? 'src/i18n/native-ios-notification-catalog.json' : file.endsWith('ContentBlockerRequestHandler.swift') ? 'src/i18n/native-ios-content-blocker-catalog.json' : null;
      if (swiftCatalog && fs.existsSync(path.join(root,swiftCatalog))) {
        const messages = JSON.parse(fs.readFileSync(path.join(root,swiftCatalog),'utf8'));
        const keys = file.endsWith('ShieldActionExtension.swift') ? /copy\["([^"\]]+)"\]/g : /localizedError\("([^"\)]+)"\)/g;
        for (const match of contents.matchAll(keys)) if(messages[match[1]]) items.push({source:messages[match[1]],occurrences:[{file,line:contents.slice(0,match.index).split('\n').length,kind:'native-resource',surface:'native-user-facing-output'}]});
      }
      for (const item of items) {
        if (!found.has(item.source)) found.set(item.source, {source: item.source, occurrences: []});
        found.get(item.source).occurrences.push(...item.occurrences);
      }
      continue;
    }
    const source = program.getSourceFile(path.join(root, file));
    const reachability = file === 'src/features/freed-app.tsx' ? declarationReachability(source) : null;
    function visit(node) {
      if (file === 'src/data/momentum-resets.ts' && ts.isTemplateExpression(node) &&
          node.templateSpans.some(span => ts.isIdentifier(span.expression) && span.expression.text === 'targetId')) {
        const pattern = templateSource(node, source);
        if (!isNaturalLanguage(pattern)) { ts.forEachChild(node, visit); return; }
        for (const id of photoTargetDisplayIds(root)) {
          for (const phrase of [id, pattern.replace(/\{\{targetId\}\}/g, id)]) {
            if (!found.has(phrase)) found.set(phrase, {source: phrase, occurrences: []});
            found.get(phrase).occurrences.push({file, line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
              kind: 'generated-target-copy', surface: 'MOMENTUM_RESET_TEMPLATES'});
          }
        }
      }
      if (file === 'functions/src/ai.ts' && node.parent === source) {
        // Only approved user-facing provider catalogs are runtime copy. Model
        // schemas, safety classifiers, IDs and system prompts are not UI text.
        const names = ts.isVariableStatement(node) ? node.declarationList.declarations.map(item => item.name.getText(source)) : [];
        if (!names.some(name => /^(?:CLARA_REPLY|APPROVED_CHALLENGE|RETENTION_(?:HEADLINE|ACTION|CHECK_IN|FOCUS_TAG))_CATALOG$/.test(name))) return;
      }
      if (reachability && node.parent === source) {
        const names = ts.isFunctionDeclaration(node) && node.name ? [node.name.text]
          : ts.isVariableStatement(node) ? node.declarationList.declarations.flatMap(item => ts.isIdentifier(item.name) ? [item.name.text] : []) : [];
        if (names.length && !names.some(name => reachability.reached.has(name))) return;
      }
      if (file === 'src/lib/feature-catalogue.ts' && ts.isCallExpression(node) && node.expression.getText(source) === 'feature') {
        for (const index of [1, 2, 3, 4]) {
          const argument = node.arguments[index];
          if (argument && ts.isStringLiteralLike(argument)) record(argument.text, file, argument, source, 'feature-copy');
          if (argument && ts.isArrayLiteralExpression(argument)) for (const child of argument.elements) if (ts.isStringLiteralLike(child)) {
            const phrase = normalized(child.text);
            if (!found.has(phrase)) found.set(phrase, {source: phrase, occurrences: []});
            found.get(phrase).occurrences.push({file, line: source.getLineAndCharacterOfPosition(child.getStart(source)).line + 1, kind: 'search-keyword', surface: 'FEATURE_DEFINITIONS'});
          }
        }
      }
      if (ts.isJsxText(node)) record(node.text, file, node, source, 'jsx');
      if (ts.isTemplateExpression(node)) {
        let cursor = node.parent, codeAttribute = false, prompt = false;
        while (cursor && cursor !== source) {
          if (ts.isJsxAttribute(cursor) && !JSX_COPY_PROPERTIES.has(cursor.name.getText(source))) codeAttribute = true;
          if (ts.isPropertyAssignment(cursor) && cursor.name.getText(source) === 'guardrails') prompt = true;
          cursor = cursor.parent;
        }
        if (!codeAttribute && !prompt) {
          if (explicitlyLocalizedComposition(node, checker)) {
            // These strings bypass Localized.Text's whole-string bridge. Keep
            // every authored fragment; translated spans are inventoried below.
            for (const literal of [node.head, ...node.templateSpans.map(span => span.literal)]) {
              record(literal.text.replace(/^[\s→↓›○]+|[\s→↓›○]+$/gu, ''), file, literal, source, 'localized-composition-fragment');
            }
            let uncertainSpan = false;
            for (const span of node.templateSpans) {
              // Primitive numeric output from the unaugmented standard method
              // and current app locale contains no authored source words.
              if (provenNumberLocaleOutput(span.expression, checker, program)) continue;
              const sourceCall = translationCallKind(span.expression, checker) === 'source';
              const input = sourceCall ? span.expression.arguments[0] : span.expression;
              const literals = input ? resolvedAuthoredLiterals(input, checker) : [];
              if (!sourceCall || !input || !ts.isStringLiteralLike(input)) uncertainSpan = true;
              for (const literal of literals) {
                const declarationSource = literal.getSourceFile();
                record(literal.text, path.relative(root, declarationSource.fileName), literal, declarationSource, 'resolved-authored-span');
              }
            }
            // A resolved initializer does not prove a binding/property cannot
            // later change. Only direct trusted translation calls with literal
            // inputs and proven numeric locale output replace the aggregate.
            // Bound source inputs, unknown spans and external data keep it.
            if (uncertainSpan) record(templateSource(node, source), file, node, source, 'uncertain-source-composition');
          } else {
            const finite = finiteTemplateSources(node, checker);
            if (finite) for (const value of finite) record(value, file, node, source, 'finite-rendered-copy');
            else record(templateSource(node, source), file, node, source, 'template-candidate');
          }
        }
      }
      if (ts.isStringLiteralLike(node)) {
        const parent = node.parent;
        const callKind = translationCallKind(parent, checker);
        if (callKind === 'source' && parent.arguments[0] === node) {
          record(node.text, file, node, source, 'source-translation');
        } else if (callKind === 'lookup' && parent.arguments[0] === node && node.text.startsWith('source.')) {
          record(node.text.slice('source.'.length), file, node, source, 'source-lookup');
        } else if (file === 'functions/src/ai.ts' && enclosingSurface(node, source) === 'RETENTION_FOCUS_TAG_CATALOG' && ts.isPropertyAssignment(parent) && parent.initializer === node) {
          record(node.text, file, node, source, 'approved-display-tag');
        } else if (ts.isJsxAttribute(parent)) {
          if (JSX_COPY_PROPERTIES.has(parent.name.getText(source))) record(node.text, file, node, source, 'attribute');
        } else if (ts.isPropertyAssignment(parent) && COPY_PROPERTIES.has(parent.name.getText(source).replace(/["']/g, ''))) {
          record(node.text, file, node, source, 'copy-property');
        } else if (isNaturalLanguage(node.text) && (/\s/.test(node.text) || ts.isArrayLiteralExpression(parent)) && !ts.isImportDeclaration(parent) && !ts.isExportDeclaration(parent)) {
          if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && ['includes', 'startsWith', 'endsWith', 'indexOf'].includes(parent.expression.name.text)) return;
          let ancestor = parent, prompt = false, jsxCode = false;
          while (ancestor && ancestor !== source) {
            if (ts.isPropertyAssignment(ancestor) && ancestor.name.getText(source) === 'guardrails') prompt = true;
            if (ts.isJsxAttribute(ancestor) && !JSX_COPY_PROPERTIES.has(ancestor.name.getText(source))) jsxCode = true;
            ancestor = ancestor.parent;
          }
          // Includes readable runtime errors and local challenge/article body strings.
          if (!prompt && !jsxCode) record(node.text, file, node, source, 'literal-candidate');
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  return [...found.values()].sort((a, b) => a.source.localeCompare(b.source));
}
function inventory(root = ROOT) {
  const source = ts.createSourceFile('freed-app.tsx', fs.readFileSync(path.join(root, 'src/features/freed-app.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const reachability = declarationReachability(source);
  const excludedDeclarations = [...reachability.declarations.keys()].filter(name => !reachability.reached.has(name));
  const entries = collectSurfacePhrases(root).map(item => ({...item, category: item.occurrences.some(occurrence => occurrence.file === 'src/data/challenge-templates.ts') ? 'challenges'
    : item.occurrences.some(occurrence => occurrence.file === 'src/data/library-articles.ts') ? 'articles'
    : item.occurrences.some(occurrence => occurrence.file === 'src/features/legal-pages.tsx') ? 'legal'
    : item.occurrences.some(occurrence => /protection|dns-guard/.test(occurrence.file)) ? 'protection'
    : item.occurrences.some(occurrence => /Account|account|social-login|SocialSign|firebase/.test(occurrence.file)) ? 'account'
    : item.occurrences.some(occurrence => /Premium|paywall|pricing/.test(occurrence.file)) ? 'premium' : 'main'}));
  return {excludedDeclarations, entries};
}
function mergeBatches(root = ROOT) {
  const directory = path.join(root, 'src/i18n/batches');
  if (!fs.existsSync(directory)) return {files: 0, added: 0, preserved: 0};
  const resources = Object.fromEntries(LOCALES.map(locale => [locale, JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/locales', `${locale}.json`), 'utf8'))]));
  const files = fs.readdirSync(directory).filter(file => file.endsWith('.json')).sort();
  let added = 0, preserved = 0;
  // Validate every batch before writing any locale, so malformed batches never
  // leave a partially updated language set.
  for (const file of files) {
    const batch = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
    if (!Array.isArray(batch.entries)) {
      if (file !== 'native-shield.json') throw new Error(`${file}: entries must be an array`);
      if (JSON.stringify(Object.keys(batch).sort()) !== JSON.stringify([...LOCALES].sort())) throw new Error(`${file}: shield language set differs`);
      const keys = ['title', 'primary', 'secondary', 'targetDescription', 'categoryDescription'];
      for (const locale of LOCALES) {
        if (JSON.stringify(Object.keys(batch[locale] ?? {}).sort()) !== JSON.stringify([...keys].sort())) throw new Error(`${file}: incomplete shield copy for ${locale}`);
        for (const key of keys) {
          const value = batch[locale][key];
          if (typeof value !== 'string' || !value.trim()) throw new Error(`${file}: empty shield ${locale}.${key}`);
          if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(batch.en[key]))) throw new Error(`${file}: shield interpolation mismatch for ${locale}.${key}`);
        }
      }
      // Shield semantic copy has its own generator; preserve reviewed catalogs.
      continue;
    }
    for (const {source, translations} of batch.entries) {
      if (typeof source !== 'string' || !source.trim()) throw new Error(`${file}: missing source`);
      if (!translations || typeof translations !== 'object') throw new Error(`${file}: missing translations for ${source}`);
      const languageKeys = Object.keys(translations).sort();
      if (JSON.stringify(languageKeys) !== JSON.stringify(LOCALES.filter(locale => locale !== 'en').sort())) throw new Error(`${file}: incorrect translation language set for ${source}`);
      for (const locale of LOCALES.filter(locale => locale !== 'en')) {
        const value = translations[locale];
        if (typeof value !== 'string' || !value.trim()) throw new Error(`${file}: ${locale} empty translation for ${source}`);
        if (JSON.stringify(placeholders(source)) !== JSON.stringify(placeholders(value))) throw new Error(`${file}: ${locale} interpolation mismatch for ${source}`);
        if (value === source && !SHARED_VALUES.has(source) && !SHARED_BY_LOCALE[locale]?.has(source)) throw new Error(`${file}: ${locale} untranslated source ${source}`);
      }
      if (Object.hasOwn(resources.en.source, source)) { preserved++; continue; }
      resources.en.source[source] = source;
      for (const locale of LOCALES.filter(locale => locale !== 'en')) resources[locale].source[source] = translations[locale];
      added++;
    }
  }
  for (const locale of LOCALES) fs.writeFileSync(path.join(root, 'src/i18n/locales', `${locale}.json`), JSON.stringify(resources[locale], null, 2)+'\n');
  return {files: files.length, added, preserved};
}
function audit(root = ROOT) {
  const errors = [], warnings = [], resources = {};
  const localeDir = path.join(root, 'src/i18n/locales');
  const actual = fs.existsSync(localeDir) ? fs.readdirSync(localeDir).filter(file => file.endsWith('.json')).map(file => file.slice(0, -5)).sort() : [];
  if (JSON.stringify(actual) !== JSON.stringify([...LOCALES].sort())) errors.push(`Locale set differs: expected ${LOCALES.join(', ')}, found ${actual.join(', ') || 'none'}`);
  for (const locale of LOCALES) {
    try { resources[locale] = JSON.parse(fs.readFileSync(path.join(localeDir, `${locale}.json`), 'utf8')); }
    catch (error) { errors.push(`${locale}: missing or invalid resource (${error.message})`); }
  }
  if (fs.existsSync(path.join(root,'src/i18n/native-android-catalog.json'))) {
    try { require('./sync-android-localizations').run(true,root);
      if (fs.existsSync(path.join(root,'src/i18n/native-ios-notification-catalog.json'))) require('./sync-ios-notification-localizations').run(true,root); }
    catch (error) { errors.push(error.message); }
  }
  const english = resources.en;
  if (!english) return {locales: LOCALES, errors, warnings, coverage: null};
  const englishFlat = flatten(english), expectedKeys = Object.keys(englishFlat).sort();
  const identical = {};
  for (const locale of LOCALES) {
    const resource = resources[locale];
    if (!resource) continue;
    for (const group of ['source', 'common', 'preferences', 'dns']) {
      if (!resource[group] || typeof resource[group] !== 'object') errors.push(`${locale}: missing ${group} dictionary`);
    }
    const flat = flatten(resource), keys = Object.keys(flat).sort();
    const missing = expectedKeys.filter(key => !(key in flat)), extra = keys.filter(key => !(key in englishFlat));
    if (missing.length) errors.push(`${locale}: ${missing.length} missing keys (${missing.slice(0, 3).join(', ')})`);
    if (extra.length) errors.push(`${locale}: ${extra.length} unexpected keys (${extra.slice(0, 3).join(', ')})`);
    identical[locale] = [];
    for (const key of keys) {
      const value = flat[key], reference = englishFlat[key];
      if (typeof value !== 'string' || !value.trim()) { errors.push(`${locale}: empty or non-string value for ${key}`); continue; }
      if (reference === undefined) continue;
      if (JSON.stringify(placeholders(value)) !== JSON.stringify(placeholders(reference))) errors.push(`${locale}: interpolation mismatch for ${key}`);
      if (locale !== 'en' && value === reference && !SHARED_VALUES.has(reference) && !SHARED_BY_LOCALE[locale]?.has(reference)) identical[locale].push(key);
    }
    if (identical[locale].length) errors.push(`${locale}: ${identical[locale].length} unexplained English-identical values (${identical[locale].slice(0, 4).join(', ')})`);
  }
  const known = new Set(Object.keys(english.source || {}).map(normalized));
  const knownTemplates = new Set(Object.keys(english.source || {}).filter(key => placeholders(key).length).map(templateSignature));
  // Bypassed compositions with unproven spans cannot be discharged by a
  // dictionary template: their runtime value never enters that whole bridge.
  const translated = item => !item.occurrences.some(occurrence => occurrence.kind === 'uncertain-source-composition') &&
    (known.has(item.source) || (item.occurrences.some(occurrence => occurrence.kind === 'template-candidate') && knownTemplates.has(templateSignature(item.source))) || SHARED_VALUES.has(item.source));
  const surface = collectSurfacePhrases(root);
  const uncovered = surface.filter(item => !translated(item));
  const covered = surface.length - uncovered.length;
  const byFile = {};
  for (const file of allSourceFiles(root)) {
    const phrases = surface.filter(item => item.occurrences.some(occurrence => occurrence.file === file));
    const missing = phrases.filter(item => !translated(item));
    byFile[file] = {phrases: phrases.length, covered: phrases.length - missing.length, uncovered: missing.length};
  }
  if (uncovered.length) warnings.push(`${uncovered.length} distinct source-surface phrases are not translated; English fallback remains visible. The inventory includes literal candidates, so inspect occurrences before translating code.`);
  return {locales: LOCALES, sourceKeys: Object.keys(english.source || {}).length, semanticKeys: expectedKeys.length - Object.keys(english.source || {}).length, errors, warnings, identicalEnglish: identical, coverage: {distinctPhrases: surface.length, covered, uncovered: uncovered.length, byFile, uncoveredPhrases: uncovered}};
}
if (require.main === module) {
  if (process.argv.includes('--merge-batches')) {
    try { process.stdout.write(`Batch merge: ${JSON.stringify(mergeBatches())}\n`); }
    catch (error) { process.stderr.write(`Batch merge failed: ${error.message}\n`); process.exit(1); }
  }
  if (process.argv.includes('--write-catalog')) {
    const catalog = inventory();
    fs.writeFileSync(path.join(ROOT, 'src/i18n/source-catalog.ts'), '// Generated with node scripts/localization-audit.js --write-catalog.\n// Static copy inventory; category and occurrence evidence are for translation work.\n// Exclusions follow references from exported freed-app declarations.\nexport const SOURCE_COPY_CATALOG = '+JSON.stringify(catalog, null, 2)+' as const;\n');
  }
  const result = audit();
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  else {
    process.stdout.write(`Localization: ${result.locales.length} locales; ${result.sourceKeys || 0} translated source keys\n`);
    for (const error of result.errors) process.stdout.write(`ERROR ${error}\n`);
    for (const warning of result.warnings) process.stdout.write(`WARNING ${warning}\n`);
    if (result.coverage) for (const [file, counts] of Object.entries(result.coverage.byFile)) process.stdout.write(`${file}: ${counts.covered}/${counts.phrases} (${counts.uncovered} uncovered)\n`);
  }
  // Resource integrity is always required; full coverage is an explicit gate.
  if (result.errors.length || (process.argv.includes('--strict') && result.coverage?.uncovered)) process.exitCode = 1;
}
module.exports = {LOCALES, SOURCE_FILES, NATIVE_SOURCE_FILES, SHARED_VALUES, audit, collectSurfacePhrases, collectNativePhrases, placeholders, inventory, mergeBatches};
