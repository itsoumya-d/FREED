import {
  generateWeeklyRecoveryReport,
  type AccountabilityPartner,
  type RecoveryState,
  type SupportCircleMember
} from "@/lib/recovery-state";

export type AccountabilityContext = {
  streakDays: number;
  host?: string | null;
  challengeTitle?: string | null;
};

export type AccountabilityPlatform = "ios" | "android" | "web";

export type SponsorReport = {
  subject: string;
  body: string;
  summary: {
    rangeLabel: string;
    streakDays: number;
    bestStreakDays: number;
    attempts: number;
    slips: number;
    completedChallenges: number;
    checkIns: number;
    riskWindow: string;
    focus: string;
  };
};

function cleanContact(value: string) {
  return value.trim();
}

function redactReportText(value: string, maxLength = 220) {
  return value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(/\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn)(?:\/[^\s]*)?/gi, "[redacted-domain]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function hasUsableAccountabilityPartner(partner: AccountabilityPartner) {
  return partner.enabled && cleanContact(partner.contact).length > 0;
}

export function hasUsableSupportCircleMember(member: SupportCircleMember) {
  return member.enabled && cleanContact(member.contact).length > 0;
}

export function buildAccountabilityMessage(partner: AccountabilityPartner, context: AccountabilityContext) {
  const host = context.host?.trim() || "a risk moment";
  const challenge = context.challengeTitle?.trim() || "a reset challenge";

  return partner.messageTemplate
    .replace(/\{streak\}/g, String(context.streakDays))
    .replace(/\{host\}/g, host)
    .replace(/\{challenge\}/g, challenge)
    .slice(0, 500);
}

export function buildAccountabilityDeepLink(
  partner: AccountabilityPartner,
  context: AccountabilityContext,
  platform: AccountabilityPlatform = "ios"
) {
  if (!hasUsableAccountabilityPartner(partner)) return null;

  const contact = cleanContact(partner.contact);
  const message = buildAccountabilityMessage(partner, context);
  const encodedMessage = encodeURIComponent(message);

  if (partner.method === "email") {
    const subject = encodeURIComponent("FREED reset check-in");
    return `mailto:${encodeURIComponent(contact)}?subject=${subject}&body=${encodedMessage}`;
  }

  const separator = platform === "ios" ? "&" : "?";
  return `sms:${encodeURIComponent(contact)}${separator}body=${encodedMessage}`;
}

export function buildSponsorReport(state: RecoveryState, day: Date | string = new Date()): SponsorReport {
  const report = generateWeeklyRecoveryReport(state, day);
  const focus = redactReportText(report.nextFocus);
  const riskWindow = redactReportText(report.riskWindow, 48) || "No clear pattern yet";
  const body = [
    "FREED weekly recovery report",
    `Range: ${report.rangeLabel}`,
    `Current streak: ${Math.max(0, Math.round(state.streakDays))} days`,
    `Best streak: ${Math.max(0, Math.round(state.bestStreakDays))} days`,
    `Protected moments interrupted: ${report.attempts}`,
    `Recovery resets completed: ${report.completedChallenges}`,
    `Daily check-ins: ${report.checkIns}`,
    `Honest resets logged: ${report.slips}`,
    `Highest-risk window: ${riskWindow}`,
    `Focus: ${focus}`,
    "Private notes, contacts, and browsing details are not included."
  ].join("\n");

  return {
    subject: "FREED weekly recovery report",
    body: body.slice(0, 1_200),
    summary: {
      rangeLabel: report.rangeLabel,
      streakDays: Math.max(0, Math.round(state.streakDays)),
      bestStreakDays: Math.max(0, Math.round(state.bestStreakDays)),
      attempts: report.attempts,
      slips: report.slips,
      completedChallenges: report.completedChallenges,
      checkIns: report.checkIns,
      riskWindow,
      focus
    }
  };
}

export function buildSponsorReportDeepLink(
  partner: AccountabilityPartner,
  state: RecoveryState,
  platform: AccountabilityPlatform = "ios",
  day: Date | string = new Date()
) {
  if (!hasUsableAccountabilityPartner(partner)) return null;

  const contact = cleanContact(partner.contact);
  const report = buildSponsorReport(state, day);
  const encodedBody = encodeURIComponent(report.body);

  if (partner.method === "email") {
    return `mailto:${encodeURIComponent(contact)}?subject=${encodeURIComponent(report.subject)}&body=${encodedBody}`;
  }

  const separator = platform === "ios" ? "&" : "?";
  return `sms:${encodeURIComponent(contact)}${separator}body=${encodedBody}`;
}

export function buildSupportCircleReportDeepLink(
  member: SupportCircleMember,
  state: RecoveryState,
  platform: AccountabilityPlatform = "ios",
  day: Date | string = new Date()
) {
  if (!hasUsableSupportCircleMember(member)) return null;

  const contact = cleanContact(member.contact);
  const report = buildSponsorReport(state, day);
  const roleLabel = member.role === "family" ? "family" : member.role;
  const body = [
    report.body,
    "",
    `Shared with ${member.name || roleLabel} by user action from FREED.`
  ].join("\n").slice(0, 1_300);
  const encodedBody = encodeURIComponent(body);

  if (member.method === "email") {
    return `mailto:${encodeURIComponent(contact)}?subject=${encodeURIComponent(report.subject)}&body=${encodedBody}`;
  }

  const separator = platform === "ios" ? "&" : "?";
  return `sms:${encodeURIComponent(contact)}${separator}body=${encodedBody}`;
}
