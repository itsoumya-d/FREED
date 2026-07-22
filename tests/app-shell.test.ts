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

assert.match(profileSource, /<RecoveryBackupCard/);
assert.match(profileSource, /pendingFirebaseEmailLink=\{pendingFirebaseEmailLink\}/);
assert.match(profileSource, /onPendingFirebaseEmailLinkHandled=\{onPendingFirebaseEmailLinkHandled\}/);
assert.match(profileSource, /<PrivacySupportCard/);
assert.match(profileSource, /<ReminderSettingsCard/);
assert.match(profileSource, /<AccountabilitySettingsCard/);
assert.doesNotMatch(profileSource, /label="Complete email sign-in"/);

const backupStart = source.indexOf("function RecoveryBackupCard(");
const privacyStart = source.indexOf("function PrivacySupportCard(");
assert.ok(backupStart >= 0 && privacyStart > backupStart);
const backupSource = source.slice(backupStart, privacyStart);
assert.match(backupSource, /\.completeEmailLink\(\{ email: authEmail, emailLink: url \}\)/);
assert.match(backupSource, /if \(!result\.ok\)/);
assert.match(backupSource, /onPendingFirebaseEmailLinkHandled\(\);/);
