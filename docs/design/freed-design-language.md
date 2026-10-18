# FREED design language

Date: 2026-10-02. Scope: original premium visual and interaction system across onboarding, the four native roots and every recovery feature. The user explicitly chose Opal + QUITTR as references. The approved paywall appearance and native four-tab shell are locked.

## Direction and evidence

FREED should feel calm, personal and protective: spacious brand moments, one meaningful recovery artifact, precise operational controls and quiet feedback. Combine Opal's sustained visual anchor and focused task hierarchy with QUITTR's personal progress artifact, clear question states and goal-led sequencing. Keep FREED’s mint identity and product voice. The latest owner request replaces the old keyhole logo completely with an original passage/F symbol.

Use an **open passage** as the original supporting artwork: space becoming available, with a clear horizon beyond a soft-edged opening. Its open-route geometry relates to FREED’s new passage/F mark. It represents a choice and a next step; it is never a visualization of dopamine, brain repair or measured recovery.

The alternative of copying QUITTR's starfield/rainbow cards would make the product visually busy; the alternative of copying Opal's gem/cave would borrow its strongest brand asset. Neither is selected. The intended combination is their hierarchy and continuity, expressed with FREED's own passage motif and mint/ink materials.

Evidence already inspected: all 47 QUITTR library entries, all 26 Opal product-section entries, and 83 supporting product entries from I Am Sober, BePresent and one sec. This design pass additionally inspected all 28 Opal onboarding stills and 27 sampled frames from its 215.6-second onboarding recording. References and downloaded media are in [the research receipt](../../research/2026-10-02-recovery-category/README.md) and [the additional Opal receipt](../../research/2026-10-02-recovery-category/premium-language/receipt.md).

**Important limit:** QUITTR has no actual Home, check-in, protection settings or recovery-tool flow in this library. Its onb_nsmij tools image is a marketing mockup. The Home/product recommendations use actual Opal and supporting product screenshots. Motion numbers below are FREED design decisions, not frame-measured competitor timings. Neither screenshot research nor sampled recordings verify native gesture behavior.

Useful durable references:

| Question | Opal evidence | QUITTR evidence | FREED decision |
| --- | --- | --- | --- |
| How does onboarding retain identity? | 1497465230/onb_im9zk, onb_25n4j, onb_t4sye | 6532588521/spl_rpgu4, onb_x3no4 | One persistent small brand/art anchor; current question is visually dominant |
| How should answer selection read? | 1497465230/onb_t4sye, onb_bewpt | 6532588521/onb_3pdqb, onb_69q6i | Check/radio + fill + label; same grammar across questions |
| How should permission setup recover? | 1497465230/onb_a2e80, onb_r20yw, onb_uc8ir | No actual setup evidence | One next permission; specific inline recovery; return and recheck |
| What should Home prioritize? | 1497465230/oth_gbmxf | Personal artifact in onb_x3no4; no Home | Protection status, truthful recovery artifact, one next action |
| How should active sessions differ? | 1497465230/oth_kescp, oth_bxcas, oth_p2341 | No actual session evidence | Focused active state; clear pause/exit; actual work requirement |
| How should operational settings read? | 1497465230/oth_313tk, oth_zekjp, oth_2xgb8 | No actual settings evidence | Compact grouped rows with status/value and recoverable permissions |

## Three screen compositions

**Brand moment:** welcome, brief plan preparation, rare milestone. Large original passage artwork, one headline and short supporting statement, one primary action. Art occupies at most 30% of the content viewport and compresses when text or keyboard needs space. Brand moments never create artificial waiting or add funnel pages.

**Focused task:** quiz, setup permission, check-in, custom reset, slip log, active challenge, breathing. Compact brand anchor; one current question or task; relevant controls; stable bottom action. Reduce reading and decoration as urgency increases.

**Operating screen:** Today, Shield, Progress, Profile and Library. Native title/header, operational sections, grouped rows and restrained hero content. Today earns one distinctive personal recovery artifact; other roots do not all receive a giant decorative card.

