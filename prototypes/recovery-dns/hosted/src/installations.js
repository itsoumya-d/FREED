import { createHash, createHmac, randomBytes } from 'node:crypto';

const bindingKey = randomBytes(32);
export function hashSecret(secret) { return createHash('sha256').update(secret, 'utf8').digest('hex'); }

// Authentication/enrollment is deliberately external: no HTTP registration route.
export function validInstallation(value, { alerts = false } = {}) {
  if (!value || value.active !== true || value.dnsConsent !== true || typeof value.installationId !== 'string' || value.installationId.length < 1 || value.installationId.length > 128 || typeof value.ownerGeneration !== 'string' || value.ownerGeneration.length < 1 || value.ownerGeneration.length > 128 || value.ownerGeneration !== value.currentOwnerGeneration || !/^[a-f0-9]{32}$/.test(value.audience)) return false;
  if (alerts && (value.websiteAlertConsent !== true || value.pushTarget?.installationId !== value.installationId || typeof value.pushTarget?.token !== 'string' || value.pushTarget.token.length < 1 || value.pushTarget.token.length > 4096)) return false;
  return true;
}

export function installationBinding(value) {
  if (!validInstallation(value)) return null;
  return createHmac('sha256', bindingKey).update(JSON.stringify([value.installationId, value.ownerGeneration, value.audience, value.pushTarget?.installationId ?? '', value.pushTarget?.token ?? ''])).digest('hex');
}

export function bounded(promise, signal) {
  signal?.throwIfAborted();
  if (!signal) return Promise.resolve(promise);
  return new Promise((resolve, reject) => {
    const abort = () => reject(new Error('operation cancelled'));
    signal.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) abort();
  });
}

export function createInstallationAuthorizer({ resolveInstallation = async () => null, hash, binding }) {
  return async ({ signal, alerts = false } = {}) => {
    const value = await bounded(resolveInstallation(hash, { signal }), signal);
    if (!validInstallation(value, { alerts }) || (binding && installationBinding(value) !== binding)) return null;
    // Defend the authorization snapshot against later SDK object mutation.
    return { ...value, ...(value.pushTarget ? { pushTarget: { ...value.pushTarget } } : {}) };
  };
}
