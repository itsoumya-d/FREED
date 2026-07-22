import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = readFileSync(resolve(__dirname, "../src/features/freed-app.tsx"), "utf8");

assert.match(source, /import \{ ROOT_DESTINATIONS, type RootDestinationId \} from "@\/design-system\/navigation"/);
assert.match(source, /type Tab = RootDestinationId/);
assert.match(source, /ROOT_DESTINATIONS\.map\(\(\{ id, accessibilityLabel, compactLabel \}\) =>/);
assert.doesNotMatch(source, /\["home", Home\][\s\S]*\["library", BookOpen\]/);
assert.match(source, /screen === "library"/);
assert.match(source, /accessibilityLabel="Back to Today"/);

const shieldStart = source.indexOf("function ShieldScreen(");
const profileStart = source.indexOf("function ProfileScreen(");
const bottomNavStart = source.indexOf("function BottomNav(");
assert.ok(shieldStart >= 0 && profileStart > shieldStart && bottomNavStart > profileStart);
const shieldSource = source.slice(shieldStart, profileStart);
const profileSource = source.slice(profileStart, bottomNavStart);
assert.match(shieldSource, /FocusShieldSection/);
assert.match(shieldSource, /onOpenProtectionSetup/);
assert.doesNotMatch(profileSource, /FocusShieldSection/);
assert.doesNotMatch(profileSource, /requestProtectionAuthorization|applyAdultContentFilter|presentFamilyActivityPicker/);
assert.match(shieldSource, /Protection health/);
assert.match(shieldSource, /Open protection setup/);
