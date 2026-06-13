const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function uniqueCandidates(values) {
  const seen = new Set();
  const candidates = [];
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    candidates.push(normalized);
  }
  return candidates;
}

function androidSdkRootCandidates() {
  return uniqueCandidates([
    process.env.ANDROID_HOME,
    process.env.ANDROID_SDK_ROOT,
    path.join(os.homedir(), "Library", "Android", "sdk"),
    path.join(os.homedir(), "Android", "Sdk"),
    "/opt/android-sdk",
    "/usr/local/share/android-sdk",
  ]);
}

function validateToolName(toolName) {
  const normalized = String(toolName || "").trim();
  if (!/^[A-Za-z0-9._-]+$/.test(normalized)) {
    throw new Error("Android SDK tool name must be a simple executable name.");
  }
  return normalized;
}

function resolveAndroidTool(toolName) {
  const name = validateToolName(toolName);
  const envKey = `FREED_${name.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_PATH`;
  const explicit = String(process.env[envKey] || "").trim();
  if (explicit) {
    if (!path.isAbsolute(explicit) || !fs.existsSync(explicit)) {
      throw new Error(`${envKey} must point to an existing absolute Android SDK tool path.`);
    }
    return explicit;
  }

  for (const root of androidSdkRootCandidates()) {
    const candidate = path.join(root, "platform-tools", name);
    if (fs.existsSync(candidate)) return candidate;
  }

  return name;
}

module.exports = {
  androidSdkRootCandidates,
  resolveAndroidTool,
};
