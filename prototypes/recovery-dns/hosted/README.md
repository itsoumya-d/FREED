# Opt-in hosted DoH recovery pilot — source only

This separate Node 22 package is an undeployed transport candidate. It preserves the older restricted resolver prototype. It is not browser interception, push delivery, device recovery, store eligibility, or release evidence. No cloud resources or credentials are included.

`npm ci --ignore-scripts`, `npm test`, `npm run check` run only this package. Tested with existing Node 22.23.1. The Dockerfile copies the official dnsproxy **v0.86.0** binary (no local Go compilation) into Node 22.23.1. Both image tags still require reviewed immutable digests, architecture/binary/license/security verification, and a real image build before deployment. Installed Go 1.22.3 cannot build the approved engine requiring 1.26.8; no runtime was downloaded.

## Runtime contract

`createRecoveryServer({feed, forward, resolveInstallation, reserveDnsRequest, sendAlert})` exports a Node HTTP server plus aborting `close()`. The executable starts a fixed `/opt/dnsproxy/dnsproxy` child, discards stdout/stderr, and exposes HTTP `PORT` (default 8080) for an HTTPS terminator. The engine listens only on loopback TCP/UDP 1053, forwards only to encrypted standard Cloudflare `https://1.1.1.1/dns-query`, and has no request-configurable upstream, plaintext fallback, Families, SafeSearch rewrite, hosts rewrite or enabled cache. Ingress forwards DNS over framed TCP and validates response ID/question/QR. Request 4096-byte, response 65535-byte, URL 6000-character, 128-request global, 16-request per-installation, 256-connection, and 4-second request bounds apply. One IN question is allowed; normal types and EDNS are supported. The parser preserves SVCB/HTTPS/other unknown types by their wire numbers. Signed/TSIG or multi-question queries are rejected.

The only route is `GET/POST /dns/<64 lowercase hexadecimal secret>/dns-query`; GET has exactly one unpadded base64url `dns` parameter, POST uses `application/dns-message`. This high-entropy native-compatible URL credential is not a Bearer header. `sha256(secret UTF8)` is passed to the installation adapter; the wire/domain never is. No cache is emitted (`no-store, private`). Invalid route/format/auth returns generic HTTP errors. Missing/stale feed and engine failures return DNS SERVFAIL; reviewed denied domains return REFUSED regardless of notification failure.

`resolveInstallation(hash, {signal})` must be an abortable, fresh, reviewed SDK lookup returning a snapshot:

```js
{
  installationId: 'nonsecret-unique-installation-id',
  active: true,
  dnsConsent: true,
  websiteAlertConsent: true,
  ownerGeneration: 'opaque-generation',
  currentOwnerGeneration: 'opaque-generation',
  audience: '32-lowercase-hex-random-nonsecret-value',
  pushTarget: { installationId: 'same-installation-id', token: 'current-fcm-registration-token' }
}
```

The audience example describes its shape, not a valid fixture. IDs/generations are nonempty strings <=128 characters. Active ownership, DNS consent and audience must validate for DNS; website-alert consent and a target bound to that installation must additionally validate for push. Re-resolution follows classification and immediately precedes forwarding/alert; owner/audience/target changes invalidate the binding. Notification provider authorization is rechecked before and after token acquisition. Store private UID, revocation and budget/control-plane fields separately; they never enter the public event. There is no HTTP enrollment/control-plane route. Without an adapter, every installation is rejected. `INSTALLATION_ADAPTER_MODULE` must be an absolute path to trusted deployed code exporting `resolveInstallation` and `reserveDnsRequest`; missing is fail-closed. The root application's Auth/AppCheck enrollment, deletion and atomic cross-instance budgets remain separate work.

`reserveDnsRequest({installationHash,installationId,ownerGeneration,requestId}, {signal})` is called exactly once after initial authentication and before classification. It returns `{status:'granted'}`, `{status:'exhausted'}` (HTTP429), or `{status:'unavailable'}` (HTTP503). Missing, error or invalid result fails closed with HTTP503. Fresh installation lookups do not reserve again. The reviewed adapter must reserve atomically across instances, recheck the owner/revocation within that transaction, and make exact retries of a requestId idempotent. Request IDs, budgets and reservation receipts are private; no domain/wire is supplied. Deployment-wide admission and alert coalescing are abuse/cost controls, not a billing hard cap; unauthenticated ingress and initial lookup can still incur costs.

`DOMAIN_FEED_PATH` is an absolute local operator-controlled JSON artifact (<=8 MiB): `{version:positiveIncreasingInteger, reviewed:true, generatedAt:epochMs, expiresAt:epochMs, domains:['blocked.example']}`. Domains are exact canonical lowercase ASCII/punycode suffixes without wildcards. Freshness is at most 24 hours. Empty/missing/expired feeds never silently allow. `DomainFeed.replace` rejects invalid/rollback replacements and retains its last good snapshot only until expiry. The executable loads once; operators must publish a reviewed new snapshot and restart before expiry. A real licensed, evaluated feed is deliberately absent; synthetic `.test` fixtures prove source behavior only.

## Alerts and lifetime

