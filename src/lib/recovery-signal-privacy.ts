export function redactRecoverySignalText(value: unknown, maxLength = 180): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/https?:\/\/[^\s]+/gi, "[redacted-link]")
    .replace(
      /\b(?:[\w-]+\.)+(?:com|net|org|io|co|app|dev|edu|gov|tv|me|xxx|adult|porn|example|test|invalid|local)(?:\/[^\s]*)?/gi,
      "[redacted-domain]"
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);

  if (!cleaned || /^no (clear pattern|slips|protected risk|completions)/i.test(cleaned)) return null;
  return cleaned;
}

export function coarseRecoveryTriggerLabel(value: unknown): string | null {
  const cleaned = redactRecoverySignalText(value, 96);
  if (!cleaned) return null;
  const lower = cleaned.toLowerCase();

  if (/\b(stress|stressed|anxious|anxiety|overwhelm|pressure|deadline|work|school|exam)\b/.test(lower)) {
    return "Stress pattern";
  }

  if (/\b(bed|bedroom|night|late|sleep|tired|exhausted|after dark)\b/.test(lower)) {
    return "Night or low-sleep pattern";
  }

  if (/\b(phone|scroll|scrolling|doomscroll|social|instagram|tiktok|reddit|youtube|shorts|twitter|x\/twitter)\b/.test(lower)) {
    return "Scrolling trigger pattern";
  }

  if (/\b(bored|idle|alone|lonely|isolation|nothing to do)\b/.test(lower)) {
    return "Boredom or isolation pattern";
  }

  if (/\b(argument|fight|partner|friend|family|rejection|message|relationship)\b/.test(lower)) {
    return "Connection stress pattern";
  }

  if (/\b(urge|craving|relapse|slip|porn|adult|nsfw|explicit)\b/.test(lower)) {
    return "Urge pattern";
  }

  return "Logged trigger pattern";
}
