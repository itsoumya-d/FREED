const assert = require("node:assert/strict");

const LOCAL_HOME_PATH_PATTERN =
  /(?:^|["'\s])(?:\/(?:Users|home)\/[A-Za-z0-9._-]+\/[^\s"']*|[A-Za-z]:(?:\\\\)+Users(?:\\\\)+[^\\/"'\s]+(?:(?:\\\\)+[^"'\s]*)?)/i;

function hasLocalHomePath(value) {
  return typeof value === "string" && LOCAL_HOME_PATH_PATTERN.test(value);
}

function sanitizeLocalHomePaths(value) {
  return String(value)
    .replace(/\/(?:Users|home)\/[A-Za-z0-9._-]+\//g, "~/")
    .replace(/[A-Za-z]:(?:\\\\)+Users(?:\\\\)+[^\\/"'\s]+(?:\\\\)+/g, "~\\\\");
}

function runSelfTest() {
  assert.equal(hasLocalHomePath('{"path": "/Users/alice/Downloads/FREED.apk"}'), true);
  assert.equal(hasLocalHomePath('{"path": "/home/alice/Downloads/FREED.apk"}'), true);
  assert.equal(hasLocalHomePath('{"path": "C:\\\\Users\\\\alice\\\\Downloads\\\\FREED.apk"}'), true);
  assert.equal(hasLocalHomePath('{"path": "~/Downloads/FREED.apk"}'), false);
  assert.equal(hasLocalHomePath('{"path": "docs/validation/artifacts/run/report.json"}'), false);
  assert.equal(
    sanitizeLocalHomePaths('{"path": "/Users/alice/Downloads/FREED.apk"}'),
    '{"path": "~/Downloads/FREED.apk"}'
  );
  assert.equal(
    sanitizeLocalHomePaths('{"path": "/home/alice/Downloads/FREED.apk"}'),
    '{"path": "~/Downloads/FREED.apk"}'
  );
  assert.equal(
    sanitizeLocalHomePaths('{"path": "C:\\\\Users\\\\alice\\\\Downloads\\\\FREED.apk"}'),
    '{"path": "~\\\\Downloads\\\\FREED.apk"}'
  );
  console.log("local path privacy self-test: pass");
}

if (require.main === module) {
  if (process.argv.includes("--self-test")) runSelfTest();
}

module.exports = {
  LOCAL_HOME_PATH_PATTERN,
  hasLocalHomePath,
  sanitizeLocalHomePaths,
  runSelfTest,
};
