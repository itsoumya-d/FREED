const { readFileSync } = require('node:fs');
const { join } = require('node:path');

const entitlement = 'com.apple.developer.networking.networkextension';
const forbiddenApis = /NEPacketTunnel|NETunnelProvider|NEVPN|NEDNSProxy|NEAppProxy|NETransparentProxy/;
const tlsOverrides = /sslSocketFactory\s*[({]|hostnameVerifier\s*[({]|X509TrustManager|NSURLAuthenticationMethodServerTrust|SecTrustSetAnchorCertificates|serverTrust/;

function readEncryptedDnsSafetySources(root = process.cwd()) {
  const read = path => readFileSync(join(root, path), 'utf8');
  const android = 'modules/freed-protection/android/src/main/java/app/freed/protection/';
  return {
    iosModule: read('modules/freed-protection/ios/FreedProtectionModule.swift'),
    infoPlist: read('ios/FREED/Info.plist'),
    entitlements: read('ios/FREED/FREED.entitlements'),
    plugin: require(join(root, 'modules/freed-protection/app.plugin.js')),
    appConfig: JSON.parse(read('app.json')),
    vpnService: read(`${android}FreedVpnService.kt`),
    upstream: read(`${android}FreedEncryptedDnsUpstream.kt`),
    dohPolicy: read(`${android}FreedDohPolicy.kt`),
    socketFactory: read(`${android}FreedProtectedSocketFactory.kt`),
    transportPolicy: read(`${android}FreedEncryptedDnsPolicy.kt`)
  };
}

function plistFalse(source, key) {
  const values = [...source.matchAll(new RegExp(`<key>${key}</key>\\s*(<[^>]+>)`, 'g'))];
  return values.length === 1 && /^<false\s*\/>$/.test(values[0][1]);
}

// Swift source precheck only: preserve literals as atomic tokens, discard line
// and nested block comments, and balance actual braces. A quoted/commented
// lookalike cannot supply a missing public API call or successful readback.
function swiftTokens(source) {
  const tokens = [];
  const stringPattern = /(#*)("""|")/y;
  const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/y;
  for (let i = 0; i < source.length;) {
    if (/\s/.test(source[i])) { i++; continue; }
    if (source.startsWith('//', i)) { const end = source.indexOf('\n', i); i = end < 0 ? source.length : end; continue; }
    if (source.startsWith('/*', i)) {
      let depth = 1; i += 2;
      while (i < source.length && depth) {
        if (source.startsWith('/*', i)) { depth++; i += 2; }
        else if (source.startsWith('*/', i)) { depth--; i += 2; }
        else i++;
      }
      if (depth) return [];
      continue;
    }
    stringPattern.lastIndex = i;
    const string = stringPattern.exec(source);
    if (string) {
      const start = i, delimiter = string[2] + string[1]; i += string[0].length;
      while (i < source.length && !source.startsWith(delimiter, i)) {
        if (!string[1] && source[i] === '\\') i += 2;
        else i++;
      }
      if (i >= source.length) return [];
      i += delimiter.length;
      tokens.push('literal:' + source.slice(start, i));
      continue;
    }
    identifierPattern.lastIndex = i;
    const identifier = identifierPattern.exec(source)?.[0];
    tokens.push(identifier ?? source[i]); i += identifier?.length ?? 1;
  }
  return tokens;
}
function sequenceIndex(tokens, expected) {
  const wanted = swiftTokens(expected);
  if (!wanted.length) return -1;
  return tokens.findIndex((_, index) => wanted.every((token, offset) => tokens[index + offset] === token));
}
function swiftBody(tokens, header) {
  const start = sequenceIndex(tokens, header);
  if (start < 0) return [];
  const open = tokens.indexOf('{', start);
  let depth = 1;
  for (let end = open + 1; open >= 0 && end < tokens.length; end++) {
    if (tokens[end] === '{') depth++;
    if (tokens[end] === '}' && --depth === 0) return tokens.slice(open + 1, end);
  }
  return [];
}
function inspectPublicDnsSettings(source) {
  const tokens = swiftTokens(source);
  const controller = swiftBody(tokens, 'private final class FreedEncryptedDnsController {');
  const status = swiftBody(controller, 'func status() async -> [String: Any] {');
  const configure = swiftBody(controller, 'func configure(enabled: Bool) async -> [String: Any] {');
  const snapshot = swiftBody(controller, 'private func snapshot(_ manager: NEDNSSettingsManager,');
  const has = (body, expected) => sequenceIndex(body, expected) >= 0;
  const expectedStatus = swiftTokens(`
    let operationId = UUID().uuidString
    guard supported else { return payload(configured: saved, error: unavailableReason) }
    guard !changingConfiguration else { return payload(configured: saved, error: "ios-dns-configuration-in-progress") }
    changingConfiguration = true
    defer { changingConfiguration = false }
    do {
      let manager = NEDNSSettingsManager.shared()
      try await manager.loadFromPreferences()
      return snapshot(manager, operationId: operationId)
    } catch {
      return payload(configured: false, error: "ios-dns-preferences-load-failed", nativeError: error, operationId: operationId, stage: "dns-load")
    }
  `);
  return status.length === expectedStatus.length && status.every((token, index) => token === expectedStatus[index]) &&
    has(controller, 'private let url = URL(string: "https://family.cloudflare-dns.com/dns-query")!') &&
    has(controller, 'private let servers = ["1.1.1.3", "1.0.0.3", "2606:4700:4700::1113", "2606:4700:4700::1003"]') &&
    has(configure, 'let manager = NEDNSSettingsManager.shared() do { try await manager.loadFromPreferences() } catch {') &&
    has(configure, 'let settings = NEDNSOverHTTPSSettings(servers: servers) settings.serverURL = url settings.matchDomains = [""] settings.matchDomainsNoSearch = true') &&
    has(configure, 'manager.dnsSettings = settings') &&
    has(configure, 'manager.onDemandRules = nil try await manager.saveToPreferences()') &&
    has(configure, 'if manager.dnsSettings != nil { try await manager.removeFromPreferences() } try setSaved(false)') &&
    has(configure, `do { try await manager.loadFromPreferences()
      return configurationResult(enabled: enabled, operationId: operationId, result: snapshot(manager, operationId: operationId, generation: configurationGeneration, stage: enabled ? "dns-save-readback" : "dns-remove-readback"), generation: configurationGeneration)
      } catch { return configurationResult(enabled: enabled, operationId: operationId, result: payload(configured: saved, error: "ios-dns-preferences-load-failed", nativeError: error)) }`) &&
    has(snapshot, 'let settings = manager.dnsSettings as? NEDNSOverHTTPSSettings') &&
    has(snapshot, 'let hasSettings = manager.dnsSettings != nil, protocolMatches = settings != nil') &&
    has(snapshot, 'let urlMatches = settings?.serverURL == url') &&
    has(snapshot, 'let serversMatch = settings?.servers.sorted() == servers.sorted()') &&
    has(snapshot, 'let domainsMatch = settings?.matchDomains == [""]') &&
    has(snapshot, 'let noSearchMatch = settings?.matchDomainsNoSearch == true') &&
    has(snapshot, 'let rulesMatch = manager.onDemandRules == nil') &&
    has(snapshot, 'let configured = hasSettings && protocolMatches && urlMatches && serversMatch && domainsMatch && noSearchMatch && rulesMatch && (!failoverSupported || failoverMatch == true)') &&
    has(snapshot, 'FreedEncryptedDnsPolicy.status(supported: supported, releaseEnabled: releaseEnabled, configured: configured, managerEnabled: manager.isEnabled,') &&
    !has(tokens, 'manager.isEnabled =') && !/manager\.isEnabled\s*=/.test(source) && !forbiddenApis.test(source);
}

/** Conservative source/build precheck; it cannot certify entitlement or device health. */
function inspectIosEncryptedDnsSafety(sources) {
  const { iosModule: source, plugin, appConfig } = sources;
  let pluginDefaultsOff = false;
  let pluginDnsOnlyOptIn = false;
  try {
    const defaults = plugin.applyDnsInfoPlist({});
    const defaultEntitlements = plugin.applyDnsEntitlements({});
    const refusedStrings = plugin.applyDnsInfoPlist({}, { releaseEnabled: 'true', devPreview: 'true' });
    const enabledEntitlements = plugin.applyDnsEntitlements({}, { releaseEnabled: true });
    const disabledEntitlements = plugin.applyDnsEntitlements({ [entitlement]: ['dns-settings'] }, { releaseEnabled: false, devPreview: false });
    pluginDefaultsOff = defaults.FreedEncryptedDnsReleaseEnabled === false && defaults.FreedEncryptedDnsDevPreview === false &&
      !defaultEntitlements[entitlement] && refusedStrings.FreedEncryptedDnsReleaseEnabled === false && refusedStrings.FreedEncryptedDnsDevPreview === false && !disabledEntitlements[entitlement];
    pluginDnsOnlyOptIn = JSON.stringify(enabledEntitlements[entitlement]) === '["dns-settings"]';
  } catch { /* A missing/broken build plugin fails closed. */ }
  const plugins = appConfig?.expo?.plugins ?? [];
  const configuredPlugins = plugins.filter(item => (Array.isArray(item) ? item[0] : item)?.includes?.('freed-protection'));
  const appConfigReleaseOff = configuredPlugins.every(item => !Array.isArray(item) || (!item[1]?.releaseEnabled && !item[1]?.devPreview));
  return {
    pluginDefaultsOff,
    pluginDnsOnlyOptIn,
    currentReleaseOff: plistFalse(sources.infoPlist, 'FreedEncryptedDnsReleaseEnabled') && plistFalse(sources.infoPlist, 'FreedEncryptedDnsDevPreview') &&
      !sources.entitlements.includes(entitlement) && appConfigReleaseOff,
    nativeEnablementGated: source.includes('Bundle.main.object(forInfoDictionaryKey: "FreedEncryptedDnsReleaseEnabled") as? Bool == true') &&
      /#if DEBUG\s+return releaseEnabled \|\| Bundle\.main\.object\(forInfoDictionaryKey: "FreedEncryptedDnsDevPreview"\) as\? Bool == true\s+#else\s+return releaseEnabled/.test(source) &&
      /#if targetEnvironment\(simulator\)\s+return false/.test(source) &&
      /if enabled && !supported \{ return payload\(configured: saved, error: unavailableReason\) \}/.test(source) &&
      /guard let enabled = configuration\["enabled"\] as\? Bool,\s*configuration\["provider"\] as\? String == "cloudflare-families" else/.test(source),
    publicDnsSettingsOnly: inspectPublicDnsSettings(source),
    truthfulHealth: source.includes('"healthy": NSNull()') && source.includes('"ios-dns-health-unverified"') && source.includes('"ios-dns-settings-enable-required"'),
    normalTls: !tlsOverrides.test(source) && !/http:\/\/family\.cloudflare-dns/.test(source)
  };
}

function inspectAndroidEncryptedDnsSafety(sources) {
  const { upstream, dohPolicy, socketFactory, transportPolicy, vpnService } = sources;
  return {
    protectedHttps: upstream.includes('.socketFactory(FreedProtectedSocketFactory(protectSocket))') &&
      socketFactory.includes('if (!protectSocket(socket)) throw IOException') && socketFactory.includes('socket.close()') &&
      upstream.includes('.dns(object : Dns') && upstream.includes('FreedDohPolicy.bootstrapAddresses(hostname)') &&
      dohPolicy.includes('https://family.cloudflare-dns.com/dns-query') && dohPolicy.includes('if (host != HOST) throw UnknownHostException') &&
      upstream.includes('.proxy(Proxy.NO_PROXY)') && upstream.includes('.followRedirects(false)') && upstream.includes('.followSslRedirects(false)') &&
      upstream.includes('.callTimeout(5, TimeUnit.SECONDS)') && !tlsOverrides.test([upstream, dohPolicy, socketFactory].join('\n')),
    noPlaintextFallback: /if \(encryptedRequested\) encrypted\(\) else plaintext\(\)/.test(transportPolicy) &&
      vpnService.includes('FreedEncryptedDnsPolicy.forward(FreedEncryptedDnsConfig.isRequested(this) || FreedRecoveryDnsPilot.activeOrUnknown(this),') &&
      vpnService.includes('{ forwardEncryptedDns(dnsPayload) }, { forwardPlaintextDns(dnsPayload) }') &&
      vpnService.includes('if (!pilotSelected && !FreedEncryptedDnsConfig.capability(this).supported) {') &&
      vpnService.includes('if (pilotSelected && !FreedRecoveryDnsPilot.supported(this)) {') &&
      vpnService.includes('descriptor == FreedRecoveryDnsPilot.activeDescriptor(this)') &&
      vpnService.includes('providerEpoch != recoveryProviderEpoch.get() || generation != encryptedDnsHealthGeneration') &&
      vpnService.includes('FreedEncryptedDnsConfig.withPlaintextPermission(this)'),
    boundedValidatedResponses: upstream.includes('FreedDohPolicy.readResponseBody(body.byteStream())') &&
      upstream.includes('FreedDohPolicy.acceptResponse(') && dohPolicy.includes('MAX_RESPONSE_BYTES = 4096') &&
      dohPolicy.includes('response.size !in 12..MAX_RESPONSE_BYTES') && dohPolicy.includes('query.copyOfRange(12, end).contentEquals(response.copyOfRange(12, responseEnd))')
  };
}

module.exports = { readEncryptedDnsSafetySources, inspectIosEncryptedDnsSafety, inspectAndroidEncryptedDnsSafety };
