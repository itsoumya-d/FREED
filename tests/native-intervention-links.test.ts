import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { test } from "node:test";
import {
  appPackageForEarnedUnlockSource,
  createDeepLinkInterventionAttempt,
  isIosScreenTimeShieldSource,
  unlockSourceForAttempt
} from "../src/lib/native-intervention";

const HTTPS_ROUTE = "https://freed-7d5ee.firebaseapp.com/intervention";
const YOUTUBE_FRAGMENT = "#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com";
const detectedAt = "2026-10-02T09:00:00.000Z";

test("HTTPS fragments produce coarse Safari browser attempts without native authority", () => {
  for (const [fragment, host, rule] of [
    [YOUTUBE_FRAGMENT, "youtube.com", "short-form:youtube-shorts"],
    ["#source=ios-safari-short-form&rule=short-form%3Ainstagram-reels&host=www.instagram.com", "instagram.com", "short-form:instagram-reels"],
    ["#source=ios-safari-short-form&rule=short-form%3Atiktok-feed&host=m.tiktok.com", "m.tiktok.com", "short-form:tiktok-feed"]
  ]) {
    const attempt = createDeepLinkInterventionAttempt(`${HTTPS_ROUTE}${fragment}`, detectedAt);
    assert.ok(attempt, `the approved fragment for ${host} should open a challenge`);
    assert.equal(attempt.host, host);
    assert.equal(attempt.url, `https://${host}`);
    assert.equal(attempt.detectedAt, detectedAt);
    assert.equal(attempt.source, "browser");
    assert.equal(attempt.result.matchedRule, `ios-safari-short-form:${rule}`);
    assert.equal(attempt.sourcePackage, undefined);
    assert.equal("scope" in attempt, false);
    assert.equal("nativeInterventionId" in attempt, false);
    assert.equal(appPackageForEarnedUnlockSource(unlockSourceForAttempt(attempt)), undefined);
    assert.equal(isIosScreenTimeShieldSource(unlockSourceForAttempt(attempt)), false);
  }
});

const invalidHttpsLinks = [
  `http://freed-7d5ee.firebaseapp.com/intervention${YOUTUBE_FRAGMENT}`,
  `https://other.firebaseapp.com/intervention${YOUTUBE_FRAGMENT}`,
  `https://freed-7d5ee.firebaseapp.com.evil.example/intervention${YOUTUBE_FRAGMENT}`,
  `https://user:password@freed-7d5ee.firebaseapp.com/intervention${YOUTUBE_FRAGMENT}`,
  `https://@freed-7d5ee.firebaseapp.com/intervention${YOUTUBE_FRAGMENT}`,
  `https://freed-7d5ee.firebaseapp.com:8443/intervention${YOUTUBE_FRAGMENT}`,
  `https://freed-7d5ee.firebaseapp.com/intervention/${YOUTUBE_FRAGMENT}`,
  `https://freed-7d5ee.firebaseapp.com/other/../intervention${YOUTUBE_FRAGMENT}`,
  `https://freed-7d5ee.firebaseapp.com/%69ntervention${YOUTUBE_FRAGMENT}`,
  `${HTTPS_ROUTE}?source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com`,
  `${HTTPS_ROUTE}?private=browsing-hint${YOUTUBE_FRAGMENT}`,
  `${HTTPS_ROUTE}?${YOUTUBE_FRAGMENT}`,
  `${HTTPS_ROUTE}#source=ios-screen-time&rule=short-form%3Ayoutube-shorts&host=youtube.com`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=configured-app%3Acom.google.android.youtube&host=youtube.com`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=instagram.com`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com.evil.example`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=evil%40youtube.com`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com%3A443`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com%2Fshorts%2Fprivate`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=www..youtube.com`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=`,
  `${HTTPS_ROUTE}#source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts`,
  `${HTTPS_ROUTE}${YOUTUBE_FRAGMENT}&host=instagram.com`,
  `${HTTPS_ROUTE}${YOUTUBE_FRAGMENT}&premium=true&nativeInterventionId=00000000-0000-4000-8000-000000000000`,
  `${HTTPS_ROUTE}${YOUTUBE_FRAGMENT}&url=https%3A%2F%2Fyoutube.com%2Fshorts%2Fprivate`,
  `${HTTPS_ROUTE}${YOUTUBE_FRAGMENT}&redirect=https%3A%2F%2Fevil.example`
];

test("HTTPS intervention links reject unexpected routes, query metadata, and unapproved payloads", () => {
  for (const link of invalidHttpsLinks) {
    assert.equal(createDeepLinkInterventionAttempt(link, detectedAt), null, link);
  }
});

