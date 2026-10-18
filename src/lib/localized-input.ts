/** Normalize decimal digits only; private prose and store-formatted prices never pass through this helper. */
export function asciiDigits(value: string): string {
  const ranges = [0x0660, 0x06f0, 0x0966, 0x09e6];
  return Array.from(value.normalize('NFKC')).map(character => {
    const code = character.codePointAt(0)!;
    const range = ranges.find(start => code >= start && code <= start + 9);
    return range === undefined ? character : String(code - range);
  }).join('');
}

export function normalizeClockTimeInput(value: string): string | null {
  const input = asciiDigits(value).replace(/[\u200e\u200f\u061c]/g, '').trim();
  const match = input.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return match ? `${String(Number(match[1])).padStart(2, '0')}:${match[2]}` : null;
}
