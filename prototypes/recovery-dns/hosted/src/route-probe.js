import packet from 'dns-packet';
import { canonicalName } from './dns.js';

// Installation-authenticated, nonce-bound configuration check only. These
// unique names are not browsing targets, achievements or app-unlock authority.
export function routeProbe(query) {
  const name = canonicalName(query.questions[0].name);
  const match = /^(a|b)\.([a-f0-9]{32})\.probe\.freedrecovery\.web\.app$/.exec(name);
  if (!match) return null;
  if (match[1] === 'b') return { kind: 'deny' };
  const type = query.questions[0].type;
  const answers = type === 'A' || type === 'AAAA' ? [{ name, type, class: 'IN', ttl: 0, data: type === 'A' ? '198.51.100.42' : '2001:db8::42' }] : [];
  const opt = query.additionals?.find(record => record.type === 'OPT');
  const additionals = opt ? [{ name: '.', type: 'OPT', udpPayloadSize: Math.max(512, Math.min(1232, opt.udpPayloadSize)), extendedRcode: 0, ednsVersion: 0, flags: opt.flags & packet.DNSSEC_OK, options: [] }] : [];
  return { kind: 'allow', wire: packet.encode({ type: 'response', id: query.id, flags: (query.flags & packet.RECURSION_DESIRED) | packet.RECURSION_AVAILABLE, questions: query.questions, answers, authorities: [], additionals }) };
}
