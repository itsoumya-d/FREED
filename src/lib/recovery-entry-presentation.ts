/** Presentation arbitration only. Native claim validation and app-time authority
 * remain independent. An acknowledged event can be recorded without replacing
 * a person's current guided activity or a newer navigation decision. */
export function createRecoveryEntryPresentation() {
  let owner: string | null = null;
  let lease: unknown = null;
  let observedRoute: string | null = null;
  let requestedRoute: string | null = null;
  let revision = 0;
  let manual = false;
  const guided = (route: string | null) => route === 'ad' || route === 'challenge';
  return {
    reconcile(nextOwner: string | null, nextLease: unknown, route: string) {
      if (owner !== nextOwner || lease !== nextLease) {
        owner = nextOwner; lease = nextLease; revision++; manual = false; requestedRoute = null;
      }
      if (observedRoute !== route) {
        observedRoute = route; revision++;
        // A lagging unchanged pathname must not erase a synchronous manual
        // entry. A real departure, including native Back, releases its hold.
        if (requestedRoute === route) requestedRoute = null;
        else { requestedRoute = null; if (!guided(route)) manual = false; }
      }
    },
    requestScreen(route: string) {
      revision++; requestedRoute = route;
      if (!guided(route)) manual = false;
    },
    beginManual() { revision++; manual = true; },
    capture() { return revision; },
    canPresent(ticket: number) {
      return revision === ticket && !manual && !guided(requestedRoute ?? observedRoute);
    }
  };
}
