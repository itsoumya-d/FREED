const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { test } = require("node:test");

const source = readFileSync(resolve("modules/freed-protection/android/src/main/java/app/freed/protection/FreedProtectionModule.kt"), "utf8");
function actionBody(name, next) {
  const start = source.indexOf(`AsyncFunction("${name}")`);
  const end = source.indexOf(`AsyncFunction("${next}")`, start);
  assert.ok(start >= 0 && end > start);
  return source.slice(start, end);
}

// These checks cover the native routing contract in source. They do not claim
// an OEM destination opened or that anyone granted a permission on a device.
test("Accessibility routing uses the public list and never a protected service-detail action", () => {
  const authorization = actionBody("requestAuthorization", "openUsageAccessSettings");
  const settings = actionBody("openProtectionSettings", "getPendingIntervention");
  assert.match(authorization, /openAndroidSettingsRoute\(\s*context,\s*Settings\.ACTION_ACCESSIBILITY_SETTINGS/);
  assert.match(settings, /openAndroidSettingsRoute\(\s*context,\s*Settings\.ACTION_ACCESSIBILITY_SETTINGS/);
  assert.doesNotMatch(source, /ACCESSIBILITY_DETAILS_SETTINGS|accessibilityServiceDetailsSettingsIntent/);
});

test("Usage Access keeps the package detail URI, then the public list, then manual app-settings fallback", () => {
  const usage = actionBody("openUsageAccessSettings", "openPrivateDnsSettings");
  assert.match(source, /Intent\(Settings\.ACTION_USAGE_ACCESS_SETTINGS, Uri\.parse\("package:\$\{context\.packageName\}"\)\)/);
  const direct = usage.indexOf("usageAccessSettingsIntent(context)");
  const list = usage.indexOf("Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)");
  const app = usage.indexOf("appDetailsSettingsIntent(context)");
  assert.ok(direct >= 0 && list > direct && app > list);
  assert.doesNotMatch(usage, /usageAccessConfigIntent|Intent\(Settings\.ACTION_SETTINGS\)/);
  assert.match(usage, /Special app access > Usage access > FREED/);
});

test("VPN recovery opens public VPN settings while approval still uses the system prepare dialog", () => {
  const vpn = actionBody("openVpnSettings", "applyAdultContentFilter");
  assert.match(vpn, /openAndroidSettingsRoute\(\s*context,\s*Settings\.ACTION_VPN_SETTINGS/);
  assert.doesNotMatch(vpn, /appDetailsSettingsIntent/);
  assert.match(vpn, /another VPN|conflicting VPN/);
  assert.match(actionBody("applyAdultContentFilter", "stopAdultContentFilter"), /VpnService\.prepare\(context\)/);
});
