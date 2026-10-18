import packet from 'dns-packet';

export const MAX_QUERY_BYTES = 4096;
export const MAX_RESPONSE_BYTES = 65535;

function decodeBounded(wire, maxBytes) {
  if (!Buffer.isBuffer(wire) || wire.length < 12 || wire.length > maxBytes) throw new Error('invalid DNS size');
  const counts = [4, 6, 8, 10].map(offset => wire.readUInt16BE(offset));
  if (counts.reduce((a, b) => a + b, 0) > 512) throw new Error('too many records');
  const message = packet.decode(wire);
  if (packet.decode.bytes !== wire.length) throw new Error('trailing DNS bytes');
  return message;
}

export function canonicalName(name) {
  if (name === '.' || name === '') return '.';
  const normalized = name.replace(/\.$/, '').toLowerCase();
  if (normalized.length > 253 || !normalized.split('.').every(label => /^[a-z0-9_-]{1,63}$/.test(label))) throw new Error('invalid DNS name');
  return normalized;
}

export function parseQuery(wire) {
  const message = decodeBounded(wire, MAX_QUERY_BYTES);
  if (message.type !== 'query' || message.opcode !== 'QUERY' || message.questions.length !== 1 || message.questions[0].class !== 'IN' || message.answers.length || message.authorities.length) throw new Error('unsupported DNS query');
  canonicalName(message.questions[0].name);
  if (message.additionals.length > 1 || message.additionals.some(rr => rr.type !== 'OPT' || rr.name !== '.' || rr.extendedRcode !== 0 || rr.ednsVersion !== 0)) throw new Error('invalid EDNS');
  return message;
}

export function responseFor(query, rcode) {
  const codes = { NOERROR: 0, SERVFAIL: 2, REFUSED: 5 };
  if (!(rcode in codes)) throw new Error('invalid result');
  const opt = query.additionals?.find(rr => rr.type === 'OPT');
  // EDNS-aware synthetic replies acknowledge EDNS0 without reflecting arbitrary
  // client options, reserved flags, or unbounded advertised UDP payload sizes.
  const additionals = opt ? [{ name: '.', type: 'OPT', udpPayloadSize: Math.max(512, Math.min(1232, opt.udpPayloadSize)), extendedRcode: 0, ednsVersion: 0, flags: opt.flags & packet.DNSSEC_OK, options: [] }] : [];
  return packet.encode({ id: query.id, type: 'response', flags: (query.flags & (packet.RECURSION_DESIRED | packet.CHECKING_DISABLED)) | packet.RECURSION_AVAILABLE | codes[rcode], questions: query.questions, answers: [], authorities: [], additionals });
}

export function validateResponse(wire, query, maxBytes = MAX_RESPONSE_BYTES) {
  const message = decodeBounded(wire, maxBytes);
  const actual = message.questions[0];
  const expected = query.questions[0];
  if (message.type !== 'response' || message.opcode !== 'QUERY' || message.id !== query.id || message.questions.length !== 1 || canonicalName(actual.name) !== canonicalName(expected.name) || actual.type !== expected.type || actual.class !== expected.class) throw new Error('mismatched DNS response');
  return wire;
}
