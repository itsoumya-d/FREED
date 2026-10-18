import { resolveFreedSystemPath } from "@/lib/deep-link-routing";

// Expo Router calls this for every URL the OS opens the app with (cold and
// warm start). FREED's feature links are consumed by FreedApp via `Linking`,
// so they all render the index route instead of expo-router's Unmatched Route.
export function redirectSystemPath({ path }: { path: string; initial: boolean }): string {
  try {
    return resolveFreedSystemPath(path);
  } catch {
    return "/";
  }
}
