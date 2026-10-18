import { useAppPreferences } from '@/hooks/use-app-preferences';
import { getAppPalette } from '@/design-system/app-palette';

export type OfferTheme = {
  bg: string;
  surface: string;
  surfacePressed: string;
  text: string;
  secondary: string;
  muted: string;
  border: string;
  accent: string;
  accentSurface: string;
  onAccent: string;
  error: string;
};

function makeOfferTheme(mode: 'light' | 'dark'): OfferTheme {
  const palette = getAppPalette(mode);
  return { bg: palette.bg, surface: palette.surface, surfacePressed: palette.surface2,
    text: palette.text, secondary: palette.text2, muted: palette.text3, border: palette.border,
    accent: palette.mint, accentSurface: palette.accentTint, onAccent: palette.onAccent, error: palette.red };
}
export const offerThemes: Record<"light" | "dark", OfferTheme> = { light: makeOfferTheme('light'), dark: makeOfferTheme('dark') };

export function useOfferTheme(): OfferTheme {
  return offerThemes[useAppPreferences().mode];
}
