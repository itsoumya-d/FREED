# Production advertising eligibility — 15 October 2026

Read-only primary-policy recheck for the accepted commercial journey. No support message, declaration, production ad, console, network configuration or spending change was made. This is an implementation/release gate, not a Google eligibility decision.

## Published requirements

[AdMob rewarded-ad policy](https://support.google.com/admob/answer/7313578?hl=en) limits non-monetary rewards to non-transferable benefits usable within the publisher's product. It requires accurate advance disclosure, affirmative choice, a dismiss/skip option, normal use after declining, and delivery of the promised earned reward. The publisher remains responsible; Google does not endorse its reward. FREED's intended in-app guided session fits the location of a benefit described by the policy, but the connected external-app-time result has no explicit approval in this source. Treat eligibility for the complete chain as unresolved rather than certifying it from the session's name.

[Google Play VpnService guidance](https://support.google.com/googleplay/android-developer/answer/12564964?hl=en) restricts eligible uses, requires a declaration and appropriate disclosure/consent, and prohibits manipulating other apps' traffic for monetization. The form explicitly asks about monetization-related redirection. An advertised website block leading to ad-funded recovery needs assessment as a complete mechanism. A notification or intermediate recovery page does not by itself establish an exception. Category selection alone is insufficient. No acceptance or rejection for FREED has been received in this continuation.

## Concrete unresolved checks

| Intended path | Needed determination/evidence | Current disposition |
| --- | --- | --- |
| User opens FREED voluntarily → one optional rewarded guided session → no app unlock | Genuine opt-in/reward/delivery and policy eligibility for actual screens | Internal Google sample mode; no new device pass |
| Native selected-app barrier → optional rewarded session → completed activity → original app window | Review the complete benefit and external app-time result, not just the immediate session | Production reward chain unapproved; test mode retained |
| VPN-covered website attempt → recovery handoff → optional video | Accurate VPN declaration, disclosure, permitted purpose and monetization determination | No production monetized VPN-redirect claim |
| Paid recovery | Genuine store entitlement/ownership and supported advertised features | Existing purchase lifecycle/device gates remain |

A future review packet should show the actual boundary, Open Challenge action, paid/free/unknown branches, exact video disclosure, skip/basic-help path, genuine reward, activity completion and app-time result. Separate website recovery from app unlock. Include VPN disclosure, destination/payload/network diagrams, data handling and a short real-device recording. Describe proposed or unexecuted paths as such. Do not claim that merely changing copy, using an external page or naming the reward a session changes its eligibility.

No policy workaround is authorized. Continue internal functionality using Google demo units and the internal-only video creative selector. Keep live ads disabled until the actual mechanism has the required disposition. This recheck does not alter user limits, add another ad, remove basic help or unlock adult websites.
