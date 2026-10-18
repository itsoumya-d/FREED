#!/usr/bin/env node
// Scoped offline content mutations and isolated localhost rendering, never hosted proof.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { inspectWebsiteContent, buildWebsiteReport } = require('./store-legal-web-export-audit');

const pages = ['privacy', 'support', 'account-deletion', 'terms'];
const output = path.resolve('docs/validation/artifacts/task-8d-hosted-legal/fix1');
const website = path.resolve('website');
const isValid = result => result.contentChecks.every(row => row.present) && result.obsoleteChecks.every(row => row.absent) && result.disclosureChecks.every(row => row.passed);

// These review-derived fixtures are authored independently of the auditor's token arrays.
// They exercise both omission and an added contradiction while other required copy survives.
function disclosureMutations() {
  const cases = [
    ['privacy', 'missing cloud consent', html => html.replace('With your explicit cloud-chat consent, ', '')],
    ['privacy', 'consent contradicted', html => html + '<p>Cloud chat sends messages without explicit consent.</p>'],
    ['privacy', 'context choice removed', html => html.replace('If you also choose to share conversation context, ', 'Whenever cloud chat is enabled, ')],
    ['privacy', 'context automatic contradiction', html => html + '<p>Conversation context is included automatically.</p>'],
    ['privacy', 'photo upload exclusion omitted', html => html.replace('Photos are not uploaded.', '')],
    ['privacy', 'photo upload contradiction', html => html + '<p>Photos are uploaded to Google.</p>'],
    ['privacy', 'analytics consent omitted', html => html.replace('If you opt into analytics sharing, ', '')],
    ['privacy', 'analytics consent contradicted', html => html + '<p>Analytics sharing is enabled without consent.</p>'],
    ['privacy', 'analytics linkage omitted', html => html.replace('These records are linked to your authenticated account UID.', '')],
    ['privacy', 'analytics anonymous contradiction', html => html + '<p>Shared analytics are anonymous and not linked to your account.</p>'],
    ['privacy', 'analytics metadata omitted', html => html.replace('The snapshot also includes schema and consent versions, opt-in time, and lineage, revision and snapshot identifiers.', '')],
    ['privacy', 'analytics retention omitted', html => html.replace('Analytics records have a configured 14-day expiry.', '')],
    ['privacy', 'immediate analytics erasure contradiction', html => html + '<p>Analytics records are erased immediately at expiry.</p>'],
    ['privacy', 'provider retention link missing', html => html.replaceAll('https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/zero-data-retention', '#missing-provider-terms')],
    ['privacy', 'dedupe boundary omitted', html => html.replace('Request deduplication records have a configured 7-day expiry.', '')],
    ['privacy', 'Google zero-retention contradiction', html => html + '<p>Google retains nothing from CLARA messages.</p>'],
    ['privacy', 'Google fixed retention contradiction', html => html + '<p>Google retains messages for exactly 7 days.</p>'],
  ];
  for (const id of ['privacy', 'support', 'terms']) {
    cases.push(
      [id, 'explicit optional one-session reward omitted', html => html.replace('Free users may explicitly choose a rewarded ad for access to one guided recovery session where available.', '')],
      [id, 'free basic help omitted', html => html.replace('Basic Help/SOS is included with free access and requires neither a paid subscription nor a rewarded ad.', '')],
      [id, 'basic help ad dependency contradiction', html => html + '<p>Basic Help requires watching an ad.</p>'],
      [id, 'basic help pay dependency contradiction', html => html + '<p>Basic Help requires a paid subscription.</p>'],
      [id, 'reward unlocks baseline contradiction', html => html + '<p>A rewarded ad releases baseline adult-domain protection.</p>'],
      [id, 'challenge unlocks baseline contradiction', html => html + '<p>Completing a challenge unlocks adult-domain protection.</p>'],
      [id, 'baseline exclusion omitted', html => html.replace('An ad or challenge never releases baseline adult-domain protection.', '')]
    );
  }
  for (const [id, label, mutate] of cases) {
    const original = fs.readFileSync(path.join(website, `${id}.html`), 'utf8');
    const mutated = mutate(original);
    assert.notEqual(mutated, original, `${id}: fixture target not found: ${label}`);
    assert.ok(!isValid(inspectWebsiteContent(id, mutated)), `${id}: accepted ${label}`);
  }
  return cases.length;
}

function contentChecks() {
  assert.equal(buildWebsiteReport({ exportDir: 'website' }).result, 'pass');
  let mutations = 0;
  for (const id of pages) {
    const html = fs.readFileSync(path.join(website, `${id}.html`), 'utf8');
    const current = inspectWebsiteContent(id, html);
    assert.ok(isValid(current), id);
    for (const row of current.contentChecks) {
      const text = row.text.replace(/&amp;/g, '&');
      const decoded = html.replace(/&#39;/g, "'").replace(/&amp;/g, '&');
      assert.ok(!isValid(inspectWebsiteContent(id, decoded.split(text).join(''))), `${id}: missing ${text}`);
      mutations++;
    }
    for (const row of current.obsoleteChecks) {
      assert.ok(!isValid(inspectWebsiteContent(id, `${html}<p>${row.text}</p>`)), `${id}: stale ${row.text}`);
      mutations++;
    }
  }
  const disclosureCases = disclosureMutations();
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'content-mutations.json'), JSON.stringify({ result: 'pass', pages, tokenMutations: mutations, independentDisclosureCases: disclosureCases, scope: 'Scoped generated-output disclosure/token rejection; independently authored omissions/contradictions; no runtime proof.' }, null, 2) + '\n');
  console.log(`Generated legal content: pass; ${mutations} token mutations and ${disclosureCases} independent disclosure cases rejected.`);
}