test("legacy freed query links retain approved host and URL compatibility", () => {
  const legacy = createDeepLinkInterventionAttempt(
    "freed://intervention?source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&url=https%3A%2F%2Fm.youtube.com%2Fshorts%2Fprivate%3Fprivate%3Dhint",
    detectedAt
  );
  assert.equal(legacy?.host, "m.youtube.com");
  assert.equal(legacy?.url, "https://m.youtube.com");
  assert.equal(JSON.stringify(legacy).includes("private"), false);
  assert.equal(createDeepLinkInterventionAttempt(
    "freed:///intervention?source=ios-safari-short-form&rule=short-form%3Ainstagram-reels&host=www.instagram.com"
  )?.host, "instagram.com");
  assert.equal(createDeepLinkInterventionAttempt(
    "freed://intervention?source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=evil.example"
  ), null);
});

// A small DOM boundary runs the shipped scripts without a browser or network.
// Link destinations and visibility are outputs of the real script, not copied builders.
class LocalElement {
  children: LocalElement[] = [];
  parent: LocalElement | null = null;
  id = "";
  className = "";
  textContent = "";
  href = "";
  hidden = false;
  attributes = new Map<string, string>();
  classList = { add() {}, remove() {} };

  constructor(readonly tagName: string) {}
  setAttribute(key: string, value: string) { this.attributes.set(key, value); }
  removeAttribute(key: string) { this.attributes.delete(key); if (key === "href") this.href = ""; }
  append(...elements: LocalElement[]) {
    for (const element of elements) { element.parent = this; this.children.push(element); }
  }
  remove() {
    if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this);
  }
  focus() {}
}

function descendants(element: LocalElement): LocalElement[] {
  return [element, ...element.children.flatMap(descendants)];
}

const { createSafariContentHarness } = require("./fixtures/safari-content-harness.cjs");

async function renderSafariShield(locationUrl: string, options: Record<string, unknown> = {}) {
  const harness = createSafariContentHarness(locationUrl, options);
  await harness.flush();
  assert.equal(harness.timers.length, 1, "The shipped guard schedules a controlled fresh-state refresh.");
  assert.equal(harness.navigations.length, 0, "Rendering waits for an explicit link tap.");
  return harness;
}

test("Safari shields emit HTTPS fragments and retain an explicit freed fallback without browsing paths", async () => {
  for (const [locationUrl, host, rule] of [
    ["https://m.youtube.com/shorts/private-video?private=browsing-hint", "youtube.com", "short-form:youtube-shorts"],
    ["https://www.instagram.com/reels/private-reel?private=browsing-hint", "instagram.com", "short-form:instagram-reels"],
    ["https://www.tiktok.com/foryou?private=browsing-hint", "tiktok.com", "short-form:tiktok-feed"]
  ]) {
    const harness = await renderSafariShield(locationUrl);
    const links = harness.links();
    assert.equal(links.length, 2, "Accepted current native state renders both person-tapped links.");
    assert.ok(harness.messages.some((message: { rule?: string; host?: string }) => message.rule === rule && message.host === host));
    const primary = new URL(links[0].href);
    assert.equal(`${primary.origin}${primary.pathname}`, HTTPS_ROUTE);
    assert.equal(primary.search, "", "coarse metadata must stay out of the HTTP request");
    assert.deepEqual(Object.fromEntries(new URLSearchParams(primary.hash.slice(1))), {
      source: "ios-safari-short-form", rule, host
    });
    assert.equal(primary.href.includes("private"), false);
    assert.equal(JSON.stringify(harness.messages).includes("private"), false);
    assert.equal(createDeepLinkInterventionAttempt(primary.href)?.host, host);
    const direct = links.find((link: { href: string }) => link.href.startsWith("freed://intervention?"));
    assert.ok(direct, "Safari retains a person-tapped custom-scheme fallback");
    assert.equal(createDeepLinkInterventionAttempt(direct.href)?.host, host);
    await harness.click(links[0]);
    assert.deepEqual(harness.navigations, [primary.href], "Only a person-tapped, freshly approved link navigates.");
  }
  assert.equal((await renderSafariShield("https://youtube.com/watch?v=normal-video")).links().length, 0);
  assert.equal((await renderSafariShield("https://youtube.com.evil.example/shorts/private-video")).links().length, 0);
});

