import {
  mobileTokens,
  type MobileTokenProfile
} from "./generated/tokens";

export type LayoutClass = "compact" | "medium" | "expanded";
export type ProtectionStatus = "protected" | "attention" | "unprotected";

export interface FreedTheme {
  readonly profile: MobileTokenProfile;
  readonly statusColors: Readonly<Record<ProtectionStatus, string>>;
}

export interface StatusPresentation {
  readonly icon: "shield-check" | "shield-alert" | "shield-off";
  readonly label: string;
  readonly color: string;
}

type SemanticStatusPath =
  | "semantic.status.protected"
  | "semantic.status.attention"
  | "semantic.status.unprotected";

function semanticColor(profile: MobileTokenProfile, path: SemanticStatusPath): string {
  const value = mobileTokens.profiles[profile][path as keyof typeof mobileTokens.profiles.base];
  if (typeof value !== "string") {
    throw new Error(`Expected semantic color token at ${path}.`);
  }
  return value;
}

export function resolveTheme(profile: MobileTokenProfile = "base"): FreedTheme {
  return {
    profile,
    statusColors: {
      protected: semanticColor(profile, "semantic.status.protected"),
      attention: semanticColor(profile, "semantic.status.attention"),
      unprotected: semanticColor(profile, "semantic.status.unprotected")
    }
  };
}

export function getLayoutClass(width: number): LayoutClass {
  if (width < 600) return "compact";
  if (width < 840) return "medium";
  return "expanded";
}

export function getStatusPresentation(
  status: ProtectionStatus,
  theme: FreedTheme = resolveTheme()
): StatusPresentation {
  const presentations: Readonly<Record<ProtectionStatus, Omit<StatusPresentation, "color">>> = {
    protected: { icon: "shield-check", label: "Protection is active" },
    attention: { icon: "shield-alert", label: "Protection needs attention" },
    unprotected: { icon: "shield-off", label: "Protection is not active" }
  };

  return { ...presentations[status], color: theme.statusColors[status] };
}
