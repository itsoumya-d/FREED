# Appllama research — FREED category study (2026-09-26)

Source: Appllama MCP (`https://mcp.appllama.io/mcp`), Pro plan, credits spent: 12
out of the 1,006 remaining on 2026-09-26 (reset 2026-10-01 UTC).

Raw tool output is in `raw/` (screen ids are durable, media URLs expire in ~1
hour, so re-request a page before re-downloading pixels). Every screenshot
carries a small Appllama watermark — it is provenance, never part of the screen.

## Queries run

| File | Tool | Purpose |
| --- | --- | --- |
| `raw/01-apps-recovery.json` | `search_apps` (revenue) | Top-grossing recovery / adult-blocker apps |
| `raw/02-apps-blocker.json` | `search_apps` (downloads) | Top-downloaded screen-time blockers |
| `raw/03-flows.json` | `list_flows` | Flow taxonomy and library density |
| `raw/04-ui-elements.json` | `list_ui_elements` | Element vocabulary |
| `raw/05..08-screens-*.json` | `search_screens` (semantic) | Permission, intervention, dashboard, paywall references |
| `raw/10-opal-onboarding-1.json` | `list_app_screens` | Opal onboarding journey, page 1 of 3 |
| `raw/11-quittr-onboarding-1.json` | `list_app_screens` | QUITTR onboarding journey, page 1 of 5 |
| `raw/13-system-chrome.json` | `get_element_screens` | How permission prompts are presented |

## Category shortlist (revenue as of 2026-08-01)

| App | Monthly revenue | Downloads | Rating | Relevant flows |
| --- | --- | --- | --- | --- |
| Opal: Screen Time Control | $500K | 200K | 4.72 | Welcome (3) · Onboarding (29) · Paywall (2) · Focus Timer (12) · App Management (5) · Dashboard (4) |
| BePresent: Screen Time Control | $400K | 200K | 4.84 | Welcome (3) · Onboarding (42) · Paywall (2) · Focus Session (5) · Scheduled Sessions (4) · App Intention (2) |
| I Am Sober | $200K | 300K | 4.88 | Welcome (5) · Onboarding (21) · Paywall (2) · Daily Pledge (2) · Achievements (2) · Progress Settings (3) |
| AppBlock | $100K | 40K | 4.59 | Onboarding (38) · App Blocking (16) · App Management (10) |
| one sec | $80K | 50K | 4.83 | Onboarding (6) · Focus (5) |
| Brainrot: Screen Time Control | $60K | 100K | 4.53 | Onboarding (40) |
| Brainbuddy: Quit PMO | $50K | 1K | 4.68 | Onboarding (43) |
| QUITTR – Break Free Now | $50K | 1K | 4.72 | Onboarding (41) |

FREED's direct set is Brainbuddy + QUITTR (recovery) and Opal/BePresent/AppBlock/Brainrot
(blocking). Both recovery apps monetise ~$50K/month while their blockers do 8–10x
that, which is the strategic gap this product closes: recovery depth with
blocker-grade protection.

## What the leaders do that FREED should copy

1. **Onboarding is the product.** Opal spends 29 screens (BePresent 42, QUITTR 41,
   Brainbuddy 43) before the paywall. The sequence is always
   *welcome → identity/name → pain-point acknowledgement → goal → quiz → personalised
   projection → paywall → permission setup → first protected moment*. FREED's current
   chain (`welcome → quiz → planCalculation → appSelection → paywall → protectionSetup`)
   matches that skeleton; the missing beats are the acknowledgement screen and the
   personalised projection being *earned* by the quiz.
2. **One decision per screen, big single CTA.** Opal's journey uses a centred gem,
   one line of copy and a bottom tap prompt per screen (`onb_7eb0l` page). QUITTR uses
   a gradient progress bar, numbered option pills, a back chevron and a bottom step
   counter on every quiz screen. FREED already has the numbered pills and the step
   counter; the wizard must keep the same discipline (one action per screen).
3. **Permission requests are framed as setup, never as diagnosis.** The library's
   permission screens are modelled as `system-chrome` (3,017 screens) and appear as
   *Actions* inside Onboarding (e.g. "Notification Permission" with a dimmed app
   backdrop, an OS alert and dual rounded actions). The top apps explain on the
   *previous* screen, then fire the OS prompt, then advance automatically — exactly
   the one-step Android wizard FREED uses. Where they differ from FREED: they never
   leave the user without an alternative path when the OS refuses, which is the
   dead-end fixed in this session.
4. **Progress is always visible.** Onboarding 19,671 screens / 1,202 apps, Paywall
   2,395 / 1,256, but "Home" only 371 / 126 — the flow taxonomy says the library
   judges onboarding and paywall as the differentiators, not the dashboard.
5. **Paywall placement.** Revenue leaders put the paywall after the personalised
   projection and before the permission wall (`pay_m8qfz`, `pay_7hgb8l`,
   `pay_qju42` all show plan selection with a comparison table). FREED's Core 3
   (yearly/monthly/lifetime) plan list with yearly as the value anchor matches;
   the lifetime row is what none of the sampled leaders offer and should stay
   visually last.

## Actions this research produced

- **Android post-onboarding dead-end** (fixed this session): the wizard now caps
  retries at two attempts per step and, when a required step cannot complete
  (`status === "unavailable"`, or a repeated failure), shows a specific cause with
  an explicit "Continue with limited protection" path. Activation stays incomplete
  and Home keeps a limited-protection banner until the activation test passes —
  the leader behaviour is "always offer the next thing", never a frozen button.
- **Next onboarding beat to add** (not yet implemented): an acknowledgement screen
  after the quiz plus a personalised projection carried into `planCalculation`;
  both are already modelled in `implementation.md` (M2.2) and match Opal/QUITTR
  screen-for-screen.
- **Permission copy pattern** (already implemented, keep): explain on the current
  screen → open the exact OS surface → auto-advance on return. This is identical to
  what the library shows for the top apps; do not add a second confirmation dialog.
