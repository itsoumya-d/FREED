# Normal-Browsing Corpus Capture: normal-browsing-current

This folder contains a manual QA run matrix. It does not satisfy release evidence by itself.
Manifest boundary: `Normal-browsing capture packets are setup handoffs only. They do not prove physical-device browser allow/block behavior, zero false positives, or zero missed adult blocks until real QA fills and validates normal-browsing-corpus.json.`
Evidence satisfied: `false`

How to use:

1. Run every matrix row on the named physical device/browser with FREED protection enabled.
2. Fill `actualResult`, `artifact`, `status`, and notes in the CSV or copy results into a QA report.
3. Put screenshots, videos, and logs under the same artifact folder or a production-safe HTTPS QA URL.
4. Use `normal-browsing-browser-checklist.md` as the per-browser capture checklist while filling the CSV.
5. Complete the per-browser `browser-report-templates/*.template.json` files and reference the completed local JSON reports from `normalBrowsing.browserMatrix[].resultArtifact`.
6. Fill `normal-browsing-corpus.json` with exact counts and artifact references.
7. Run `npm run evidence:validation:draft -- docs/validation/artifacts/<run-id>/draft-evidence` before promotion.

The manual browser matrix intentionally uses only the release template's real external URL sets. Synthetic classifier-corpus URLs are exported separately as static classifier proof and are not physical browser QA targets.
`normal-browsing-corpus-matrix.csv` is the physical-browser run sheet; `classifier-corpus-static.csv` is classifier coverage proof only.
`normal-browsing-browser-summary.template.json` precomputes pending `normalBrowsing.browserMatrix` rows with exact URL counts for each browser. Keep the rows pending until physical-device QA fills device details, result artifacts, pass counts, zero failure counts, and `passed=true`.
`browser-report-templates/*.template.json` are pending `freed-normal-browsing-browser-report-v1` report shapes with `sanitized=true`. Keep them out of final evidence until every pass/no-false-positive/no-missed-block check is true.
`normal-browsing-evidence-fill-template.json` mirrors the final evidence shape but intentionally uses pending values and false checks. Do not promote it without replacing every pending field with real QA evidence.

Required counts:

- Classifier corpus cases: 49
- Release allowed URLs: 12
- Release recovery-search URLs: 4
- Release adult-blocked URLs: 4
- Browser rows: 5
- Manual QA rows: 100
- Static classifier-only rows: 49