Every composition uses the same type ramp, spacing, radii, semantic colors and control feedback. A screen's difference comes from hierarchy and task, not a new palette or unrelated illustration.

## Brand artwork

Use assets/brand/freed-symbol.png as the new FREED mark. assets/icon.png and assets/adaptive-icon.png are the platform derivatives. The previous mark is retained only in assets/brand/previous for recovery. Use 36–44 pt in compact brand headers and 64–88 pt on welcome; preserve its aspect ratio and clear space equal to one quarter of its displayed width. The mark has no shield, keyhole or warm detail; it uses the one mint family.

Supporting artwork specification:

- Original broad soft-edged passage with an open center, simple horizon and three restrained depth planes; matte ink exterior, cool mint edge, quiet neutral distance.
- No gem, cave, life tree, starfield, rainbow foil, copied phone mockup, competitor art or watermark.
- Welcome: 240–300 pt wide, normal content height 180–240 pt; centered with no text over it.
- Today: a cropped passage contour may occupy the trailing upper quarter of the recovery artifact. Keep at least 24 pt between art and readable data. Text sits on an opaque semantic surface.
- Focused tasks: one 48–64 pt motif or the real logo near the top. No new full illustration for every question.
- Rare achievement: reuse the same artwork, with the open space slightly more visible; no simulated biological growth.
- Use an original local image or a small vector composition. Supply a light/dark treatment; keep heavy artwork static. Do not animate runtime blur, lighting, particles or an entire background. Assets are decorative and excluded from screen-reader order.

A restrained two-stop tint is permitted only inside this signature artwork or the personal recovery artifact because the user's chosen Opal + QUITTR direction explicitly calls for atmosphere. Primary CTAs stay solid. The tint does not spread to every ordinary card.

## Semantic color system

These target roles build on the existing cool mint palette in src/design-system/app-palette.ts. Components resolve semantic roles from the current theme; they do not import the legacy hard-coded dark palette. The existing paywall theme remains unchanged.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| Canvas | #F4F7F8 | #0B0F14 | Root/background |
| Deep canvas | #EAF0F2 | #080B10 | Quiet artwork depth |
| Surface | #FFFFFF | #151B23 | Content and ordinary grouped sections |
| Raised surface | #EAF0F2 | #1E2732 | Short overlay / distinct inset |
| Selected surface | #E2F2EC | #18352F | Chosen option and completed practice |
| Primary text | #17232D | #F2F5F7 | Reading and main data |
| Secondary text | #50616E | #ACB8C3 | Supporting descriptions |
| Tertiary text | #596C7A | #8D9CAA | Footnotes and dates that remain readable |
| Accent / positive | #137A60 | #78E0C2 | Primary action, chosen state, progress |
| On accent | #FFFFFF | #102A23 | Solid primary-button label |
| Subtle divider | #DCE5E9 | #2B3844 | Grouped rows; not sole state indicator |
| Attention | #85570F | #F2C56A | Specific permission/limited state |
| Critical | #AE302A | #FFAAA4 | Destructive action and blocking error |

One accent family across the product. Amber/red are functional states, never category styling. Neutral content does not acquire blue/purple/pink merely to differentiate cards. Positive mint does not mean an active native service unless current status proves it.

Calculated text contrast for the flat target pairs: light accent on white 5.28:1; light secondary on white 6.41:1; light tertiary on white 5.45:1; dark secondary on surface 8.57:1; dark tertiary on surface 6.16:1; dark on-accent label 9.61:1. Attention/critical text exceeds 6:1 on light surfaces and 9:1 on dark surfaces. These are arithmetic checks, not a completed device accessibility audit. Text over images/tints must use an opaque backing or be checked separately.

Selected/focus/error states use text, symbol and shape as well as color. Do not reduce essential instructions to low-opacity text or blur past questions into the reading order. Disabled controls still expose their reason.

## Typography and layout

Use system type: SF on iOS and the platform system sans on Android. Keep weight emphasis within this family. No imported headline font or random serif word. The existing logo provides the distinctive brand treatment.

