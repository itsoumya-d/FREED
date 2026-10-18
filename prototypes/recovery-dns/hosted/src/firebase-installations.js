// Only trusted bundled control-plane code is loaded. No credential is in this
// module: Firestore uses the attached service identity after deployment review.
import { createRecoveryDnsFirestoreAdapter } from '../control-plane/recovery-dns-firebase.js';
if (process.env.GCLOUD_PROJECT !== 'freed-7d5ee') throw new Error('pilot project unavailable');
const adapter = createRecoveryDnsFirestoreAdapter();
export const resolveInstallation = adapter.resolveInstallation;
export const reserveDnsRequest = adapter.reserveDnsRequest;
