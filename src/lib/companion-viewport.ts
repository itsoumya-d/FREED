export function isCompanionOnScreen(rect: { x: number; y: number; width: number; height: number }, viewport: { width: number; height: number }) {
  return [rect.x, rect.y, rect.width, rect.height, viewport.width, viewport.height].every(Number.isFinite)
    && rect.width > 0 && rect.height > 0 && rect.x < viewport.width && rect.y < viewport.height
    && rect.x + rect.width > 0 && rect.y + rect.height > 0;
}
