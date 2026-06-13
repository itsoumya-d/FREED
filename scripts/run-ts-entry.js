const { existsSync } = require("node:fs");
const { dirname, resolve } = require("node:path");
const Module = require("node:module");

process.env.ESBUILD_WORKER_THREADS ||= "0";

const esbuild = require("esbuild");
const { buildSync } = esbuild;
const { loadEnvFile } = require("./lib/env-file-loader");

function parseEntryArgs(argv) {
  const args = [];
  let envFile = process.env.FREED_RELEASE_ENV_FILE || null;
  const nextValue = (option, index) => {
    const value = argv[index + 1];
    if (!value) throw new Error(`Missing value for ${option}`);
    return value;
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--env-file") {
      envFile = nextValue(arg, index);
      index += 1;
    } else if (arg.startsWith("--env-file=")) {
      envFile = arg.slice("--env-file=".length);
      if (!envFile) throw new Error("Missing value for --env-file");
    } else {
      args.push(arg);
    }
  }

  return { args, envFile };
}

function mergeEnvFile(envFile) {
  if (!envFile) return;
  Object.assign(process.env, loadEnvFile(envFile, "release env file"), { FREED_RELEASE_ENV_FILE: envFile });
}

async function main() {
  const [, , entryArg, ...rawEntryArgs] = process.argv;
  if (!entryArg) throw new Error("Usage: node scripts/run-ts-entry.js <entry.ts> [...args]");

  const entryPath = resolve(process.cwd(), entryArg);
  if (!existsSync(entryPath)) throw new Error(`TypeScript entrypoint not found: ${entryArg}`);
  const { args: entryArgs, envFile } = parseEntryArgs(rawEntryArgs);
  mergeEnvFile(envFile);

  const result = buildSync({
    entryPoints: [entryPath],
    bundle: true,
    external: [
      "expo",
      "expo-*",
      "react-native",
      "react-native-*",
      "lucide-react-native"
    ],
    platform: "node",
    format: "cjs",
    target: "node20",
    write: false,
    logLevel: "silent"
  });
  const bundled = result.outputFiles?.[0]?.text;
  if (!bundled) throw new Error(`Failed to bundle TypeScript entrypoint: ${entryArg}`);

  const originalArgv = process.argv;
  process.argv = [originalArgv[0], entryPath, ...entryArgs];

  try {
    const entryModule = new Module(entryPath, module);
    entryModule.filename = entryPath;
    entryModule.paths = Module._nodeModulePaths(dirname(entryPath));
    entryModule._compile(bundled, entryPath);
  } finally {
    process.argv = originalArgv;
    await esbuild.stop();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Failed to run TypeScript entrypoint.");
  process.exitCode = 1;
});