| Role | Size / leading | Weight |
| --- | --- | --- |
| Native large title | 34 / 41 | 700 |
| Main question / task title | 28 / 34 | 700 |
| Section heading | 20 / 26 | 600–700 |
| Body / explanatory instruction | 17 / 24 | 400 |
| Control label | 15–17 / 20–24 | 600 |
| Caption / definition | 13 / 18 | 400–500 |
| Main recovery number | 48 / 54 | 700, tabular |
| Active exercise timer | 48 / 54 | 600–700, tabular |
| Secondary metric | 24 / 30 | 600, tabular |

Only one display number or display heading dominates a viewport. When a native large title already labels the root, do not render a second oversized title in the scroll content. Reading paragraphs remain 17 pt with 24–26 pt leading.

All layout/type values below are points on iOS and density-independent units on Android. Use a 4 pt rhythm: 4, 8, 12, 16, 20, 24, 32, 40, 48. Normal phone margin 20 pt; compact narrow width can use 16 pt. Ordinary group padding 16 pt; hero padding 24 pt; section gap 24 pt; heading-to-body gap 8–12 pt. A text form maxes at 560 pt; a single-column root at 640 pt. At wider layouts, center content or use two logical columns without splitting one task.

Shape rules: inputs 12 pt; ordinary groups 20 pt; signature hero and full task sheet 28 pt; tiny inset/chip 8 pt; buttons pill or 16 pt only where the existing setup treatment requires it. All rounded rectangles use continuous corners. Ordinary rows are flat inside a group, not nested miniature cards. Sheets get a single subtle elevation; rows and primary buttons do not glow.

Controls: primary action minimum 52–56 pt high; icon controls minimum 44 pt hit area on iOS and 48 dp on Android; grouped row minimum 56 pt with content-driven height. Switches, date/time controls and system pickers use native controls. A row has icon, title/detail, current value/status and appropriate chevron or switch. A chevron means deeper navigation, not a switch or destructive action.

Safe area and keyboard are system-controlled. Primary actions clear the home indicator. Root scrolling uses automatic inset adjustment. Forms scroll focused controls above the keyboard; the bottom action remains reachable. Dynamic Type is enabled: controls grow rather than clip, supporting descriptions wrap, multi-column options stack at XL size, and decorative artwork shrinks or disappears before type is reduced. Timers may split their label/value onto separate lines; no essential text is ellipsized or forced into a fixed-height card.

## State hierarchy and truthful data

Protection has precedence over decoration. Present states in this order when applicable: current temporary unlock; required action/error; pending check; active verified scope; platform unsupported. Show text and a symbol. A last known active state may be labeled stale/checking; do not present it as a fresh check.

Today order is fixed:

1. Slim current protection status; opens the relevant Shield/setup action.
2. Personal recovery artifact: one truthful whole-day streak, elapsed hours/minutes, next milestone. Its progress is a user's streak goal, not a health-repair percentage.
3. One next action: saved reset first; otherwise daily check-in; then pledge or a short relevant practice.
4. Compact daily practice group with completed count; all existing habits remain available.
5. Quick tools and reading. SOS remains in the native root header and bypasses ads.

Move activity formulas, best/lifetime counts, XP/level and deeper reports into Progress. Do not repeat the same streak in metric boxes, a goal card, clock and milestone card. On a zero-day user, elapsed minutes provide meaningful truthful progress. A recorded slip restarts current progress and preserves best/history.

Loading uses native activity indicators and stable section geometry. No false numerical preparation. Empty data has an explanation and one useful next action. Errors live beside the failed action and preserve input. Successful storage/permission outcomes get quiet confirmation; an exercise completion becomes helpful only after the user's outcome feedback, not a decorative timer.

Do not import QUITTR's diagnostic/dopamine/quit-date claims, Opal's lifetime-years savings predictions or either app's medical/coverage promises. FREED's estimates remain defined estimates. iOS protection distinguishes selected-app shields, adult-domain blocking and Safari rules; it cannot inspect all adult media inside native third-party apps.

## Motion system

Native tabs, push/back, system sheets, keyboard and system dialogs retain platform motion. Do not layer a whole-screen custom entrance on top of native navigation. Tabs never slide. Back returns through navigation; successful purchase/onboarding/session events leave obsolete states.

