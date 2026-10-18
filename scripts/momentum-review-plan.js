#!/usr/bin/env node
'use strict';
// Read-only planning and guarded file generation. This module never runs Maestro,
// boots a device, establishes a fixture, resets data, or promotes runtime results.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const yaml = require('js-yaml');
const { validateIsolation, OWNER_SIMULATOR } = require('./lib/feature-test-manifest');
const ROOT = path.resolve(__dirname, '..');
const LANGUAGES = [
    'en', 'hi', 'es', 'pt', 'fr', 'de', 'ar', 'ja', 'ko', 'zh-Hans'
];
const THEMES = ['light', 'dark'];
const PLATFORMS = ['ios', 'android'];
const MATRIX = 'docs/implementation/screen-review-matrix.json';
const TREATMENTS = 'docs/implementation/momentum-surface-treatment-map.json';
const OUTPUT = 'docs/implementation/momentum-native-review-plan.json';
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
function filesUnder(root, relative) {
    const folder = path.join(root, relative);
    if (!fs.existsSync(folder))
        return [];
    return fs.readdirSync(folder, {
        withFileTypes: true
    }).flatMap(entry => entry.isDirectory() && ![
        'build', 'Pods', 'node_modules', '.git'
    ].includes(entry.name) ? filesUnder(root, path.join(relative, entry.name)) : entry.isFile() ? [path.join(relative, entry.name).replace(/\\/g, '/')] : []).sort();
}
function appSourceFiles(root) {
    const code = [
        ...filesUnder(root, 'src'), ...filesUnder(root, 'app'),
        ...filesUnder(root, 'modules/freed-protection'), ...filesUnder(root, 'ios'),
        ...filesUnder(root, 'android/app/src')
    ].filter(file => /\.(tsx?|js|json|swift|kt|xml|strings|png|webp|svg|ttf|html|css|plist|pbxproj)$/.test(file) && !/(?:GoogleService-Info|google-services|\.env|server-verification|\/tests?\/)/.test(file));
    // Asset format is unrestricted: brand binaries, Lottie and future formats
    // are build inputs too. Locks and bundler configs bind compilation choices.
    const assets = filesUnder(root, 'assets');
    const design = filesUnder(root, 'design');
    const buildInputs = [
        'app.config.js', 'app.json', 'package.json', 'package-lock.json',
        'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
        'ios/Podfile', 'ios/Podfile.lock',
        'babel.config.js', 'babel.config.cjs', 'babel.config.mjs', 'babel.config.json',
        'metro.config.js', 'metro.config.cjs', 'metro.config.mjs', 'metro.config.json',
        'android/build.gradle', 'android/app/build.gradle', 'android/settings.gradle',
        'android/gradle.properties'
    ].filter(file => fs.existsSync(path.join(root, file)));
    return [...new Set([...code, ...assets, ...design, ...buildInputs])].sort();
}
function fingerprint(root, files = appSourceFiles(root)) { const entries = [...new Set(files)].sort().map(file => ({
    file, sha256: sha256(fs.readFileSync(path.join(root, file)))
})); return {
    algorithm: 'sha256-of-sorted-path-and-content-hashes-v2', sha256: sha256(entries.map(entry => `${entry.file}\0${entry.sha256}\n`).join('')), fileCount: entries.length
}; }
function sourceSelectors(root) {
    const staticIds = new Map(), templates = [];
    for (const file of appSourceFiles(root).filter(f => /\.tsx$/.test(f))) {
        const text = fs.readFileSync(path.join(root, file), 'utf8');
        for (const match of text.matchAll(/testID\s*=\s*(?:"([^"]+)"|'([^']+)'|\{\s*"([^"]+)"\s*\}|\{\s*'([^']+)'\s*\})/g)) {
            const id = match.slice(1).find(Boolean);
            if (!staticIds.has(id))
                staticIds.set(id, []);
            staticIds.get(id).push({
                file, line: text.slice(0, match.index).split('\n').length
            });
        }
        for (const match of text.matchAll(/testID\s*=\s*\{[^\n]*`([^`]+)`[^\n]*\}/g))
            templates.push({
                template: match[1], file, line: text.slice(0, match.index).split('\n').length
            });
    }
    return {
        staticIds, templates, hasRouteWrapper: fs.existsSync(path.join(root, 'src/features/freed-app.tsx')) && fs.readFileSync(path.join(root, 'src/features/freed-app.tsx'), 'utf8').includes('`screen-${screen}`'), hasLanguageRows: fs.existsSync(path.join(root, 'src/components/LanguagePicker.tsx')) && fs.readFileSync(path.join(root, 'src/components/LanguagePicker.tsx'), 'utf8').includes('`${testID}-${option.value}`')
    };
}
function selectorEvidence(id, index) {
    if (/^language-(?:bn)(?:$|-)/.test(id))
        return {
            confirmed: false, reason: 'retired-language'
        };
    if (id === 'language' && index.hasLanguageRows)
        return {
            confirmed: false, reason: 'obsolete-language-container'
        };
    if (/^language-(?:system|en|hi|es|pt|fr|de|ar|ja|ko|zh-Hans)$/.test(id) && index.hasLanguageRows)
        return {
            confirmed: true, kind: 'declared-language-row', source: 'src/components/LanguagePicker.tsx'
        };
    if (/^appearance-(?:system|light|dark)$/.test(id))
        return {
            confirmed: true, kind: 'declared-android-appearance-row', platforms: ['android'], source: 'src/components/PreferencePicker.android.tsx'
        };
    if (index.staticIds.has(id))
        return {
            confirmed: true, kind: 'literal-source', occurrences: index.staticIds.get(id)
        };
    if (index.hasRouteWrapper && /^screen-main-(?:today|shield|progress|profile)$/.test(id))
        return {
            confirmed: true, kind: 'declared-root-route', source: 'src/features/freed-app.tsx'
        };
    if (index.hasRouteWrapper && /^screen-(?:welcome|quiz|planCalculation|appSelection|account|paywall|protectionSetup|library|intercept|ad|challenge|breathing|checkin|journal|coach|slip|customChallenge|article)$/.test(id))
        return {
            confirmed: true, kind: 'declared-flow-route', source: 'src/features/freed-app.tsx'
        };
    return {
        confirmed: false, reason: 'selector-not-confirmed-in-current-source'
    };
}
function inventoryFlows(root, index = sourceSelectors(root)) {
    return filesUnder(root, '.maestro/flows').filter(file => file.endsWith('.yaml')).map(file => {
        const text = fs.readFileSync(path.join(root, file), 'utf8'), docs = yaml.loadAll(text);
        const meta = docs[0] || {};
        const selectors = [], links = [], textSelectors = [];
        function visit(value, platforms = PLATFORMS, command = null) {
            if (Array.isArray(value)) {
                value.forEach(item => visit(item, platforms, command));
                return;
            }
            if (!value || typeof value !== 'object')
                return;
            const current = value.when?.platform ? [String(value.when.platform).toLowerCase()] : platforms;
            for (const [key, item] of Object.entries(value)) {
                if (key === 'id' && typeof item === 'string')
                    selectors.push({
                        id: item, platforms: current, command, evidence: selectorEvidence(item, index)
                    });
                if (key === 'openLink' && typeof item === 'string')
                    links.push(item);
                if (key === 'text' && typeof item === 'string')
                    textSelectors.push(item);
                if (['tapOn', 'assertVisible', 'assertNotVisible'].includes(key) && typeof item === 'string')
                    textSelectors.push(item);
                visit(item, current, key);
            }
        }
        visit(docs[1]);
        return {
            name: meta.name || path.basename(file, '.yaml'), file, tags: meta.tags || [], sha256: sha256(text), links: [...new Set(links)], selectors, localeSensitiveTextSelectors: [...new Set(textSelectors)].sort(), gaps: selectors.filter(s => !s.evidence.confirmed).map(s => ({
                selector: s.id, platforms: s.platforms, reason: s.evidence.reason
            })), resetCommands: /\b(?:clearState|clearKeychain|eraseDevice)\s*:/.test(text)
        };
    }).sort((a, b) => a.name.localeCompare(b.name));
}
const FLOWS = {
    splash: [], welcome: ['onboarding-welcome'], quiz: ['onboarding-quiz'], planCalculation: ['onboarding-plan'], appSelection: ['onboarding-app-selection'], paywall: ['paywall-plans', 'paywall-legal', 'paywall-free-exit'], account: ['account-options'], protectionSetup: ['protection-setup'], library: ['library-articles'], today: [
        'today-metrics', 'today-habits', 'today-pledge', 'root-navigation'
    ], shield: ['shield-health', 'protection-layers'], progress: ['progress-zero', 'progress-reports'], profile: ['profile-plan', 'root-navigation'], intercept: ['intercept', 'urgent-support'], ad: ['rewarded-reset'], challenge: ['challenge-list'], breathing: ['breathing'], checkin: ['checkin-save', 'recovery-drafts'], journal: ['journal-save', 'recovery-drafts'], coach: ['clara-local'], slip: ['slip-save'], customChallenge: ['custom-reset'], article: ['library-articles'], preferences: ['preferences-language', 'preferences-appearance', 'localization-rtl-restart'], privacy: ['privacy-support', 'paywall-legal'], support: ['privacy-support'], 'account-deletion': ['deletion-account'], 'profile/reminders': ['profile-reminders'], 'profile/routine': ['profile-plan'], 'profile/history': ['profile-history'], 'profile/backup/export': ['backup-local'], 'profile/backup/restore': ['backup-local'], 'profile/backup/automatic': ['backup-hosted'], 'profile/accountability/partner': ['profile-accountability'], 'profile/accountability/support-circle': ['profile-accountability'], 'profile/privacy/deletion-local': ['deletion-local'], 'profile/privacy/deletion-account': ['deletion-account'], 'account/email-login': ['account-options', 'account-validation'], 'account/email-create': ['account-validation'], 'account/email-reset': ['account-reset-validation'], 'account/email-verification': ['account-verification'], 'account/provider-collision': [], 'shield/app-selection': ['shield-preferences'], 'shield/limits': ['shield-preferences'], 'shield/schedules': ['shield-schedules'], 'shield/domain-exceptions': ['shield-allowlist'], 'shield/focus-rules': [], 'shield/calibration': [], 'shield/encrypted-dns': ['encrypted-dns-consent', 'encrypted-dns-status', 'encrypted-dns-release-gated'], 'shield/diagnostics': ['shield-diagnostics'], 'progress/history': ['progress-reports'], 'progress/milestones': ['progress-zero'], 'progress/reports': ['progress-reports'], 'library/search': ['library-search'], 'article/reading': ['library-articles'], 'challenge/photo': [], 'challenge/motion': [], 'challenge/timing': ['challenge-list'], 'coach/offline': ['clara-local'], 'coach/quota': [], 'paywall/loading': ['paywall-price-recovery'], 'paywall/unavailable': ['paywall-price-recovery'], 'paywall/ready': ['paywall-price-recovery'], 'paywall/cancel': [], 'paywall/restore': []
};
const ANCHOR_URLS = {
    welcome: 'freed:///onboarding/welcome', quiz: 'freed:///onboarding/quiz', planCalculation: 'freed:///onboarding/planCalculation', appSelection: 'freed:///onboarding/appSelection', account: 'freed:///flow/account', paywall: 'freed:///flow/paywall', protectionSetup: 'freed:///flow/protectionSetup', library: 'freed:///today/library', today: 'freed:///today', shield: 'freed:///shield', progress: 'freed:///progress', profile: 'freed:///profile', ad: 'freed:///flow/ad', challenge: 'freed:///flow/challenge', breathing: 'freed:///flow/breathing', checkin: 'freed:///flow/checkin', journal: 'freed:///flow/journal', coach: 'freed:///flow/coach', slip: 'freed:///flow/slip', customChallenge: 'freed:///flow/customChallenge', preferences: 'freed:///preferences'
};
const ROOT_TABS = new Set([
    'today', 'shield', 'progress', 'profile'
]);
function requirements(surface) {
    const need = ['disposable-fixture', 'matching-installed-binary-and-source', 'native-layout-control-back-resume-motion-a11y-review'];
    if ([
        'splash', 'welcome', 'quiz', 'planCalculation', 'appSelection'
    ].includes(surface))
        need.push('onboarding-stage-fixture');
    else
        need.push('completed-onboarding-fixture');
    if (/^account\//.test(surface))
        need.push('account-mode-fixture');
    if (/provider-collision|email-verification|deletion-account|backup\/automatic/.test(surface))
        need.push('isolated-account-service');
    if (/backup\//.test(surface))
        need.push('encrypted-backup-fixture');
    if (/history|milestone|routine|reports/.test(surface))
        need.push('recorded-history-fixture');
    if (surface === 'paywall' || /paywall\//.test(surface))
        need.push('store-price-or-purchase-state-fixture', 'store-sandbox');
    if (surface === 'customChallenge')
        need.push('verified-entitlement-fixture');
    if (surface === 'ad')
        need.push('rewarded-ad-sandbox');
    if (/challenge\//.test(surface))
        need.push('selected-challenge-fixture');
    if (surface === 'challenge/photo')
        need.push('physical-camera');
    if (surface === 'challenge/motion')
        need.push('physical-sensors');
    if (surface === 'shield/calibration')
        need.push('signed-device', 'android-accessibility-target-app', 'policy-release-gate');
    if (surface === 'shield/focus-rules')
        need.push('selected-rule-fixture', 'signed-device');
    if (surface === 'shield/encrypted-dns')
        need.push('real-network-dns-verification');
    if (/^coach\//.test(surface))
        need.push('offline-or-quota-service-state-fixture');
    if (/deletion|reset|cancel|restore/.test(surface))
        need.push('transition-result-fixture');
    return need;
}
function uniqueRows(rows, label) {
    if (!Array.isArray(rows) || !rows.length)
        throw new Error(`${label} must contain an explicit non-empty surface inventory`);
    const map = new Map();
    for (const row of rows) {
        if (!row.surface || map.has(row.surface))
            throw new Error(`Duplicate or invalid ${label} surface: ${row.surface}`);
        map.set(row.surface, row);
    }
    return map;
}
function buildPlan({ root = ROOT, matrix, treatments }) {
    const publicRows = treatments.publicPresentations || [];
    const review = uniqueRows(matrix.surfaces, 'review matrix');
    const design = uniqueRows([...treatments.surfaces, ...publicRows], 'treatment map and public presentations');
    if (review.size !== design.size || [...review.keys()].some(key => !design.has(key)))
        throw new Error('Review/treatment surface sets differ; every retained route, state and public presentation needs a treatment');
    for (const row of design.values()) {
        if (!Array.isArray(row.sourceEvidence) || !row.sourceEvidence.length)
            throw new Error(`Missing source marker evidence for ${row.surface}`);
        for (const evidence of row.sourceEvidence) {
            const file = path.join(root, evidence.file || '');
            if (!fs.existsSync(file) || !fs.statSync(file).isFile() || !Array.isArray(evidence.markers) || !evidence.markers.length)
                throw new Error(`Missing source marker file for ${row.surface}`);
            const content = fs.readFileSync(file, 'utf8');
            for (const marker of evidence.markers)
                if (typeof marker !== 'string' || !marker.trim() || !content.includes(marker))
                    throw new Error(`Unconfirmed source marker for ${row.surface}: ${marker}`);
        }
    }
    const publicNames = new Set(publicRows.map(row => row.surface));
    for (const row of publicRows) {
        if (review.get(row.surface).kind !== 'public-presentation' || row.kind !== 'public-presentation')
            throw new Error(`Public presentation kind mismatch for ${row.surface}`);
        if (!Array.isArray(row.entrySurfaces) || !row.entrySurfaces.length || row.entrySurfaces.some(entry => !review.has(entry) || publicNames.has(entry)))
            throw new Error(`Invalid public entry surface for ${row.surface}`);
        if (JSON.stringify(review.get(row.surface).entrySurfaces) !== JSON.stringify(row.entrySurfaces))
            throw new Error(`Public entry surface sets differ for ${row.surface}`);
    }
    const index = sourceSelectors(root), flows = inventoryFlows(root, index), flowByName = new Map(flows.map(flow => [flow.name, flow]));
    const surfaces = [...review.keys()].sort().map(surface => {
        const input = review.get(surface), treatment = design.get(surface), mapped = (FLOWS[surface] || []).map(name => flowByName.get(name)).filter(Boolean), url = ANCHOR_URLS[surface], anchor = url ? {
            url, selector: ROOT_TABS.has(surface) ? `screen-main-${surface}` : `screen-${surface}`
        } : null;
        const observed = anchor && flows.some(f => f.links.includes(url) && f.selectors.some(s => s.id === anchor.selector && s.evidence.confirmed));
        const gaps = [];
        if (!mapped.length)
            gaps.push('no-existing-surface-flow');
        if (!observed)
            gaps.push('no-direct-observed-anchor');
        if (mapped.some(f => f.localeSensitiveTextSelectors.length))
            gaps.push('existing-flow-uses-locale-sensitive-text');
        if (mapped.some(f => f.gaps.length))
            gaps.push('existing-flow-has-stale-or-unconfirmed-selectors');
        if (surface.includes('/'))
            gaps.push('root-route-anchor-does-not-establish-nested-state');
        if (publicNames.has(surface)) gaps.push('public-modal-requires-entry-and-auth-transition-fixtures');
        return {
            surface, kind: input.kind, source: treatment.source, renderer: treatment.renderer, treatment: treatment.treatment, reviewed: false, anchor: observed ? anchor : null, anchorCandidate: anchor, existingFlows: mapped.map(f => f.name), sourceEvidence: treatment.sourceEvidence, ...(publicNames.has(surface) ? {entrySurfaces: treatment.entrySurfaces} : {}), requirements: publicNames.has(surface) ? ['disposable-fixture', 'matching-installed-binary-and-source', 'native-layout-control-back-resume-motion-a11y-review', 'public-support-entry-state-fixture', 'four-public-entry-surfaces', 'no-cloud-store-ad-or-private-state'] : requirements(surface), coverageGaps: gaps
        };
    });
    const cells = [];
    for (const surface of surfaces)
        for (const language of LANGUAGES)
            for (const theme of THEMES)
                for (const platform of PLATFORMS) {
                    const baseline = review.get(surface.surface);
                    const check = baseline.checks?.[language]?.[theme];
                    if (!check)
                        throw new Error(`Missing ${language}/${theme} coverage for ${surface.surface}`);
                    const inherited = baseline.platformExecution?.[platform] || 'not-run';
                    const sharedBlock = Object.values(check).find(value => typeof value === 'string' && value.startsWith('blocked'));
                    const blocked = String(inherited).startsWith('blocked') || Boolean(sharedBlock);
                    cells.push({
                        id: `${surface.surface}|${language}|${theme}|${platform}`, surface: surface.surface, language, theme, platform, status: blocked ? 'blocked' : 'not-run', blockReason: blocked ? (String(inherited).startsWith('blocked') ? inherited : sharedBlock) : null, inheritedChecks: check, nativeEvidence: [], readiness: 'blocked-until-guard-and-state-prerequisites', scenario: publicNames.has(surface.surface) ? 'public-presentation-entry-and-auth-transition-scenarios' : surface.anchor ? 'observed-native-anchor' : 'fixture-or-service-or-hardware-scenario', ...(surface.entrySurfaces ? {entrySurfaces: surface.entrySurfaces} : {}), requirements: surface.requirements
                    });
                }
    const execution = {
        passed: 0, 'not-run': cells.filter(c => c.status === 'not-run').length, blocked: cells.filter(c => c.status === 'blocked').length
    };
    return {
        schemaVersion: 'freed-momentum-native-review-plan-v1', meaning: 'Planning is not execution. Source composition and generic smoke never pass native cells.', requiredNativeChecks: [
            'layout-and-font-scaling', 'authored-copy-and-interpolation', 'native-controls-and-gestures', 'back-resume-and-draft-preservation', 'interactive-companion', 'foreground-focus-and-Reduce-Motion', 'screen-reader-and-RTL'
        ], dimensions: {
            surfaceCount: surfaces.length, inheritedSurfaceCount: surfaces.length - publicNames.size, routeAndTabCount: surfaces.filter(row => ["route", "root-tab"].includes(row.kind)).length, nestedStateCount: surfaces.filter(row => row.kind === "nested-or-state").length, publicPresentationCount: publicNames.size, publicPresentationCellCount: publicNames.size * LANGUAGES.length * THEMES.length * PLATFORMS.length, languages: LANGUAGES, themes: THEMES, platforms: PLATFORMS, cellCount: cells.length
        }, inputHashes: {
            matrix: sha256(JSON.stringify(matrix)), treatments: sha256(JSON.stringify(treatments))
        }, sourceFingerprint: fingerprint(root), languageThemeNavigation: {
            languageRows: LANGUAGES.map(language => ({
                selector: `language-${language}`, evidence: selectorEvidence(`language-${language}`, index)
            })), androidThemeSelectors: THEMES.map(theme => `appearance-${theme}`), iosThemeLabels: 'Read current preferences.light/dark from the selected locale catalog; the native segmented picker lacks per-segment testIDs.', rtl: 'Each generated flow requires a fresh externally established English/LTR fixture; Arabic uses observed explicit-restart selectors, never resets app data.'
        }, summary: {
            execution, observedAnchorSurfaceCount: surfaces.filter(s => s.anchor).length, coverageGapSurfaceCount: surfaces.filter(s => s.coverageGaps.length).length, existingFlowCount: flows.length
        }, guardContract: {
            fixtureSchema: 'freed-disposable-ui-fixture-v1', fixtureFields: [
                'deviceId', 'platform', 'disposable=true', 'dataOwner=test-only', 'services=disabled|emulator|sandbox', 'allowRealEmail=false', 'allowRealPurchases=false', 'allowRealMessages=false'
            ], baselineFields: [
                'language=en', 'theme=light', 'rtl=false', 'onboardingComplete=true'
            ], bindingFields: [
                'deviceId', 'sourceFingerprint', 'installedSourceFingerprint', 'artifactPath', 'artifactSha256', 'installedBinarySha256', 'buildCapturePath', 'buildCaptureSha256'
            ], buildCaptureContract: { schemaVersion: 'freed-compiled-source-binding-v1', capturePhase: 'build-input', capturedBy: 'external-native-build', requiredFields: ['sourceFingerprint', 'artifactSha256', 'sourceCapturedAt', 'buildStartedAt', 'buildFinishedAt'], chronology: 'sourceCapturedAt <= buildStartedAt <= buildFinishedAt', authority: 'Supplied by an external native build runner, never synthesized by the review planner; JSON/hash consistency is not independent device observation.' }, outputScope: '.maestro/momentum-review/ only', installationBoundary: 'Installed and fixture state are externally supplied receipts; generation compares hashes/local bytes and never claims independent native observation.'
        }, guardRequirements: [
            'Existing disposable fixture contract, never owner simulator/data', 'Externally established English/LTR/light fixture with completed onboarding for anchor sweep', 'Artifact bytes hash equals installed-binary receipt hash', 'Current source fingerprint equals external build-input capture and installed-source receipt fingerprint', 'One disposable baseline per flow; no runtime fixture bypass or data/Keychain reset'
        ], surfaces, flowInventory: flows, cells
    };
}
function validateGuard(guard, currentFingerprint, root = ROOT) {
    const fixture = guard.fixture;
    if (!fixture || !validateIsolation(fixture, {
        device: fixture.deviceId, mode: fixture.platform
    }).valid)
        throw new Error('Invalid disposable fixture contract');
    if (String(fixture.deviceId).toUpperCase() === OWNER_SIMULATOR)
        throw new Error('Owner device is forbidden');
    if (!PLATFORMS.includes(fixture.platform))
        throw new Error('Unsupported native fixture platform');
    if (guard.baseline?.language !== 'en' || guard.baseline?.theme !== 'light' || guard.baseline?.rtl !== false || guard.baseline?.onboardingComplete !== true)
        throw new Error('Externally established English/LTR/light completed-onboarding baseline required');
    const binding = guard.binding;
    if (!binding || binding.deviceId !== fixture.deviceId || binding.sourceFingerprint !== currentFingerprint || binding.installedSourceFingerprint !== currentFingerprint)
        throw new Error('Source fingerprint mismatch or missing installed source binding');
    if (!/^[a-f0-9]{64}$/.test(binding.artifactSha256 || '') || binding.installedBinarySha256 !== binding.artifactSha256)
        throw new Error('Installed binary hash mismatch');
    const file = path.resolve(root, binding.artifactPath || '');
    if (!fs.existsSync(file) || !fs.statSync(file).isFile() || sha256(fs.readFileSync(file)) !== binding.artifactSha256)
        throw new Error('Local binary artifact bytes do not match binding');
    if (!binding.buildCapturePath || !/^[a-f0-9]{64}$/.test(binding.buildCaptureSha256 || ''))
        throw new Error('External build-time capture receipt is required; current hashes cannot establish compiled source');
    const capturePath = path.resolve(root, binding.buildCapturePath);
    if (!fs.existsSync(capturePath) || !fs.statSync(capturePath).isFile())
        throw new Error('External build capture file is missing');
    const bytes = fs.readFileSync(capturePath);
    if (sha256(bytes) !== binding.buildCaptureSha256)
        throw new Error('External build capture hash mismatch');
    const capture = JSON.parse(bytes.toString('utf8'));
    const capturedAt = Date.parse(capture.sourceCapturedAt);
    const startedAt = Date.parse(capture.buildStartedAt);
    const finishedAt = Date.parse(capture.buildFinishedAt);
    if (capture.schemaVersion !== 'freed-compiled-source-binding-v1' ||
        capture.capturePhase !== 'build-input' || capture.capturedBy !== 'external-native-build' ||
        capture.sourceFingerprint !== currentFingerprint || capture.artifactSha256 !== binding.artifactSha256 ||
        ![capturedAt, startedAt, finishedAt].every(Number.isFinite) || capturedAt > startedAt || startedAt > finishedAt)
        throw new Error('Invalid build-time source capture; source must be captured before compilation and bound to its artifact');
    return {
        platform: fixture.platform, deviceId: fixture.deviceId, services: fixture.services, sourceFingerprint: currentFingerprint, binarySha256: binding.artifactSha256, buildCaptureSha256: binding.buildCaptureSha256, claim: 'Provided installation/fixture binding validated against local bytes; native state is not independently observed by this planner'
    };
}
function renderSweep(plan, { platform, language, theme }) {
    if (!PLATFORMS.includes(platform) || !LANGUAGES.includes(language) || !THEMES.includes(theme))
        throw new Error('Invalid native sweep dimensions');
    const rows = plan.surfaces.filter(s => s.anchor && s.requirements.includes('completed-onboarding-fixture') && !s.requirements.some(r => [
        'rewarded-ad-sandbox', 'store-sandbox', 'selected-challenge-fixture', 'isolated-account-service', 'verified-entitlement-fixture'
    ].includes(r)));
    const commands = [
        {
            openLink: 'freed:///preferences'
        }, {
            extendedWaitUntil: {
                visible: {
                    id: 'screen-preferences'
                }, timeout: 15000
            }
        }, {
            scrollUntilVisible: {
                element: {
                    id: `language-${language}`
                }, direction: 'DOWN', timeout: 10000
            }
        }, {
            tapOn: {
                id: `language-${language}`
            }
        }, {
            assertVisible: {
                id: `language-${language}`, checked: true
            }
        }
    ];
    if (language === 'ar')
        commands.push({
            scrollUntilVisible: {
                element: {
                    id: 'language-restart'
                }, direction: 'DOWN', timeout: 10000
            }
        }, {
            assertVisible: {
                id: 'language-restart-notice'
            }
        }, {
            tapOn: {
                id: 'language-restart'
            }
        }, {
            openLink: 'freed:///preferences'
        }, {
            extendedWaitUntil: {
                visible: {
                    id: 'screen-preferences'
                }, timeout: 15000
            }
        });
    if (platform === 'android')
        commands.push({
            scrollUntilVisible: {
                element: {
                    id: `appearance-${theme}`
                }, direction: 'UP', timeout: 10000
            }
        }, {
            tapOn: {
                id: `appearance-${theme}`
            }
        }, {
            assertVisible: {
                id: `appearance-${theme}`, checked: true
            }
        });
    else
        commands.push({
            scrollUntilVisible: {
                element: {
                    id: 'appearance'
                }, direction: 'UP', timeout: 10000
            }
        }, {
            tapOn: {
                text: plan.localeLabels?.[language]?.[theme] || `UNBOUND-${language}-${theme}`, index: 0
            }
        });
    for (const row of rows)
        commands.push({
            openLink: row.anchor.url
        }, {
            extendedWaitUntil: {
                visible: {
                    id: row.anchor.selector
                }, timeout: 15000
            }
        }, {
            takeScreenshot: `${row.surface}-${language}-${theme}-${platform}`
        });
    return yaml.dump({
        appId: 'app.freed.recovery', name: `momentum-${platform}-${language}-${theme}`, tags: ['momentum-review', 'guarded-disposable', 'local-write']
    }, {
        lineWidth: -1
    }) + '---\n# Generated candidate only. Use verify-guard before execution; no owner data or resets.\n' + yaml.dump(commands, {
        lineWidth: -1
    });
}
function writeFlows(plan, guard, root = ROOT) {
    const current = fingerprint(root).sha256;
    if (current !== plan.sourceFingerprint.sha256)
        throw new Error('Source changed since review plan; rebuild before generation');
    const binding = validateGuard(guard, current, root);
    const directory = path.join(root, '.maestro/momentum-review');
    fs.mkdirSync(directory, {
        recursive: true
    });
    const files = [];
    const labels = {};
    for (const language of LANGUAGES)
        labels[language] = JSON.parse(fs.readFileSync(path.join(root, `src/i18n/locales/${language}.json`), 'utf8')).preferences;
    const scoped = {
        ...plan, localeLabels: labels
    };
    for (const language of LANGUAGES)
        for (const theme of THEMES) {
            const file = `.maestro/momentum-review/${binding.platform}-${language}-${theme}.yaml`;
            fs.writeFileSync(path.join(root, file), renderSweep(scoped, {
                platform: binding.platform, language, theme
            }));
            files.push(file);
        }
    fs.writeFileSync(path.join(directory, 'guard-binding.json'), JSON.stringify(binding, null, 2) + '\n');
    return {
        binding, files, status: 'generated-not-executed', installationEvidence: 'Provided installed hash/source binding is compared with local artifact; this planner cannot independently observe the device or fixture.', requiredInvocation: 'node scripts/momentum-review-plan.js --verify-guard GUARD.json before every manual Maestro run; regenerate baseline externally for each flow.'
    };
}
function main(argv) {
    const output = path.join(ROOT, OUTPUT);
    const options = {
        guard: null, emit: false, verify: false
    };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--emit-flows')
            options.emit = true;
        else if (argv[i] === '--guard')
            options.guard = argv[++i];
        else if (argv[i] === '--verify-guard') {
            options.verify = true;
            options.guard = argv[++i];
        }
        else if (argv[i] === '--help') {
            console.log('node scripts/momentum-review-plan.js [--guard GUARD.json --emit-flows]\nnode scripts/momentum-review-plan.js --verify-guard GUARD.json\nDefault writes the deterministic current route/state/public-presentation inventory x10x2x2 plan only. No UI or fixture establishment occurs.');
            return;
        }
        else
            throw new Error(`Unknown option: ${argv[i]}`);
    }
    const plan = buildPlan({
        root: ROOT, matrix: JSON.parse(fs.readFileSync(path.join(ROOT, MATRIX), 'utf8')), treatments: JSON.parse(fs.readFileSync(path.join(ROOT, TREATMENTS), 'utf8'))
    });
    if (options.verify) {
        if (!options.guard)
            throw new Error('Guard file required');
        console.log(JSON.stringify(validateGuard(JSON.parse(fs.readFileSync(path.resolve(ROOT, options.guard), 'utf8')), plan.sourceFingerprint.sha256, ROOT), null, 2));
        return;
    }
    if (options.emit) {
        if (!options.guard)
            throw new Error('Guard file required before generating native sweeps');
        plan.generated = writeFlows(plan, JSON.parse(fs.readFileSync(path.resolve(ROOT, options.guard), 'utf8')), ROOT);
    }
    else
        plan.generated = {
            status: 'blocked', reason: 'No bound disposable fixture/installed-binary/source guard supplied; no Maestro files emitted.'
        };
    fs.writeFileSync(output, JSON.stringify(plan, null, 2) + '\n');
    console.log(JSON.stringify({
        output: OUTPUT, ...plan.summary, generated: plan.generated.status
    }, null, 2));
}
if (require.main === module) {
    try {
        main(process.argv.slice(2));
    }
    catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
module.exports = {
    buildPlan, inventoryFlows, sourceSelectors, selectorEvidence, fingerprint, validateGuard, renderSweep, writeFlows, LANGUAGES, THEMES, PLATFORMS
};
