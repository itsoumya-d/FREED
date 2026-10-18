#!/usr/bin/env node
// Only published Cloudflare test domains and example.com are queried. No credentials or browsing data.
const fs = require('node:fs');
const path = require('node:path');
const provider = 'https://family.cloudflare-dns.com/dns-query';
const cases = [
  { domain: 'nudity.testcategory.com', expectedBlocked: true, purpose: 'published adult-filter test' },
  { domain: 'malware.testcategory.com', expectedBlocked: true, purpose: 'published malware-filter test' },
  { domain: 'example.com', expectedBlocked: false, purpose: 'ordinary-domain control' },
];
async function main() {
  const results = await Promise.all(cases.map(async scenario => {
    try {
      const response = await fetch(`${provider}?name=${scenario.domain}&type=A`, { headers: { accept: 'application/dns-json' }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Resolver returned HTTP ${response.status}`);
      const answer = await response.json();
      const addresses = (answer.Answer ?? []).filter(item => item.type === 1).map(item => item.data);
      const blocked = answer.Status === 3 || addresses.includes('0.0.0.0');
      const ordinaryResolved = answer.Status === 0 && addresses.some(ip => ip !== '0.0.0.0');
      return { ...scenario, dnsStatus: answer.Status, blocked, ordinaryResolved, passed: scenario.expectedBlocked ? blocked : ordinaryResolved };
    } catch (error) { return { ...scenario, passed: false, error: error.message }; }
  }));
  const output = path.resolve('docs/validation/artifacts/2026-10-02-premium-cloudflare/provider-check.json');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify({ generatedAt: new Date().toISOString(), provider, scope: 'Public resolver check only. This does not prove mobile routing or physical-device enforcement.', accountSetupRequired: false, results }, null, 2) + '\n');
  for (const result of results) console.log(`${result.passed ? 'PASS' : 'FAIL'} ${result.domain}${result.error ? `: ${result.error}` : ''}`);
  console.log(output);
  if (results.some(result => !result.passed)) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
