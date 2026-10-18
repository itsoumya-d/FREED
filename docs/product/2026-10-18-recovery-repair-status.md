# Recovery repair status — 18 October 2026

This supplements the 13 October version-3 release contract. It does not replace historical results or expand advertised browser coverage.

## Physical result

TestFlight **1.0 (19)** was updated and opened through iPhone Mirroring. Safari's harmless `nudity.testcategory.com` page loaded without FREED recovery. Both FREED Safari extension switches were On, but site grants and loaded redirect rules were not established. Adult setup reported DNS Off; no routing claim follows from this test. A prior stock website-denial screen remains a blocking-only result, not a recovery pass.

The phone reported Screen Time authorized and native status observed. Protect simultaneously showed a global synchronization failure. Source tracing reproduced that warning: startup invokes retired global app-configuration writers that intentionally reject calls, despite acknowledged app groups now owning configuration. The warning therefore cannot diagnose whether a particular group is installed.

Mirroring subsequently disconnected with “iPhone in Use,” then required the Mac login. No password was entered. The remaining physical checks are unavailable until the connection is available again.

Physical packet: `.superpowers/sdd/2026-10-13-publishable-recovery/task-144-phone19/`. It binds source, IPA, device/OS provenance, executed failures and unexecuted scenarios. Existing Internal TestFlight delivery remains build 19; source changes below are not installed-device results.

## Repair scope

1. **Modern group startup:** replace retired global writes with a current-owner native observation. Keep group mutation acknowledgements, genuine failures, reset-disabled protection and supersession fences authoritative. Do not install an optimistic working rule.
2. **Safari site-access repair:** add an explicit permission choice for exactly the extension's declared websites, with denial/unavailable states. Refresh its actual configuration receipt afterward. No automatic prompt, broader domain permission, or inference that permission equals recovery.
3. **Reachable Safari setup:** expose actionable Safari setup within Review setup while DNS needs repair. Keep the required setup order and all enforcement/readback gates. DNS failure must not hide the controls needed to repair recovery.
4. **One app-rule editor:** group-capable onboarding and permission setup route to the existing acknowledged group editor. They no longer expose global timer controls or treat a status refresh as saving a rule. Returning from Apps releases the navigation gate without reopening the editor or completing a permission step.

These source repairs passed independent review. Task 146's original publication race and Task 149's original retained-route latch failure are preserved with their corrected regressions. Verification includes 45 Task 146 checks, 109 Safari checks with three environment skips, 180 affected setup checks, and 61 final app-setup checks; the latter also reran nine actual startup checks. TypeScript passed. These are separate focused runs, not a complete suite or phone pass. The broad UI sweep was interrupted and remains recorded as such.

Later Mirroring inspection reached Safari's system extension list. Both FREED rows showed On, but the installed-extension controls were dimmed and tapping Focus Shield did not open its details. The cause and whether the explicit request can work under this restriction are still unproved; the extension switch must not be presented as a working recovery path. The session subsequently reported iPhone in Use again. No protection was disabled to force a redirect.

No paid DNS service, domain, certificate interception, console access change, live ad or new simulator/runtime was introduced. DNS is filtering infrastructure, not a universal browser-to-app callback.

## UI direction and inspected evidence

The existing 86-unit order remains the complete review checklist. This continuation inspected Today, Protect, adult setup, protection details and diagnostics on the physical phone; it did not review all 3,440 baseline cells. Transitions were allowed to settle before assessing layouts. The approved identity, home and paywall direction remain.

The next changes keep one current task visible, put actionable repair beside its state, and move exact website lists and diagnostics into disclosure. Motion may acknowledge a real selection or saved result; it must never imply enforcement that was not read back.

Inspected Mobbin references: [Opal rule editor](https://mobbin.com/screens/fe41577e-b63f-4c85-805f-6c872778eace), [Opal app/rule sheet](https://mobbin.com/screens/f8792486-21e2-406f-8c52-86caf194e740), [Jomo intervention](https://mobbin.com/screens/8a55774e-736b-4346-a3fe-07585f9e55b5), and [Insight Timer paused session](https://mobbin.com/screens/7e0d32d9-0307-4a43-ba85-64f99c6a669f). These are layout references, not revenue rankings, motion recordings or user studies.

[Apple's Safari extension session](https://developer.apple.com/videos/play/wwdc2023/10119/) requires site permission for redirect actions. [Its extension walkthrough](https://developer.apple.com/videos/play/wwdc2026/216/) demonstrates a deliberate permission request and extension-owned destination. [Design foundations](https://developer.apple.com/videos/play/wwdc2025/359/) and [navigation design](https://developer.apple.com/videos/play/wwdc2022/10001/) inform information hierarchy and predictable return paths. These sources do not prove FREED's runtime behavior.

## Release gate

Still required: Safari blocking plus the accepted Open Challenge action; Chrome/Android recovery; selected-app activation, thresholds, all earned windows and native relock on both platforms; actual video playback/reward; durable exercise completion; signed account/purchase lifecycle; photo qualification; friend-lock enrollment; remaining accessibility, language, theme and performance checks. Keep each result separate. Public readiness remains false.
