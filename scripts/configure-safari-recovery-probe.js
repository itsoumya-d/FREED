"use strict";

const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const plist = require('@expo/plist');
const { buildSafariRecoveryProbeConfiguration, PROBE_RULES } = require('./lib/safari-recovery-probe');

function configureSafariRecoveryProbe(root, inputs) {
  const flag = inputs.FREED_SAFARI_RECOVERY_PROBE;
  if (flag !== undefined && flag !== '' && flag !== '0' && flag !== '1') throw new Error('FREED_SAFARI_RECOVERY_PROBE must be 0 or 1.');
  // A distinct pinned-feed artifact; never broaden or silently compose the safe probe.
  const { configureSafariAdultRecovery } = require('./lib/safari-adult-recovery');
  const adult = configureSafariAdultRecovery(root, inputs);
  if (adult) return adult;
  const directory = path.join(root, 'ios/FREEDSafariFocusShield');
  const manifestPath = path.join(directory, 'manifest.json'), infoPath = path.join(directory, 'Info.plist');
  const originals = [fs.readFileSync(manifestPath, 'utf8'), fs.readFileSync(infoPath, 'utf8')];
  const result = buildSafariRecoveryProbeConfiguration(JSON.parse(originals[0]), plist.default.parse(originals[1]), { profile: inputs.EAS_BUILD_PROFILE, enabled: flag === '1' });
  // Validate packaged resources before writing either configuration file.
  const resources = path.join(directory, 'recovery-probe');
  if (fs.lstatSync(resources).isSymbolicLink()) throw new Error('Probe resources must be a local folder.');
  for (const file of ['page.html', 'page.css', 'page.js', 'kite.svg', 'rules.json']) {
    const stat = fs.lstatSync(path.join(resources, file));
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Missing or unsafe probe resource: ${file}`);
  }
  if (JSON.stringify(JSON.parse(fs.readFileSync(path.join(directory, 'recovery-probe/rules.json'), 'utf8'))) !== JSON.stringify(PROBE_RULES)) throw new Error('Probe fixture rules differ from the reviewed contract.');
  const writes = [JSON.stringify(result.manifest, null, 2) + '\n', plist.default.build(result.info)];
  let completed = 0;
  try {
    for (const [index, target] of [manifestPath, infoPath].entries()) {
      if ((index === 0 ? JSON.stringify(JSON.parse(originals[index])) : JSON.stringify(plist.default.parse(originals[index]))) === JSON.stringify(index === 0 ? result.manifest : result.info)) continue;
      const temporary = `${target}.freed-probe-${randomUUID()}`;
      let created = false;
      try { fs.writeFileSync(temporary, writes[index], { flag: 'wx' }); created = true; fs.renameSync(temporary, target); } finally { if (created && fs.existsSync(temporary)) fs.unlinkSync(temporary); }
      completed = index + 1;
    }
  } catch (error) {
    // These are generated source files, never the device's protection store.
    for (let i = 0; i < completed; i++) fs.writeFileSync([manifestPath, infoPath][i], originals[i]);
    throw error;
  }
  return { enabled: flag === '1', profile: inputs.EAS_BUILD_PROFILE ?? null };
}
if (require.main === module) {
  try { process.stdout.write(JSON.stringify(configureSafariRecoveryProbe(path.resolve(__dirname, '..'), process.env)) + '\n'); }
  catch (error) { process.stderr.write(error.message + '\n'); process.exitCode = 1; }
}
module.exports = { configureSafariRecoveryProbe };