Motion below is the intended FREED specification:

| Interaction | Purpose | Motion | Haptic / accessibility |
| --- | --- | --- | --- |
| Primary button press | Immediate touch feedback | Scale 1 → 0.98 on press-in; responsive spring, no overshoot; settle on release | One light impact only if action is accepted; disabled has none |
| Operational row press | Clear hit feedback | Surface highlight in 100–120 ms; no row scale | Native selection tick where appropriate |
| Quiz/choice selection | Make state unmistakable | Fill + check/radio transition 120 ms; label stays still | One selection tick; selected state announced |
| Question changes within one route | Maintain continuity | Outgoing opacity 100 ms, incoming opacity 160 ms; optional 8 pt rise only on first arrival | Reduce Motion: opacity only; focus moves to heading |
| New brand moment | Establish identity once | Artwork opacity 200–240 ms and scale 0.98 → 1; headline stays readable immediately | No haptic or compulsory delay; no looping drift |
| Help/details expansion | Reveal relevant context | Content opacity 120–160 ms; native/discrete layout update; no large bouncing height animation | Expanded state exposed |
| Permission return/status update | Explain actual state change | Status symbol/text crossfade 160 ms after recheck; actual completed step check appears | One success tick only for real newly completed step |
| Habit completed | Confirm recorded action | Checkmark + selected surface 140–180 ms; no confetti | One selection/success tick; outcome announced |
| Save/check-in/slip/custom reset | Confirm persistence | Busy indicator; success opacity/check 180 ms; native dismissal when save succeeds | One success feedback; errors announce and retain draft |
| Challenge pause/resume | Make temporal state explicit | Content/controls crossfade 160 ms; timer text does not roll or count animated values | State announced; actual active time remains truthful |
| Earned milestone | Rare meaningful reward | One small check/art fade 220–260 ms; no looping trophy or particle burst | Optional success feedback, once per new earned event |
| Breathing cadence | Explain an actual phase | Scale 1 → 1.08 on inhale; return 1 on exhale; phase-duration matched timing; no huge glow | Optional single phase haptic; no per-second loop; text countdown always visible |
| New report/content | Prevent a jarring replacement | Section opacity 120–180 ms after real data arrives | No animated counters while reading |
| Ad/provider loading | Communicate actual asynchronous work | Native spinner only; stable layout | No progress percentage unless provider supplies one |

Timing easing for non-gesture state motion: cubic-bezier(0.23, 1, 0.32, 1). Finger-driven responses use a critically damped spring; shared reference is duration 400 ms / dampingRatio 1, with small press distance so perceived feedback begins immediately. Frequent actions have no elaborate choreography. Data labels and clocks stay fixed; only actual values update.

Reduce Motion removes scale, translation, stagger and continuous decorative effects. Use a 100–150 ms opacity change or immediate selected state. Breathing shows phase/count without geometric expansion. No haptic is required to understand a state. Respect user haptic settings and avoid feedback at every timer tick or during scroll. No stagger on recycled rows or article paragraphs.

## Every-screen implementation matrix

The existing 19 Screen states include main, which expands to four roots: 22 concrete surfaces. This matrix changes presentation and interaction clarity; it does not add funnel steps or remove features.

