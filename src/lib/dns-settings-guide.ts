import { normalizeEncryptedDnsStatus } from './encrypted-dns';

export const DNS_GUIDE_STORAGE_KEY = 'freed.dns.settings-guide.v1';
export type DnsGuideStage = 0 | 1 | 2;
const isStage = (value: unknown): value is DnsGuideStage => value === 0 || value === 1 || value === 2;

/** Visual position is never evidence of saved preferences or OS selection. */
export function getDnsSettingsGuide(status: unknown, stage: unknown) {
  const safe = normalizeEncryptedDnsStatus(status);
  if (!safe.supported || !safe.releaseEnabled || !safe.configured || safe.enabled || !safe.configurationLabel) return null;
  return { label: safe.configurationLabel, stage: isStage(stage) ? stage : 0 as DnsGuideStage };
}
export function restoreDnsGuideStage(value: string | null, label: string): DnsGuideStage {
  try {
    const saved = JSON.parse(value ?? 'null');
    return saved?.version === 1 && saved.label === label && isStage(saved.stage) ? saved.stage : 0;
  } catch { return 0; }
}
