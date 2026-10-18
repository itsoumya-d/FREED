#!/usr/bin/env node

// Compile and execute the cancelChallengePhoto closure copied verbatim from
// the live Swift module. Only its owner gate and photo pipeline are effects
// substituted by the small fixture below.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const sourcePath = path.resolve(__dirname, '../modules/freed-protection/ios/FreedProtectionModule.swift');
const source = fs.readFileSync(sourcePath, 'utf8');
const marker = 'AsyncFunction("cancelChallengePhoto")';
const markerIndex = source.indexOf(marker);
if (markerIndex < 0) throw new Error(`Could not find ${marker} in ${sourcePath}`);

const closureStart = source.indexOf('{', markerIndex);
if (closureStart < 0) throw new Error('Production cancellation closure has no body');
const closureHeader = source.slice(closureStart).match(/^\{\s*(\(operationId:\s*String\)\s*->\s*Bool)\s+in\b/);
if (!closureHeader) {
  throw new Error(`Unexpected production cancellation signature: ${source.slice(closureStart, closureStart + 120)}`);
}
if (!/^\(operationId:\s*String\)\s*->\s*Bool$/.test(closureHeader[1])) {
  const signature = closureHeader[1];
  throw new Error(`Unexpected production cancellation signature: ${signature}`);
}

let depth = 0;
let bodyEnd = -1;
for (let index = closureStart; index < source.length; index += 1) {
  if (source[index] === '{') depth += 1;
  if (source[index] === '}') {
    depth -= 1;
    if (depth === 0) {
      bodyEnd = index + 1;
      break;
    }
  }
}
if (bodyEnd < 0) throw new Error('Production cancellation closure is unbalanced');
const productionClosure = source.slice(closureStart, bodyEnd);

const fixture = `
final class Pipeline {
  var result: Bool
  var calls: [String] = []
  init(result: Bool) { self.result = result }
  func cancel(_ operationId: String) -> Bool {
    calls.append(operationId)
    return result
  }
}

final class Owner {
  let allowed: Bool
  let photoPipeline: Pipeline
  init(allowed: Bool, pipeline: Pipeline) {
    self.allowed = allowed
    self.photoPipeline = pipeline
  }
  func legacyPrivateAvailable() -> Bool { allowed }
  func invoke(_ operationId: String) -> Bool {
    let cancel: (String) -> Bool = ${productionClosure}
    return cancel(operationId)
  }
}

func expect(_ condition: @autoclosure () -> Bool, _ message: String) {
  if !condition() { fatalError(message) }
}

let allowedTruePipeline = Pipeline(result: true)
let allowedTrue = Owner(allowed: true, pipeline: allowedTruePipeline)
expect(allowedTrue.invoke("op-true"), "authorized true result was not forwarded")
expect(allowedTruePipeline.calls == ["op-true"], "authorized operation id was not forwarded exactly once")

let allowedFalsePipeline = Pipeline(result: false)
let allowedFalse = Owner(allowed: true, pipeline: allowedFalsePipeline)
expect(!allowedFalse.invoke("op-false"), "authorized false result was not forwarded")
expect(allowedFalsePipeline.calls == ["op-false"], "authorized false operation id was not forwarded exactly once")

let refusedPipeline = Pipeline(result: true)
let refused = Owner(allowed: false, pipeline: refusedPipeline)
expect(!refused.invoke("op-refused"), "unauthorized request did not refuse")
expect(refusedPipeline.calls.isEmpty, "unauthorized request called the photo pipeline")
print("PASS: extracted production closure forwards true/false, preserves operationId, and refuses before pipeline when unauthorized")
`;

const tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'freed-task113-'));
try {
  const fixturePath = path.join(tempDirectory, 'CancelChallengePhotoRegression.swift');
  const executablePath = path.join(tempDirectory, 'cancel-challenge-photo-regression');
  fs.writeFileSync(fixturePath, fixture);
  const compile = spawnSync('xcrun', ['swiftc', '-module-cache-path', path.join(tempDirectory, 'module-cache'), fixturePath, '-o', executablePath], { encoding: 'utf8' });
  process.stdout.write(compile.stdout || '');
  process.stderr.write(compile.stderr || '');
  if (compile.status !== 0) process.exit(compile.status || 1);
  const run = spawnSync(executablePath, [], { encoding: 'utf8' });
  process.stdout.write(run.stdout || '');
  process.stderr.write(run.stderr || '');
  if (run.status !== 0) process.exit(run.status || 1);
} finally {
  fs.rmSync(tempDirectory, { recursive: true, force: true });
}
