/** Offline source-to-reviewed-archive association. This proves no native or provider request. */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { isDeepStrictEqual } = require('node:util');
const { createRequire } = require('node:module');
// Resolve the verification compiler at startup; do not bundle its implementation into every TS test entry.
const toolRequire = createRequire(path.join(process.cwd(), 'scripts/lib/clara-deployment-source-binding.js'));
const ts = toolRequire('../../functions/node_modules/typescript');

const LEDGER = '.superpowers/sdd/2026-10-05-daily-usability-release-completion/';
const DEFAULTS = {
  FREED_CLARA_DEPLOYMENT_BINDING: `${LEDGER}deployed-source-comparison.json`,
  FREED_CLARA_DEPLOYMENT_ARCHIVES: `${LEDGER}deployed-source-archives.json`,
  FREED_CLARA_BACKEND_SOURCE_BINDING: `${LEDGER}clara-backend-source-binding.json`,
};
const ENTRY_SOURCE = 'functions/src/clara-cloud-firebase.ts';
const CONFIG_INPUTS = ['functions/package.json', 'functions/package-lock.json', 'functions/tsconfig.json'];
const HASH = /^[a-f0-9]{64}$/;
const reproductionCache = new Map();

function sha(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function same(actual, expected, reason) {
  if (!isDeepStrictEqual(actual, expected)) throw new Error(reason);
}

function workspaceFile(root, relativePath, allowedPrefixes = ['.superpowers/', '.cache/', 'docs/validation/artifacts/', 'functions/']) {
  const safeShape = typeof relativePath === 'string' && /^[-A-Za-z0-9_./]+$/.test(relativePath);
  const insideAllowedPrefix = safeShape && allowedPrefixes.some(prefix => relativePath.startsWith(prefix));
  if (!insideAllowedPrefix || relativePath.split('/').includes('..')) throw new Error('Unsafe backend association input path');
  let current = root;
  for (const segment of relativePath.split('/')) {
    current = path.join(current, segment);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Backend association input must not contain symlinks');
  }
  if (!fs.statSync(current).isFile()) throw new Error('Backend association input must be a file');
  return current;
}

function readInput(root, relativePath) {
  const absolute = workspaceFile(root, relativePath);
  if (fs.statSync(absolute).size > 5_000_000) throw new Error('Backend association input exceeds its bound');
  return { path: relativePath, raw: fs.readFileSync(absolute) };
}

function readConfigured(root, key) {
  return readInput(root, process.env[key] || DEFAULTS[key]);
}

function selectedRow(rows, field, value) {
  if (!Array.isArray(rows)) throw new Error('Missing backend deployment ledger rows');
  const matching = rows.filter(row => row && row[field] === value);
  if (matching.length !== 1) throw new Error('Missing or duplicate backend deployment association');
  return matching[0];
}

function sourceClosure(root) {
  const seen = new Set();
  function visit(relativePath) {
    if (seen.has(relativePath)) return;
    seen.add(relativePath);
    const input = readInput(root, relativePath);
    const imports = ts.preProcessFile(input.raw.toString('utf8'), true, true).importedFiles;
    for (const entry of imports) {
      if (!entry.fileName.startsWith('.')) continue; // External package inputs are bound by package + lock.
      const dependency = path.posix.normalize(path.posix.join(path.posix.dirname(relativePath), entry.fileName))
        .replace(/\.js$/, '.ts');
      if (!dependency.startsWith('functions/src/') || !dependency.endsWith('.ts')) {
        throw new Error('Unexpected backend source import boundary');
      }
      visit(dependency);
    }
  }
  visit(ENTRY_SOURCE);
  return [...seen].sort();
}

function compilerIdentity() {
  const compilerPath = toolRequire.resolve('../../functions/node_modules/typescript');
  const packagePath = path.join(path.dirname(compilerPath), '..', 'package.json');
  return {
    version: ts.version,
    implementationSha256: sha(fs.readFileSync(compilerPath)),
    packageSha256: sha(fs.readFileSync(packagePath)),
  };
}

function compilerConfiguration(root) {
  const configPath = workspaceFile(root, 'functions/tsconfig.json');
  const config = ts.readConfigFile(configPath, ts.sys.readFile);
  if (config.error) throw new Error('Backend compiler configuration is unreadable');
  // Current deployment has one self-contained config. New transitive configs must gain explicit reviewed coverage.
  if (config.config.extends || config.config.references?.length) {
    throw new Error('Uncovered transitive backend compiler configuration');
  }
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.join(root, 'functions'));
  if (parsed.errors.length) throw new Error('Backend compiler configuration is invalid');
  return parsed;
}

