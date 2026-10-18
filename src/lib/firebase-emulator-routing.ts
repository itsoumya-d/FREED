export function firebaseEmulatorRouting(enabled: boolean, development: boolean, platform: string) {
  if (!enabled) return null;
  if (!development) throw new Error('Local test services require a development build.');
  if (platform !== 'ios' && platform !== 'android') throw new Error('Native local test services require a device build.');
  const host = platform === 'android' ? '10.0.2.2' : '127.0.0.1';
  return { authUrl: `http://${host}:9099`, functionsHost: host, functionsPort: 5001 };
}