async function renderChecks() {
  const playwrightModule = process.env.FREED_LEGAL_PLAYWRIGHT_MODULE || 'playwright';
  const { chromium } = require(playwrightModule);
  const server = http.createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const relative = pages.some(id => pathname === `/${id}`) ? `${pathname.slice(1)}.html` : pathname.slice(1);
    const filename = path.resolve(website, relative);
    if (!filename.startsWith(website + path.sep) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) { response.writeHead(404); response.end('Not found'); return; }
    const contentType = filename.endsWith('.css') ? 'text/css' : filename.endsWith('.svg') ? 'image/svg+xml' : 'text/html';
    response.writeHead(200, { 'Content-Type': contentType }); response.end(fs.readFileSync(filename));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  let browser;
  const evidence = [];
  try {
    browser = await chromium.launch({ headless: true, channel: process.env.FREED_LEGAL_BROWSER_CHANNEL || "chrome" });
    for (const [label, viewport] of [['mobile', { width: 375, height: 812 }], ['desktop', { width: 1440, height: 1000 }]]) {
      const context = await browser.newContext({ viewport });
      const tab = await context.newPage();
      for (const id of pages) {
        const errors = [];
        const onError = error => errors.push(error.message);
        tab.on('pageerror', onError);
        const response = await tab.goto(`${baseUrl}/${id}`, { waitUntil: 'networkidle' });
        assert.equal(response.status(), 200);
        const metrics = await tab.evaluate(() => {
          const visible = element => { const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0 && getComputedStyle(element).visibility !== 'hidden'; };
          const links = [...document.querySelectorAll('a')].filter(visible);
          const text = [...document.querySelectorAll('main p,main h1,main h2,footer a')];
          const clipped = text.filter(element => { const box = element.getBoundingClientRect(); return box.left < 0 || box.right > innerWidth + 1 || element.scrollWidth > element.clientWidth + 1; }).map(element => element.textContent);
          const paragraph = getComputedStyle(document.querySelector('main p'));
          return { viewport: { width: innerWidth, height: innerHeight }, documentWidth: document.documentElement.scrollWidth, clipped, fontSize: paragraph.fontSize, lineHeight: paragraph.lineHeight, contactReachable: links.some(link => link.getAttribute('href').startsWith('mailto:')), routesReachable: ['/privacy', '/support', '/account-deletion', '/terms'].every(route => links.some(link => link.getAttribute('href') === route)), sectionCount: document.querySelectorAll('main section').length };
        });
        assert.ok(metrics.documentWidth <= viewport.width + 1, `${label}/${id}: horizontal overflow`);
        assert.deepEqual(metrics.clipped, [], `${label}/${id}: clipped text`);
        assert.ok(metrics.contactReachable && metrics.routesReachable, `${label}/${id}: contact/navigation`);
        assert.ok(parseFloat(metrics.fontSize) >= 15 && parseFloat(metrics.lineHeight) >= 22, `${label}/${id}: readable paragraphs`);
        assert.deepEqual(errors, [], `${label}/${id}: page errors`);
        const screenshot = `${id}-${label}.png`;
        await tab.screenshot({ path: path.join(output, screenshot), fullPage: true });
        const clickedDestinations = [];
        for (const destination of pages) {
          const href = `/${destination}`;
          await tab.locator(`footer a[href="${href}"]`).click();
          await tab.waitForURL(`${baseUrl}${href}`);
          assert.equal(new URL(tab.url()).pathname, href);
          clickedDestinations.push(href);
        }
        evidence.push({ id, layout: label, result: 'pass', responseStatus: response.status(), ...metrics, directlyLoadedDestination: `/${id}`, clickedDestinations, contactCheck: "visible mailto href only; no message sent", googleReferenceCheck: "href presence only; official destination verified separately by read-only documentation lookup", screenshot, htmlSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(website, `${id}.html`))).digest('hex'), screenshotSha256: crypto.createHash('sha256').update(fs.readFileSync(path.join(output, screenshot))).digest('hex'), consoleErrors: errors });
        tab.off('pageerror', onError);
      }
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
  fs.writeFileSync(path.join(output, 'render-checks.json'), JSON.stringify({ result: 'pass', scope: 'Fresh headless localhost task browser only; existing tabs untouched; no hosted or device proof.', checks: evidence }, null, 2) + '\n');
  console.log(`Localhost legal render: pass; ${evidence.length} page/layout checks.`);
}

(async () => { contentChecks(); if (process.argv.includes('--render')) await renderChecks(); })().catch(error => { console.error(error); process.exitCode = 1; });
