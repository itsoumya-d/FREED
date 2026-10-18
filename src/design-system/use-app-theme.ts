import { useAppPreferences } from '@/hooks/use-app-preferences';
import { getAppPalette } from './app-palette';
export function useAppTheme() {
  const { mode } = useAppPreferences();
  const colors = getAppPalette(mode);
  return { colors, mode, typography: { heavy: '800' as const, bold: '700' as const, semibold: '700' as const, medium: '500' as const, regular: '400' as const }, gradients: { app: [colors.bg, colors.bg] as const, hero: [colors.heroSurface, colors.heroSurface] as const, purple: [colors.surface, colors.surface] as const, peach: [colors.surface, colors.surface] as const, pink: [colors.surface, colors.surface] as const, mint: [colors.surface, colors.surface] as const, sky: [colors.surface, colors.surface] as const, yellow: [colors.surface, colors.surface] as const, danger: [colors.surface, colors.surface] as const, cta: [colors.mint, colors.mint] as const, calm: [colors.surface, colors.surface] as const } };
}
