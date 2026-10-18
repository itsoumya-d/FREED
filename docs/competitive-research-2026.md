# Competitive Research — DNS/Content Blockers vs FREED (2026-08)

How the market works today, and where FREED wins or must catch up.

## Landscape

| Product | Approach | Strength | Weakness FREED exploits |
| --- | --- | --- | --- |
| **NextDNS** | Cloud DNS (Private DNS / DoH) | Zero device overhead, dashboard + analytics, cross-device profiles | 300k free queries/mo then paid; queries leave the device; no recovery layer; config lives on a website, not in-app |
| **Blokada** | Local DNS VPN; freemium cloud VPN (Plus) | Simple setup, FOSS heritage (v5) | Free tier is a funnel to Blokada Plus; cloud VPN routes traffic through their servers; blocking only |
| **RethinkDNS** | On-device DNS + per-app firewall, FOSS | Most capable free Android blocker; local-first | Steep learning curve; settings sprawl; still just a blocker/firewall |
| **AdGuard** | Local VPN + HTTPS inspection (paid) | Deepest in-app ad blocking | Paid; inspection posture complicates store review and trust |
| **BlockSite / Covenant Eyes-style** | Accessibility/VPN block + accountability | Habit framing, accountability partners | Heavy subscriptions ($10+/mo); accountability often requires reading user activity |

## Where FREED structurally wins

1. **Recovery layer nobody else has.** Every competitor stops at blocking.
   FREED intercepts the moment: full-screen intervention, breathing, adaptive
   challenges, earned unlocks, streaks. That is a different product category
   (habit change), not a utility — and it justifies premium pricing without
   charging for "unlimited queries".
2. **Fully local, zero recurring cost.** Classification is an on-device set
   lookup against a synced feed; upstream resolution is Cloudflare's free
   resolvers. No query caps (NextDNS), no third-party traffic routing
   (Blokada Plus), no subscription required to stay protected.
3. **DNS-only tunnel = zero streaming impact.** Only the two resolver IPs are
   routed into the TUN; YouTube/video traffic never enters it. Competitors
   that route 0.0.0.0/0 pay battery/CPU costs and invite Play scrutiny;
   FREED's release gates pin "no full-traffic proxy / no packet inspection".
4. **Honest UX posture.** No overlays/screenshots/OCR; redacted handoffs;
   documented blind spots surfaced in-app (strict Private DNS, IPv6-only,
   other VPNs) instead of silently failing.

## Where competitors are ahead — catch-up list

| Gap | Who does it better | Plan |
| --- | --- | --- |
| Blocked-query analytics ("what did we stop this week") | NextDNS dashboard | We already track per-session counters (`dnsGuardSessionQueries`, `blockedQueries`); add a weekly digest card from existing counters — no new data collection needed |
| Cross-device sync of allow/block lists | NextDNS profiles | Firebase account link now exists (social login step); sync `userAllowedDomains` + discipline settings behind it later |
| Setup simplicity | Blokada one-tap | Our wizard is longer by necessity (Play-mandated disclosure + consent); keep auto-advance tight so it feels like 3 taps |
| IPv6/DoH coverage | AdGuard (inspection) | Documented limitation; detect and warn (done). Longer term: answer AAAA synthetically inside the tunnel |
| Content-blocker-grade Safari coverage | AdGuard iOS | iOS uses Screen Time + Safari blocker by design (no NetworkExtension entitlement); acceptable trade for App Store review speed |

## Speed/stability positioning ("faster than them, no glitch")

- Resolution path: race both resolvers under a bounded budget with network-
  fallback and SERVFAIL caps — parity with NextDNS latency without leaving
  the device. Keep the 15s feed re-read and 12h foreground refresh.
- Failure modes: every competitor has a "it silently stopped" complaint
  class. FREED now reports real runtime state (`dnsGuardRuntimeReady` after
  actual `establish()`), bounded timeouts everywhere, capped auto-retries,
  and honest health rows — make "Protection is verifiably on" the brand.

## Store-policy notes (both platforms)

- **Play:** VpnService declaration form + review video + prominent in-app
  disclosure (shipped: modal before first consent). Category fit:
  parental-control/self-control. Accessibility declaration pack exists in
  docs/store-policy/. Never claim full VPN/proxying in listing copy.
- **App Store:** Screen Time API requires Family Controls entitlement
  (present); no NetworkExtension target by design keeps review simple.

Sources: NextDNS.io, Blokada community/docs, RethinkDNS docs, AdGuard docs,
2026 comparison roundups (unstore.io, factually.co, appmus.com), Google Play
VpnService policy pages.
