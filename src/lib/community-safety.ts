import { generateWeeklyRecoveryReport, type RecoveryState } from "@/lib/recovery-state";

export const REMOTE_COMMUNITY_ENABLED_DEFAULT = false;
export const COMMUNITY_SAFETY_REVIEW_VERSION = "2026-05-13";

export type CommunityAbuseReportChannel = "in-app" | "email" | "none";

export type CommunitySafetyControls = {
  enabled: boolean;
  userOptedInAt: string | null;
  consentVersion: string | null;
  privacyDisclosureReviewed: boolean;
  communityGuidelinesAcceptedAt: string | null;
  moderationPolicyVersion: string | null;
  moderationQueueReady: boolean;
  abuseReportChannel: CommunityAbuseReportChannel;
  abuseReportResponseSlaHours: number;
  hasBlockAndMuteControls: boolean;
  blockMuteAppliesToAllSurfaces: boolean;
  aggregateOnlySharing: boolean;
  privateNotesAllowed: boolean;
  browsingDataAllowed: boolean;
  supportContactSharingAllowed: boolean;
  directMessagingAllowed: boolean;
  userGeneratedPostTextAllowed: boolean;
  dataRetentionDays: number;
  retentionDeletionReviewed: boolean;
  crisisEscalationReviewed: boolean;
};

export type CommunityReadiness = {
  ready: boolean;
  reviewVersion: typeof COMMUNITY_SAFETY_REVIEW_VERSION;
  gaps: string[];
};

export type CommunityMilestonePayload = {
  kind: "weekly-milestone";
  title: string;
  body: string;
  summary: {
    rangeLabel: string;
    streakDays: number;
    protectedMoments: number;
    completedResets: number;
    checkIns: number;
  };
  privacy: {
    aggregateOnlySharing: true;
    excludesPrivateNotes: true;
    excludesBrowsingDetails: true;
    excludesSupportContacts: true;
    excludesUserGeneratedText: true;
  };
  moderation: {
    reviewVersion: typeof COMMUNITY_SAFETY_REVIEW_VERSION;
    consentVersion: string;
    moderationPolicyVersion: string;
    abuseReportChannel: Exclude<CommunityAbuseReportChannel, "none">;
    abuseReportResponseSlaHours: number;
    blockMuteAppliesToAllSurfaces: true;
    directMessagingAllowed: false;
    userGeneratedPostTextAllowed: false;
  };
  retention: {
    dataRetentionDays: number;
    deletionReviewed: true;
  };
};

export function createDefaultCommunitySafetyControls(): CommunitySafetyControls {
  return {
    enabled: REMOTE_COMMUNITY_ENABLED_DEFAULT,
    userOptedInAt: null,
    consentVersion: null,
    privacyDisclosureReviewed: false,
    communityGuidelinesAcceptedAt: null,
    moderationPolicyVersion: null,
    moderationQueueReady: false,
    abuseReportChannel: "none",
    abuseReportResponseSlaHours: 0,
    hasBlockAndMuteControls: false,
    blockMuteAppliesToAllSurfaces: false,
    aggregateOnlySharing: true,
    privateNotesAllowed: false,
    browsingDataAllowed: false,
    supportContactSharingAllowed: false,
    directMessagingAllowed: false,
    userGeneratedPostTextAllowed: false,
    dataRetentionDays: 0,
    retentionDeletionReviewed: false,
    crisisEscalationReviewed: false
  };
}

function hasValidIsoDate(value: string | null) {
  return typeof value === "string" && value.length > 0 && !Number.isNaN(Date.parse(value));
}

