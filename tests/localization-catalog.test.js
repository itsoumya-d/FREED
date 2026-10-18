'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const ts = require('typescript');
const {spawnSync} = require('node:child_process');
const {LOCALES, audit, placeholders, inventory, mergeBatches, collectNativePhrases, NATIVE_SOURCE_FILES} = require('../scripts/localization-audit');
const ROOT = path.resolve(__dirname, '..');
const resources = Object.fromEntries(LOCALES.map(locale => [locale, JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/locales', `${locale}.json`), 'utf8'))]));

test('all ten catalogs have matching non-empty keys and interpolation tokens', () => {
  const report = audit();
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.locales, ['en','hi','es','pt','fr','de','ar','ja','ko','zh-Hans']);
  for (const [source, english] of Object.entries(resources.en.source)) {
    assert.equal(english, source, 'The English source bridge is an identity map');
    for (const locale of LOCALES.slice(1)) {
      assert.ok(resources[locale].source[source]?.trim(), `${locale}: ${source}`);
      assert.deepEqual(placeholders(resources[locale].source[source]), placeholders(source));
    }
  }
});

test('preferences, core navigation and common actions are translated', () => {
  for (const locale of LOCALES.slice(1)) {
    for (const key of ['close','back','cancel','continue','retry','done']) assert.notEqual(resources[locale].common[key], resources.en.common[key], `${locale}: ${key}`);
    for (const key of ['title','appearance','language','languageDescription','saved','saveError','restartRequired','restartNow','later']) assert.notEqual(resources[locale].preferences[key], resources.en.preferences[key], `${locale}: preferences.${key}`);
    for (const label of ['Today','Shield','Progress','Profile','Library']) assert.notEqual(resources[locale].source[label], label, `${locale}: ${label}`);
  }
});

test('Cloudflare disclosure states off-device processing and retains provider identity', () => {
  assert.match(resources.en.dns.consentBody, /sent to Cloudflare Families over HTTPS/);
  assert.match(resources.en.dns.consentBody, /Cloudflare receives the domains requested/);
  assert.match(resources.en.dns.consentBody, /does not inspect content inside encrypted apps/);
  assert.match(resources.en.dns.providerExceptions, /cannot override Cloudflare/);
  for (const locale of LOCALES.slice(1)) {
    assert.notEqual(resources[locale].dns.consentBody, resources.en.dns.consentBody);
    assert.match(resources[locale].dns.consentBody, /Cloudflare Families/);
    assert.match(resources[locale].dns.consentBody, /HTTPS/);
    assert.ok(resources[locale].dns.consentBody.length > 90);
    for (const key of ['off','waiting','releaseGated']) assert.ok(resources[locale].dns[key]?.trim());
  }
});

test('every local recovery article is translated as complete paragraphs', () => {
  const source = fs.readFileSync(path.join(ROOT, 'src/data/library-articles.ts'), 'utf8');
  const module = {exports:{}};
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('exports','module',compiled)(module.exports,module);
  const articles = module.exports.LIBRARY_ARTICLES;
  assert.equal(articles.length, 4);
  assert.equal(articles.reduce((count, article) => count+article.paragraphs.length, 0), 16);
  for (const article of articles) for (const locale of LOCALES.slice(1)) {
    for (const value of [article.title, article.tag, article.summary, ...article.paragraphs]) {
      assert.ok(resources[locale].source[value], `${locale}: missing ${article.id} text`);
      assert.notEqual(resources[locale].source[value], value, `${locale}: English placeholder in ${article.id}`);
    }
    // CJK characters encode substantially more meaning per character than
    // alphabetic scripts; this catches empty/one-sentence placeholders without
    // imposing an English word-length model on Chinese text.
    const minimumLength = locale === 'zh-Hans' ? 45 : 80;
    for (const paragraph of article.paragraphs) assert.ok(resources[locale].source[paragraph].length > minimumLength, `${locale}: truncated ${article.id} paragraph`);
  }
});

test('Arabic, Hindi, Korean, Japanese and Chinese resources contain their own scripts', () => {
  const alphabets = {ar:/[\u0600-\u06ff]/, hi:/[\u0900-\u097f]/, ko:/[\uac00-\ud7af]/, ja:/[\u3040-\u30ff]/, 'zh-Hans':/[\u4e00-\u9fff]/};
  for (const [locale, alphabet] of Object.entries(alphabets)) {
    assert.match(resources[locale].preferences.languageDescription, alphabet);
    assert.match(resources[locale].dns.consentBody, alphabet);
    assert.match(resources[locale].source['How urges peak and fade'], alphabet);
  }
});
test('legal body paragraphs and permission explanations are in the source catalog', () => {
  const report = audit();
  for (const file of ['src/features/legal-pages.tsx','src/lib/protection-permissions.ts','src/lib/protection-setup-presenter.ts']) {
    assert.equal(report.coverage.byFile[file].uncovered,0,`${file}: untranslated authored copy`);
  }
});
test('native permission resources match actual authored descriptions', () => {
  const config=JSON.parse(fs.readFileSync(path.join(ROOT,'app.json'),'utf8'));
  const permissions=Object.entries(config.expo.ios.infoPlist).filter(([key,value])=>key.endsWith('UsageDescription')&&typeof value==='string');
  assert.equal(permissions.length,5);
  for(const [key,description] of permissions) {
    assert.equal(resources.en.native.permissions[key],description);
    for(const locale of LOCALES.slice(1)) {
      assert.equal(resources[locale].native.permissions[key],resources[locale].source[description]);
      assert.notEqual(resources[locale].native.permissions[key],description);
    }
  }
});
test('native authored output extraction follows branches, helpers and interpolation without collecting identifiers', () => {
  const swift = String.raw`
    let programId = "app.freed.protection"
    let diagnosticOnly = "Internal configuration diagnostics are not displayed."
    // message: "A comment is not displayed."
    let status = statusPayload(message: active
      ? "Screen Time is active."
      : "Screen Time needs approval.")
    let notes = ["notes": ["Uses Apple authorization."]]
    throw makeFreedError("Rule \(index + 1) is invalid.")
    private func earnedUnlockMessage() -> String {
      return "Only the challenged app is unlocked."
    }
  `;
  const swiftPhrases = collectNativePhrases('native.swift', swift).map(item => item.source);
  assert.deepEqual(swiftPhrases.sort(), ['Screen Time is active.','Screen Time needs approval.','Uses Apple authorization.','Rule {{value1}} is invalid.','Only the challenged app is unlocked.'].sort());
  const kotlin = String.raw`
    val status = statusPayload(message = when (route) {
      "settings-route" -> "Opened Android settings."
      else -> "Android settings could not open."
    })
    val count = statusPayload(message = "Saved with \${allowed.size} domain\${if (allowed.size == 1) "" else "s"}.")
    val error = statusPayload(message = "Could not read image: \${error.localizedMessage ?: "unknown error"}")
    private fun protectionStatusMessage(): String {
      return "Protection is active.\$privateDnsNote"
    }
  `.replace(/\\\$/g, '$');
  const kotlinPhrases = collectNativePhrases('native.kt', kotlin).map(item => item.source);
  assert.deepEqual(kotlinPhrases.sort(), ['Opened Android settings.','Android settings could not open.','Saved with {{count}} domain.','Saved with {{count}} domains.','Could not read image: {{error}}','unknown error','Protection is active.{{privateDnsNote}}','Protection is active.'].sort());
});
test('native protection output has translated coverage in every locale', () => {
  const report = audit();
  for (const file of NATIVE_SOURCE_FILES) {
    if (file.endsWith('FreedInterventionActivity.kt')) {
      // The barrier has four resource-backed controls after removal of its
      // automatic countdown. Check actual resource references, not a stale
      // minimum number of literal strings.
      const contents = fs.readFileSync(path.join(ROOT, file), 'utf8');
      const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/native-android-catalog.json'), 'utf8'));
      const ids = [...new Set([...contents.matchAll(/\bR\.string\.([a-zA-Z_0-9]+)/g)].map(match => match[1]))];
      assert.deepEqual(ids.sort(), ['freed_intervention_breathe', 'freed_intervention_eyebrow', 'freed_intervention_title', 'freed_start_recovery']);
      for (const id of ids) {
        assert.ok(Object.hasOwn(registry, id), `${file}: missing resource ${id}`);
        const entry = inventory().entries.find(item => item.source === registry[id]);
        assert.ok(entry?.occurrences.some(occurrence => occurrence.file === file && occurrence.kind === 'native-resource'), `${id}: missing consumer evidence`);
        for (const locale of LOCALES) assert.ok(resources[locale].source[registry[id]]?.trim(), `${locale}: missing ${id}`);
      }
    } else {
      assert.ok(report.coverage.byFile[file].phrases >= (file.endsWith('ContentBlockerRequestHandler.swift') ? 2 : file.endsWith('SafariWebExtensionHandler.swift') ? 1 : file.endsWith('FreedNativeCompanion.kt') ? 3 : file.endsWith('ShieldActionExtension.swift') ? 2 : file.endsWith('FreedDnsGuardPolicy.kt') ? 3 : /FreedProtectionModule\.(?:swift|kt)$/.test(file) ? 40 : 5), `${file}: incomplete native inventory`);
    }
    assert.equal(report.coverage.byFile[file].uncovered, 0, `${file}: native authored output is untranslated`);
  }
});

test('Android disclosure describes whole-app coverage and user-initiated recovery consistently', () => {
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/i18n/native-android-catalog.json'), 'utf8'));
  assert.match(registry.freed_accessibility_description, /selected apps.*whole-app/);
  assert.match(registry.freed_accessibility_description, /Shorts and Reels inspection is experimental and outside the public release/);
  for (const key of ['freed_browser_channel_description', 'freed_dns_intervention_channel_description']) {
    assert.match(registry[key], /only when you choose/);
    assert.doesNotMatch(registry[key], /redirects|opening.*now/);
  }
  assert.doesNotMatch(registry.freed_intervention_subtitle, /opening.*now/);
  for (const locale of LOCALES) {
    const message = resources[locale].source[registry.freed_intervention_subtitle];
    assert.ok(message?.includes(resources[locale].source[registry.freed_start_recovery]), `${locale}: disclosure must name the displayed recovery button`);
  }
});
test('Hindi and Arabic prose has no accidental CJK text', () => {
  for(const locale of ['hi','ar']) {
    for(const [source,translation] of Object.entries(resources[locale].source)) {
      assert.doesNotMatch(translation,/[\u3040-\u30ff\u4e00-\u9fff]/,`${locale}: mixed-script draft in ${source}`);
    }
  }
});

test('all active authored surfaces pass the strict release coverage gate', () => {
  const report = audit();
  assert.ok(report.coverage.distinctPhrases > 1000, 'Inventory must cover legacy UI and challenge copy');
  assert.equal(report.coverage.covered+report.coverage.uncovered, report.coverage.distinctPhrases);
  assert.deepEqual(report.coverage.uncoveredPhrases, [], 'Translate newly authored copy before release');
  assert.equal(report.coverage.uncovered, 0);
  const strict = spawnSync(process.execPath, ['scripts/localization-audit.js','--strict'], {cwd:ROOT,encoding:'utf8'});
  assert.equal(strict.status, 0, strict.stdout+strict.stderr);
});

test('local photo display templates inventory every target noun and generated instruction', () => {
  const entries = inventory().entries;
  for (const target of ['flower', 'plant', 'chair', 'cup', 'shoe', 'branch', 'clock', 'fruit']) {
    for (const value of [target, `Find a ${target}`, `Find a ${target} nearby.`]) {
      const entry = entries.find(item => item.source === value);
      assert.ok(entry?.occurrences.some(item => item.file === 'src/data/momentum-resets.ts' && item.kind === 'generated-target-copy'), `Missing displayed target: ${value}`);
    }
  }
});

test('unused legacy profile is excluded through exported-entry reachability', () => {
  const catalog = inventory();
  const main = fs.readFileSync(path.join(ROOT,'src/features/freed-app.tsx'),'utf8');
  if (/function LegacyProfileScreen\(/.test(main)) assert.ok(catalog.excludedDeclarations.includes('LegacyProfileScreen'));
  assert.ok(catalog.entries.every(entry => !entry.occurrences.some(occurrence => occurrence.surface === 'LegacyProfileScreen')));
  assert.ok(!catalog.entries.some(entry => /^M 28 140 C/.test(entry.source)), 'SVG path commands are not copy');
});

function batchFixture() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'freed-copy-batch-'));
  fs.mkdirSync(path.join(directory,'src/i18n/locales'),{recursive:true});
  fs.mkdirSync(path.join(directory,'src/i18n/batches'),{recursive:true});
  for (const locale of LOCALES) fs.writeFileSync(path.join(directory,'src/i18n/locales',`${locale}.json`),JSON.stringify({source:{existing:locale==='en'?'existing':`kept-${locale}`},common:{},preferences:{},dns:{}}));
  return directory;
}
test('new native authored messages are reported as uncovered with occurrence evidence', () => {
  const directory = batchFixture();
  try {
    const nativePath = path.join(directory,NATIVE_SOURCE_FILES[0]);
    fs.mkdirSync(path.dirname(nativePath),{recursive:true});
    fs.writeFileSync(nativePath,'let status = statusPayload(message: "A newly authored protection message.")');
    const report = audit(directory);
    assert.equal(report.coverage.uncovered, 1);
    assert.ok(report.warnings.some(warning => warning.includes('English fallback')));
    assert.equal(report.coverage.uncoveredPhrases[0].source,'A newly authored protection message.');
    assert.deepEqual(report.coverage.uncoveredPhrases[0].occurrences,[{file:NATIVE_SOURCE_FILES[0],line:1,kind:'native-output',surface:'native-user-facing-output'}]);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('batch merge is idempotent and preserves reviewed translations', () => {
  const directory=batchFixture();
  try {
    const translations=Object.fromEntries(LOCALES.slice(1).map(locale=>[locale,`translation-${locale} {{count}}`]));
    fs.writeFileSync(path.join(directory,'src/i18n/batches','one.json'),JSON.stringify({entries:[{source:'{{count}} new tasks',translations},{source:'existing',translations:Object.fromEntries(LOCALES.slice(1).map(locale=>[locale,`replacement-${locale}`]))}]}));
    assert.equal(mergeBatches(directory).added,1);
    assert.equal(mergeBatches(directory).added,0);
    for(const locale of LOCALES.slice(1)) {
      const resource=JSON.parse(fs.readFileSync(path.join(directory,'src/i18n/locales',`${locale}.json`),'utf8'));
      assert.equal(resource.source.existing,`kept-${locale}`);
      assert.equal(resource.source['{{count}} new tasks'],translations[locale]);
    }
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});
test('invalid translation batches fail before changing any catalog', () => {
  const directory=batchFixture();
  try {
    const englishPath=path.join(directory,'src/i18n/locales/en.json'), before=fs.readFileSync(englishPath,'utf8');
    const translations=Object.fromEntries(LOCALES.slice(1).map(locale=>[locale,`translation-${locale}`]));
    fs.writeFileSync(path.join(directory,'src/i18n/batches','bad.json'),JSON.stringify({entries:[{source:'{{count}} new tasks',translations}]}));
    assert.throws(()=>mergeBatches(directory),/interpolation mismatch/);
    assert.equal(fs.readFileSync(englishPath,'utf8'),before);
  } finally {fs.rmSync(directory,{recursive:true,force:true});}
});

test('semantic shield batches coexist with authored batches and validate Korean before merge', () => {
  const directory = batchFixture();
  try {
    const copy = Object.fromEntries(LOCALES.map(locale => [locale, Object.fromEntries(['title','primary','secondary','targetDescription','categoryDescription'].map(key => [key, `${locale}-${key}`]))]));
    fs.writeFileSync(path.join(directory,'src/i18n/batches','native-shield.json'), JSON.stringify(copy));
    assert.doesNotThrow(() => mergeBatches(directory));
    delete copy.ko;
    fs.writeFileSync(path.join(directory,'src/i18n/batches','native-shield.json'), JSON.stringify(copy));
    assert.throws(() => mergeBatches(directory), /shield.*language set/i);
  } finally { fs.rmSync(directory,{recursive:true,force:true}); }
});
