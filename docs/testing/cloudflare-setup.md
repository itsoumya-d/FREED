# Cloudflare setup for FREED

The Cloudflare dashboard was inspected in the existing signed-in browser. Its domain overview had no zones. No account settings, DNS records, tokens, paid plans, or subscriptions were changed.

## Adult-content and malware filtering

FREED uses Cloudflare's public Families resolver at `https://family.cloudflare-dns.com/dns-query`. This service does not require creating a website zone, API token, Worker, or Zero Trust organization. Cloudflare publishes this endpoint in its [Families setup guide](https://developers.cloudflare.com/1.1.1.1/setup/#dns-over-https-doh).

The app's optional encrypted-DNS integration is implemented for iOS and Android. It retains the provider disclosure, explicit consent, truthful native status, and no app-added plaintext downgrade. Release activation stays off until physical-device enforcement and iOS provisioning pass. See [native implementation and release checks](encrypted-dns.md).

The terminal check queried only Cloudflare's published safe category-test domains and an ordinary control:

| Check | Observed |
| --- | --- |
| `nudity.testcategory.com` | Blocked |
| `malware.testcategory.com` | Blocked |
| `example.com` | Resolved |

Run `node scripts/verify-cloudflare-families.js` to repeat the checks. The [provider receipt](../validation/artifacts/2026-10-02-premium-cloudflare/provider-check.json) records the timestamp and results. These checks establish public resolver behavior, not mobile traffic routing or complete adult-content protection.

## Website DNS

Custom website DNS is a separate optional setup. The domain name has not been supplied, so no zone was created and no registrar nameservers were changed. Once an owned domain is provided, its current hosting and DNS records can be inspected before creating the appropriate zone and migration instructions.
