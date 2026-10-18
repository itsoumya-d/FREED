# Hosted DNS recovery probe

Status: source-only feasibility probe. This is not a deployed resolver, a production design, a release candidate, or device evidence.

## Question tested

Could a hosted DNS-over-HTTPS boundary, for the requests that actually reach it, deny a classified adult destination and ask an already-consented FREED installation to show one minimal **Open FREED** action?

The expected commercial journey remains:

`search results → blocked destination → Open FREED → Premium chooser or explicit real rewarded ad → challenge`

This probe covers only the DNS decision and an opaque request to an injected alert adapter. It gives no membership, ad, challenge, app-time, or adult-site unlock authority.

Cloudflare Families forces SafeSearch and provides no per-request callback into FREED, so it cannot supply the requested usable search-results boundary and recovery handoff by itself. Apple TN3120 rules out treating a local packet tunnel as a general content filter, and the `adult-content-filter-restricted` path described by TN3134 is restricted. Neither is replaced or bypassed here.

## Implemented source contract

`resolver.ts` is a dependency-injected, non-network controller. Its injected forwarder has no URL argument, so deployment composition must bind it to one reviewed, fixed allowlisted upstream. There is no caller-supplied upstream URL, redirect, webhook, or callback.

- Accepts only `/dns-query` RFC 8484 GET with canonical unpadded base64url, or POST with exactly `application/dns-message`.
- Caps query wire data at 512 bytes before GET base64url decoding or POST wire copying, then accepts one uncompressed IN question for A or AAAA only. It explicitly rejects other methods, duplicate/extra URL parameters, malformed labels, compression pointers, extra records, extra questions, trailing bytes, unsupported query types, and response-shaped requests. The hosting layer still needs its own HTTP request-size limit.
- Requires a synthetic bearer credential to resolve to an active installation with current owner generation and explicit cloud-DNS consent. It immediately snapshots the installation route and owner generation as immutable primitives, then compares a fresh lookup with that snapshot after classification and before forwarding.
- Delegates domain classification to a trusted dependency. `unavailable`, thrown failures, and every runtime value other than literal `allow` or `deny` return DNS SERVFAIL without forwarding.
- Returns DNS REFUSED for a denied name even when alerts are not consented, fail, or are unavailable.
- Registers the complete deferred alert operation with an injected host-lifecycle registrar before starting its third authorization lookup. The registered promise covers reauthorization, all delivery fences, bounded cancellation, and the provider call. DNS REFUSED remains independent, so a slow or never-settling alert cannot hold open the denial. Each attempt is capped at five seconds and receives an abort signal. Immediately before invoking the provider-boundary adapter, the controller re-resolves the installation and checks the captured route and generation, current cloud-DNS consent, current notification consent, event expiry, and cancellation state.
- Emits only `{ id, kind: "website-recovery", expiresAt }` as the client-visible event. The adapter separately receives immutable server-side `{ installationRef, ownerGeneration }` routing authority and the abort signal. The event emits no query, domain, token, account, route, IP, photo, journal, membership, ad, or app authority.
- Coalesces A/AAAA and duplicate denied bursts by an in-memory keyed digest of installation route plus normalized name. The map contains no plaintext name, expires entries after 60 seconds, and is capped at 256 entries.
- Bounds an upstream attempt to at most five seconds, aborts it on timeout, and accepts only a bounded DNS response with the same transaction ID, opcode, uncompressed question name, type, class, and clear reserved Z flag. Failure returns SERVFAIL.
- Has no logging, event analytics, metrics, or persistence interface.

The alert adapter contract is narrow: `deliver(authority, event, signal)` is the provider side-effect boundary, must honor cancellation before provider acceptance, and must not add browsing data. Cancellation cannot recall a request already accepted by an external notification provider. A notification accepted just before revocation or expiry can still be delivered later; this prototype does not establish a delivered-after-revocation guarantee.

The host-lifecycle contract is also narrow: required `defer(task)` must synchronously attach the complete promise to the host's request-lifetime facility and return `retained`, or return `unavailable`. The controller starts alert work only after `retained`; an unavailable or throwing registrar leaves the task start gate closed, releases that attempt's coalescing claim so a later denial can retry registration, and still returns DNS REFUSED. The registrar must be nonblocking. A production Worker/serverless `waitUntil` adapter and proof that it retains bounded work are unimplemented deployment gates.

