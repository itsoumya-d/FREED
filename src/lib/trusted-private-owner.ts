import { getJourneyOwner, type JourneyAuthSnapshot } from './user-journey';
export function trustedPrivateOwner(auth: JourneyAuthSnapshot, sdkUid: string | null): string | null {
  const owner = getJourneyOwner(auth); return owner && owner === sdkUid ? owner : null;
}
