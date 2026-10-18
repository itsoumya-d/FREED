/* Offline verification only: compiles into memory and matches the existing reviewed uploaded archive. */
const fs = require('node:fs');
const path = require('node:path');
const { IDENTITY } = require('./lib/google-clara-release-evidence');
const backend = require('./lib/clara-deployment-source-binding');
const output = process.env.FREED_CLARA_BACKEND_SOURCE_BINDING || backend.DEFAULTS.FREED_CLARA_BACKEND_SOURCE_BINDING;
if (!/^[-A-Za-z0-9_./]+$/.test(output) || output.split('/').includes('..') || !output.startsWith('.superpowers/') || !output.endsWith('.json')) {
  throw new Error('Verification receipt must use a safe task-owned .superpowers JSON path');
}
const receipt = backend.reproduce(process.cwd(), IDENTITY);
const absolute = path.join(process.cwd(), output);
let current = process.cwd();
for (const segment of output.split('/').slice(0, -1)) {
  current = path.join(current, segment);
  if (fs.existsSync(current) && (fs.lstatSync(current).isSymbolicLink() || !fs.statSync(current).isDirectory())) {
    throw new Error('Verification receipt output must not traverse symlinks or non-directories');
  }
}
fs.mkdirSync(path.dirname(absolute), { recursive: true });
fs.writeFileSync(absolute, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ result: 'PASS', purpose: receipt.purpose, compiledArchiveMatched: receipt.association.archiveSha256, revision: receipt.association.revision, sourceInputCount: Object.keys(receipt.inputSha256s).length }, null, 2));