Each generic event is exactly `{version:'1', kind:'website-recovery', id:UUIDv4, audience:32lowerhex, expiresAt:decimalEpochMsString}` with <=60-second expiry. No domain, URL, UID, original application, authority, ad or reward data is sent. The keyed per-process digest coalesces all denied domains for an installation/owner binding for 60 seconds, max1024 entries and 16 concurrent jobs. Jobs defer one event-loop turn, have a one-second budget, and are awaited within the DNS HTTP request lifetime so Cloud Run request-based CPU cannot freeze detached work after a response. Notification outcome never changes REFUSED. Shutdown/request timeout aborts jobs; there is no persistent queue or retry after expiry. Request latency can increase by at most this budget. Per-process bounds do not replace deployment-wide abuse budgets.

`createFcmSender({projectId,getAccessToken})` makes a real abortable FCM HTTP-v1 request, with fixed generic title/body, Android TTL/collapse key, APNs expiry/collapse ID, and no redirects/retries. It returns only provider **acceptance**, never a fabricated device-delivery receipt. `createAttachedServiceAccountTokenProvider()` is an explicit short-lived token provider using the fixed Google metadata endpoint and an attached service account (ADC environment); it requests no key file. Other reviewed ADC implementations can supply `getAccessToken({signal})`. Tokens/response bodies/errors are never logged. The executable fixes project `freed-7d5ee`; it does not alter account roles or permissions.

## Remaining live gates

Review and connect the Auth/AppCheck installation adapter, owner/deletion/revocation lifecycle, atomic deployment-wide budgets and feed provenance/update process; resolve image digests and build/run the real dnsproxy image; review hosting/request logging so neither the URL secret nor GET query can enter platform/access/error logs; verify TLS, cache bypass and rewrites on the owned `https://freedrecovery.web.app` site; review latency/cost/store/privacy behavior. Hosting can rewrite HTTPS to Cloud Run but does not provide DoT on port853. No deployment is authorized by this package.

Then separately prove iOS system DoH and Android VPN DoH, ordinary DNS types/search behavior, feed blocking, generic push receipt, consent/revocation/account transitions, browser-specific Open Challenge, foreground access/ad/challenge completion and native enforcement. Source tests and synthetic local sockets establish none of those device outcomes.

Official references inspected: [dnsproxy tagged CLI](https://github.com/AdguardTeam/dnsproxy/blob/v0.86.0/README.md), [tagged Docker binary path](https://github.com/AdguardTeam/dnsproxy/blob/v0.86.0/docker/build.Dockerfile), [Cloudflare DoH](https://developers.cloudflare.com/1.1.1.1/encryption/dns-over-https/make-api-requests/), [RFC8484](https://www.rfc-editor.org/rfc/rfc8484), [FCM HTTP v1](https://firebase.google.com/docs/cloud-messaging/send/v1-api), [FCM Android/APNs fields](https://firebase.google.com/docs/reference/fcm/rest/v1/projects.messages), [attached identity metadata](https://cloud.google.com/compute/docs/access/authenticate-workloads).

## Families policy check and bundled control plane (18 October)

The executable now composes the fresh local reviewed policy with a fixed Families A-query classification probe. A matched successful0.0.0.0 answer denies; errors, truncation, oversized bodies and cancellation fail closed. Only the allow/deny decision is retained. A SafeSearch CNAME is never forwarded: allowed original queries use the separate standard encrypted resolver. This can block malware as well as adult categories; it is not a complete classification guarantee or a browser click detector. Safe public Mac DNS probes confirmed the documented denial and Google rewrite, not phone routing.

`npm run build:control-plane` bundles the reviewed Auth/AppCheck/Firestore control-plane source into this separate service package. The attached-identity wrapper exports the real installation/admission adapters. Pilot configuration remains disabled/missing by default. The functions callables, account-detachment integration, query-log handling, immutable container/runtime validation, deployment approval and native credential/profile/mode migration still require their own verification. Existing OS automatic filtering can preempt this service; no source or hosting page changes establish recovery in that path.

## 18 October primary-policy and routing-check ruling

Live Families classification is the mandatory primary provider policy for EVERY non-probe request. An optional `DOMAIN_FEED_PATH` supplies an additional reviewed local deny list; an invalid/stale supplied list still fails closed. Absence of a supplemental file does not bypass the live Families policy. This avoids inventing or re-dating a full adult-domain feed. Allowed original responses come only from the standard encrypted resolver; Families' SafeSearch rewrites are discarded. Provider outages and non-NOERROR/truncated policy replies fail closed. The policy can miss a category or a browser can bypass system DNS; no complete-coverage claim follows.

Authenticated/budgeted `a.<nonce32hex>.probe.freedrecovery.web.app` returns documentation-only A198.51.100.42/AAAA2001:db8::42 TTL0; matching b-probe returns REFUSED and the same generic recovery alert. These unique names allow a CURRENT native system-resolver-path check without cached ordinary names. They carry no browsing data and establish no browser enforcement, reward, completion or unlock. Native mode migration still needs its own exact authorization, profile/generation/network checks and rollback.
