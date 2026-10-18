const path = require('node:path');
const Module = require('node:module');
let loaded;
/** Run the same reviewed TS gate from direct-Node release commands. */
function evaluateInterceptionReleaseGate(request) {
  if (!loaded) {
    const entry = path.resolve(__dirname, '../../src/lib/interception-release-gate.ts');
    const result = require('esbuild').buildSync({ entryPoints: [entry], bundle: true, write: false, platform: 'node', format: 'cjs', target: 'node18', logLevel: 'silent' });
    const compiled = new Module(entry, module);
    compiled.filename = entry;
    compiled.paths = Module._nodeModulePaths(path.dirname(entry));
    compiled._compile(result.outputFiles[0].text, entry);
    loaded = compiled.exports.evaluateInterceptionReleaseGate;
  }
  return loaded(request);
}
module.exports = { evaluateInterceptionReleaseGate };
