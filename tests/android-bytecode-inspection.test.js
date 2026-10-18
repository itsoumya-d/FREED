const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");
const { inspectAndroidZipArtifact } = require("../scripts/build-android-release-apk");

test("detects real Hermes bytecode in the standard bundle filename", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-hbc-inspection-"));
  try {
    const assets = path.join(dir, "base", "assets");
    fs.mkdirSync(assets, {recursive:true});
    const source = path.join(dir, "input.js");
    fs.writeFileSync(source, "globalThis.answer = 42;\n");
    const compiler = path.resolve("node_modules/hermes-compiler/hermesc/osx-bin/hermesc");
    const built = spawnSync(compiler, ["-emit-binary", "-out", path.join(assets, "index.android.bundle"), source], {encoding:"utf8"});
    assert.equal(built.status, 0, built.stderr);
    const archive = path.join(dir, "bundle.aab");
    assert.equal(spawnSync("zip", ["-q", "-r", archive, "base"], {cwd:dir}).status, 0);
    const result = await inspectAndroidZipArtifact(archive);
    assert.equal(result.hasJsBundle, true);
    assert.equal(result.hasHermesBytecode, true);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});

test("a misleading hbc extension cannot establish executable bytecode", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "freed-hbc-name-"));
  try {
    fs.mkdirSync(path.join(dir, "assets"));
    fs.writeFileSync(path.join(dir, "assets", "index.android.bundle.hbc"), "globalThis.answer = 42;\n");
    const archive = path.join(dir, "bundle.apk");
    assert.equal(spawnSync("zip", ["-q", "-r", archive, "assets"], {cwd:dir}).status, 0);
    assert.equal((await inspectAndroidZipArtifact(archive)).hasHermesBytecode, false);
  } finally { fs.rmSync(dir, {recursive:true,force:true}); }
});