export function getRemoteCommunityReadiness(
  controls: CommunitySafetyControls = createDefaultCommunitySafetyControls()
): CommunityReadiness {
  const gaps: string[] = [];

  if (!controls.enabled) gaps.push("remote-community-disabled-by-default");
  if (!hasValidIsoDate(controls.userOptedInAt)) gaps.push("missing-explicit-user-consent");
  if (!controls.consentVersion) gaps.push("missing-consent-version");
  if (!controls.privacyDisclosureReviewed) gaps.push("missing-privacy-disclosure-review");
  if (!hasValidIsoDate(controls.communityGuidelinesAcceptedAt)) gaps.push("missing-community-guidelines-acceptance");
  if (!controls.moderationPolicyVersion) gaps.push("missing-moderation-policy-review");
  if (!controls.moderationQueueReady) gaps.push("missing-moderation-queue");
  if (controls.abuseReportChannel === "none") gaps.push("missing-abuse-report-channel");
  if (
    !Number.isFinite(controls.abuseReportResponseSlaHours) ||
    controls.abuseReportResponseSlaHours < 1 ||
    controls.abuseReportResponseSlaHours > 24
  ) {
    gaps.push("abuse-report-sla-must-be-between-1-and-24-hours");
  }
  if (!controls.hasBlockAndMuteControls) gaps.push("missing-block-and-mute-controls");
  if (!controls.blockMuteAppliesToAllSurfaces) gaps.push("block-and-mute-must-cover-all-surfaces");
  if (!controls.aggregateOnlySharing) gaps.push("sharing-must-stay-aggregate-only");
  if (controls.privateNotesAllowed) gaps.push("private-notes-must-not-be-shared");
  if (controls.browsingDataAllowed) gaps.push("browsing-details-must-not-be-shared");
  if (controls.supportContactSharingAllowed) gaps.push("support-contacts-must-not-be-shared");
  if (controls.directMessagingAllowed) gaps.push("remote-direct-messaging-must-stay-disabled-until-reviewed");
  if (controls.userGeneratedPostTextAllowed) gaps.push("user-generated-community-text-must-stay-disabled");
  if (!Number.isFinite(controls.dataRetentionDays) || controls.dataRetentionDays < 1 || controls.dataRetentionDays > 30) {
    gaps.push("data-retention-must-be-between-1-and-30-days");
  }
  if (!controls.retentionDeletionReviewed) gaps.push("missing-retention-deletion-review");
  if (!controls.crisisEscalationReviewed) gaps.push("missing-crisis-escalation-review");

  return {
    ready: gaps.length === 0,
    reviewVersion: COMMUNITY_SAFETY_REVIEW_VERSION,
    gaps
  };
}

export function buildCommunityMilestonePayload(
  state: RecoveryState,
  controls: CommunitySafetyControls,
  day: Date | string = new Date()
): CommunityMilestonePayload {
  const report = generateWeeklyRecoveryReport(state, day);
  const streakDays = Math.max(0, Math.round(state.streakDays));
  const protectedMoments = Math.max(0, report.attempts);
  const completedResets = Math.max(0, report.completedChallenges);
  const checkIns = Math.max(0, report.checkIns);

  return {
    kind: "weekly-milestone",
    title: `${streakDays} clean-day streak`,
    body: `${report.rangeLabel}: ${protectedMoments} protected moments, ${completedResets} recovery resets, ${checkIns} check-ins.`,
    summary: {
      rangeLabel: report.rangeLabel,
      streakDays,
      protectedMoments,
      completedResets,
      checkIns
    },
    privacy: {
      aggregateOnlySharing: true,
      excludesPrivateNotes: true,
      excludesBrowsingDetails: true,
      excludesSupportContacts: true,
      excludesUserGeneratedText: true
    },
    moderation: {
      reviewVersion: COMMUNITY_SAFETY_REVIEW_VERSION,
      consentVersion: controls.consentVersion ?? "",
      moderationPolicyVersion: controls.moderationPolicyVersion ?? "",
      abuseReportChannel: controls.abuseReportChannel === "none" ? "in-app" : controls.abuseReportChannel,
      abuseReportResponseSlaHours: Math.max(1, Math.min(24, Math.round(controls.abuseReportResponseSlaHours))),
      blockMuteAppliesToAllSurfaces: true,
      directMessagingAllowed: false,
      userGeneratedPostTextAllowed: false
    },
    retention: {
      dataRetentionDays: Math.max(1, Math.min(30, Math.round(controls.dataRetentionDays))),
      deletionReviewed: true
    }
  };
}

export function buildGatedCommunityMilestone(
  state: RecoveryState,
  controls: CommunitySafetyControls = createDefaultCommunitySafetyControls(),
  day: Date | string = new Date()
) {
  const readiness = getRemoteCommunityReadiness(controls);
  return {
    readiness,
    payload: readiness.ready ? buildCommunityMilestonePayload(state, controls, day) : null
  };
}
