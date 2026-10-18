import { readFile, stat } from 'node:fs/promises';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { DomainFeed } from './feed.js';
import { createFamiliesPolicy } from './families-policy.js';
import { createTcpForwarder, startDnsproxy } from './transport.js';
import { createAttachedServiceAccountTokenProvider, createFcmSender } from './alerts.js';
import { createRecoveryServer } from './server.js';

// Trusted local module supplies the reviewed control-plane SDK boundary. Missing
// adapter rejects every installation, never an environment-auth allowlist.
async function loadAdapter(path) {
  if (!path) return {};
  if (!isAbsolute(path)) throw new Error('adapter path must be absolute');
  const module = await import(pathToFileURL(path));
  if (typeof module.resolveInstallation !== 'function' || typeof module.reserveDnsRequest !== 'function') throw new Error('invalid installation adapter');
  return { resolveInstallation: module.resolveInstallation, reserveDnsRequest: module.reserveDnsRequest };
}

async function main() {
  // Live Families classification is always mandatory. A separately configured
  // local deny supplement is additional policy, not an unfiltered fallback.
  let feed = { classify: () => 'allow' };
  if (process.env.DOMAIN_FEED_PATH) {
    feed = new DomainFeed();
    const path = process.env.DOMAIN_FEED_PATH;
    if (!isAbsolute(path) || (await stat(path)).size > 8 * 1024 * 1024) throw new Error('invalid local feed');
    if (!feed.replace(JSON.parse(await readFile(path, 'utf8')))) throw new Error('invalid local feed');
  }
  const adapter = await loadAdapter(process.env.INSTALLATION_ADAPTER_MODULE);
  const sendAlert = createFcmSender({ projectId: 'freed-7d5ee', getAccessToken: createAttachedServiceAccountTokenProvider() });
  const port = Number(process.env.PORT ?? 8080);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid HTTP port');
  const service = createRecoveryServer({ feed: createFamiliesPolicy({ feed }), ...adapter, sendAlert, forward: createTcpForwarder() });
  const engine = startDnsproxy();
  try { await new Promise((resolve, reject) => { service.server.once('error', reject); service.server.listen(port, '0.0.0.0', resolve); }); }
  catch (error) { engine.stop(); throw error; }
  const shutdown = async () => { engine.stop(); await service.close(); };
  process.once('SIGTERM', () => { void shutdown(); });
  process.once('SIGINT', () => { void shutdown(); });
}

main().catch(() => { process.stderr.write('Recovery DNS pilot unavailable.\n'); process.exitCode = 1; });
