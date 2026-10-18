# Localization verification

FREED ships English (`en`), Hindi (`hi`), Bengali (`bn`), Spanish (`es`), Portuguese (`pt`), French (`fr`), German (`de`), Arabic (`ar`), Japanese (`ja`), and Simplified Chinese (`zh-Hans`). Resource files live in `src/i18n/locales`. English remains the fallback for unknown text.

Each file contains `common`, `preferences`, `dns`, and `source` dictionaries. `native.permissions` contains translations of the actual permission descriptions from `app.json`. The new encrypted-DNS disclosure describes HTTPS queries sent to Cloudflare Families. Older DNS Guard disclosures remain separately in `source` for the existing local filter.

The `source` dictionary uses exact authored English strings as keys. Long recovery readings are translated as full paragraph units. Dynamic authored copy uses named interpolation tokens such as `{{count}}`, `{{price}}`, and `{{cadence}}`; translations retain exactly the same token names and occurrences. Brand names, app names, URLs, product identifiers, and user-provided text retain their identities.

## Run the checks

```sh
node --test tests/localization-catalog.test.js
node scripts/localization-audit.js
node scripts/localization-audit.js --json
node scripts/localization-audit.js --strict
```

The ordinary audit exits unsuccessfully for missing or malformed locale files, language-set mismatch, inconsistent keys, empty translations, unexplained English-identical values, or interpolation mismatch. Shared spellings have narrow documented exceptions in the audit; they are not a blanket exemption for English paragraphs.

The audit also reports uncovered source phrases with file, line, containing surface, and category. A structurally complete resource set can still leave English visible. `--strict` exits unsuccessfully whenever the current source inventory has untranslated phrases. Do not report app-wide localization complete until this gate passes and the actual screens have been exercised.

The inventory includes JSX text, copy attributes and properties, long body arrays, readable error candidates, dynamic template candidates, and recovery-draft notices. It follows references from exported declarations in `freed-app.tsx`, so unreferenced legacy screens are excluded with evidence. Server scanning is limited to approved user-facing CLARA, challenge, and retention catalogs; model prompts, schemas, classifier needles, URLs, authentication protocols, SVG path commands, identifiers, and testIDs are excluded. Literal candidates should still be checked in their recorded context before translating.

Native output scanning targets `FreedProtectionModule.swift`, `FreedProtectionModule.kt`, and `FreedDnsGuardPolicy.kt`. It records authored `message` fields and arguments, capability `notes`, readable Safari routing errors, `makeFreedError` messages, settings-route message arguments, and the small helpers that return unlock/protection/DNS policy messages. Branches and Swift/Kotlin interpolation retain occurrence evidence. Native count suffixes are inventoried in both their singular and plural rendered forms; optional Android DNS notes have both a base phrase and a composed template. Nested readable fallback errors are included. Package IDs, domains, settings action constants, raw operating-system errors, classifier labels, and internal issue-code diagnostics are not translation units.

This inventory verifies the selected authored native outputs reaching the app’s source bridge. It does not claim to translate arbitrary device/vendor error text or ML-generated labels, and it does not replace signed-device testing of platform-owned UI. Native permission prompts use the separately generated platform resource files from `native.permissions`.

Refresh the durable, categorized inventory when authored copy changes:

```sh
node scripts/localization-audit.js --write-catalog
```

This regenerates `src/i18n/source-catalog.ts`, exporting `SOURCE_COPY_CATALOG` with entries, occurrence evidence, and excluded top-level declarations. It does not modify app code or silently remove old resource keys that may still be used by saved recovery state.

## Merge translation batches

Batch authors write a separate file under `src/i18n/batches`:

```json
{
  "entries": [
    {
      "source": "Exact English phrase {{count}}",
      "translations": {
        "hi": "… {{count}}",
        "bn": "… {{count}}",
        "es": "… {{count}}",
        "pt": "… {{count}}",
        "fr": "… {{count}}",
        "de": "… {{count}}",
        "ar": "… {{count}}",
        "ja": "… {{count}}",
        "zh-Hans": "… {{count}}"
      }
    }
  ]
}
```

These ellipses illustrate the schema only and must never be shipped as translations. Keep incomplete work in a non-JSON staging file, such as `main-4.draft`, then rename it to `.json` when every entry has all nine translations. Use one catalog writer while other workers produce separate batches.

```sh
node scripts/localization-audit.js --merge-batches --write-catalog
node --test tests/localization-catalog.test.js
```

The merge validates every completed batch before modifying resources, inserts English source identities, preserves existing translations, and is idempotent. Conflicting existing text requires deliberate review; rerunning a batch does not overwrite it.

## Review the rendered experience

Automated tests verify locale parity, real translation differences, native scripts, full Library paragraphs, accurate encrypted-DNS disclosure, native output extraction and coverage, and safe batch merging. These are machine-generated translation drafts without independent native-speaker review. Automated checks cannot establish linguistic fluency or semantic accuracy by themselves.

Exercise welcome, account access, protection setup, Today, Shield, Progress, Profile, preferences, Library, article reading, CLARA, challenges, and the paywall in every locale. Check Arabic after the requested direction restart, Hindi and Bengali glyphs, large text, long German labels, VoiceOver/TalkBack labels, store-formatted prices, counters, and date formatting. Confirm URLs, purchase IDs, passwords, emails, user-entered recovery notes, and testIDs are preserved. Verify native permission prompts on signed devices separately from translated in-app explanations.
