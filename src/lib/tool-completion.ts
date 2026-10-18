import { getLocalDateKey, hydrateRecoveryState, recordDailyHabitCompletion, localDateKeyToUtcMs, type ChallengeCompletion, type DailyHabitKey, type RecoveryState } from './recovery-state';
import type { ChallengeFeedbackOutcome, RecoveryChallenge } from './recovery-engine';
import { getPracticeDefinition } from './practice-definitions';
import { markPersonalPlanDate } from './personal-daily-plan';

export type ToolCompletionReceipt = {
  id: string; sessionId: string; toolId: string; title: string; category: RecoveryChallenge['category'];
  startedAt: string; completedAt: string; dateKey: string; activeDurationSec: number;
  helpfulness?: ChallengeFeedbackOutcome; practiceKey?: DailyHabitKey;
};
export type ToolCompletionInput = Omit<ToolCompletionReceipt, 'id' | 'completedAt' | 'startedAt'> & { startedAt: Date | string | number };
export const TOOL_COMPLETION_DETAIL_LIMIT = 400;
const validIdentity = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9:_-]{1,160}$/.test(value);
const validCategories = ['physical', 'breathing', 'reflection', 'connection', 'reset'];
const validFeedback = ['helped', 'still-urging', 'unknown'];
export function sanitizeToolCompletionReceipt(value: unknown): ToolCompletionReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (!validIdentity(record.sessionId) || !validIdentity(record.toolId) || typeof record.title !== 'string' || !record.title.trim() || !validCategories.includes(String(record.category)) || typeof record.dateKey !== 'string' || !Number.isFinite(localDateKeyToUtcMs(record.dateKey))) return null;
  const started = typeof record.startedAt === 'string' ? Date.parse(record.startedAt) : Number.NaN;
  const completed = typeof record.completedAt === 'string' ? Date.parse(record.completedAt) : Number.NaN;
  if (!Number.isFinite(started) || !Number.isFinite(completed) || typeof record.activeDurationSec !== 'number' || !Number.isFinite(record.activeDurationSec) || record.activeDurationSec <= 0 || record.activeDurationSec > (completed - started) / 1000) return null;
  return { id: `tool-${record.sessionId}`, sessionId: record.sessionId, toolId: record.toolId, title: record.title.trim().replace(/\s+/g, ' ').slice(0, 72), category: record.category as RecoveryChallenge['category'], startedAt: record.startedAt as string, completedAt: record.completedAt as string, dateKey: record.dateKey, activeDurationSec: record.activeDurationSec,
    ...(validFeedback.includes(String(record.helpfulness)) ? { helpfulness: record.helpfulness as ChallengeFeedbackOutcome } : {}),
    ...(typeof record.practiceKey === 'string' && getPracticeDefinition(record.practiceKey) ? { practiceKey: record.practiceKey as DailyHabitKey } : {}) };
}
export function sanitizeToolSessionIds(value: unknown): string[] { return Array.isArray(value) ? [...new Set(value.filter(validIdentity))] : []; }
/** Only a completed session can enter reset history. This writer grants no unlock or protection event. */
export function recordToolCompletion(state: RecoveryState, input: ToolCompletionInput, at = new Date()): RecoveryState {
  if (!input.dateKey || input.dateKey !== getLocalDateKey(at)) throw new Error('tool-date-changed');
  if (!validIdentity(input.sessionId) || !validIdentity(input.toolId) || !input.title?.trim() || !validCategories.includes(input.category) || (input.helpfulness !== undefined && !validFeedback.includes(input.helpfulness)) || (input.practiceKey !== undefined && !getPracticeDefinition(input.practiceKey))) throw new RangeError('tool-invalid');
  if ((state.toolCompletionSessionIds ?? []).includes(input.sessionId) || (state.toolCompletions ?? []).some(receipt => receipt.sessionId === input.sessionId) || state.challengeHistory.some(receipt => receipt.source === 'tool' && receipt.sessionId === input.sessionId)) return state;
  const startedAt = input.startedAt instanceof Date ? new Date(input.startedAt.getTime()) : new Date(input.startedAt);
  const elapsed = (at.getTime() - startedAt.getTime()) / 1000;
  if (!Number.isFinite(elapsed) || elapsed < 0 || !Number.isFinite(input.activeDurationSec) || input.activeDurationSec <= 0 || input.activeDurationSec > elapsed) throw new RangeError('tool-duration-invalid');
  const completedAt = at.toISOString();
  const receipt: ToolCompletionReceipt = { ...input, id: `tool-${input.sessionId}`, title: input.title.trim().replace(/\s+/g, ' ').slice(0, 72), startedAt: startedAt.toISOString(), completedAt };
  const completion: ChallengeCompletion = { id: receipt.id, sessionId: receipt.sessionId, title: receipt.title, category: receipt.category, completedAt, durationSec: receipt.activeDurationSec, outcome: receipt.helpfulness ?? 'unknown', premium: false, source: 'tool', toolId: receipt.toolId, dateKey: receipt.dateKey };
  let next = hydrateRecoveryState({ ...markPersonalPlanDate(state, at), completedChallenges: state.completedChallenges + 1,
    toolCompletions: [receipt, ...(state.toolCompletions ?? [])], toolCompletionSessionIds: [...(state.toolCompletionSessionIds ?? []), receipt.sessionId], challengeHistory: [completion, ...state.challengeHistory] });
  if (input.practiceKey) next = recordDailyHabitCompletion(next, { key: input.practiceKey, label: getPracticeDefinition(input.practiceKey)!.label, completed: true }, completedAt);
  return next;
}
