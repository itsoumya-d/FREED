/** Stages the built, secret-free foundation without changing the full deployment entrypoint. */
const { createHash } = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const functionsRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(functionsRoot, "..");
const stagingRoot = path.join(repositoryRoot, ".cache", "firebase-foundation-deploy");
const sourceRoot = path.join(stagingRoot, "source");
const builtRoot = path.join(functionsRoot, "lib");
const files = new Map();

function copyBuiltDependency(relative) {
  if (files.has(relative)) return;
  const inputPath = path.resolve(builtRoot, relative);
  if (!inputPath.startsWith(builtRoot + path.sep)) throw new Error("Dependency escaped the Functions build.");
  const source = fs.readFileSync(inputPath);
  files.set(relative, createHash("sha256").update(source).digest("hex"));
  const outputPath = path.join(sourceRoot, "lib", relative);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, source);
  for (const match of source.toString().matchAll(/require\(["'](\.\.?\/[^"']+)["']\)/g)) {
    copyBuiltDependency(path.normalize(path.join(path.dirname(relative), match[1])));
  }
}

fs.rmSync(sourceRoot, { recursive: true, force: true });
fs.mkdirSync(sourceRoot, { recursive: true });
copyBuiltDependency("foundation.js");
const packageJson = JSON.parse(fs.readFileSync(path.join(functionsRoot, "package.json"), "utf8"));
packageJson.main = "lib/foundation.js";
delete packageJson.scripts;
fs.writeFileSync(path.join(sourceRoot, "package.json"), JSON.stringify(packageJson, null, 2) + "\n");
fs.copyFileSync(path.join(functionsRoot, "package-lock.json"), path.join(sourceRoot, "package-lock.json"));
// Local discovery uses installed dependencies. Upload excludes this link; Cloud Build installs the lockfile.
fs.symlinkSync(path.join(functionsRoot, "node_modules"), path.join(sourceRoot, "node_modules"), "dir");
const config = { functions: [{ source: "source", codebase: "freed", runtime: "nodejs22", ignore: ["node_modules", ".git", "*.log"] }] };
fs.writeFileSync(path.join(stagingRoot, "firebase.json"), JSON.stringify(config, null, 2) + "\n");
const packageHash = createHash("sha256").update(fs.readFileSync(path.join(sourceRoot, "package.json"))).digest("hex");
const lockHash = createHash("sha256").update(fs.readFileSync(path.join(sourceRoot, "package-lock.json"))).digest("hex");
const compiledFiles = [...files].sort(([a], [b]) => a.localeCompare(b)).map(([file, sha256]) => ({ file, sha256 }));
const sourceSha256 = createHash("sha256").update(JSON.stringify({ packageHash, lockHash, compiledFiles })).digest("hex");
const receipt = {
  recordedAt: new Date().toISOString(), project: "freed-7d5ee", codebase: "freed", runtime: "nodejs22",
  main: packageJson.main, sourceSha256, packageHash, lockHash, compiledFiles,
  includesEnvironmentFiles: false, credentialValuesOmitted: true,
  excludedSecretEntrypoints: ["ai-firebase.js", "purchase-firebase.js", "subscription-notifications.js"]
};
const receiptPath = path.join(repositoryRoot, "docs", "validation", "artifacts", "2026-10-02-native-ui-testflight", "backend", "foundation-build-manifest.json");
fs.mkdirSync(path.dirname(receiptPath), { recursive: true });
fs.writeFileSync(receiptPath, JSON.stringify(receipt, null, 2) + "\n");
console.log(JSON.stringify({ config: path.join(stagingRoot, "firebase.json"), sourceSha256, compiledFileCount: files.size, main: packageJson.main }));
