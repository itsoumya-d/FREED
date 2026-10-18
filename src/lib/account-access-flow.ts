import type { FirebaseAccountSummary, FirebaseAuthActionResult, createFirebaseAuthAdapter } from "./firebase-client";

type EmailAccountAdapter = Pick<ReturnType<typeof createFirebaseAuthAdapter>, "getAccountSummary" | "createEmailAccount" | "signInWithEmailPassword">;
export type EmailAccountIntent = "create" | "sign-in";
export type EmailAccountSubmission = { status: "switch-required" } | { status: "completed"; result: FirebaseAuthActionResult };

export function beginEmailAccountAccess(intent: EmailAccountIntent, account: FirebaseAccountSummary): EmailAccountIntent | "guest-switch" {
  return intent === "sign-in" && account.anonymous ? "guest-switch" : intent;
}

export async function submitEmailAccountAccess(adapter: EmailAccountAdapter, intent: EmailAccountIntent, input: { email: string; password: string }, options: { linkExisting?: boolean } = {}): Promise<EmailAccountSubmission> {
  const account = adapter.getAccountSummary();
  // Linking an email credential can create a password account. A Sign in
  // intent must never enroll an unused email on the guest account.
  if (intent === "sign-in" && account.anonymous) return { status: "switch-required" };
  const result = intent === "create"
    ? await adapter.createEmailAccount(input, { linkExisting: options.linkExisting === true || account.anonymous })
    : await adapter.signInWithEmailPassword(input, { linkExisting: false });
  return { status: "completed", result };
}
