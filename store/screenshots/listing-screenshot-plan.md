# FREED Store Listing Screenshot Plan

This is the capture and ASO handoff for App Store and Google Play listing screenshots. It is separate from `store/screenshots/manifest.json`, which maps the Core 3 paywall screenshots used for in-app purchase review.

## Release Boundary

- Capture listing screenshots from the same signed build family that will enter TestFlight, Play internal testing, or final store review.
- Do not use these screenshots as physical-device protection evidence. Android and iOS protection evidence must still come from the release validation JSON files under `docs/validation/evidence/`.
- Do not include explicit adult content, real adult domains, private notes, raw URLs, raw search terms, account IDs, serial numbers, console pages, secrets, receipt tokens, or provider payloads.
- Keep v1 purchase UI Core 3 only: yearly, monthly, and lifetime. Do not show family, accountability, or AI coach products in launch screenshots.
- Use a clean status bar and production-safe data. Screenshots must not show debug menus, localhost/LAN URLs, placeholder env values, build logs, or internal QA banners.

## Recommended Benefit Set

Final ASO copy still needs owner approval before image generation or store upload. Start with these six public listing concepts:

1. TURN ON REAL PROTECTION - protection setup checklist with the next required native step visible.
2. BLOCK ADULT SITES SAFELY - activation test passed with native status and adult-domain protection ready.
3. INTERRUPT APP LOOPS - selected app limits and recovery handoff configuration.
4. RECOVER IN THE MOMENT - supportive recovery challenge or shield action.
5. KEEP PRIVACY LOCAL - privacy/profile controls showing local-first data boundaries.
6. UPGRADE WITHOUT AD BREAKS - Core 3 paywall with yearly, monthly, and lifetime only.

## Capture Requirements

- App Store 6.7-inch portrait: 1290x2796.
- App Store 6.5-inch portrait: 1242x2688.
- Google Play phone portrait: 1080x1920 minimum, 9:16.
- Save raw captures and finished assets under `store/screenshots/listing/`.
- Start from `store/screenshots/listing/manifest.template.json`, then add `store/screenshots/listing/manifest.json` before production upload.
- Manifest rows must include `id`, `platform`, `deviceClass`, `sourceBuild`, `sourceCapturePath`, `finalAssetPath`, `headline`, `screen`, `width`, `height`, `sha256`, and `reviewBoundary`.

## Retake Rules

- Retake any screenshot that shows missing permissions, failed activation, inactive DNS Guard, incomplete Screen Time/Safari setup, sample AdMob IDs, unavailable purchase products, stale pricing, hidden text, clipped text, overlapping UI, or disabled controls that should be usable.
- Retake if the displayed build is not the submitted signed build family.
- Retake if the screenshot makes an unsupported protection claim, implies silent OS permission granting, or suggests FREED bypasses Android/iOS consent.
- Retake if a screenshot can be mistaken for passing physical-device validation. Store screenshots are marketing/review assets only.

## Generation Handoff

When final copy and source screenshots are approved, generate the framed App Store and Play listing assets, then add `store/screenshots/listing/manifest.json` with dimensions and SHA-256 hashes for every final file. Keep `store/screenshots/manifest.json` scoped to IAP review unless the catalog audit is intentionally expanded.
