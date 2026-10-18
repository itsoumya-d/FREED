/**
 * FREED Design System Tokens — Built to the Appllama Mobile Design Benchmark
 * Enforces Apple HIG fidelity, continuous squircle geometry, tabular numerals,
 * and FREED’s warm chalk, umber and copper Passage palette.
 */

import { getAppPalette } from "../design-system/app-palette";

/** Default dark tokens for compatibility; mounted screens use useAppTheme. */
export const colors = getAppPalette("dark");

export const gradients = {
  app: [colors.bg, colors.bg] as const,
  hero: [colors.heroSurface, colors.heroSurface] as const,
  purple: [colors.surface, colors.surface] as const,
  peach: [colors.surface, colors.surface] as const,
  pink: [colors.surface, colors.surface] as const,
  mint: [colors.surface, colors.surface] as const,
  sky: [colors.surface, colors.surface] as const,
  yellow: [colors.surface, colors.surface] as const,
  danger: [colors.surface, colors.surface] as const,
  cta: [colors.accent, colors.accent] as const,
  calm: [colors.surface, colors.surface] as const
};

export const radii = {
  xs: 8,
  sm: 12,
  md: 16,
  lg: 24,
  xl: 32,
  pill: 999
};

export const squircle = {
  borderCurve: "continuous"
} as const;

export const borderCurve = "continuous" as const;

export const tabularNums = {
  fontVariant: ["tabular-nums"]
} as const;

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32,
  page: 24,
  section: 24
};

export const typography = {
  family: undefined as string | undefined,
  familyFallback: undefined as string | undefined,
  heavy: "700" as const,
  bold: "600" as const,
  semibold: "600" as const,
  medium: "500" as const,
  regular: "400" as const
};

export const shadow = {
  card: {
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)"
  },
  glowPurple: {
    boxShadow: "0 8px 24px rgba(33, 29, 25, 0.12)"
  },
  glowRed: {
    boxShadow: "0 8px 30px rgba(239, 68, 68, 0.22)"
  },
  glowEmerald: {
    boxShadow: "0 8px 24px rgba(33, 29, 25, 0.12)"
  },
  soft: {
    boxShadow: "0 8px 24px rgba(0, 0, 0, 0.24)"
  },
  modal: {
    boxShadow: "0 16px 48px rgba(0, 0, 0, 0.38)"
  }
};

/** Empty starfield — replaces 58 expensive individual Views with clean, zero-slop rendering */
export const starField: readonly { x: number; y: number; size: number; opacity: number }[] = [];

