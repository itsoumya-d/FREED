/** Full deployment surface. Foundation deployment uses foundation.ts directly. */
export * from "./foundation.js";
export { generateClaraReply, generateChallenges, generateRetentionPlan } from "./ai-firebase.js";
export { verifyStorePurchase, getPurchaseCheckoutContext, getApplePurchaseCheckoutContext, verifyAppleStorePurchase } from "./purchase-firebase.js";
export { appleSubscriptionNotifications, appleSubscriptionNotificationsSandbox, googlePlaySubscriptionNotifications } from "./subscription-notifications.js";
export {generateGoogleClaraReply} from './clara-cloud-firebase.js';

// Opt-in pilot callables fail closed unless the reviewed server allowlist is enabled.
export { enrollRecoveryDns, revokeRecoveryDns } from "./recovery-dns-firebase.js";
