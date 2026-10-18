import type { DailyHabitKey } from './recovery-state';

export type PracticeCategory = 'commitment' | 'movement' | 'reflection' | 'calm';
export type PracticeDefinition = {
  key: DailyHabitKey; label: string; category: PracticeCategory; detail: string;
  instructions: readonly string[];
  action?: 'journal' | 'movement' | 'breathing'; actionLabel?: string;
};
/** These are self-reported daily practices. Guided tools do not complete them. */
export const practiceDefinitions: readonly PracticeDefinition[] = [
  { key: 'adult-content-boundary', label: 'No adult content', category: 'commitment', detail: 'Your daily record', instructions: ['Choose the boundary you want to keep today.', 'Put your phone away from the places where urges usually rise.', 'Record this practice only when it reflects your day.'] },
  { key: 'exercise', label: 'Exercise', category: 'movement', detail: 'Move your body', instructions: ['Choose a comfortable movement you can do safely.', 'Take a short walk or try comfortable basic movement.', 'Return here to record the movement you completed.'], action: 'movement', actionLabel: 'Open basic movement' },
  { key: 'journal', label: 'Journal', category: 'reflection', detail: 'Be honest with yourself', instructions: ['Find a quiet moment and open your private Journal.', 'Write one honest reflection about what helped or felt difficult.', 'Save your reflection in Journal, then review your daily record.'], action: 'journal', actionLabel: 'Open Journal' },
  { key: 'meditation', label: 'Meditation', category: 'calm', detail: 'Find a quiet minute', instructions: ['Sit comfortably and let your shoulders relax.', 'Notice your breath without forcing it.', 'Use guided breathing if helpful, then record the time you took.'], action: 'breathing', actionLabel: 'Open guided breathing' },
  { key: 'cold-shower', label: 'Cold shower', category: 'calm', detail: 'Refresh your routine', instructions: ['Choose a comfortable shower temperature.', 'Cool the water only if it feels safe and comfortable for you.', 'Record the practice you chose for today.'] },
  { key: 'social-media-boundary', label: 'No social media', category: 'commitment', detail: 'Protect your attention', instructions: ['Choose a social media boundary for today.', 'Move distracting apps out of reach during your protected time.', 'Record this practice only when it reflects your day.'] },
];
export function getPracticeDefinition(key: string): PracticeDefinition | undefined {
  return practiceDefinitions.find(practice => practice.key === key);
}
