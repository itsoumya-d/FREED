import { MomentumCompanion } from './MomentumCompanion';
/** Compatibility for retained feature surfaces while presentation migrates. */
export function PassageArtwork({ width = 240, height = 240, variant = 'passage', interactive = true }: { width?: number; height?: number; variant?: 'passage' | 'breathing'; interactive?: boolean }) {
  return <MomentumCompanion width={width} height={height} variant={variant === 'breathing' ? 'calm' : 'welcome'} interactive={interactive} />;
}
