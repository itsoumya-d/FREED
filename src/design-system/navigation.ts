export type RootDestinationId = "today" | "shield" | "progress" | "profile";

export interface RootDestination {
  readonly id: RootDestinationId;
  readonly accessibilityLabel: string;
  readonly compactLabel: string;
}

export const ROOT_DESTINATIONS: readonly RootDestination[] = [
  { id: "today", accessibilityLabel: "Today recovery plan", compactLabel: "Today" },
  { id: "shield", accessibilityLabel: "Protection controls", compactLabel: "Protect" },
  { id: "progress", accessibilityLabel: "Recovery progress", compactLabel: "Progress" },
  { id: "profile", accessibilityLabel: "Profile and settings", compactLabel: "Profile" }
];