function requiredSourceHashes(root) {
  compilerConfiguration(root);
  const files = [...sourceClosure(root), ...CONFIG_INPUTS].sort();
  return Object.fromEntries(files.map(file => [file, sha(readInput(root, file).raw)]));
}

function archiveContents(root, archivePath) {
  const absolute = workspaceFile(root, archivePath);
  const filenames = execFileSync('unzip', ['-Z', '-1', absolute], { encoding: 'utf8', maxBuffer: 100_000 })
    .trim().split('\n');
  if (new Set(filenames).size !== filenames.length || filenames.some(file => !/^[-A-Za-z0-9_./]+$/.test(file) || file.includes('..'))) {
    throw new Error('Archive comparison contains duplicate or unsafe paths');
  }
  return Object.fromEntries(filenames.map(file => [file, execFileSync('unzip', ['-p', absolute, file], { maxBuffer: 2_000_000 })]));
}

function localRuntimeImports(code) {
  const result = [];
  const ast = ts.createSourceFile('compiled.js', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'require' &&
        node.arguments.length === 1 && ts.isStringLiteral(node.arguments[0])) {
      const moduleName = node.arguments[0].text;
      if (moduleName.startsWith('.')) result.push(moduleName);
    }
    ts.forEachChild(node, visit);
  }
  visit(ast);
  return result;
}

function runtimeClosure(compiled) {
  const seen = new Set();
  function visit(file) {
    if (seen.has(file)) return;
    if (!compiled[file]) throw new Error('Missing transitive compiled archive coverage');
    seen.add(file);
    for (const dependency of localRuntimeImports(compiled[file].toString('utf8'))) {
      visit(path.posix.normalize(path.posix.join(path.posix.dirname(file), dependency)));
    }
  }
  visit('lib/clara-cloud-firebase.js');
  return [...seen].sort();
}

