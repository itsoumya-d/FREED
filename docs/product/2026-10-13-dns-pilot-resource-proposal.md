# Encrypted-DNS pilot resource proposal —13 October2026

Status: preparation only. No domain purchased, server provisioned, service identity changed or protection migrated. Reuse existing project freed-7d5ee. Page hosting remains freed-landing.web.app; it cannot provide the Android DoT listener or a replacement arbitrary-HTTPS block page.

## Proposed bounded resources

One e2-micro VM in us-central1, one10GiB standard persistent disk, one external IPv4, existing project, separate least-privilege identity. Normal public TLS for a separately approved DNS hostname;443DoH and853DoT only, no public UDP/TCP53. Five revocable opt-in installations. dnsproxy v0.86.0 provides maintained DNS transport; the current limited A/AAAA prototype remains contract evidence, not the deployed resolver. No load balancer, Cloud NAT or new paid monitoring service.

Planning arithmetic for730hours/month, before tax and local-currency conversion, without assuming free-tier eligibility: e2-micro published hourly rate0.008376428USD implies6.11USD; external IPv4 at0.005USD/hour implies3.65USD. Disk price/region must be confirmed at provisioning. Reserve1USD disk,1.20USD egress (10GiB at0.12USD/GiB),0.60USD DNS zone/query allowance if a new zone is needed and2USD operational contingency:14.56USD planning estimate, below the25USD ceiling. This is a planning estimate, not an exact provider quote or guaranteed maximum.

Prefer a subdomain of a domain already owned and controlled by the user to avoid an unnecessary registration. Current evidence supplies only Firebase-managed hosts; those cannot be repointed to the pilot VM or assigned arbitrary wildcard installation names. Domain ownership/available hostname and registrar quote remain unverified. If a new domain is required, show its first-year and renewal total and the final VM/disk/egress estimate before purchase or provisioning.

## Native-compatible credential design to validate

Android Private DNS accepts a hostname rather than a custom Authorization header. Candidate: high-entropy per-installation hostname under an approved TLS wildcard, matched and revoked server-side using TLS SNI. iOS can use that hostname with an exact DoH URL. Do not encode an account identifier, query/domain or device identity in the hostname. Endpoint names are credentials; redact them from app/server/error/access logs and exports. DNS infrastructure and TLS observers may see the endpoint hostname; do not promise secret transport of SNI. Proof with the actual native configurations, credential rotation, revocation and background use is required before adopting this design.

A DNS alert is generic, bounded and consented. It carries no browsing domain, membership, ad reward or app-break authority. Cache/prefetch/OS policy/custom resolvers/Tor/VPN/push restrictions can prevent click-correlated delivery. Notification delivery does not establish a browser recovery pass.

## Cost and migration controls

Billing alerts are additional warnings, not a spending cap. Five-installation admission, bounded wire/request sizes, handshake/query limits, aggregate egress accounting and early shutdown must be implemented/tested; unknown traffic and attack costs remain a deployment risk. No promise that a budget alert stops25USD expenditure. Retain local protection and user rollback; native failover behavior and outage state require device proof before migration. Do not weaken Families/Screen Time merely to exercise the pilot.

## Current sources

- [Google Compute general-purpose prices](https://cloud.google.com/products/compute/pricing/general-purpose) — e2-micro hourly planning rate; regional final quote pending.
- [Google VPC prices](https://cloud.google.com/vpc/network-pricing) — IPv4 rate and internet egress.
- [Google disk prices](https://cloud.google.com/compute/disks-image-pricing) — final disk quote pending.
- [dnsproxy official source](https://github.com/AdguardTeam/dnsproxy) — DoH/DoT transport; native-compatible installation authentication is our adapter responsibility.

This proposal authorizes no live resource and provides no device, load, privacy or release acceptance.
