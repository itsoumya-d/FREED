const assert = require("node:assert/strict");
const { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { homedir, tmpdir } = require("node:os");
const { assertSafeEnvFilePath } = require("./env-file-safety");

function expandEnvFileHome(path) {
  if (path === "~") return homedir();
  if (typeof path === "string" && path.startsWith("~/")) return join(homedir(), path.slice(2));
  return path;
}

function parseEnvFile(path, label = "env file") {
  const env = {};
  const seenKeys = new Map();
  const text = readFileSync(path, "utf8");
  for (const [index, rawLine] of text.split(/\r?\n/).entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match) {
      throw new Error(`${label} line ${index + 1} must use KEY=value syntax.`);
    }

    const key = match[1];
    const firstLine = seenKeys.get(key);
    if (firstLine !== undefined) {
      throw new Error(`${label} line ${index + 1} repeats ${key} from line ${firstLine}.`);
    }
    seenKeys.set(key, index + 1);

    let value = match[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value.replace(/\\n/g, "\n");
  }
  return env;
}

function loadEnvFile(envFile, label = "release env file") {
  if (!envFile) return {};
  assertSafeEnvFilePath(envFile, label);
  const absolute = resolve(process.cwd(), expandEnvFileHome(envFile));
  if (!existsSync(absolute)) throw new Error(`Env file not found: ${envFile}`);
  return parseEnvFile(absolute, label);
}

module.exports = {
  expandEnvFileHome,
  loadEnvFile,
  parseEnvFile,
};

function runSelfTest() {
  const root = mkdtempSync(join(tmpdir(), "freed-env-file-loader-"));
  try {
    const valid = join(root, "valid.env");
    writeFileSync(
      valid,
      [
        "# comment",
        "EXPO_PUBLIC_AI_COACH_ENDPOINT=https://api.freedrecovery.app/api/clara",
        "",
        "export APP_STORE_PRIVATE_KEY='line-one\\nline-two'"
      ].join("\n")
    );
    assert.deepEqual(parseEnvFile(valid, "release env file"), {
      EXPO_PUBLIC_AI_COACH_ENDPOINT: "https://api.freedrecovery.app/api/clara",
      APP_STORE_PRIVATE_KEY: "line-one\nline-two"
    });
    assert.equal(expandEnvFileHome("~"), homedir());
    assert.equal(expandEnvFileHome("~/prod.env"), join(homedir(), "prod.env"));
    assert.equal(expandEnvFileHome("secrets/prod.env"), "secrets/prod.env");

    const malformed = join(root, "malformed.env");
    writeFileSync(malformed, ["GOOD=value", "# spacer", "", "MISSING_EQUALS"].join("\n"));
    assert.throws(() => parseEnvFile(malformed, "release env file"), /release env file line 4 must use KEY=value syntax/);

    const duplicate = join(root, "duplicate.env");
    writeFileSync(duplicate, ["GOOD=value", "# spacer", "", "GOOD=again"].join("\n"));
    assert.throws(() => parseEnvFile(duplicate, "release env file"), /release env file line 4 repeats GOOD from line 1/);

    const duplicateExportFirst = join(root, "duplicate-export-first.env");
    writeFileSync(duplicateExportFirst, ["export GOOD=value", "# spacer", "", "GOOD=again"].join("\n"));
    assert.throws(() => parseEnvFile(duplicateExportFirst, "release env file"), /release env file line 4 repeats GOOD from line 1/);

    const duplicateExportSecond = join(root, "duplicate-export-second.env");
    writeFileSync(duplicateExportSecond, ["GOOD=value", "# spacer", "", "export GOOD=again"].join("\n"));
    assert.throws(() => parseEnvFile(duplicateExportSecond, "release env file"), /release env file line 4 repeats GOOD from line 1/);

    console.log("env file loader self-test: pass");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (require.main === module && process.argv.includes("--self-test")) {
  runSelfTest();
}
