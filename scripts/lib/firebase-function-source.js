const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

/** Resolve the actual runtime export surface without importing Firebase code. */
function collectExportedFunctionSources(root, entry = 'functions/src/index.ts', readSource) {
  const boundary = path.resolve(root, 'functions/src');
  const modules = new Map();
  const read = readSource || (relative => fs.readFileSync(path.resolve(root, relative), 'utf8'));
  const relativePath = absolute => path.relative(root, absolute).replace(/\\/g, '/');
  const resolveModule = (from, specifier) => {
    if (!specifier.startsWith('.')) throw new Error(`Unsupported external runtime re-export: ${specifier}`);
    let resolved = path.resolve(root, path.dirname(from), specifier);
    if (/\.m?js$/.test(resolved)) resolved = resolved.replace(/\.m?js$/, '.ts');
    else if (!path.extname(resolved)) resolved += '.ts';
    const relative = path.relative(boundary, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Runtime export escapes the Functions source boundary.');
    return relativePath(resolved);
  };
  function load(file) {
    if (modules.has(file)) return modules.get(file);
    if (modules.size >= 200) throw new Error('Functions export graph exceeded the bounded module limit.');
    const source = read(file);
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
    if (ast.parseDiagnostics.length) throw new Error(`Cannot parse Functions source ${file}`);
    const node = { path: file, source, own: new Map(), imports: new Map(), direct: new Map(), named: [], stars: [], resolved: new Map() };
    modules.set(file, node);
    const exported = statement => statement.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
    for (const statement of ast.statements) {
      const names = ts.isVariableStatement(statement) ? statement.declarationList.declarations.map(d => {
        if (!ts.isIdentifier(d.name)) { if (exported(statement)) throw new Error(`Unsupported exported binding pattern in ${file}`); return null; }
        return d.name.text;
      }).filter(Boolean) : (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement) || ts.isEnumDeclaration(statement)) && statement.name ? [statement.name.text] : [];
      for (const name of names) {
        const origin = { path: file, localName: name };
        node.own.set(name, origin);
        if (exported(statement)) node.direct.set(name, origin);
      }
      if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && !statement.importClause?.isTypeOnly && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings)) {
        for (const item of statement.importClause.namedBindings.elements) {
          if (!item.isTypeOnly) node.imports.set(item.name.text, { specifier: statement.moduleSpecifier.text, inputName: (item.propertyName || item.name).text });
        }
      }
    }
    for (const statement of ast.statements) {
      if (ts.isExportAssignment(statement)) throw new Error(`Unsupported default runtime export in ${file}; export named deployment handlers.`);
      if (!ts.isExportDeclaration(statement) || statement.isTypeOnly) continue;
      const target = statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? resolveModule(file, statement.moduleSpecifier.text) : null;
      if (target) load(target);
      if (!statement.exportClause && target) { node.stars.push(target); continue; }
      if (!statement.exportClause || !ts.isNamedExports(statement.exportClause)) throw new Error(`Unsupported namespace runtime export in ${file}`);
      for (const item of statement.exportClause.elements) {
        if (item.isTypeOnly) continue;
        const inputName = (item.propertyName || item.name).text;
        const outputName = item.name.text;
        if (target) node.named.push({ target, inputName, outputName });
        else if (node.own.has(inputName)) node.direct.set(outputName, node.own.get(inputName));
        else if (node.imports.has(inputName)) {
          const imported = node.imports.get(inputName);
          const importedTarget = resolveModule(file, imported.specifier);
          load(importedTarget);
          node.named.push({ target: importedTarget, inputName: imported.inputName, outputName });
        } else throw new Error(`Missing local runtime export ${inputName} in ${file}`);
      }
    }
    node.resolved = new Map(node.direct);
    return node;
  }
  const entryAbsolute = path.resolve(root, entry);
  if (path.relative(boundary, entryAbsolute).startsWith('..')) throw new Error('Entry escapes Functions source boundary.');
  const entryNode = load(relativePath(entryAbsolute));
  for (let iteration = 0; iteration <= modules.size * 2; iteration++) {
    let changed = false;
    for (const node of modules.values()) {
      const explicit = new Set([...node.direct.keys(), ...node.named.map(ref => ref.outputName)]);
      const next = new Map(node.direct);
      for (const ref of node.named) {
        const origin = modules.get(ref.target).resolved.get(ref.inputName);
        if (origin) next.set(ref.outputName, origin);
      }
      for (const target of node.stars) {
        for (const [name, origin] of modules.get(target).resolved) {
          if (name === 'default' || explicit.has(name)) continue;
          const previous = next.get(name);
          if (previous && (previous.path !== origin.path || previous.localName !== origin.localName)) throw new Error(`Ambiguous runtime export ${name} in ${node.path}`);
          next.set(name, origin);
        }
      }
      if (next.size !== node.resolved.size || [...next].some(([name, value]) => { const before = node.resolved.get(name); return !before || before.path !== value.path || before.localName !== value.localName; })) changed = true;
      node.resolved = next;
    }
    if (!changed) break;
    if (iteration === modules.size * 2) throw new Error('Functions runtime export graph did not converge.');
  }
  for (const node of modules.values()) {
    for (const ref of node.named) if (!modules.get(ref.target).resolved.has(ref.inputName)) throw new Error(`Missing named runtime export ${ref.inputName} from ${ref.target}`);
  }
  return { modules: [...modules.values()].map(({ path, source }) => ({ path, source })), exports: [...entryNode.resolved].map(([exportName, origin]) => ({ exportName, ...origin })) };
}
module.exports = { collectExportedFunctionSources };
