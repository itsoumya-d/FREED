export type RootDestinationId = "today" | "shield" | "progress" | "profile";

export interface RootDestination {
  readonly id: RootDestinationId;
  readonly accessibilityLabel: string;
  readonly compactLabel: string;
}

export const ROOT_DESTINATIONS: readonly RootDestination[] = [
  { id: "today", accessibilityLabel: "Today recovery plan", compactLabel: "Today" },
  { id: "shield", accessibilityLabel: "Focus Shield protection", compactLabel: "Shield" },
  { id: "progress", accessibilityLabel: "Recovery progress", compactLabel: "Progress" },
  { id: "profile", accessibilityLabel: "Profile and settings", compactLabel: "Profile" }
];
