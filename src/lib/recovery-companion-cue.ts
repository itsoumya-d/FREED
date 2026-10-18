import { generateAchievementBadges, type RecoveryState } from './recovery-state';
import type { CompanionCue } from './companion-policy';

/** Only metadata from already committed records enters character presentation. */
export function getRecoveryCompanionCue(previous: RecoveryState | null, current: RecoveryState): CompanionCue | undefined {
  if (!previous || previous === current) return;
  const earned = new Set(generateAchievementBadges(previous).filter(badge => badge.earned).map(badge => badge.id));
  const award = generateAchievementBadges(current).find(badge => badge.earned && !earned.has(badge.id));
  if (award) return { id: 'achievement:' + award.id, pose: 'celebrate', earned: true };
  const checkin = current.dailyCheckIns.find(record => !previous.dailyCheckIns.some(old => old.id === record.id && old.updatedAt === record.updatedAt));
  if (checkin) return { id: 'checkin:' + checkin.id + ':' + checkin.updatedAt, pose: 'saved' };
  const pledge = current.pledges.find(record => !previous.pledges.some(old => old.dateKey === record.dateKey));
  if (pledge) return { id: 'pledge:' + pledge.dateKey + ':' + pledge.createdAt, pose: 'saved' };
  const practice = current.dailyHabits.find(record => record.completed && !previous.dailyHabits.some(old => old.key === record.key && old.dateKey === record.dateKey && old.completed));
  if (practice) return { id: 'practice:' + practice.key + ':' + practice.dateKey + ':' + practice.updatedAt, pose: 'saved' };
  const reset = current.challengeHistory.find(record => !previous.challengeHistory.some(old => old.id === record.id));
  if (reset) return { id: 'reset:' + reset.id, pose: 'saved' };
  const slip = current.relapseRecords.find(record => !previous.relapseRecords.some(old => old.id === record.id));
  if (slip) return { id: 'slip:' + slip.id, pose: 'saved' };
}