The controller is deliberately not a full DNS resolver. It does not support EDNS, DNSSEC-sized responses, non-A/AAAA records, internationalized wire labels, compressed question names, recursive resolution, caching, retries, or upstream discovery.

## Tests

`resolver.test.ts` uses synthetic installation credentials and injected in-memory dependencies. It exercises ordinary search forwarding without SafeSearch substitution, deny plus opaque alert and separate server authority, A/AAAA coalescing and TTL, alert rejection, a never-settling alert, full-task lifecycle registration and draining, unavailable/throwing registration, cancellation and late completion, generation/cloud-DNS/notification/expiry delivery fences, in-place authorization mutation, missing/revoked/stale/unconsented installations, strict pre-allocation GET/POST bounds, malformed DNS shapes, runtime-invalid classification, upstream timeout cancellation, response identity mismatch, and reserved response Z.

Run only the focused probe with:

```sh
NODE_OPTIONS=--max-old-space-size=512 node scripts/run-ts-entry.js prototypes/recovery-dns/resolver.test.ts
```

## Unimplemented gates

All deployment and integration work is unimplemented: hosted runtime, host-lifecycle/`waitUntil` adapter and retention proof, public endpoint, TLS, hosting-layer request limits, a fixed production upstream adapter, adult-feed adapter and freshness policy, authentication issuance/rotation/revocation service, FCM registration, APNs registration and any APNs delivery/revocation guarantee, notification delivery adapter, notification action/deep link, native DNS profile/configuration integration, native DoH support for supplying this controller's custom Bearer header, explicit cloud-DNS consent UI, explicit notification consent UI, abuse and denial-of-service controls, cost controls, retention policy and deletion proof, security review, key management, rate limiting, privacy review, store-policy eligibility, signed builds, device setup, device enforcement, device recovery handoff, ad SDK path, membership verification, challenge orchestration, accessibility, localization, and production monitoring that preserves the stated data prohibitions. The controller's authenticated HTTP shape does not prove that iOS can configure or retain those headers for native encrypted DNS.

DNS caches can answer without contacting the service. Custom DoH, encrypted-DNS clients, Tor, VPNs, proxies, alternate networking stacks, captive portals, offline states, resolver changes, and newly installed browsers can bypass or avoid this path. Notification delay, denial, disabled notifications, platform throttling, and deep-link failure can prevent the recovery action even when DNS denial succeeds. DNS also does not identify a foreground browser or guarantee that a search engine returns an unsuppressed result.

Existing OS adult-web policy can deny navigation with the stock **Website Not Allowed** path before any hosted DNS lookup occurs. This probe therefore cannot establish recovery entry for that path either. The baseline adult-web policy must remain enabled and must not be removed or weakened to force hosted-DNS evidence.

Therefore this source probe establishes neither universal coverage nor the accepted one-action recovery promise. Public release and every-browser recovery remain blocked pending supported public APIs, store eligibility, completed service/native adapters, and source/binary/device-bound evidence for each browser and scenario. Existing Cloudflare Families and ManagedSettings protection must remain in place; this probe does not replace, remove, or weaken either one.


## 13 October declared-coverage correction

The current charter permits verified Safari/iOS and Chrome/Android paths plus complete app-limit journeys on both platforms to ship, with other browser paths explicitly untested, unsupported or blocking only. Earlier universal-release wording above is historical; no probe/provider delivery result becomes a declared recovery pass. This source remains undeployed and native/provider evidence remains unexecuted.

The approved maintained transport engine is dnsproxy v0.86.0. Its official tagged go.mod requires Go 1.26.8; this Mac has 1.22.3. No runtime was installed or automatically downloaded. Use a separatelyverified compatible build environment before compiling a transport adapter. The native-compatible installation authentication, engine privacy/cancellation and existing FCM integration gaps are recorded in .superpowers/sdd/2026-10-13-publishable-recovery/task-70-map.md. Optional pilot resources/costs are prepared in docs/product/2026-10-13-dns-pilot-resource-proposal.md; no paid resource enabled.