| Surface | Composition / premium treatment | Interaction and motion | State that must remain clear |
| --- | --- | --- | --- |
| Splash | Real logo on semantic canvas; compact passage hint | One 200 ms logo reveal; readiness decides exit | Hydration/loading; no fake prep |
| Welcome | Original passage hero, concise promise, one start action and visible free path | One brand reveal; native onward transition | Returning user/account entry/skip |
| Quiz | Compact shared anchor, one 28 pt question, clean choice rows and progress | Selection 120 ms; question change 160 ms | Saved answers, Back, unanswered state |
| Plan calculation | Personal preference artifact; factual summary | Real spinner/preparation only; summary fade 180 ms | No diagnosis, dopamine or predicted date |
| App selection | App names/counts and clear scope on grouped surface | Native picker; selected fill/check | Required selection, missing picker, platform scope |
| Account | Focused provider/email task; actual logo | Native auth transition; visible busy indicator | Guest path, email verification/reset, collision/errors |
| Protection setup | Compact artwork, current step, one next settings action | Recheck status crossfade; genuine step tick | Denial/revocation/VPN conflict, Help, limited path |
| Paywall | **Approved appearance locked** | Preserve existing accepted interaction and provider state | Prices, subscribe/restore/cancel, free exit/origin |
| Today | Status row + personal recovery artifact + one action + practices | Quiet recorded-action feedback; no entrance cascade | Actual scope, elapsed time, saved reset, zero day |
| Shield | Operational status and grouped app/schedule/web controls | Native toggles/pickers; help expansion | Coverage limits, permission recovery, current unlock |
| Progress | Real history hero, then patterns/outcomes/milestones/reports | Static readable data; rare earned-milestone response | Empty/low data, estimate definitions, time range |
| Profile | Logo/account identity, membership, grouped preferences | Native deeper navigation or explicit expansions | Signed-out, backup/restore conflict, deletion scope |
| Library | Intent tools first, one featured article, compact categories | Quiet press highlights; native push | Gated feature/local availability |
| Article | Editorial headline/read time, readable body | Native navigation; no paragraph animation | Large text, back/scroll continuity |
| Intercept / SOS | Calm focused task, reason + one reset action, secondary help | No ritual animation or busy decoration | Manual vs real block source; urgent ad bypass |
| Rewarded reset | Stable preparing/provider state, clear no-ad fallback | Native spinner/provider UI; outcome fade only | Not earned/cancelled/unavailable; no false reward |
| Challenge | Capable recommendation; focused actual steps/time/proof | Pause/resume crossfade; explicit completion feedback | Sensors/permissions, saved active time, one receipt |
| Breathing | Calm cadence selector, phase/count, minimal motif | Phase-linked 1.08 scale; text-only Reduce Motion | Pause/Close, actual phase; no promised cure |
| Daily check-in | Short prompt, mood/urge/sleep scales, optional reflection | 120 ms selection; storage success/dismissal | Scale endpoint meanings, edited/draft/saving/error |
| CLARA | Compact identity and actual local/remote status; readable chat | Sending spinner; anchored keyboard-safe composer | Quota, offline fallback, timeout/retry, real guidance scope |
| Slip log | Kind concise heading, precise reset consequence, form | Preserve draft; save feedback and native return | Current streak restarts only on save; best/history preserved |
| Custom reset | Simple labeled builder + saved-reset list | Native controls; save and start with quiet confirmation | Premium return/origin, required fields, persistence |

Expanded feature sections follow the same system: reminders use native switch/time rows; accountability uses selected contact/form and preview; backup uses labeled passphrase/actions and explicit restore choice; privacy keeps local/cloud deletion distinct; advanced Shield exposes real diagnostics without dominating everyday use. All 99 feature-ledger rows remain required.

## Implementation and acceptance constraints

The visual implementation should consolidate semantic colors and shared components before changing each screen. Legacy imports of constants/design, hard-coded rgba white surfaces, multi-hue card gradients, custom toggles, duplicate native/manual titles and unbounded ScreenTransition/StaggeredEntry usage must not remain as the rendered default. The approved paywall is excluded from visual-token migration unless needed for an actual functional fix.

Complete target verification on the implemented app:

- Both themes, compact phone, regular phone, XL text, screen reader and Reduce Motion.
- Native tab/push/back/retap, keyboard-safe forms, cold start and correct one-way exits.
- Default/selected/loading/empty/error/paused/success states, real native protection status and user-visible coverage.
- Screen recordings for quiz selection/change, permission return, practice completion, challenge pause/resume, breathing and save/dismissal.
- No clipped text, essential low-contrast caption, repeated automatic haptic, background animation, fake counter, repeated Home metric or unsupported outcome claim.

This design document supplies a concrete target. Reference media and source review are not proof that these acceptance checks pass; the root implementation must append current FREED device evidence.
