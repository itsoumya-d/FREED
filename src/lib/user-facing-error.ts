import { redactOperationalText } from "@/lib/operational-redaction";

export function safeUserFacingMessage(value: unknown, fallback: string, maxLength = 180) {
  const cleaned = redactOperationalText(errorText(value), maxLength)?.replace(/[<>]/g, "").trim();
  return cleaned || fallback;
}

function errorText(value: unknown) {
  if (value instanceof Error) return value.message;
  return typeof value === "string" ? value : null;
}
