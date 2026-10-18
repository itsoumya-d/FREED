/** Historical evidence metadata only; never a license or native grant authority. */
export type AuthoredTemplateRevision = { id: string; revision: number };
export type CompletionProvenance = {
  version: 1;
  method: 'timer' | 'motion' | 'steps' | 'location' | 'photo' | 'connection';
  verificationRuleVersion: 1;
  template?: AuthoredTemplateRevision;
};
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
export function sanitizeAuthoredTemplateRevision(value: unknown, expectedId?: string): AuthoredTemplateRevision | undefined {
  if (!object(value) || Object.keys(value).some(key => !['id', 'revision'].includes(key)) ||
    typeof value.id !== 'string' || !/^[A-Za-z0-9:_-]{1,160}$/.test(value.id) || expectedId !== undefined && value.id !== expectedId ||
    typeof value.revision !== 'number' || !Number.isSafeInteger(value.revision) || value.revision < 1) return undefined;
  return { id: value.id, revision: value.revision };
}
export function sanitizeCompletionProvenance(value: unknown, expectedId?: string): CompletionProvenance | undefined {
  if (!object(value) || Object.keys(value).some(key => !['version', 'method', 'verificationRuleVersion', 'template'].includes(key)) ||
    value.version !== 1 || value.verificationRuleVersion !== 1 || typeof value.method !== 'string' || !['timer', 'motion', 'steps', 'location', 'photo', 'connection'].includes(value.method)) return undefined;
  const template = value.template === undefined ? undefined : sanitizeAuthoredTemplateRevision(value.template, expectedId);
  if (value.template !== undefined && !template) return undefined;
  return { version: 1, method: value.method as CompletionProvenance['method'], verificationRuleVersion: 1, ...(template ? { template } : {}) };
}