function deploymentAssociation(root, identity) {
  const comparison = readConfigured(root, 'FREED_CLARA_DEPLOYMENT_BINDING');
  const archives = readConfigured(root, 'FREED_CLARA_DEPLOYMENT_ARCHIVES');
  const deployed = selectedRow(JSON.parse(comparison.raw), 'function', identity.callable);
  const archived = selectedRow(JSON.parse(archives.raw), 'name', identity.callable);
  if (deployed.state !== 'ACTIVE' || archived.state !== 'ACTIVE' || deployed.privateFilesFound !== false ||
      !HASH.test(deployed.archiveSha256 || '') || !/^generategoogleclarareply-[a-z0-9-]+$/.test(deployed.revision || '')) {
    throw new Error('Invalid reviewed backend deployment association');
  }
  same(archived.revision, deployed.revision, 'Stale backend deployment revision association');
  same(archived.sha256, deployed.archiveSha256, 'Backend deployment archive association mismatch');
  const archive = readInput(root, archived.archive);
  same(sha(archive.raw), archived.sha256, 'Actual reviewed deployment archive checksum mismatch');
  const files = archiveContents(root, archived.archive);
  const compiledFiles = runtimeClosure(files);
  const requiredFiles = [...compiledFiles, 'lib/entry.js', 'package.json', 'package-lock.json', 'functions.yaml'].sort();
  same(Object.keys(files).sort(), requiredFiles, 'Missing or unexpected reviewed archive comparison coverage');
  same([...new Set(deployed.matchedFiles || [])].sort(), requiredFiles, 'Missing or empty deployment comparison coverage');
  if (!Array.isArray(deployed.matchedFiles) || deployed.matchedFiles.length !== requiredFiles.length) {
    throw new Error('Duplicate or missing deployment comparison coverage');
  }
  const compiledHashes = Object.fromEntries(requiredFiles.map(file => [file, sha(files[file])]));
  for (const file of requiredFiles) {
    same(sha(readInput(root, `${archived.stage}/source/${file}`).raw), compiledHashes[file], 'Staged package does not match reviewed deployed archive');
  }
  const manifest = JSON.parse(files['functions.yaml']);
  const endpoint = manifest.endpoints?.[identity.callable];
  same(Object.keys(manifest.endpoints || {}), [identity.callable], 'Foreign callable deployment manifest');
  if (endpoint?.entryPoint !== identity.callable || endpoint?.serviceAccountEmail !== identity.runtimeIdentity ||
      !isDeepStrictEqual(endpoint?.region, [identity.region]) || endpoint?.timeoutSeconds !== 30 || endpoint?.platform !== 'gcfv2') {
    throw new Error('Foreign project/runtime identity deployment manifest');
  }
  const stageConfig = readInput(root, `${archived.stage}/firebase.json`);
  const config = JSON.parse(stageConfig.raw);
  if (config.functions?.length !== 1 || config.functions[0].runtime !== 'nodejs22' ||
      config.functions[0].codebase !== 'freed' || config.functions[0].source !== 'source') {
    throw new Error('Unexpected deployment package configuration');
  }
  const stageReceipt = readInput(root, `${archived.stage}/source-receipt.json`);
  const stage = JSON.parse(stageReceipt.raw);
  same(stage.project, identity.projectId, 'Foreign project source/deployment association');
  same(stage.names, [identity.callable], 'Foreign callable source/deployment association');
  const stageCompiled = compiledFiles.map(file => ({ file: path.posix.basename(file), sha256: compiledHashes[file] }));
  same([...stage.compiled].sort((a, b) => a.file.localeCompare(b.file)), stageCompiled.sort((a, b) => a.file.localeCompare(b.file)), 'Staged compiled source receipt coverage mismatch');
  return {
    identity,
    comparisonArtifact: comparison.path,
    comparisonSha256: sha(comparison.raw),
    archivesArtifact: archives.path,
    archivesSha256: sha(archives.raw),
    archiveArtifact: archive.path,
    archiveSha256: sha(archive.raw),
    revision: deployed.revision,
    stage: archived.stage,
    stageConfigSha256: sha(stageConfig.raw),
    stageSourceReceiptSha256: sha(stageReceipt.raw),
    compiledSha256s: compiledHashes,
  };
}

