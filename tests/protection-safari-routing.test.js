const assert = require("node:assert/strict");
const { readFileSync, mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { resolve, join } = require("node:path");
const { spawnSync } = require("node:child_process");
const { test } = require("node:test");

const source = readFileSync(resolve("modules/freed-protection/ios/FreedProtectionModule.swift"), "utf8");

test("Safari callbacks start on MainActor and resolve only once with a bounded deadline", () => {
  const start = source.indexOf("  // Races a SafariServices callback");
  const end = source.indexOf("  private enum SafariReloadOutcome", start);
  const workspace = mkdtempSync(join(tmpdir(), "freed-safari-callback-test-"));
  try {
    const input = join(workspace, "SafariCallback.swift");
    const executable = join(workspace, "safari-callback-tests");
    writeFileSync(input, `import Foundation
final class Harness {
${source.slice(start, end)}
  func check() async {
    let value: Int? = await safariCallWithTimeout(timeoutSeconds: 1) { done in
      MainActor.preconditionIsolated()
      done(42)
      done(7)
    }
    precondition(value == 42)
    let expired: Int? = await safariCallWithTimeout(timeoutSeconds: 0.01) { _ in
      MainActor.preconditionIsolated()
    }
    precondition(expired == nil)
  }
}
@main struct Cases {
  static func main() async {
    await Task.detached { await Harness().check() }.value
    print("Safari callback cases passed")
  }
}
`);
    const compiled = spawnSync("xcrun", ["swiftc", "-parse-as-library", "-swift-version", "5", input, "-o", executable], { encoding: "utf8" });
    assert.equal(compiled.status, 0, compiled.stderr);
    const tested = spawnSync(executable, [], { encoding: "utf8", timeout: 5000 });
    assert.equal(tested.status, 0, tested.stderr.slice(0, 1000));
    assert.match(tested.stdout, /Safari callback cases passed/);
  } finally { rmSync(workspace, { recursive: true, force: true }); }
});

test("Safari settings router awaits opening, falls back safely, and refuses background launches", () => {
  const start = source.indexOf("// MARK: - Safari settings routing");
  const end = source.indexOf("// MARK: - Family activity picker", start);
  assert.ok(start >= 0 && end > start, "the native settings router must expose its platform-independent routing seam");
  const workspace = mkdtempSync(join(tmpdir(), "freed-safari-settings-test-"));
  try {
    const fixture = readFileSync(resolve("tests/protection-safari-routing.swift"), "utf8");
    const input = join(workspace, "SafariRouting.swift");
    const executable = join(workspace, "safari-routing-tests");
    writeFileSync(input, "import Foundation\n" + source.slice(start, end) + "\n" + fixture);
    const compiled = spawnSync("xcrun", ["swiftc", "-parse-as-library", "-swift-version", "5", input, "-o", executable], { encoding: "utf8" });
    assert.equal(compiled.status, 0, compiled.stderr);
    const tested = spawnSync(executable, [], { encoding: "utf8" });
    assert.equal(tested.status, 0, tested.stderr);
    assert.match(tested.stdout, /Safari routing cases passed/);
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("the picker has an explicit cancel path and cannot be swiped away with an unresolved promise", () => {
  const picker = source.slice(source.indexOf('AsyncFunction("presentFamilyActivityPicker")'), source.indexOf('AsyncFunction("openProtectionSettings")'));
  assert.match(picker, /controller\.isModalInPresentation = true/);
  assert.match(picker, /onCancel:\s*\{\s*finishPicker\(/);
  assert.match(picker, /guard !didResume else \{ return \}\s*didResume = true/);
});

test("native source contract saves the requested limit before authorization and selection guards", () => {
  // This is a structural bridge check, not proof of permission approval or a
  // running DeviceActivity monitor. Scheduling itself stays behind its guards.
  const start = source.indexOf('AsyncFunction("configureBlockedAppPackages")');
  const end = source.indexOf('AsyncFunction("presentFamilyActivityPicker")', start);
  const configuration = source.slice(start, end);
  const sanitize = configuration.indexOf("let limitMinutes = self.sanitizeDailyLimitMinutes(dailyLimitMinutes)");
  const persist = configuration.indexOf("self.sharedDefaults().set(limitMinutes, forKey: self.appLimitDailyMinutesKey)");
  // 12 Oct correction: the existing native guard/scheduler was extracted before
  // candidate 12. Keep the same prerequisites, following the real helper calls
  // rather than searching for now-absent inline guards. This remains source-only.
  const install = configuration.indexOf('try self.installConfiguredAppGuard()');
  const installer = source.slice(source.indexOf('  private func installConfiguredAppGuard()'), source.indexOf('  private func isIndependentAppGuardActive()'));
  const authorization = installer.indexOf('guard isAuthorized() else { return }');
  const scheduleCall = installer.indexOf('try scheduleSelectedAppLimitMonitoring(');
  const schedulerStart = source.indexOf('  private func scheduleSelectedAppLimitMonitoring(');
  const scheduler = source.slice(schedulerStart, source.indexOf('\n  private func ', schedulerStart + 1));
  const targets = scheduler.indexOf('guard selectedTargetCount > 0 else {');
  const monitoring = scheduler.indexOf('try center.startMonitoring(');
  assert.ok(sanitize >= 0 && persist > sanitize, "save only a sanitized limit");
  assert.ok(install > persist && authorization >= 0 && scheduleCall > authorization, "unauthorized setup must still remember the requested limit");
  assert.ok(install > persist && targets >= 0, "the initial empty selection must still remember the requested limit");
  assert.ok(scheduleCall > authorization && monitoring > targets, "permission and selection remain prerequisites to scheduling");
});
