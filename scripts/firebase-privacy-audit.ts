import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

type PrivacyAuditOptions = {
  sourceFiles?: string[];
};

export type FirebasePrivacyAuditReport = {
  ok: boolean;
  violations: string[];
};

const REACT_NATIVE_DEFAULTS: Record<string, boolean> = {
  app_data_collection_default_enabled: false,
  analytics_auto_collection_enabled: false,
  analytics_collection_deactivated: true,
  crashlytics_auto_collection_enabled: false,
  perf_auto_collection_enabled: false,
  perf_collection_deactivated: true,
  messaging_auto_init_enabled: false
};

const ANDROID_DEFAULTS: Record<string, boolean> = {
  app_data_collection_default_enabled: false,
  firebase_analytics_collection_enabled: false,
  firebase_analytics_collection_deactivated: true,
  firebase_crashlytics_collection_enabled: false,
  firebase_performance_collection_enabled: false,
  firebase_performance_collection_deactivated: true,
  firebase_messaging_auto_init_enabled: false,
  delivery_metrics_exported_to_big_query_enabled: false
};

const IOS_DEFAULTS: Record<string, boolean> = {
  FirebaseDataCollectionDefaultEnabled: false,
  FIREBASE_ANALYTICS_COLLECTION_ENABLED: false,
  FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED: true,
  FirebaseCrashlyticsCollectionEnabled: false,
  firebase_performance_collection_enabled: false,
  firebase_performance_collection_deactivated: true,
  FirebaseMessagingAutoInitEnabled: false
};

export function inspectFirebasePrivacyDefaults(root: string, options: PrivacyAuditOptions = {}): FirebasePrivacyAuditReport {
  const violations: string[] = [];
  const firebaseConfig = readJson(join(root, "firebase.json"));
  const reactNative = firebaseConfig?.["react-native"];
  for (const [key, expected] of Object.entries(REACT_NATIVE_DEFAULTS)) {
    if (reactNative?.[key] !== expected) violations.push(`firebase.json react-native.${key} must be ${expected}`);
  }

  assertAndroidDefaults(join(root, "android/app/src/main/AndroidManifest.xml"), violations);
  assertIosDefaults(join(root, "ios/FREED/Info.plist"), violations);
  assertNoDirectClientDatabaseModules(root, options.sourceFiles ?? ["src/lib/firebase-native.ts", "src/features/freed-app.tsx"], violations);

  return { ok: violations.length === 0, violations: Array.from(new Set(violations)).sort() };
}

function assertAndroidDefaults(path: string, violations: string[]) {
  const source = readText(path);
  for (const [key, expected] of Object.entries(ANDROID_DEFAULTS)) {
    const value = expected ? "true" : "false";
    const expression = new RegExp(`<meta-data[^>]+android:name=["']${key}["'][^>]+android:value=["']${value}["']`, "i");
    if (!expression.test(source)) violations.push(`Android manifest must set ${key}=${value}`);
  }
}

function assertIosDefaults(path: string, violations: string[]) {
  const source = readText(path);
  for (const [key, expected] of Object.entries(IOS_DEFAULTS)) {
    const value = expected ? "true" : "false";
    const expression = new RegExp(`<key>${key}</key>\\s*<${value}\\s*/>`, "i");
    if (!expression.test(source)) violations.push(`iOS Info.plist must set ${key}=${value}`);
  }
}

function assertNoDirectClientDatabaseModules(root: string, sourceFiles: string[], violations: string[]) {
  const packageJson = readJson(join(root, "package.json"));
  const dependencies = { ...(packageJson?.dependencies ?? {}), ...(packageJson?.devDependencies ?? {}) };
  if (dependencies["@react-native-firebase/firestore"]) violations.push("Firestore dependency must not be installed directly");
  if (dependencies["@react-native-firebase/storage"]) violations.push("Storage dependency must not be installed directly");

  for (const file of sourceFiles) {
    const source = readText(join(root, file));
    if (/@react-native-firebase\/firestore|firebase\/firestore/.test(source)) {
      violations.push(`${relative(root, join(root, file))}: Firestore import is forbidden`);
    }
    if (/@react-native-firebase\/storage|firebase\/storage/.test(source)) {
      violations.push(`${relative(root, join(root, file))}: Storage import is forbidden`);
    }
  }
}

function readJson(path: string): Record<string, any> | null {
  try {
    return JSON.parse(readText(path));
  } catch {
    return null;
  }
}

function readText(path: string) {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

function main() {
  const report = inspectFirebasePrivacyDefaults(process.cwd());
  console.log("# Firebase privacy defaults audit");
  console.log(`Result: ${report.ok ? "pass" : "fail"}`);
  if (report.violations.length > 0) {
    for (const violation of report.violations) console.log(`- ${violation}`);
    process.exitCode = 1;
  }
}

if (process.argv[1]?.endsWith("firebase-privacy-audit.ts")) main();