test("Safari shields require current literal native authority and clear existing overlays after reset", async () => {
  for (const options of [{ browserAvailable: false }, { active: false }, { active: "true" }, { accepted: false }, { accepted: "true" }, { rejectNative: true }]) {
    const harness = await renderSafariShield("https://youtube.com/shorts/private-video", options);
    assert.equal(harness.hasShield(), false);
    assert.equal(harness.links().length, 0);
  }
  const harness = await renderSafariShield("https://youtube.com/shorts/private-video");
  assert.equal(harness.hasShield(), true);
  harness.setActive(false); await harness.tick();
  assert.equal(harness.hasShield(), false, "A controlled fresh-state refresh removes a reset overlay without a route change.");
  const tappedAfterReset = await renderSafariShield("https://youtube.com/shorts/private-video");
  const link = tappedAfterReset.links()[0];
  tappedAfterReset.setActive(false); await tappedAfterReset.click(link);
  assert.deepEqual(tappedAfterReset.navigations, [], "Earlier approval never authorizes a new navigation after reset.");
  assert.equal(tappedAfterReset.hasShield(), false);
  const resetDuringTap = await renderSafariShield("https://youtube.com/shorts/private-video");
  resetDuringTap.setDeferredNative(true);
  const tap = resetDuringTap.click(resetDuringTap.links()[0]);
  assert.equal(resetDuringTap.pending[0].input.type, "get-protection-configuration");
  await resetDuringTap.resolveNextNative({ protectionConfigurationActive: true });
  assert.equal(resetDuringTap.pending[0].input.rule, "short-form:youtube-shorts");
  await resetDuringTap.resolveNextNative({ accepted: true, protectionConfigurationActive: true });
  assert.equal(resetDuringTap.pending[0].input.type, "get-protection-configuration");
  await resetDuringTap.resolveNextNative({ protectionConfigurationActive: false });
  await tap;
  assert.deepEqual(resetDuringTap.navigations, [], "A reset during native acknowledgement blocks navigation at the final fresh-state check.");
  assert.equal(resetDuringTap.hasShield(), false);
});

function renderFallback(locationUrl: string) {
  assert.ok(existsSync("public/intervention.html"), "the explicit-user fallback page must be published");
  const html = readFileSync("public/intervention.html", "utf8");
  const link = new LocalElement("a");
  const anchor = html.match(/<a\b([^>]*\bid="open-freed"[^>]*)>([^<]*)<\/a>/i);
  assert.ok(anchor, "the fallback has a labeled native app link");
  link.hidden = /\bhidden(?:\s|=|$)/i.test(anchor[1]);
  link.href = anchor[1].match(/\bhref="([^"]*)"/i)?.[1] ?? "";
  link.textContent = anchor[2];
  const status = new LocalElement("p");
  status.textContent = html.match(/<p\b[^>]*\bid="handoff-status"[^>]*>([^<]*)<\/p>/)?.[1] ?? "";
  const elements = new Map([["open-freed", link], ["handoff-status", status]]);
  const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1, "one local script validates and presents the handoff");
  assert.doesNotMatch(scripts[0][1], /\bsrc\s*=/i);
  const location = { href: locationUrl };
  const initialUrl = location.href;
  const sandbox = {
    location,
    document: { getElementById(id: string) { return elements.get(id); } },
    URL, URLSearchParams,
    fetch() { assert.fail("the fallback must make no remote calls"); },
    XMLHttpRequest: class { constructor() { assert.fail("the fallback must make no remote calls"); } },
    navigator: { sendBeacon() { assert.fail("the fallback must make no analytics calls"); } },
    setTimeout() { assert.fail("the fallback must not schedule automatic navigation"); },
    open() { assert.fail("the fallback must wait for a person's link tap"); }
  };
  runInNewContext(scripts[0][2], sandbox);
  assert.equal(sandbox.location, location, "rendering must not replace the page location");
  assert.equal(location.href, initialUrl, "rendering must not automatically navigate");
  return { link, status };
}

test("the fallback page presents only a validated, manual coarse app link", () => {
  const { link, status } = renderFallback(`${HTTPS_ROUTE}${YOUTUBE_FRAGMENT}`);
  assert.equal(link.hidden, false);
  assert.ok(link.textContent.length > 0, "the app link has an accessible label");
  assert.equal(link.href, "freed://intervention?source=ios-safari-short-form&rule=short-form%3Ayoutube-shorts&host=youtube.com");
  assert.equal(createDeepLinkInterventionAttempt(link.href)?.host, "youtube.com");
  assert.ok(status.textContent.length > 0);
});

test("invalid fallback payloads show a safe local message and no app link", () => {
  for (const locationUrl of [...invalidHttpsLinks, HTTPS_ROUTE]) {
    const { link, status } = renderFallback(locationUrl);
    assert.equal(link.hidden, true, locationUrl);
    assert.equal(link.href, "", locationUrl);
    assert.ok(status.textContent.length > 0, "invalid input gets a local explanation");
    assert.equal(status.textContent.includes("browsing-hint"), false);
    assert.equal(status.textContent.includes("evil.example"), false);
  }
});
