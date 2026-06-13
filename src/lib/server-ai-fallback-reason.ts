import { containsSensitiveOperationalText } from "@/lib/operational-redaction";
import { safeUserFacingMessage } from "@/lib/user-facing-error";

export function safeServerAiFallbackReason(error: unknown, fallback: string, maxLength = 160) {
  const raw = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (containsSensitiveOperationalText(raw)) return fallback;
  return safeUserFacingMessage(raw, fallback, maxLength);
}
