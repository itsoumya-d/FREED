const ONBOARDING_SCREENS = new Set(["splash", "welcome", "quiz", "planCalculation", "appSelection", "account", "protectionSetup", "paywall"]);

export type PaywallNavigationToken<T extends string> = Readonly<{ generation: number; origin: T | null; featureId?: string }>;

export function createPaywallNavigationSession<T extends string>(initialScreen: T) {
  let screen = initialScreen;
  let generation = 0;
  let origin: T | null = null;
  let featureId: string | undefined;
  return {
    open(feature?: string) {
      if (screen !== "paywall") origin = screen;
      screen = "paywall" as T;
      featureId = feature;
      generation += 1;
    },
    update(next: T) {
      if (next === screen) return;
      if (next === "paywall") origin = screen;
      featureId = undefined;
      screen = next;
      generation += 1;
    },
    capture(): PaywallNavigationToken<T> | null {
      return screen === "paywall" ? { generation, origin, ...(featureId ? { featureId } : {}) } : null;
    },
    owns(token: PaywallNavigationToken<T> | null) {
      return token !== null && screen === "paywall" && token.generation === generation;
    },
    getOrigin() { return origin; }
  };
}

export function resolvePaywallReturn<T extends string>(options: {
  origin: T | null;
  protectionReady: boolean;
  limitedProtectionAcknowledged: boolean;
  accountStepDone: boolean;
  immediateRecovery?: boolean;
}): T | "main" | "account" | "protectionSetup" {
  if (options.origin && !ONBOARDING_SCREENS.has(options.origin)) return options.origin;
  if (options.immediateRecovery) return "main";
  if (options.protectionReady || options.limitedProtectionAcknowledged) return "main";
  return options.accountStepDone ? "protectionSetup" : "account";
}
