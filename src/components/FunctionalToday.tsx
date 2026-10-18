import React from 'react';
import { Activity, BookOpen, MessageCircleHeart, NotebookPen, Waves } from 'lucide-react-native';
import { MomentumToday, type MomentumHabit } from './MomentumToday';
import { useMotionSettings } from '@/design-system/motion';
import { useTodayClock } from './use-today-clock';
import { buildRecoveryDaySnapshot } from '@/lib/recovery-day-snapshot';
import { getPersonalDailyPlan } from '@/lib/personal-daily-plan';
import { getLocalDateKey, isCheckInCompleted, hasPledgedOnDate, type DailyHabitKey, type RecoveryState } from '@/lib/recovery-state';
import { getProtectionSetupReadiness } from '@/lib/protection-readiness';
import { practiceDefinitions } from '@/lib/practice-definitions';
import type { CompanionCue } from './MomentumCompanion';
import { appI18n, translateSource } from '@/i18n/runtime';
import { useAdultProtectionPresentation } from '@/hooks/use-adult-protection-presentation';
import type { ProtectionCapability, ProtectionStatus } from 'freed-protection';
import type { AdultProtectionObservations } from '@/lib/adult-protection-presentation';
import { getAppProtectionPresentation } from '@/lib/app-protection-presentation';
import type { AppGroupsSnapshot } from '@/lib/app-groups-contract';
export type FunctionalTodayProps = {
  recoveryState: RecoveryState; streakDays: number; protectionReadiness: ReturnType<typeof getProtectionSetupReadiness>;
  protectionCapability?: ProtectionCapability | null; protectionStatus?: ProtectionStatus | null;
  protectionObservations?: AdultProtectionObservations | null; protectionSyncing?: boolean; protectionSyncMessage?: string | null;
  protectionGroups?: AppGroupsSnapshot | null; protectionGroupsPending?: boolean; protectionGroupsError?: string | null; protectionGroupsWaitingForOwner?: boolean;
  onCheckIn: () => void; onJournal: () => void; onPanic: () => void; onMovement: () => void; onBreathing: () => void; onCoach: () => void;
  onAttempt?: (url: string) => void;
  openAllPractices?: boolean; initialPracticeKey?: DailyHabitKey; onAllFeatures?: () => void; protectionGoal?: 'websites' | 'apps' | 'both' | 'none'; onOpenLibrary: () => void; onOpenShield: () => void; onOpenProgress: () => void;
  onHabitToggle: (habit: MomentumHabit & { key: DailyHabitKey; dateKey: string }) => void;
  onPlanChange: (keys: DailyHabitKey[], dateKey: string) => void; onTakePledge: () => void;
  resumableChallengeTitle?: string; onResumeChallenge?: () => void; companionCue?: CompanionCue;
  [extra: string]: unknown;
};
export function FunctionalToday(props: FunctionalTodayProps) {
  const adult = useAdultProtectionPresentation({ capability: props.protectionCapability, status: props.protectionStatus, observations: props.protectionObservations, syncing: props.protectionSyncing, syncMessage: props.protectionSyncMessage });
  const appProtection = getAppProtectionPresentation({ modernGroups: props.protectionCapability?.appGroups === true, groups: props.protectionGroups, pending: props.protectionGroupsPending, error: props.protectionGroupsError, waitingForOwner: props.protectionGroupsWaitingForOwner, legacy: props.protectionReadiness.appLimits });
  const now = useTodayClock(useMotionSettings().active), today = new Date(now), dateKey = getLocalDateKey(today);
  const snapshot = buildRecoveryDaySnapshot(props.recoveryState, today, now);
  const plan = getPersonalDailyPlan(props.recoveryState, today, now);
  const habits = snapshot.practices.map(item => ({ key: item.key, label: appI18n.t(`companion.practices.${item.key}.title`), detail: appI18n.t(`companion.practices.${item.key}.detail`), category: item.category, done: item.done, dateKey }));
  const checkIn = isCheckInCompleted(snapshot.checkIn);
  const practiceAction = (key: DailyHabitKey) => key === 'journal' ? props.onJournal() : key === 'meditation' ? props.onBreathing() : key === 'exercise' ? props.onMovement() : props.onOpenLibrary();
  const next = habits.find(item => plan?.practiceKeys.includes(item.key) && !item.done);
  const goalIncomplete = props.protectionGoal === 'websites' ? !adult.verified : props.protectionGoal === 'apps' ? !appProtection.ready : props.protectionGoal === 'both' ? !adult.verified || !appProtection.ready : false;
  const action = props.resumableChallengeTitle && props.onResumeChallenge ? { label: 'Continue saved reset', reason: 'Your interrupted activity is ready to resume.', press: props.onResumeChallenge } : goalIncomplete ? { label: 'Finish your chosen protection', reason: 'Complete the protection goal you selected. Website and app protection work independently.', press: props.onOpenShield } : !checkIn ? { label: "Start today's check-in", reason: 'Record how you feel to understand your patterns.', press: props.onCheckIn } : next ? { label: `${translateSource('Start practice')} · ${next.label}`, reason: "A practice you chose for today's plan.", press: () => practiceAction(next.key) } : { label: 'Explore recovery tools', reason: 'Your daily plan is recorded. Support stays available whenever you need it.', press: props.onOpenLibrary };
  const website = adult.verified, apps = appProtection.ready;
  return <MomentumToday today={today} selectedDate={today} onSelectDate={() => undefined} snapshot={snapshot} days={props.streakDays} elapsed="" milestone="" milestoneProgress={0} onProgress={props.onOpenProgress} onAllFeatures={props.onAllFeatures} openAllPractices={props.openAllPractices} initialPracticeKey={props.initialPracticeKey}
    protectionLabel={website ? 'Adult website protection on' : adult.status === 'Needs attention' ? 'Adult websites' : apps ? 'App protection ready' : 'Choose your protection'} protectionDetail={`${translateSource('Adult websites')}: ${translateSource(adult.status)} · ${translateSource('Apps')}: ${translateSource(appProtection.status)}. ${translateSource(adult.nextAction)}`} protectionReady={website || apps} onProtection={props.onOpenShield}
    actionLabel={action.label} actionReason={action.reason} actionPracticeKey={!goalIncomplete && checkIn && !props.resumableChallengeTitle && next && !['exercise','meditation','journal'].includes(next.key) ? next.key : undefined} onAction={action.press} onPanic={props.onPanic} plannedKeys={plan?.practiceKeys ?? []} checkInCompleted={checkIn} onCheckIn={props.onCheckIn} onPlanChange={keys => props.onPlanChange(keys, dateKey)} habits={habits} onHabitToggle={habit => { const current = habits.find(item => item.key === habit.key); if (current) return props.onHabitToggle(current); }} onPracticeAction={practiceAction} pledged={hasPledgedOnDate(props.recoveryState)} onPledge={props.onTakePledge}
    companionPose={!checkIn ? 'listen' : next?.key === 'journal' ? 'write' : 'guide'} companionCue={props.companionCue} companionHelp={{ title: translateSource('Your next step'), body: translateSource(action.reason), actions: [{ label: translateSource('Breathe'), onPress: props.onBreathing }, { label: translateSource('Write'), onPress: props.onJournal }] }}
    tools={[{ label: 'Breathe', detail: '', Icon: Waves, press: props.onBreathing }, { label: 'Move', detail: '', Icon: Activity, press: props.onMovement }, { label: 'Write', detail: '', Icon: NotebookPen, press: props.onJournal }, { label: 'Talk', detail: '', Icon: MessageCircleHeart, press: props.onCoach }]} />;
}
