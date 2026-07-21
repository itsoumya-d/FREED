(() => {
  "use strict";

  const OVERLAY_ID = "freed-safari-focus-shield";
  const NATIVE_APP_ID = "app.freed.recovery";
  let lastRouteKey = "";

  // Approved routes: /shorts/, /feed/shorts, /reel/, /reels/, /foryou.
  function approvedSurface(locationValue) {
    const host = locationValue.hostname.toLowerCase().replace(/^www\./, "");
    const path = locationValue.pathname.toLowerCase();

    if ((host === "youtube.com" || host.endsWith(".youtube.com")) &&
        (/^\/shorts(?:\/|$)/.test(path) || /^\/feed\/shorts(?:\/|$)/.test(path))) {
      return { host: "youtube.com", rule: "short-form:youtube-shorts", label: "YouTube Shorts" };
    }
    if ((host === "instagram.com" || host.endsWith(".instagram.com")) && /^\/reels?(?:\/|$)/.test(path)) {
      return { host: "instagram.com", rule: "short-form:instagram-reels", label: "Instagram Reels" };
    }
    if ((host === "tiktok.com" || host.endsWith(".tiktok.com")) && /^\/foryou(?:\/|$)/.test(path)) {
      return { host: "tiktok.com", rule: "short-form:tiktok-feed", label: "TikTok For You" };
    }
    return null;
  }

  function challengeLink(surface) {
    const params = new URLSearchParams({
      source: "ios-safari-short-form",
      rule: surface.rule,
      host: surface.host
    });
    return `https://intervention.freed.app/intervention?${params.toString()}`;
  }

  function notifyNative(surface) {
    const runtime = globalThis.browser?.runtime;
    if (!runtime?.sendNativeMessage) return;
    runtime.sendNativeMessage(NATIVE_APP_ID, {
      type: "record-pending-intervention",
      source: "ios-safari-short-form",
      rule: surface.rule,
      host: surface.host
    }).catch(() => undefined);
  }

  function removeShield() {
    document.getElementById(OVERLAY_ID)?.remove();
    document.documentElement.classList.remove("freed-focus-shield-active");
  }

  function renderShield(surface) {
    removeShield();
    document.documentElement.classList.add("freed-focus-shield-active");

    const style = document.createElement("style");
    style.textContent = `
      html.freed-focus-shield-active body > :not(#${OVERLAY_ID}) { display: none !important; }
      #${OVERLAY_ID} { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center;
        box-sizing: border-box; padding: 28px; background: #12101c; color: #fff; font: 17px/1.45 -apple-system, BlinkMacSystemFont, sans-serif; }
      #${OVERLAY_ID} .freed-card { max-width: 460px; text-align: center; }
      #${OVERLAY_ID} h1 { margin: 0 0 12px; font-size: 30px; }
      #${OVERLAY_ID} p { margin: 0 0 24px; color: rgba(255,255,255,.78); }
      #${OVERLAY_ID} a { display: inline-block; padding: 14px 22px; border-radius: 999px; background: #b99aff;
        color: #171122; font-weight: 700; text-decoration: none; }
    `;

    const shield = document.createElement("section");
    shield.id = OVERLAY_ID;
    shield.setAttribute("role", "dialog");
    shield.setAttribute("aria-modal", "true");
    shield.setAttribute("aria-label", "FREED recovery pause");

    const card = document.createElement("div");
    card.className = "freed-card";
    const title = document.createElement("h1");
    title.textContent = "Pause the loop";
    const copy = document.createElement("p");
    copy.textContent = `${surface.label} is paused in Safari. Open FREED for a local recovery challenge.`;
    const link = document.createElement("a");
    link.href = challengeLink(surface);
    link.textContent = "Open FREED challenge";

    card.append(title, copy, link);
    shield.append(style, card);
    (document.body || document.documentElement).append(shield);
    link.focus({ preventScroll: true });
  }

  function inspectRoute() {
    const surface = approvedSurface(window.location);
    const routeKey = surface ? `${surface.rule}:${window.location.pathname}` : "allowed";
    if (routeKey === lastRouteKey && document.getElementById(OVERLAY_ID)) return;
    lastRouteKey = routeKey;

    if (!surface) {
      removeShield();
      return;
    }
    notifyNative(surface);
    if (document.readyState === "loading" && !document.body) {
      document.addEventListener("DOMContentLoaded", () => renderShield(surface), { once: true });
    } else {
      renderShield(surface);
    }
  }

  for (const method of ["pushState", "replaceState"]) {
    const original = history[method];
    history[method] = function (...args) {
      const result = original.apply(this, args);
      queueMicrotask(inspectRoute);
      return result;
    };
  }
  window.addEventListener("popstate", inspectRoute);
  new MutationObserver(inspectRoute).observe(document.documentElement, { childList: true, subtree: true });
  inspectRoute();
})();
