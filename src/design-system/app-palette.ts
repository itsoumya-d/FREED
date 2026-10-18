import { momentumPalettes } from './generated/momentum-palette';

export type PracticeCategory = 'commitment' | 'movement' | 'reflection' | 'calm';
/** Legacy names are aliases, so every existing surface shares Momentum. */
function aliases(palette: typeof momentumPalettes.light | typeof momentumPalettes.dark) {
  return Object.freeze({ ...palette, mint: palette.accent, mintDark: palette.accent,
    mintLight: palette.accent, emerald: palette.accent, emeraldDark: palette.accent,
    purple: palette.accent, purpleDeep: palette.accent,
    peach: palette.warning, peachLight: palette.warning, yellow: palette.warning, pink: palette.accent });
}
const palettes = { light: aliases(momentumPalettes.light), dark: aliases(momentumPalettes.dark) };
export function getAppPalette(mode: 'light' | 'dark' | null | undefined) {
  return palettes[mode === 'dark' ? 'dark' : 'light'];
}
export function getPracticePalette(category: PracticeCategory, mode: 'light' | 'dark' | null | undefined) {
  const palette = getAppPalette(mode);
  const surfaces = { commitment: palette.commitmentSurface, movement: palette.movementSurface,
    reflection: palette.reflectionSurface, calm: palette.calmSurface };
  return { surface: surfaces[category], ink: palette.practiceInk };
}
/** Large reading panels spend category color on cues; compact PracticeTiles keep their own surfaces. */
export function getCategoryPanelPalette(category: PracticeCategory, mode: 'light' | 'dark' | null | undefined) {
  const palette = getAppPalette(mode);
  const surfaces = { commitment: palette.commitmentPanelSurface, movement: palette.movementPanelSurface,
    reflection: palette.reflectionPanelSurface, calm: palette.calmPanelSurface };
  const accents = { commitment: palette.commitmentPanelAccent, movement: palette.movementPanelAccent,
    reflection: palette.reflectionPanelAccent, calm: palette.calmPanelAccent };
  return { surface: surfaces[category], ink: palette.text, secondaryInk: palette.text2, accent: accents[category] };
}
