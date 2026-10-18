import { Redirect } from "expo-router";

// Safety net: any path without a file route returns to the app instead of
// showing expo-router's "Unmatched Route" developer screen to users.
export default function NotFoundRoute() {
  return <Redirect href="/" />;
}