function reproduce(root, identity) {
  const association = deploymentAssociation(root, identity);
  const parsed = compilerConfiguration(root);
  const emitted = {};
  const program = ts.createProgram({ rootNames: [path.join(root, ENTRY_SOURCE)], options: parsed.options });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length) throw new Error('Backend verification compilation has diagnostics');
  const result = program.emit(undefined, (file, text) => {
    if (file.endsWith('.js')) emitted[`lib/${path.basename(file)}`] = Buffer.from(text);
  });
  if (result.emitSkipped) throw new Error('Backend verification compilation emitted no output');
  for (const [file, digest] of Object.entries(association.compiledSha256s)) {
    if (!file.startsWith('lib/') || file === 'lib/entry.js') continue;
    if (!emitted[file]) throw new Error('Missing reproduced deployed compiled file');
    same(sha(emitted[file]), digest, 'Current backend source does not reproduce reviewed compiled archive');
  }
  const archive = archiveContents(root, association.archiveArtifact);
  const generatedEntry = `exports.${identity.callable}=require('./clara-cloud-firebase.js').${identity.callable};\n`;
  same(archive['lib/entry.js'].toString('utf8'), generatedEntry, 'Reviewed deployment entry does not match its declared source transform');
  const originalPackage = JSON.parse(readInput(root, 'functions/package.json').raw);
  delete originalPackage.scripts;
  originalPackage.main = 'lib/entry.js';
  same(JSON.parse(archive['package.json']), originalPackage, 'Backend package transform does not reproduce deployed package');
  same(sha(readInput(root, 'functions/package-lock.json').raw), association.compiledSha256s['package-lock.json'], 'Backend package lock does not reproduce deployed lock');
  return {
    schemaVersion: 'freed-clara-backend-source-binding-v1',
    purpose: 'verification-only-source-association-not-runtime-proof',
    association,
    compiler: compilerIdentity(),
    inputSha256s: requiredSourceHashes(root),
    compilerOutputSha256s: Object.fromEntries(Object.entries(emitted).sort(([a], [b]) => a.localeCompare(b)).map(([file, bytes]) => [file, sha(bytes)])),
    transforms: { entrySource: ENTRY_SOURCE, packageMain: 'lib/entry.js', removedPackageKeys: ['scripts'] },
  };
}

function validate(root, identity) {
  const input = readConfigured(root, 'FREED_CLARA_BACKEND_SOURCE_BINDING');
  const receipt = JSON.parse(input.raw);
  const expectedKeys = ['schemaVersion', 'purpose', 'association', 'compiler', 'inputSha256s', 'compilerOutputSha256s', 'transforms'];
  same(Object.keys(receipt).sort(), expectedKeys.sort(), 'Unsupported backend source association fields');
  same(receipt.schemaVersion, 'freed-clara-backend-source-binding-v1', 'Missing current backend source association schema');
  same(receipt.purpose, 'verification-only-source-association-not-runtime-proof', 'Backend source association is not native/provider proof');
  same(receipt.association, deploymentAssociation(root, identity), 'Stale or foreign backend source/deployment association');
  same(receipt.compiler, compilerIdentity(), 'Backend association compiler changed');
  same(receipt.inputSha256s, requiredSourceHashes(root), 'Current backend source/package/config inputs differ from reviewed deployment association');
  same(receipt.transforms, { entrySource: ENTRY_SOURCE, packageMain: 'lib/entry.js', removedPackageKeys: ['scripts'] }, 'Backend source/deployment transform mismatch');
  const compiled = receipt.association.compiledSha256s;
  for (const [file, digest] of Object.entries(compiled)) {
    if (file.startsWith('lib/') && file !== 'lib/entry.js') {
      same(receipt.compilerOutputSha256s[file], digest, 'Backend reproduced compiled coverage differs from reviewed archive');
    }
  }
  const expectedOutputFiles = sourceClosure(root).map(file => `lib/${path.basename(file, '.ts')}.js`).sort();
  same(Object.keys(receipt.compilerOutputSha256s).sort(), expectedOutputFiles, 'Missing transitive backend compilation coverage');
  // Reproduce from the actual input bytes. A rewritten receipt cannot merely seal new source hashes.
  const key = sha(JSON.stringify({ inputs: receipt.inputSha256s, compiler: receipt.compiler, association: receipt.association }));
  if (!reproductionCache.has(key)) reproductionCache.set(key, reproduce(root, identity));
  same(receipt, reproductionCache.get(key), 'Backend source association does not reproduce the actual reviewed uploaded compiled archive');
  return { receiptSha256: sha(input.raw), ...receipt.association, inputSha256s: receipt.inputSha256s };
}

module.exports = { DEFAULTS, sha, requiredSourceHashes, sourceClosure, compilerIdentity, deploymentAssociation, reproduce, validate };
