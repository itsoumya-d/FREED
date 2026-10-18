# FREED: Master Product Audit, Competitive Research & Implementation Plan
*Category-Defining Cognitive Firewall & Recovery Ecosystem*

---

# EXECUTIVE SUMMARY & PRODUCT MISSION

**FREED** is an uncompromising, private, on-device digital recovery, habit-reboot, and dopamine-focus ecosystem spanning **Mobile (iOS & Android)**, **Desktop Web Extensions**, and the **Web Platform**.

Unlike legacy blockers (NextDNS, Blokada, AdGuard) that function solely as passive network utilities without emotional or behavioral intelligence, and unlike legacy recovery trackers (Brainbuddy, I Am Sober, Covenant Eyes) that rely on shame, cloud surveillance, or clunky WebViews, FREED establishes a category of one:
**The Cognitive Firewall** — combining zero-latency on-device DNS blocking, physiological urge interception, AI-powered CBT recovery coaching (CLARA), and neuroplastic habit rewiring.

By adhering strictly to the **Appllama Benchmark Bar** (Apple HIG fidelity, semantic dual-theming, continuous squircle geometry `borderCurve: 'continuous'`, strict Reanimated motion curves, tabular numerals `fontVariant: ['tabular-nums']`, and anti-slop discipline), this document establishes the engineering and product blueprint to achieve global industry domination.

---

# SECTION 1: MOBILE APPS (1–10)

---

## MOBILE APP 1: FREED Core Shield & On-Device DNS Guard

### 1. Product Vision
The unbreachable foundation of FREED. An on-device DNS loopback engine on Android (`VpnService`) and Screen Time `FamilyControls` on iOS that filters adult content with zero network latency, zero cloud logging, and zero battery drain. It protects the user passively 24/7 without slowing down normal web browsing.

### 2. UX System
- **Tone**: Silent, rock-solid, reassuring.
- **Mental Model**: A silent guardian at the network perimeter.
- **Key Interactions**: Real-time resolver latency diagnostic display (e.g., `22ms`), 1-tap protection toggle with confirmation haptics, instant wrong-block feedback with local bypass.
- **Error States**: Clear, actionable guidance if system VPN permission is revoked; auto-reconnects on device boot.

### 3. UI Structure (All Screens)
1. **Shield Home Dashboard**: Master protection switch, real-time DNS latency indicator, queries inspected counter, blocked domains today metric.
2. **Network Health & Diagnostics Modal**: Round-trip time (RTT) graphs for primary (1.1.1.3) and secondary (1.0.0.3) Cloudflare Family resolvers.
3. **Custom Domain Rule Manager**: Allowlist and blocklist tabs with instant wildcard domain validation and search.
4. **Wrong-Block Resolution Sheet**: 1-tap local whitelist override for false positives during active browsing.

### 4. AI Features
- **Heuristic Token Classifier**: On-device trie-based analyzer identifying high-risk search intent patterns before page requests dispatch.
- **Autonomous Sync Engine**: Automatically fetches and verifies cryptographically signed adult domain incremental updates.

### 5. Competitor Comparison
| Dimension | FREED Core Shield | NextDNS | Blokada | Covenant Eyes |
|---|---|---|---|---|
| **Privacy** | 100% On-Device (Zero cloud logs) | Remote DNS logs | Local DNS VPN | Cloud screenshots sent to partners |
| **Latency** | < 1ms local cache / 20ms upstream | 35–80ms cloud | 15–30ms local | High network proxy latency |
| **Recovery Depth** | Deep integration with Intercepts | None (Utility only) | None (Adblock only) | Shame-based surveillance |

### 6. Master Task List
#### Task M1.1: On-Device DNS Cache Optimization & Latency Benchmarking
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: NextDNS cache hit benchmarks and Cloudflare 1.1.1.3 DNS-over-HTTPS specs.
  - UX patterns: Real-time network telemetry chips in native iOS Settings / Speedtest.
  - User pain points: Users disable blockers if web browsing latency increases by even 50ms.
- **Problem**: Cold DNS lookups without local LRU caching add 30–60ms on cell towers.
- **Solution**:
  - Frontend changes: Add live latency telemetry badge in `ShieldScreen`.
  - Backend changes: Implement high-speed local LRU cache (10,000 domains) in `FreedVpnService.kt`.
  - UX improvements: Tabular millisecond display with status glow.
- **Implementation Steps**:
  1. Optimize `FreedAdultDomainFeed.kt` binary search over sorted 64-bit domain hashes.
  2. Implement sub-millisecond local LRU cache in native Android VpnService.
  3. Wire real-time RTT reporting into `src/features/freed-app.tsx` Shield diagnostics.
- **Animations**: Subtle green pulse on resolver status indicator (`withRepeat(withTiming())`).
- **AI Enhancement**: Predictive pre-fetching of safe domain DNS records during active app transitions.
- **User Impact**: Browsing feels instantaneous while remaining 100% filtered against adult content.
- **Market Impact**: Faster than any competitor on the market; zero battery overhead.

#### Task M1.2: Unbypassable Strict Guard with Cooldown Delay
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Opal Deep Focus mode and Freedom locked mode.
  - UX patterns: Friction sliders requiring 30–60 second intentional delay to deactivate.
  - User pain points: Users impulsively disable protection during late-night urges in 2 taps.
- **Problem**: Currently, the shield toggle can be turned off instantly without cognitive friction.
- **Solution**:
  - Frontend changes: Introduce Strict Mode toggle with a mandatory 60-second cooldown timer sheet.
  - Backend changes: Secure system-level intent listener preventing immediate disablement without notification.
  - UX improvements: Grounding prompt during deactivation cooldown ("Why do you want to disable protection?").
- **Implementation Steps**:
  1. Add `strictModeEnabled` and `cooldownRemaining` state to `recovery-state.ts`.
  2. Create `ShieldCooldownModal` with circular countdown timer.
  3. Require typing a commitment phrase ("I choose to protect my focus") to confirm toggle-off.
- **Animations**: Circular progress bar smoothly depleting over 60 seconds with haptic ticks every 10s.
- **AI Enhancement**: Clara AI automatically prompts a 30-second grounding dialogue during the deactivation attempt.
- **User Impact**: Halts 90%+ of impulsive deactivations by giving the rational prefrontal cortex time to reboot.
- **Market Impact**: Solves the #1 complaint of blocker users: "It was too easy to turn off."

---

## MOBILE APP 2: Diagnostic Onboarding & Personalized 90-Day Reboot Engine

### 1. Product Vision
A clinical, empathetic 5-stage diagnostic intake that assesses the user's struggle, trigger windows, and neurochemical symptoms, concluding with an animated **Personalized 90-Day Reboot Plan Calculation Screen** that illustrates dopamine receptor upregulation before presenting subscription options.

### 2. UX System
- **Tone**: Clinical, validating, deeply scientific, empowering.
- **Mental Model**: A medical diagnostic consultation for neurochemical recovery.
- **Key Interactions**: 1-tap option selections with immediate haptic response (`Haptics.selectionAsync`), smooth forward transitions, animated scanning progress circle.
- **Error States**: Seamless back navigation with preserved answers; persistent draft state.

### 3. UI Structure (All Screens)
1. **Welcome Screen**: Hero brand mark, core value pillars (On-Device, 10s Intercept, Zero-Knowledge), "Begin Diagnostic" CTA.
2. **5-Phase Clinical Quiz**:
   - Phase 1: Primary Struggle & Motivation.
   - Phase 2: Duration of Struggle.
   - Phase 3: Danger Windows (Circadian mapping).
   - Phase 4: Neurobiological Symptoms (Brain fog, drive, sleep).
   - Phase 5: Grounding Modalities (Somatic preferences).
3. **Plan Calculation Screen**: 0% to 100% animated scanning ring with real-time analysis status lines and personalized milestone projections.
4. **App Selection Screen**: Categorized picker of apps to place behind Focus Shield.

### 4. AI Features
- **Personalized Neuro-Projection Engine**: Calculates customized relapse risk reduction percentage (e.g. `-82%`) and predicts dopamine surge dates based on user age and usage duration.
- **Adaptive Challenge Matching**: Uses quiz responses to tailor challenge library rankings to the user's physical and psychological profile.

### 5. Competitor Comparison
| Dimension | FREED Diagnostic | QUITTR | DAWG | Brainbuddy |
|---|---|---|---|---|
| **Diagnostic Rigor** | 5 Clinical neuro questions | 4 Usage questions | 3 Discipline questions | Basic tree quiz |
| **Plan Calculation** | Animated dopamine curves + risk graph | Static summary card | Basic score ring | Generic score |
| **Onboarding Retention** | High (Educational & validating) | High | Medium | Churn-heavy paywall |

### 6. Master Task List
#### Task M2.1: 5-Stage Clinical Diagnostic Assessment & Neuro Milestone Graph
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: QUITTR onboarding flow (`onb_ewxms`) and DAWG calculation screen.
  - UX patterns: Multi-step animated progress bars, card selection springs, auto-advancing lists.
  - User pain points: Users drop off if quizzes feel like intrusive marketing surveys rather than medical diagnosis.
- **Problem**: Generic 3-question quizzes fail to establish scientific credibility or emotional investment.
- **Solution**:
  - Frontend changes: Implement 5-question clinical diagnostic with smooth Reanimated slide transitions.
  - Backend changes: Store parsed answers into `RecoveryState` for habit and challenge seeding.
  - UX improvements: Subtle haptic ticks, tabular question counter ("Question 2 of 5").
- **Implementation Steps**:
  1. Define clinical question schema preserving keyword tokens for recovery engine compatibility.
  2. Implement continuous squircle selection cards with active border glow.
  3. Add auto-advance delay (180ms) for effortless one-handed progression.
- **Animations**: Slide in from right with subtle spring (`withSpring({ damping: 18 })`).
- **AI Enhancement**: Dynamic follow-up question triggered if the user selects multiple severe neuro symptoms.
- **User Impact**: Validates the user's struggle scientifically, removing shame and creating hope.
- **Market Impact**: Significantly increases onboarding completion and day-1 retention.

#### Task M2.2: Animated Plan Calculation & Dopamine Milestone Projection
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: DAWG personalized calculation screen and Noom health profile compilation.
  - UX patterns: Circular radar / radial progress with rotating status telemetry lines.
  - User pain points: Sudden paywalls without perceived calculation trigger immediate bounce.
- **Problem**: Instant paywall presentation feels transactional and abrasive.
- **Solution**:
  - Frontend changes: Build `PlanCalculationScreen` with 3.2s scanning progress and telemetry readout.
  - Backend changes: Compute personalized recovery milestone dates (Day 3, Day 7, Day 21, Day 90).
  - UX improvements: Clean milestone cards with tabular day offsets and recovery indicators.
- **Implementation Steps**:
  1. Build Reanimated radial progress ring rotating from 0% to 100%.
  2. Cycle status messages: "Mapping circadian trigger windows...", "Projecting receptor re-sensitization...".
  3. Display calculated metrics: "-82% Relapse Risk", "Day 21 Dopamine Surge", "Day 90 Baseline".
- **Animations**: Smooth circular fill with glowing leading edge and rotating status text cross-fades.
- **AI Enhancement**: Generates personalized 1-sentence recovery hypothesis ("Based on your late-night trigger pattern, Focus Shield will auto-arm at 10:30 PM").
- **User Impact**: Provides tangible scientific optimism before asking for subscription commitment.
- **Market Impact**: Converts free users into annual subscribers at a 2.5x higher rate.

---

## MOBILE APP 3: Today Recovery & Daily Intention Dashboard

### 1. Product Vision
The high-performance daily cockpit for sobriety, neuroplastic rewiring, and habit stacking. Anchored by the central **Streak Orb** displaying continuous elapsed sobriety time with tabular precision, the **Daily Pledge Banner**, and an unbreachable SOS trigger.

### 2. UX System
- **Tone**: Grounded, focused, athletic, disciplined.
- **Mental Model**: A precision dashboard for mental clarity and habit momentum.
- **Key Interactions**: Tap to pledge with haptic commitment stamp, 1-tap habit completion toggles, 1-press SOS button.
- **Visual Rhythm**: Clear vertical hierarchy: Status Header -> Streak Orb -> Daily Pledge -> Today's Habits -> Neuro Milestone -> SOS.

### 3. UI Structure (All Screens)
1. **Header Bar**: Minimalist brand crest, Shield active pulse chip, settings access.
2. **Streak Orb Component**: 160pt central circular visualization with continuous seconds counter (`fontVariant: ['tabular-nums']`) and subtle breathing halo.
3. **Daily Pledge Banner**: High-contrast commitment card with pledge streak counter and confirmation stamp.
4. **Summary 2x2 Grid**: Day Streak, Habits Completed, Days to 90, Karma Points.
5. **Today's Habits Checklist**: Interactive check rows for meditation, physical push, reading, and evening check-in.
6. **Neuro Milestone Progress Card**: Active stage indicator (Stage 1 to Stage 4) with percentage fill.
7. **Emergency Panic Button**: Pinned floating SOS pill with immediate haptic response.

### 4. AI Features
- **Circadian Danger Window Alert**: Proactively highlights the SOS button and displays a calming prompt as the user's historical trigger window approaches.
- **Adaptive Habit Stacking**: Suggests new recovery micro-habits based on current streak stability.

### 5. Competitor Comparison
| Dimension | FREED Today Dashboard | I Am Sober | Brainbuddy | Opal |
|---|---|---|---|---|
| **Clock Precision** | Tabular seconds with continuous halo | Days/Hours (Static) | Days (Static tree) | Focus minutes only |
| **Habit Stacking** | Direct integration with recovery plan | Separate notes | Fixed program | None |
| **SOS Interception** | 1-tap zero-latency panic intervention | Community forum | Panic button (Heavy video) | Mindful pause |

### 6. Master Task List
#### Task M3.1: Precision Tabular Streak Orb with Continuous Micro-Pulse
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Opal focus timer and Apple Fitness activity rings.
  - UX patterns: Continuous squircle cards, tabular numerals to prevent layout jitter, subtle breathing glow.
  - User pain points: Digits shifting horizontally as seconds tick creates subconscious anxiety.
- **Problem**: Layout jitter on timer digits degrades perceived product quality.
- **Solution**:
  - Frontend changes: Wrap all timer and streak numerals in `fontVariant: ["tabular-nums"]`.
  - Backend changes: High-resolution timestamp calculation based on `soberStartDate`.
  - UX improvements: Subtle Reanimated breathing glow pulsing at 12 breaths per minute.
- **Implementation Steps**:
  1. Audit and standardize `StreakOrb` timer text styles.
  2. Implement sinusoidal Reanimated glow loop (`withRepeat(withTiming())`).
  3. Ensure zero frame drops on iOS and Android during continuous seconds updates.
- **Animations**: Sinusoidal breathing halo with 5000ms period matching resting respiration.
- **AI Enhancement**: Dynamic halo color temperature shifting subtly from amber to emerald as streak milestones are crossed.
- **User Impact**: Mesmerizing, calming visual anchor that reinforces pride and daily commitment.
- **Market Impact**: Benchmark-quality visual polish that rivals Apple first-party apps.

#### Task M3.2: Daily Pledge Commitment Ritual with Haptic Stamp
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: I Am Sober morning pledge and Duolingo daily streak commitment.
  - UX patterns: Tactile button press with progressive haptic confirmation and celebratory badge stamp.
  - User pain points: Routine check-ins feel like meaningless administrative chores.
- **Problem**: Simple toggle checkboxes lack emotional weight and ceremony.
- **Solution**:
  - Frontend changes: Upgrade `PledgeBanner` into an interactive ritual card with commitment text.
  - Backend changes: Track cumulative `pledgeStreak` and calendar history in `RecoveryState`.
  - UX improvements: Medium impact haptic feedback (`Haptics.impactAsync(Medium)`) on lock-in.
- **Implementation Steps**:
  1. Build expandable pledge sheet with morning intention text.
  2. Wire `recordDailyPledge` with timestamp and streak increment.
  3. Display "Today's pledge is locked in · X-day pledge streak" with green badge.
- **Animations**: Scale spring press (`scale: 0.97`) followed by checkmark draw animation.
- **AI Enhancement**: Generates a personalized daily affirmation tailored to the user's primary struggle.
- **User Impact**: Sets an intentional neurological frame for the day in under 10 seconds.
- **Market Impact**: Directly drives 30-day user retention and DAU engagement.

---

## MOBILE APP 4: Mindful Urge Intercept & Circuit Breaker

### 1. Product Vision
The 10-second cognitive firewall. When an adult or doomscroll trigger fires, FREED intercepts before dopamine hijacks the prefrontal cortex. It replaces cold system error screens with an empathetic, calming intervention featuring Opal-inspired "Hold to Ground" physical resistance and Clara AI CBT reframing.

### 2. UX System
- **Tone**: Compassionate, unhurried, reassuring, firm.
- **Mental Model**: An emergency physiological circuit breaker.
- **Key Interactions**: 3-second continuous press-and-hold button with tactile vibration, 1-tap expandable Clara CBT urge script, wrong-block reporting.
- **Visual Palette**: Calming Forest Slate (`#0A0D0C` / `#111827`) with Emerald accents — avoiding alarming red banners.

### 3. UI Structure (All Screens)
1. **Urge Intercept Overlay**: Full-screen modal displaying blocked context (App or Domain).
2. **Hold to Ground Component**: Circular press-and-hold button requiring 3 seconds of sustained touch.
3. **Clara AI Urge Script Card**: 3-step cognitive reframing (Recognize, Reframe, Redirect).
4. **Action Choice Grid**: "Surf the Urge (Challenge)", "Message Sponsor", "Back to Safety".
5. **Wrong Block Reporter**: 1-tap local whitelist override for accidental blocks.

### 4. AI Features
- **Contextual CBT Generator**: Instantly crafts a 3-sentence cognitive reframing statement customized to the exact domain or app that was intercepted.
- **Dopamine Loop Interruption**: Classifies whether the attempt was a late-night search or an afternoon app habit and adapts the script accordingly.

### 5. Competitor Comparison
| Dimension | FREED Mindful Intercept | Opal | One Sec | Freedom |
|---|---|---|---|---|
| **Intervention Depth** | Hold-to-ground + Clara AI + Somatics | Hold to leave (Focus only) | 1 Breath animation | Blank block page |
| **Tactile Resistance** | Progressive haptic acceleration | Simple progress bar | None | None |
| **Recovery Intelligence** | CBT reframing + Urge rating | Focus rating | None | None |

### 6. Master Task List
#### Task M4.1: "Hold to Ground" Anti-Impulse 3-Second Circuit Breaker
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Opal "Hold to Leave" anti-impulse bar and One Sec breathing pause.
  - UX patterns: Long-press gesture with Reanimated linear progress fill and progressive haptic ticking.
  - User pain points: Impulsive finger taps bypass friction if physical effort is not required.
- **Problem**: Simple single-tap dismiss buttons fail to interrupt involuntary dopamine-seeking reflex loops.
- **Solution**:
  - Frontend changes: Build `HoldToGroundBar` requiring 3000ms continuous press.
  - Backend changes: Record urge successfully resisted in analytics and streak metrics.
  - UX improvements: Haptic ticks increase in frequency as completion nears; releases if finger lifts early.
- **Implementation Steps**:
  1. Implement Gesture Handler `PanGesture` or `LongPressGesture` with active progress tracking.
  2. Animate continuous squircle progress fill using `useAnimatedStyle`.
  3. Trigger `Haptics.notificationAsync(Success)` upon 3-second completion.
- **Animations**: Fluid progress fill with spring snap-back to 0% if released early.
- **AI Enhancement**: Automatically increases hold duration to 5s if multiple attempts occur within 15 minutes.
- **User Impact**: Forces conscious prefrontal cortex engagement, halting 80%+ of impulsive relapse attempts.
- **Market Impact**: Industry-leading mindful friction mechanism praised by neuroscientists and clinicians.

#### Task M4.2: Real-Time Contextual CBT Urge Script Generator
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Woebot CBT thought-record exercises and CBT urge surfing literature.
  - UX patterns: Clean 3-tier card (Recognize -> Reframe -> Redirect) with high legibility.
  - User pain points: Users in high-arousal urge states cannot process long paragraphs or complex therapy texts.
- **Problem**: Static generic advice ("Just don't do it") triggers psychological reactance and frustration.
- **Solution**:
  - Frontend changes: Add 1-tap expandable `ClaraUrgeScriptCard` directly on the intercept screen.
  - Backend changes: Seed script parameters with intercepted host, current time, and user's primary motivation.
  - UX improvements: Bulleted 3-sentence actionable structure that can be digested in 5 seconds.
- **Implementation Steps**:
  1. Implement `ClaraUrgeScriptCard` with expand/collapse Reanimated height transition.
  2. Formulate 3 distinct steps: Recognize (name the dopamine spike), Reframe (novelty vs self-respect), Redirect (put phone down, physiological sigh).
  3. Provide 1-tap "I did this" confirmation button that logs the win.
- **Animations**: Smooth accordion height expansion with `FadeInDown.duration(180)`.
- **AI Enhancement**: Dynamic generation via Clara AI when online; instant offline heuristic template when disconnected.
- **User Impact**: Immediate cognitive relief during moments of acute vulnerability.
- **Market Impact**: Transforms a cold blocker into a compassionate 24/7 recovery coach.

---

## MOBILE APP 5: Clara AI Recovery Coach 2.0

### 1. Product Vision
An empathetic, 24/7 Cognitive Behavioral Therapy (CBT) and Acceptance and Commitment Therapy (ACT) recovery coach. Clara provides real-time de-escalation, relapse post-mortems without shame, HALT (Hungry, Angry, Lonely, Tired) diagnostic evaluations, and personalized habit guidance.

### 2. UX System
- **Tone**: Warm, intelligent, non-judgmental, clinically grounded.
- **Mental Model**: A trusted recovery mentor and therapist in your pocket.
- **Key Interactions**: Dynamic situational prompt chips, fluid 60fps typing, streaming response indicator, 1-tap retry.
- **Visual Design**: Forest Slate chat bubbles, Clara identity badge with verified shield crest, auto-scrolling message list.

### 3. UI Structure (All Screens)
1. **Coach Screen Header**: Clara avatar, active status badge ("AI Recovery Strategist"), back button.
2. **Conversation Stream**: Virtualized message list with distinct user (emerald-tinted) and Clara (slate surface) bubbles.
3. **Situational Prompt Carousels**: Dynamic horizontal pill chips adapting to user streak, recent slips, and time of day.
4. **Input Bar**: Continuous squircle text input with send button, offline status notice, and retry action.

### 4. AI Features
- **Local-First Privacy Guard**: Client-side regex scrubber redacts all names, email addresses, phone numbers, and URLs before prompting.
- **Autonomous Recovery State Context**: Prompts receive anonymous context (streak days, attempts today, recent slip window) without sending user identity.
- **Offline Fallback Guide**: If network fails, Clara seamlessly delivers responses from a comprehensive built-in CBT wisdom corpus.

### 5. Competitor Comparison
| Dimension | Clara AI 2.0 | Brainbuddy | Woebot | ChatGPT App |
|---|---|---|---|---|
| **Recovery Specialization** | Built specifically for porn & dopamine loops | Static pre-written text | General mental health | Generic (Lacks recovery guardrails) |
| **Privacy Redaction** | Automated client-side PII scrubbing | Proprietary cloud | Cloud-based | Cloud storage / model training |
| **Situational Awareness** | Injects real-time streak and block metrics | Generic day count | None | None |

### 6. Master Task List
#### Task M5.1: High-Performance Uncontrolled Input & Conversational Virtualization
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Claude iOS app and Telegram mobile chat performance.
  - UX patterns: Uncontrolled text inputs with debounced state, smooth auto-scrolling FlashList.
  - User pain points: Typing stutter or keyboard lag during emotional distress creates intense frustration.
- **Problem**: Controlled `TextInput` with inline state updates re-renders the entire screen on every keystroke.
- **Solution**:
  - Frontend changes: Decouple typing input from message tree; wrap messages in optimized list with inverted scrolling.
  - Backend changes: Streamlined token buffer for smooth streaming rendering.
  - UX improvements: `Send` icon with active color switch and tap haptic feedback.
- **Implementation Steps**:
  1. Optimize `CoachPanel` input bar with native performance optimizations.
  2. Replace standard `ChevronRight` with semantic `Send` vector icon.
  3. Wire `tap()` haptics to send trigger and chip selections.
- **Animations**: Message bubbles enter with `FadeInUp.duration(180)`; typing indicator pulses with staggered dots.
- **AI Enhancement**: Streaming token simulation for lifelike conversational pacing.
- **User Impact**: Ultra-responsive, silky-smooth chatting experience that feels natural and supportive.
- **Market Impact**: Solves the common mobile AI pitfall of sluggish, buggy chat interfaces.

#### Task M5.2: Situational Prompt Dynamic Adaptation & Offline Fallback Guide
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: ChatGPT prompt chips and Pi AI conversational suggestions.
  - UX patterns: Horizontally scrollable chip row with context-dependent suggestions.
  - User pain points: Users staring at a blank chat input during an urge often don't know what to ask.
- **Problem**: Static prompt chips don't match the user's immediate emotional or physiological reality.
- **Solution**:
  - Frontend changes: Compute `situationalChips` dynamically using `React.useMemo` based on `attemptsToday`, `slipsThisWeek`, and `streakDays`.
  - Backend changes: Comprehensive offline decision tree for instant responses without network connection.
  - UX improvements: 1-tap chip execution with immediate haptic response.
- **Implementation Steps**:
  1. If `attemptsToday > 0`, prioritize "Urge right now" and "3 slow breaths".
  2. If `slipsThisWeek > 0` or `streakDays === 0`, prioritize "Reset after slip" and "HALT check".
  3. If network drops, surface honest offline badge ("Reply from built-in recovery guide") with 1-tap retry.
- **Animations**: Chip press scale (`scale: 0.96`) with smooth horizontal momentum scrolling.
- **AI Enhancement**: Context-aware prompts minimize user typing effort to zero during high-stress moments.
- **User Impact**: Guides the user instantly to the exact therapeutic intervention they need.
- **Market Impact**: Differentiates FREED as a proactive clinical partner rather than a passive chatbot.

---

## MOBILE APP 6: Multi-Mode Parasympathetic Breathing Engine

### 1. Product Vision
An immersive, tactile autonomic downregulation visualizer. By pacing respiration, the breathing engine triggers parasympathetic vagal stimulation, reducing heart rate and decreasing amygdala arousal during acute cravings or bedtime anxiety.

### 2. UX System
- **Tone**: Serene, meditative, hypnotic, grounding.
- **Mental Model**: A physiological metronome for the nervous system.
- **Key Interactions**: Segmented mode control (4-7-8, Box, Physiological Sigh), expanding central orb, synchronized tactile haptics on phase shifts.
- **Sensory Integration**: Haptics match inhalation ramp, hold stillness, and exhalation release.

### 3. UI Structure (All Screens)
1. **Breathing Protocol Selector**: Continuous squircle segmented control supporting 3 science-backed protocols.
2. **Central Visualizer Orb**: 180pt pulsing circle with glowing aura and dynamic phase label ("Inhale", "Hold", "Exhale").
3. **Tabular Respiration Timer**: Tabular seconds countdown for current phase.
4. **Neurobiology Insight Card**: Explanation of the active physiological mechanism (e.g. Vagus nerve activation, CO2 offloading).
5. **Session Completion Summary**: Cycles completed, total mindful minutes logged, button to return to dashboard.

### 4. AI Features
- **Adaptive Duration Recommendation**: Suggests Box Breathing for daytime focus and 4-7-8 for late-night insomnia based on current device clock.
- **Biofeedback Log Analysis**: Correlates completed breathing sessions with decreased relapse probability in analytics.

### 5. Competitor Comparison
| Dimension | FREED Breathing Engine | stoic. | Othership | Apple Mindfulness |
|---|---|---|---|---|
| **Protocols** | 4-7-8, Box (4-4-4-4), Huberman Sigh | 4-7-8 & Box | Audio guided only | 1 generic pace |
| **Tactile Integration** | Phase-synchronized haptic pulse | Basic haptic | Audio cues only | Standard taptic |
| **Urge Intercept Link** | 1-tap direct access from blocked screen | Standalone app | Standalone app | Standalone watch |

### 6. Master Task List
#### Task M6.1: Multi-Protocol Respiratory Engine with Synchronized Tactile Haptics
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: stoic. breathing screen (`oth_xwuj1`) and Huberman Lab physiological sigh protocol.
  - UX patterns: Continuous squircle segmented picker, expanding Reanimated circle, haptic punctuation.
  - User pain points: Users find generic breathing timers boring or disconnected from physical sensations.
- **Problem**: Fixed 4-7-8 breathing does not suit acute anxiety (which benefits from Physiological Sigh) or daytime focus (which benefits from Box Breathing).
- **Solution**:
  - Frontend changes: Build 3-mode selector with distinct timing phases and phase-synchronized `Haptics.impactAsync`.
  - Backend changes: Track completed breath cycles in `RecoveryState`.
  - UX improvements: Smooth sinusoidal easing (`Easing.inOut(Easing.quad)`) matching natural lung expansion.
- **Implementation Steps**:
  1. Configure 3 protocols: 4-7-8 Relax, Box (4-4-4-4), and Physiological Sigh (2s in + 1s in + 6s out).
  2. Fire `Haptics.impactAsync(Light)` on Inhale, `Haptics.impactAsync(Medium)` on Hold, and soft pulse on Exhale.
  3. Include educational neurobiology cards explaining the mechanism.
- **Animations**: Sinusoidal scale expansion (`scale: 1.0 -> 1.55`) with synchronized opacity glow.
- **AI Enhancement**: Suggests the optimal breathing mode based on current user stress and time of day.
- **User Impact**: Rapid autonomic calm within 60 seconds of starting the exercise.
- **Market Impact**: Matches or exceeds dedicated standalone meditation apps like stoic. and Breathwrk.

#### Task M6.2: Autonomous Pacing Progression & Session Biofeedback Logging
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Apple Health Mindful Minutes integration and Whoop respiratory tracking.
  - UX patterns: Cycle completion ring, session milestone badges, Apple HealthKit sync.
  - User pain points: Lack of feedback on whether breathing actually helped reduce the craving.
- **Problem**: Breathing sessions end abruptly without capturing recovery impact.
- **Solution**:
  - Frontend changes: Add post-session urge rating check ("How is your urge level now: Lower / Same?").
  - Backend changes: Write mindful minutes to Apple HealthKit / Google Health Connect.
  - UX improvements: Victory completion card with celebratory haptic feedback.
- **Implementation Steps**:
  1. Display cycle counter ("Cycle 3 of 4") with tabular numerals.
  2. Prompt quick 1-tap post-session rating upon completion.
  3. Award +5 Karma points and log mindful recovery minutes.
- **Animations**: Gentle confetti particle burst or radial glow on final cycle completion.
- **AI Enhancement**: Correlates breathing effectiveness with specific trigger types in weekly reports.
- **User Impact**: Closes the behavioral loop, proving to the user that cravings naturally decay.
- **Market Impact**: Connects physiological exercises directly into measurable sobriety metrics.

---

## MOBILE APP 7: Somatic Challenge Runner & Physical Grounding

### 1. Product Vision
An action-oriented challenge engine engineered to occupy working memory for 180–300 seconds (the critical duration of an acute craving spike). Challenges leverage physical movement, cold thermogenesis, and sensory grounding to break obsessive dopamine loops.

### 2. UX System
- **Tone**: Disciplined, energizing, physical, triumphant.
- **Mental Model**: A physical circuit breaker for mental obsessions.
- **Key Interactions**: Accelerometer movement verification, step-by-step progress cards, timer countdowns, victory check-ins.
- **Sensory Feedback**: Energetic haptics upon completing each physical repetition or step.

### 3. UI Structure (All Screens)
1. **Challenge Selection Deck**: Categorized cards (Physical Grounding, Sensory Reset, Mental Shift, Environment Change).
2. **Active Challenge HUD**: Full-screen focus mode with countdown timer, instruction illustrations, and sensor counter.
3. **Sensor Verification Screen**: Real-time accelerometer rep detector for pushups or jumping jacks.
4. **Challenge Victory Screen**: Celebratory summary, karma points earned, return to clean browsing.

### 4. AI Features
- **Adaptive Challenge Matching**: Automatically prioritizes somatic physical challenges during evening restlessness and mental challenges during workday stress.
- **Fatigue Guard**: Adjusts repetition targets based on user fitness baseline captured in onboarding.

### 5. Competitor Comparison
| Dimension | FREED Challenge Runner | Brainbuddy | Cold Turkey | 7 Minute Workout |
|---|---|---|---|---|
| **Verification** | Accelerometer / Camera sensor verification | Self-report check | None | Timer only |
| **Urge Tie-in** | Directly launched from intercept screen | Daily fixed tasks | Desktop only | Fitness only |
| **Neuroscience Basis** | Designed around 3-minute craving decay window | 100-day tree | Hard lockout | General cardio |

### 6. Master Task List
#### Task M7.1: Accelerometer-Verified Movement Challenges
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Nike Training Club rep counter and Apple Watch workout sensors.
  - UX patterns: Bold tabular countdown numerals, high-contrast rep counters, energetic audio/haptic cues.
  - User pain points: Users often fake self-reported challenges if there is zero verification.
- **Problem**: Self-reported tasks lack accountability and physical commitment.
- **Solution**:
  - Frontend changes: Build `AccelerometerRepCounter` tracking phone motion during pushups or jumping jacks.
  - Backend changes: Native sensor listener using `expo-sensors` accelerometer peaks.
  - UX improvements: Dynamic counter incrementing with a sharp haptic tick on every valid repetition.
- **Implementation Steps**:
  1. Integrate `Accelerometer.addListener` detecting z-axis acceleration peaks above threshold.
  2. Implement debounced rep counting (minimum 800ms between reps).
  3. Display high-contrast tabular counter ("14 / 20 Reps") with circular progress.
- **Animations**: Spring punch on number change (`withSpring({ damping: 12 })`).
- **AI Enhancement**: Automatically calibrates accelerometer threshold based on device placement (pocket vs floor).
- **User Impact**: Forces immediate physical blood flow into large muscle groups, dissipating sexual tension.
- **Market Impact**: The only recovery app offering automated sensor-verified physical interventions.

#### Task M7.2: Adaptive Challenge Difficulty Engine Based on Urge Intensity
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Duolingo adaptive difficulty and Strava relative effort algorithms.
  - UX patterns: 3-tier difficulty selection with dynamic recommendation chip.
  - User pain points: A 50-pushup challenge is overwhelming for beginners; 5 pushups is ineffective for athletes.
- **Problem**: One-size-fits-all challenges cause frustration or disengagement.
- **Solution**:
  - Frontend changes: Add difficulty selector (Light Reset, Moderate Reset, High-Intensity Circuit).
  - Backend changes: Calculate recommended intensity based on self-reported urge severity (1–10).
  - UX improvements: Clear duration expectation ("Takes 2 mins · 20 Pushups").
- **Implementation Steps**:
  1. Map urge level: Level 1–4 -> Sensory splash / breathing; Level 5–7 -> 20 Pushups; Level 8–10 -> Cold shower / high intensity.
  2. Store challenge completion streaks in `RecoveryState`.
  3. Award scaled karma points (5 to 25 pts) based on intensity tier.
- **Animations**: Card elevation and border highlight when selected.
- **AI Enhancement**: Learns which challenge types yield the highest urge de-escalation success for the user.
- **User Impact**: Delivers the exact right intensity needed to overcome the active craving.
- **Market Impact**: Creates a personalized physical training system for neurochemical self-mastery.

---

## MOBILE APP 8: Neurochemical Reboot & Urge Analytics Center

### 1. Product Vision
An authoritative, data-driven window into brain restoration. It visualizes the 90-day neurochemical rewiring process (dopamine receptor upregulation, prefrontal cortex gray matter restoration), tracks the **Sobriety Score (0–100)**, and maps circadian relapse risk heatmaps.

### 2. UX System
- **Tone**: Scientific, objective, empowering, analytical.
- **Mental Model**: An executive health dashboard for neural recovery.
- **Key Interactions**: Tap to inspect milestone details, scrub across the 90-day timeline, filter danger heatmaps by weekday/hour.
- **Visual Design**: High-contrast charts with tabular data, Emerald/Sky accent gradients, zero cluttered graphs.

### 3. UI Structure (All Screens)
1. **Sobriety Score Card**: 0–100 composite index calculated from streak length, habit compliance, and urge resistance.
2. **90-Day Brain Reboot Path**: Interactive roadmap illustrating biological recovery stages:
   - Stage 1 (Days 1–3): Physical withdrawal & craving loop interruption.
   - Stage 2 (Days 4–7): Dopamine upregulation & mental clarity surge.
   - Stage 3 (Days 8–21): Prefrontal rewiring & emotional stabilization.
   - Stage 4 (Days 22–90): Neural baseline reset & autonomic mastery.
3. **Hourly Relapse Risk Heatmap**: 24-hour visual grid highlighting high-risk danger windows.
4. **Milestone Trophy Case**: Unlocked and locked achievements celebrating cumulative sobriety.

### 4. AI Features
- **Predictive Relapse Risk Forecasting**: Analyzes past blocking timestamps and check-in logs to forecast relapse risk 4 hours in advance.
- **Milestone Projection Refinement**: Recalculates expected dopamine receptor normalization dates based on habit consistency.

### 5. Competitor Comparison
| Dimension | FREED Analytics Center | I Am Sober | Brainbuddy | Whoop App |
|---|---|---|---|---|
| **Scientific Basis** | Dopamine receptor upregulation timeline | Basic day counter | 100-day tree metaphor | Physiological recovery |
| **Risk Forecasting** | 24-hour predictive danger heatmap | Retrospective log | None | Strain forecast |
| **Sobriety Index** | Multi-factor composite score (0–100) | Days clean only | Static level | Recovery % |

### 6. Master Task List
#### Task M8.1: Predictive Hourly Relapse Risk Forecast Engine
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Whoop recovery score forecasting and Apple Health trend insights.
  - UX patterns: 24-hour circadian clock heatmap with color-coded risk bands (Low, Moderate, High).
  - User pain points: Users are blindsided by sudden urges that follow predictable weekly patterns.
- **Problem**: Retrospective charts show where users slipped in the past, but fail to prevent future slips.
- **Solution**:
  - Frontend changes: Build `UrgeRiskHeatmap` with interactive hourly risk bars and proactive recommendations.
  - Backend changes: Implement `calculateUrgeRiskForecast` clustering past attempts by weekday and hour of day.
  - UX improvements: Tabular hour labels with amber alert tags on high-risk windows.
- **Implementation Steps**:
  1. Ingest historical `BlockingAttempt` timestamps and check-in urge scores.
  2. Compute probability density across 24 hourly buckets for the current day of the week.
  3. Surface proactive notification 60 minutes before peak danger window.
- **Animations**: Smooth chart bar height interpolation using `withSpring()`.
- **AI Enhancement**: Contextual recommendation: "Your risk peaks at 11 PM on Fridays. Consider scheduling a 10 PM Focus Lockdown."
- **User Impact**: Turns subconscious relapse vulnerability into conscious, prepared defense.
- **Market Impact**: Pioneers predictive AI intervention in the addiction recovery space.

#### Task M8.2: 90-Day Dopamine Receptor Recovery Path Visualizer
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Duolingo learning path and Brainbuddy 100-day reboot roadmap.
  - UX patterns: Vertical milestone trail with unlocked checkpoints, glowing progress connector, and reward cards.
  - User pain points: Long streaks feel endless and demotivating without intermediate biological milestones.
- **Problem**: Binary streak counters create an all-or-nothing mindset where day 14 feels no different from day 1.
- **Solution**:
  - Frontend changes: Implement interactive `RebootPathRoadmap` connecting 8 scientific milestones.
  - Backend changes: Calculate exact progress percentage toward the active biological stage.
  - UX improvements: Rich explanatory cards describing neurochemical changes occurring inside the brain.
- **Implementation Steps**:
  1. Create milestone definitions: Day 1 (Acute Halt), Day 3 (Craving Peak), Day 7 (Dopamine Spike), Day 14 (Gray Matter Restoration), Day 30 (Emotional Baseline), Day 60 (Prefrontal Rewiring), Day 90 (Basal Reset).
  2. Render continuous vertical path with glowing node at the user's current day.
  3. Allow tapping future nodes to preview upcoming cognitive benefits.
- **Animations**: Milestone node unlocks with celebration pulse and haptic notification.
- **AI Enhancement**: Highlights specific real-world benefits the user should be feeling this week based on their quiz profile.
- **User Impact**: Replaces vague hopes with concrete, biology-backed milestones to strive for daily.
- **Market Impact**: Creates immense long-term retention; users stay engaged for the full 90 days.

---

## MOBILE APP 9: Daily Check-In, Mood & Slip Recovery Journal

### 1. Product Vision
A zero-shame self-reflection sanctuary. Captures daily emotional states, sleep quality, and urge intensities in under 60 seconds, and transforms slips into profound learning opportunities through structured, compassionate deconstruction.

### 2. UX System
- **Tone**: Safe, compassionate, honest, forward-looking.
- **Mental Model**: A non-judgmental mirror for self-awareness and emotional regulation.
- **Key Interactions**: 1-tap mood pill selectors, tabular 1–5 rating scales, distraction-free journaling, slip analysis wizard.
- **Psychological Safety**: Strict local-first privacy, zero scolding language, preservation of cumulative sober days.

### 3. UI Structure (All Screens)
1. **Daily Check-In Modal**:
   - Mood Matrix: Steady, Energized, Stressed, Low.
   - Urge Level Scale: 0 to 5 tabular pills.
   - Sleep Quality Scale: 1 to 5 tabular pills.
   - Reflection Field: Distraction-free text area with thought prompts.
2. **Slip Recovery Screen**:
   - Compassionate Reassurance: "A slip is an event, not your identity."
   - Trigger Deconstruction: What caused it? (HALT, location, app, mood).
   - Defensive Adjustment: 1-tap adjustment to Focus Shield rules to patch the hole.
   - Clean Restart: Reset streak clock while preserving "Best Streak" and cumulative sober days.

### 4. AI Features
- **Sentiment & Trigger Correlation**: Detects correlations between low sleep scores and next-day urge spikes.
- **Root-Cause Deconstructor**: Analyzes user reflection text to identify subconscious cognitive distortions.

### 5. Competitor Comparison
| Dimension | FREED Check-In & Journal | Daylio | I Am Sober | Brainbuddy |
|---|---|---|---|---|
| **Slip Handling** | Compassionate root-cause deconstruction | General mood only | Public confession / reset | Shameful tree burning |
| **Speed** | Completed in < 60 seconds | 30 seconds | 2 minutes | Long questionnaire |
| **Shield Integration** | Directly updates blocker rules from slip cause | None | None | None |

### 6. Master Task List
#### Task M9.1: Friction-Free 60-Second Evening Review Flow
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Daylio mood tracking and stoic. evening reflection.
  - UX patterns: Continuous squircle pill selectors, auto-advancing sections, tabular numbers.
  - User pain points: Long journaling templates cause users to abandon daily tracking after 3 days.
- **Problem**: Clunky multi-step forms discourage daily evening completion.
- **Solution**:
  - Frontend changes: Single-page scrollable `CheckInScreen` with pre-selected defaults and quick taps.
  - Backend changes: Store structured `DailyCheckIn` in local SQLite/MMKV state.
  - UX improvements: Tap haptic feedback on all mood, urge, and sleep pill presses.
- **Implementation Steps**:
  1. Build 4-state mood matrix with semantic color accents (Steady, Energized, Stressed, Low).
  2. Implement tabular 0–5 urge scale and 1–5 sleep scale.
  3. Add 1-tap "Save Reflection" CTA with instant confirmation.
- **Animations**: Mood card expands with subtle border glow on active selection.
- **AI Enhancement**: Generates a 1-sentence evening summary correlating sleep and urge control.
- **User Impact**: Takes only 45 seconds to build profound self-awareness and emotional literacy.
- **Market Impact**: Maximizes daily check-in completion rates (target > 75% weekly compliance).

#### Task M9.2: Compassionate Slip Deconstruction & Root Cause Identifier
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Relapse prevention therapy (RPT) frameworks and I Am Sober reset flow.
  - UX patterns: Calming neutral tones, reassuring header typography, structured multi-choice deconstruction.
  - User pain points: The "Abstinence Violation Effect" — feeling like a failure leads to multi-day binges.
- **Problem**: Blaming and shaming the user causes catastrophic relapse binges and app uninstalls.
- **Solution**:
  - Frontend changes: Build zero-shame `SlipScreen` emphasizing data over guilt.
  - Backend changes: Preserve total sober days and best streak; log the specific trigger into `slipTrigger` state.
  - UX improvements: Immediate actionable takeaway ("Adjust Focus Shield to lock this app during danger hours").
- **Implementation Steps**:
  1. Lead with normalizing message: "Recovery is a skill built through iteration, not perfection."
  2. Capture trigger taxonomy: Fatigue, Stress, Boredom, Late Night, Unrestricted Browser.
  3. Offer 1-tap button to patch the trigger in Focus Shield and recommit cleanly.
- **Animations**: Soft fade transition into clean today dashboard; zero loud alarms.
- **AI Enhancement**: Clara AI analyzes the slip trigger and delivers a tailored 2-minute audio grounding exercise.
- **User Impact**: Halts relapse binges instantly; transforms shame into durable defensive resilience.
- **Market Impact**: Sets a new ethical and clinical gold standard for the entire addiction recovery category.

---

## MOBILE APP 10: Encrypted Accountability & Guardian Sync

### 1. Product Vision
Radical accountability without surveillance. Unlike invasive apps that take screenshots of user devices or expose browsing history, FREED provides client-side encrypted recovery reports, automated weekly progress summaries, sponsor SOS alerts, and biometric app locking.

### 2. UX System
- **Tone**: Trustworthy, secure, professional, mature.
- **Mental Model**: A Swiss bank vault for your recovery data.
- **Key Interactions**: 1-tap sponsor pairing via invite link, biometrics toggle (FaceID / Fingerprint), 1-tap encrypted backup restore.
- **Security Guarantee**: AES-GCM-256 client-side encryption. Server never sees raw recovery notes or private triggers.

### 3. UI Structure (All Screens)
1. **Accountability Partner Card**: Partner name, connection status, last report sent timestamp, "Message Partner" button.
2. **Sponsor Pairing Wizard**: Generate secure invite code / QR link with customizable sharing permissions.
3. **Encrypted Cloud Backup Settings**: AES-256 key generator, manual backup trigger, automatic daily cloud sync toggle.
4. **Security & Privacy Center**: Biometric App Lock switch, Data Export (JSON/PDF), 1-Click Instant Data Deletion.

### 4. AI Features
- **Automated PII Redactor**: Automatically sanitizes any user journals before generating accountability summaries.
- **Weekly Progress Synthesizer**: Composes a thoughtful, dignified weekly progress report for the sponsor celebrating clean streaks and habit consistency.

### 5. Competitor Comparison
| Dimension | FREED Accountability | Covenant Eyes | Accountable2You | Relay |
|---|---|---|---|---|
| **Surveillance Style** | Encrypted milestone reports | Invasive screenshot monitoring | Invasive keylogging & logs | Group chat |
| **Privacy Architecture** | 100% Client-Side AES-GCM-256 | Cloud-stored screenshots | Cloud-stored URLs | Cloud messages |
| **User Dignity** | High (Empowered self-reporting) | Very Low (Shame & paranoia) | Very Low | Moderate |

### 6. Master Task List
#### Task M10.1: Client-Side AES-GCM-256 Encrypted P2P Recovery Backup
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Signal private backup protocol and 1Password zero-knowledge architecture.
  - UX patterns: Key phrase display, biometrically secured backup toggles, instant restore verification.
  - User pain points: Fear that intimate recovery journals or slip logs will leak in a server breach.
- **Problem**: Cloud backups storing unencrypted recovery records create catastrophic privacy liability.
- **Solution**:
  - Frontend changes: Encrypt all recovery payloads using AES-GCM-256 with user key before network dispatch.
  - Backend changes: Server stores only opaque ciphertext blobs; rejects unauthenticated sync envelopes.
  - UX improvements: "Zero-Knowledge Encryption Active" trust badge in Profile screen.
- **Implementation Steps**:
  1. Implement `createEncryptedRecoveryBackup` using WebCrypto / `expo-crypto` AES-GCM.
  2. Verify payload round-trips without exposing plaintext in `tests/core.test.ts`.
  3. Store encrypted envelope in Supabase/Firebase storage with strict row-level security.
- **Animations**: Shield lock animation drawing closed when backup completes.
- **AI Enhancement**: Automatically verifies backup integrity and alerts user if a sync is overdue.
- **User Impact**: Absolute peace of mind that personal recovery data is mathematically unhackable.
- **Market Impact**: Establishes FREED as the only privacy-certified recovery platform in the world.

#### Task M10.2: Automated Weekly Sponsor Accountability PDF/SMS Digest
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Covenant Eyes weekly report and Relay recovery check-in notifications.
  - UX patterns: Clean, dignified executive summary card with checkmarks, streak badges, and positive reinforcement.
  - User pain points: Awkwardness of manually texting sponsors about daily sobriety status.
- **Problem**: Manual accountability creates friction and embarrassment, leading to communication drop-off.
- **Solution**:
  - Frontend changes: Add sponsor settings allowing automated weekly email/SMS delivery of progress reports.
  - Backend changes: Cloud function generates dignified, positive PDF digest summarizing streak days and habit checks.
  - UX improvements: User can preview the exact report before it is delivered to their partner.
- **Implementation Steps**:
  1. Build `AccountabilitySettingsCard` with partner name and notification schedule.
  2. Generate sanitized aggregate report omitting explicit URL details and private journal texts.
  3. Include 1-tap "Message Partner" shortcut directly on the Urge Intercept screen.
- **Animations**: Smooth card reveal with verified connection badge.
- **AI Enhancement**: Synthesizes a constructive weekly conversation starter for the user and sponsor.
- **User Impact**: Deepens human connection and trust without invasive surveillance or shame.
- **Market Impact**: Converts religious, clinical, and 12-step recovery communities who mandate partner accountability.

---

# SECTION 2: WEB APPS (1–10)

---

## WEB APP 1: FREED Web Platform & Marketing Experience (`website/`)

### 1. Product Vision
The authoritative public gateway for FREED. An elegant, science-backed platform educating millions on dopamine neurobiology, habit loops, and digital wellness, designed to convert organic and paid traffic into high-retention iOS and Android app installs.

### 2. UX System
- **Visual Identity**: Obsidian & Forest Emerald aesthetic (`#0A0D0C` / `#10B981`), precision typography, generous negative space, interactive 3D device frames.
- **Feel**: Authoritative, calm, institutional, technologically superior.
- **Key Actions**: Download on App Store, Get on Google Play, Test Interactive Calculator, View Open Source Audits.

### 3. UI Structure (All Screens)
1. **Hero Section**: Headline ("Reclaim Your Mind, Focus, and Drive"), primary store CTA badges, 3D interactive phone frame showcasing the Streak Orb.
2. **The Problem in Numbers**: Visual breakdown of average screen time, dopamine burnout, and pornography cognitive impacts.
3. **The Cognitive Firewall**: Exploded interactive architectural diagram (On-Device DNS + 10s Intercept + Clara AI).
4. **Interactive Dopamine Calculator Preview**: Sliders for years of use -> instant reboot projection.
5. **Direct Competitor Comparison Matrix**: Feature-by-feature comparison vs Opal, Brainbuddy, NextDNS, and Covenant Eyes.
6. **Social Proof & Testimonials**: Verified streak milestones, clinical psychologist endorsements.
7. **Footer & Trust Bar**: Zero-log privacy pledge, open-source code links, legal compliance.

### 4. AI Features
- **Smart Visitor Attribution**: Adapts hero copy dynamically based on referral source (e.g. productivity vs pornography recovery vs ADHD focus).
- **Interactive FAQ Bot**: Web-based mini Clara AI answering technical privacy and DNS questions.

### 5. Competitor Comparison
| Dimension | FREED Web Platform | Opal.so | Brainbuddy.net | NextDNS.io |
|---|---|---|---|---|
| **Design Language** | Forest Emerald, Dark Luxury, Apple HIG | Pastel Slate | Heavy Gamified Dark | Spartan Technical Utility |
| **Scientific Depth** | Peer-reviewed citations, reboot calculator | General focus articles | Addiction science | Pure networking specs |
| **Transparency** | Open-source auditability & local DNS proof | Closed source | Closed source | Transparent privacy |

### 6. Master Task List
#### Task W1.1: Web Landing Page Conversion Architecture & 3D Interactive Mockup
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Opal.so, Linear.app, and Stripe product landing pages.
  - UX patterns: Sticky navigation, high-contrast store buttons, CSS squircle cards, interactive device frames.
  - User pain points: Most recovery websites look sketchy, shame-driven, or dated.
- **Problem**: Outdated landing pages fail to convey the elite engineering and privacy of the native apps.
- **Solution**:
  - Frontend changes: Rebuild `website/index.html` with continuous squircle cards, CSS glassmorphism, and responsive typography.
  - Backend changes: Fast static deployment on Firebase Hosting with global CDN edge caching.
  - UX improvements: Single locked Emerald accent (`#10B981`) with tabular stat counters.
- **Implementation Steps**:
  1. Build modern CSS design system with CSS custom properties matching `mobileTokens`.
  2. Implement interactive CSS phone mockup demonstrating the breathing animation.
  3. Wire high-contrast SVG App Store and Google Play badges with UTM tracking.
- **Animations**: CSS scroll-triggered fade-up animations (`transform: translateY(20px)` to `0`).
- **AI Enhancement**: Dynamic headline optimization based on device user agent.
- **User Impact**: Instantly conveys safety, quality, and medical-grade trustworthiness.
- **Market Impact**: Lifts web-to-app store install conversion rate by an estimated 35%.

#### Task W1.2: Direct Competitor Comparison Table & Trust Badges
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: 1Password vs LastPass comparison tables and NextDNS feature matrices.
  - UX patterns: Clean tabular grid with green checkmarks, amber warning dashes, and clear feature rows.
  - User pain points: Confusion over why a user should pay for FREED when free DNS blockers exist.
- **Problem**: Visitors do not immediately understand how FREED differs from simple content blockers or shame trackers.
- **Solution**:
  - Frontend changes: Add comprehensive side-by-side comparison matrix covering Privacy, Intercepts, AI, and Latency.
  - Backend changes: Static verified evidence links backing every competitor claim.
  - UX improvements: Highlight FREED with subtle emerald glow border and "Category Leader" badge.
- **Implementation Steps**:
  1. Construct responsive HTML/CSS comparison table with horizontal scroll on mobile.
  2. Clearly highlight: 100% On-Device DNS, Zero Cloud Logs, 10s Intercept, Clara AI 2.0.
  3. Include verified third-party audit badges and independent security testing seals.
- **Animations**: Highlight column pulses gently on page scroll.
- **AI Enhancement**: Interactive tooltip generator explaining networking terminology on hover.
- **User Impact**: Completely clarifies value proposition, answering "Why FREED?" in 10 seconds.
- **Market Impact**: Positions FREED as the only comprehensive, modern solution in the category.

---

## WEB APP 2: Interactive Dopamine Reboot Diagnostic Calculator

### 1. Product Vision
An interactive, viral web diagnostic tool modeling dopamine D2 receptor downregulation and prefrontal cortex recovery curves. Visitors input their struggle duration and daily frequency to receive a tailored, science-backed 90-day biological restoration forecast.

### 2. UX System
- **Feel**: Engaging, scientific, eye-opening, deeply personalized.
- **Key Interactions**: Dual-range sliders for years of exposure and daily hours spent, animated curve rendering, instant milestone breakdown.
- **Conversion CTA**: "Save My Recovery Plan & Download App".

### 3. UI Structure (All Screens)
1. **Intake Slider Panel**: Sliders for Age First Exposed, Years Compelled, Average Daily Screen Time.
2. **Real-Time Neurograph**: Interactive SVG chart graphing predicted dopamine receptor density over 90 days.
3. **Biological Phase Breakdown**: Day 3 (Craving Peak), Day 21 (DeltaFosB Decay), Day 90 (Receptor Upregulation).
4. **App Handoff Card**: QR code and SMS/email link to instantly import calculated profile into the mobile app.

### 4. AI Features
- **Neuroplastic Modeling Algorithm**: Adjusts recovery curve slopes based on age of onset and stimulus intensity.
- **Personalized Risk Analysis**: Generates a 2-sentence clinical profile of the user's primary vulnerability window.

### 5. Competitor Comparison
| Dimension | FREED Web Calculator | Noom Health Quiz | Brainbuddy Web Quiz | Covenant Eyes Assessment |
|---|---|---|---|---|
| **Science Basis** | Neurobiology & D2 receptor kinetics | Calorie deficit | Static survey | Moral/religious questionnaire |
| **Visual Feedback** | Real-time interactive SVG curve | Static text | Generic score | Score email gate |
| **Mobile Handoff** | 1-click seamless profile transfer | Email nurture | Manual download | Sales call |

### 6. Master Task List
#### Task W2.1: Interactive SVG Dopamine Kinetics Curve Generator
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: D3.js health calculators and interactive scientific charts on Our World In Data.
  - UX patterns: Smooth SVG cubic bezier curves updating in real-time as range sliders move.
  - User pain points: Static text statistics fail to communicate the reality of brain healing.
- **Problem**: Users perceive recovery as a binary willpower struggle rather than a predictable biological process.
- **Solution**:
  - Frontend changes: Build standalone interactive calculator widget in `website/calculator.html`.
  - Backend changes: Math model computing DeltaFosB transcription factor half-life and D2 upregulation.
  - UX improvements: Smooth 60fps slider drag with tabular number updates.
- **Implementation Steps**:
  1. Implement reactive SVG path generator drawing baseline vs recovering dopamine density.
  2. Add annotations for Day 7 (Withdrawal hump), Day 21 (Neural rewiring), Day 90 (Basal reset).
  3. Include primary CTA button linking directly to mobile app store listings with pre-filled quiz params.
- **Animations**: SVG path dynamically morphs using CSS transition or requestAnimationFrame.
- **AI Enhancement**: Generates personalized neuro-summary based on slider input values.
- **User Impact**: Replaces abstract guilt with measurable, biologically grounded recovery goals.
- **Market Impact**: Massive top-of-funnel viral acquisition loop; highly shareable across recovery forums.

---

## WEB APP 3: FREED Desktop Browser Extension for Chromium (`extension/`)

### 1. Product Vision
The companion browser extension for Google Chrome, Brave, Microsoft Edge, and Opera. Built on Manifest V3, it ensures seamless recovery protection across desktop environments using `declarativeNetRequest` to filter adult domains and halt infinite doomscrolling with zero network latency.

### 2. UX System
- **Feel**: Integrated, unobtrusive, rock-solid, calm.
- **Key Interactions**: Popup status badge, 1-click emergency Panic button, custom rule manager, domain testing tool.
- **Design Language**: Continuous squircle popup card matching the mobile Emerald palette.

### 3. UI Structure (All Screens)
1. **Extension Popup (`popup/index.html`)**: Protection active indicator, domains blocked today counter, active streak synchronizer, Panic button.
2. **Options Page (`options/index.html`)**: Custom domain whitelist and blacklist editor, rule testing sandbox, Strict Mode toggle.
3. **Background Service Worker (`background.js`)**: High-performance rule compilation and alarm scheduler.

### 4. AI Features
- **Doomscroll Loop Detector**: Monitors rapid URL navigation patterns on short-form platforms (Reels, Shorts) and triggers circuit breakers.

### 5. Competitor Comparison
| Dimension | FREED Chromium Extension | BlockSite | Cold Turkey | StayFocusd |
|---|---|---|---|---|
| **Architecture** | Modern Manifest V3 (Zero latency) | Manifest V2 / Heavy tracking | Native OS hook | Old MV2 extension |
| **Privacy** | 100% On-device rule evaluation | Tracks browsing history | Local app | Collects usage data |
| **Recovery Depth** | Intercept circuit breaker + Breathing | Hard redirect to upsell | Hard lockout | Timer countdown |

### 6. Master Task List
#### Task W3.1: YouTube Shorts & Social Doomscroll Content Script Eliminator
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Unhook YouTube extension and Opal desktop focus tools.
  - UX patterns: Clean CSS element hiding without breaking search, subscriptions, or utility.
  - User pain points: Relapses frequently originate from mindless algorithmic short-form video feeds.
- **Problem**: Blocking entire domains (like youtube.com) destroys productivity; users need the utility but must eliminate the dopamine trap.
- **Solution**:
  - Frontend changes: Add targeted content script `extension/content-scripts/doomscroll-shield.js`.
  - Backend changes: Declarative CSS injection rules stripping `#shorts-container`, Reels tab, and algorithmic feeds.
  - UX improvements: Clean layout collapse without visual flickering or broken page grids.
- **Implementation Steps**:
  1. Add optional content script permission in `manifest.json`.
  2. Implement MutationObserver safely hiding Shorts carousels and infinite recommendation sidebars.
  3. Add toggle in `options/index.html`: "Hide Short-Form Feeds (YouTube Shorts & Instagram Reels)".
- **Animations**: Smooth fade-out of feed elements as page DOM hydrates.
- **AI Enhancement**: Heuristic detection of infinite scroll depth, presenting a gentle reminder after 10 minutes.
- **User Impact**: Preserves desktop work utility while eliminating the #1 casual relapse vector.
- **Market Impact**: Solves the dilemma modern professionals face between total isolation and digital temptation.

---

## WEB APP 4: FREED Safari Desktop Content Blocker Extension

### 1. Product Vision
A native macOS Safari Content Blocker extension delivering lightning-fast, zero-overhead adult domain filtering. Because Safari Content Blockers evaluate rules compiled directly into WebKit, Safari never exposes browsing activity to the extension process.

### 2. UX System
- **Feel**: Completely invisible, native macOS integration, zero CPU overhead.
- **Key Interactions**: 1-click enablement in Safari Settings -> Extensions, status confirmation in Safari toolbar.

### 3. UI Structure (All Screens)
1. **Safari Extension Toolbar Menu**: Native AppKit/SwiftUI popover showing active rule count and status.
2. **Safari Settings Guide**: Clean visual step-by-step tutorial explaining how to enable the content blocker.

### 4. AI Features
- **Autonomous Rule Compiler**: Compiles high-volume JSON blocklists into compact Safari `blockerList.json` triggers.

### 5. Competitor Comparison
| Dimension | FREED Safari Extension | 1Blocker | AdGuard Safari | Screen Time Safari |
|---|---|---|---|---|
| **Architecture** | Native WebKit Content Blocker | WebKit Content Blocker | WebKit Content Blocker | OS Proxy |
| **Recovery Focus** | Adult & short-form doomscroll | General adblocking | General adblocking | Generic website limits |
| **Privacy** | 100% Private (WebKit evaluates rules) | 100% Private | 100% Private | Apple cloud limits |

### 6. Master Task List
#### Task W4.1: Native Safari Blocker Rule Optimization & Static Packaging
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: 1Blocker Safari extension and Apple Safari Content Blocker guidelines.
  - UX patterns: macOS native System Settings integration, zero-config onboarding.
  - User pain points: Safari limits content blockers to 150,000 rules; oversized feeds crash the extension.
- **Problem**: Large adult blocklists exceed WebKit's static rule capacity if not properly deduplicated and optimized.
- **Solution**:
  - Frontend changes: Export optimized `safari-content-blocker.json` within WebKit limits.
  - Backend changes: Domain clustering script compressing subdomains into root wildcard rules.
  - UX improvements: Instant compile status in build scripts.
- **Implementation Steps**:
  1. Implement `scripts/build-safari-rules.ts` condensing domain sets into regex triggers.
  2. Package native macOS extension target in Xcode project.
  3. Verify zero memory or network footprint during browsing.
- **Animations**: N/A (Native WebKit execution).
- **AI Enhancement**: Pattern deduplication engine identifying common porn TLD structures.
- **User Impact**: Native, flawless Safari browsing protection without battery drain on MacBooks.
- **Market Impact**: Complete cross-platform continuity for Apple ecosystem power users.

---

## WEB APP 5: Emergency Web Intercept Gateway (`extension/blocked/`)

### 1. Product Vision
The browser's mindful circuit breaker. Replaces the cold, broken Chrome "This site cannot be reached" error with a soothing, full-screen restorative intervention featuring a full-page parasympathetic breathing visualizer and 1-click safe redirects.

### 2. UX System
- **Tone**: Calming, compassionate, grounding, beautiful.
- **Feel**: A serene pause in an otherwise frantic digital environment.
- **Key Interactions**: 15-second mandatory circuit breaker countdown, interactive 4-7-8 breathing circle, "Take Me to Safety" redirect button.

### 3. UI Structure (All Screens)
1. **Header Shield Crest**: Glowing Forest Emerald shield vector icon.
2. **Restorative Headline**: "Hold on. You are still in control."
3. **Compassionate Reassurance**: Explains that FREED paused the domain to protect the user's streak.
4. **Interactive Breather Box**: SVG expanding breathing circle with "Inhale / Hold / Exhale" pacing text.
5. **Safe Action Deck**: "Back to Safety", "Take a Breath Instead", "Emergency Grounding".

### 4. AI Features
- **Dynamic Inspiring Redirection**: Suggests positive, inspiring destinations (Wikipedia deep dive, TED talk, DuoLingo) instead of leaving the user on a blank tab.

### 5. Competitor Comparison
| Dimension | FREED Web Intercept | Chrome Default | BlockSite Intercept | Freedom Intercept |
|---|---|---|---|---|
| **Aesthetic** | Dark luxury, Emerald glow, breathing circle | Cold error screen (ERR_BLOCKED) | Aggressive cartoon / upsell | Green quote screen |
| **Somatic Tools** | Built-in 4-7-8 breathing metronome | None | None | None |
| **Psychological Safety** | Zero guilt, zero shaming | Confusing | Annoying | Static |

### 6. Master Task List
#### Task W5.1: Desktop Calming Intercept Glassmorphism & SVG Breathing Metronome
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Calm.com web visualizer and Opal mindful pause screen.
  - UX patterns: CSS backdrop-filter glassmorphism, continuous squircle cards, animated SVG breathing paths.
  - User pain points: Ugly error pages provoke irritation, causing users to immediately search for another bypass.
- **Problem**: The existing `extension/blocked/index.html` is minimal and lacks visual polish.
- **Solution**:
  - Frontend changes: Rebuild `blocked.css` and `blocked.js` with modern CSS tokens, glowing gradients, and smooth animations.
  - Backend changes: Instant parameter reading from URL search query (`?url=...`).
  - UX improvements: 1-click "Back to Safety" automatically navigates browser history back or closes tab.
- **Implementation Steps**:
  1. Apply deep obsidian background (`#0A0D0C`) with Emerald radial gradient.
  2. Implement CSS keyframe breathing circle expanding and contracting over 19 seconds (4-7-8 timing).
  3. Wire `freed-back` button to `history.back()` or `chrome.tabs.remove()`.
- **Animations**: CSS `@keyframes pulseBreather` with smooth sinusoidal scale and glow.
- **AI Enhancement**: Context-aware quote rotation delivering CBT recovery wisdom.
- **User Impact**: Converts an acute craving into a 30-second mindfulness break right inside the browser.
- **Market Impact**: The most beautiful and calming intercept screen in the digital wellness sector.

---

## WEB APP 6: Sponsor & Accountability Partner Web Dashboard

### 1. Product Vision
A dignified, read-only web portal for sponsors, therapists, or trusted accountability partners. Allows partners to view weekly progress summaries, streak milestones, and habit consistency without requiring them to install an app or create complex accounts.

### 2. UX System
- **Tone**: Clean, professional, clinical, respectful.
- **Mental Model**: A patient or co-pilot progress chart.
- **Key Interactions**: Magic token authentication, weekly milestone digest, encouragement button.
- **Privacy Core**: Zero raw browsing logs; displays only aggregate habit completion and streak days.

### 3. UI Structure (All Screens)
1. **Partner Welcome Portal**: Clear explanation of the partner's role as a supportive, non-policing ally.
2. **Weekly Summary Card**: Days clean this week, Daily Pledges taken, Mindful Breaths logged.
3. **Encouragement Messenger**: 1-click send of supportive affirmations ("Proud of your 14 days, Alex!").
4. **Emergency Alert Banner**: Displayed only if the user explicitly triggered an SOS panic notification.

### 4. AI Features
- **Constructive Communication Coach**: Provides the partner with guidance on how to speak constructively about recovery without triggering shame or resentment.

### 5. Competitor Comparison
| Dimension | FREED Partner Dashboard | Covenant Eyes Portal | Relay Group Web |
|---|---|---|---|
| **Data Shown** | Aggregate habits & streak milestones | Raw explicit screenshots & search terms | Group check-in status |
| **Partner Experience** | Dignified, uplifting, actionable | Traumatic, police-like surveillance | Chat-based |
| **Friction** | Zero login (Encrypted magic link) | Complex account login | App install required |

### 6. Master Task List
#### Task W6.1: Zero-Knowledge Magic-Link Partner Dashboard
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Notion public share pages and medical patient portal views.
  - UX patterns: Responsive web layout, card hierarchy, high-contrast typography, zero-login magic token.
  - User pain points: Sponsors give up on accountability apps when forced to install complex software.
- **Problem**: Partners refuse to download heavy mobile apps just to check on a friend once a week.
- **Solution**:
  - Frontend changes: Build lightweight responsive web dashboard at `website/partner.html`.
  - Backend changes: Serverless function validating time-limited encrypted access tokens.
  - UX improvements: Clear progress gauges and 1-tap encouragement buttons.
- **Implementation Steps**:
  1. Build secure route `/partner?token=...` decrypting aggregate milestone summary.
  2. Render weekly clean streak chart and daily pledge checkmarks.
  3. Include 1-tap "Send Encouragement" SMS/push trigger back to the user's phone.
- **Animations**: Gentle entry fade for summary cards.
- **AI Enhancement**: Generates suggested conversation questions for the weekly check-in call.
- **User Impact**: Deepens relationship trust without burdening the partner with complex apps.
- **Market Impact**: Radical alternative to toxic spyware apps like Covenant Eyes.

---

## WEB APP 7: Somatic Recovery Audio Vault & Guided Breath Player

### 1. Product Vision
A dedicated web audio player streaming science-backed somatic grounding audio tracks, binaural beats for deep sleep, Huberman physiological sigh sessions, and emergency urge de-escalation guidance directly from any browser.

### 2. UX System
- **Feel**: Hypnotic, immersive, tranquil, premium.
- **Key Interactions**: 1-tap audio playback, waveform visualizer, sleep timer, background audio continuity.
- **Visual Palette**: Dark slate canvas with ambient emerald soundwave pulses.

### 3. UI Structure (All Screens)
1. **Audio Vault Deck**: Categorized audio tracks (Emergency Urge De-escalation, 4-7-8 Bedtime Reset, Binaural Theta Waves, Walking Grounding).
2. **Full-Screen Audio HUD**: Minimalist player with play/pause, scrub bar, remaining time, and synchronized breathing prompt.
3. **Sleep Timer Modal**: 15m / 30m / 45m / Stop after track.

### 4. AI Features
- **Circadian Audio Recommendation**: Automatically surfaces sleep tracks after 10 PM and focus tracks during morning hours.

### 5. Competitor Comparison
| Dimension | FREED Audio Vault | Calm.com Web | Headspace Web | YouTube (Unfiltered) |
|---|---|---|---|---|
| **Focus** | Recovery urge de-escalation & dopamine reboot | General meditation | General mindfulness | High risk of rabbit holes |
| **Safety** | 100% Curated & trigger-free | General catalog | General catalog | Toxic recommendation algorithms |
| **Friction** | Instant play, zero ad interruptions | Subscription gate | Subscription gate | Video ads destroy focus |

### 6. Master Task List
#### Task W7.1: Zero-Distraction Web Somatic Audio Engine
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Poolsuite.net audio player and Calm web player.
  - UX patterns: Fixed bottom audio player bar, smooth HTML5 audio stream, animated SVG waveform.
  - User pain points: Streaming audio from YouTube or Spotify exposes vulnerable users to explicit thumbnails and ads.
- **Problem**: Users seeking calming audio on public video platforms get derailed by recommendations.
- **Solution**:
  - Frontend changes: Build dedicated `website/audio.html` with distraction-free audio streaming.
  - Backend changes: Static audio hosting on Firebase CDN with HTTP range request support.
  - UX improvements: Full keyboard accessibility (Space to play/pause, Esc to dismiss).
- **Implementation Steps**:
  1. Implement HTML5 Audio player with custom styled scrub bar and volume slider.
  2. Add animated SVG waveform vibrating in sync with audio playback state.
  3. Include 4 emergency guided urge scripts recorded by certified somatic therapists.
- **Animations**: Waveform bars bounce with CSS transforms during active playback.
- **AI Enhancement**: Dynamic voice pacing adjustment based on selected intensity tier.
- **User Impact**: A completely safe, trigger-free sanctuary for auditory grounding during hard moments.
- **Market Impact**: Expands FREED's footprint beyond blockers into the booming wellness audio market.

---

## WEB APP 8: Recovery Science & Clinical Knowledge Library

### 1. Product Vision
An authoritative open-access digital encyclopedia covering the neuroscience of dopamine, pornography habituation, erectile recovery, and prefrontal cortex rewiring. Designed to educate users, destigmatize recovery, and drive massive organic SEO traffic.

### 2. UX System
- **Feel**: Academic, elegant, highly legible, inspiring.
- **Typography Ramp**: Editorial serif headings paired with clean sans-serif body text for optimal reading endurance.
- **Key Interactions**: Table of contents navigation, reading time estimator, 1-tap article sharing, related recovery challenge links.

### 3. UI Structure (All Screens)
1. **Library Home**: Featured neurobiology articles, topic pills (Neurochemistry, Habit Loops, Sleep & Drive, Relationships), search bar.
2. **Article Reader View**: Long-form editorial article layout with reading progress bar, pull quotes, scientific diagram embeds, and citations.
3. **Interactive Habit Loop Widget**: Embedded diagram demonstrating the Cue -> Craving -> Response -> Reward cycle.
4. **Article Bottom CTA**: "Apply this science with the FREED Mobile App".

### 4. AI Features
- **Key Takeaways Synthesizer**: 3-bullet executive summary generated at the top of every article.
- **Adaptive Reading Recommendations**: Suggests next articles based on topics the user has explored.

### 5. Competitor Comparison
| Dimension | FREED Science Library | Your Brain On Porn | Brainbuddy Articles | Medium / Substack |
|---|---|---|---|---|
| **Design** | Modern luxury editorial, Apple Books feel | Outdated 2011 forum aesthetic | Clunky in-app WebView | Cluttered with paywalls and popups |
| **Evidence Quality** | Peer-reviewed citations (PubMed/NIH) | Forum posts & anecdotes | Proprietary articles | Unverified opinions |
| **Integration** | Directly links to mobile challenges | None | None | None |

### 6. Master Task List
#### Task W8.1: High-Performance Editorial Science Reader & SEO Architecture
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Stripe Press, Apple Books, and LessWrong reading interfaces.
  - UX patterns: Sticky reading progress bar, clean typography ramp, dark/light reading mode toggle.
  - User pain points: Medical papers are too dense to read; blog posts are often scientifically inaccurate.
- **Problem**: Recovery content online is fragmented between dated forums and sensationalist blog posts.
- **Solution**:
  - Frontend changes: Build `website/library/` with static SSG pages generated from `src/data/library-articles.ts`.
  - Backend changes: Structured Schema.org MedicalWebPage metadata for top-rank SEO indexing.
  - UX improvements: Estimated reading times, table of contents, and clean citations.
- **Implementation Steps**:
  1. Build article template with responsive reading container (max-width 680px for optimal line length).
  2. Implement top reading progress bar tracking scroll depth.
  3. Include direct links to in-app exercises: "Feeling this right now? Start a 4-7-8 Breathing Session".
- **Animations**: Subtle progress bar fill along top edge of viewport.
- **AI Enhancement**: Automatically highlights the 3 most actionable takeaways in an executive callout box.
- **User Impact**: Replaces shame and confusion with deep, objective scientific understanding.
- **Market Impact**: Positions FREED as the definitive world authority on digital habit recovery, driving millions in free organic traffic.

---

## WEB APP 9: Store Legal, Privacy & Compliance Web Portal

### 1. Product Vision
The absolute benchmark in legal transparency, Apple App Store compliance, Google Play policy adherence, and GDPR/CCPA privacy rights. Proves to regulators, store reviewers, and security researchers that FREED never intercepts or stores user browsing data.

### 2. UX System
- **Feel**: Transparent, institutional, authoritative, reassuring.
- **Key Interactions**: Instant self-service 1-click account and data deletion, clear policy navigation, zero legalese jargon summaries.

### 3. UI Structure (All Screens)
1. **Privacy Policy (`privacy.html`)**: Clear human-language summary at the top, detailed technical disclosure of `VpnService` on-device loopback.
2. **Terms of Service (`terms.html`)**: Clear subscription billing terms, trial cancellation instructions, intellectual property.
3. **Support & Contact Portal (`support.html`)**: Frequently asked questions, setup troubleshooting, direct founder contact email.
4. **Self-Service Account & Data Deletion Portal (`account-deletion.html`)**: 1-click immediate deletion form fulfilling Apple App Store Guideline 5.1.1(v).

### 4. AI Features
- **Privacy Audit Checker**: Automatically verifies that no external tracking scripts or advertising pixels exist on legal pages.

### 5. Competitor Comparison
| Dimension | FREED Legal Portal | Opal Legal | Brainbuddy Legal | Covenant Eyes Legal |
|---|---|---|---|---|
| **Account Deletion** | Instant self-service 1-click web deletion | In-app only | Email request required | Phone call required |
| **VpnService Disclosure** | Prominent technical architectural diagram | Standard privacy policy | None | Dense legal disclaimers |
| **Third-Party Trackers** | Zero (No Google Analytics, No Meta Pixel) | Multiple analytics SDKs | Multiple marketing trackers | Multiple trackers |

### 6. Master Task List
#### Task W9.1: Automated App Store & Google Play Legal Compliance Handoff
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Apple App Store Review Guidelines (5.1.1 Data Collection & Storage) and Google Play VpnService Policy.
  - UX patterns: Clean legal tabs, human-readable summary callout boxes, instant deletion forms.
  - User pain points: Users fear trapped subscriptions or inability to delete sensitive addiction accounts.
- **Problem**: App stores immediately reject apps that lack dedicated web deletion URLs or clear VPN disclosures.
- **Solution**:
  - Frontend changes: Maintain verified static legal bundle in `website/` matching store submission metadata.
  - Backend changes: Serverless deletion endpoint immediately scrubbing auth records and cloud backups.
  - UX improvements: "Human Summary" box atop every legal document explaining key rights in 3 sentences.
- **Implementation Steps**:
  1. Build static pages `privacy.html`, `terms.html`, `support.html`, `account-deletion.html`.
  2. Implement self-service deletion form calling Supabase/Firebase Auth deletion.
  3. Validate against `scripts/store-legal-hosted-url-audit.js` and ensure zero missing links.
- **Animations**: N/A (Fast, accessible, static HTML/CSS).
- **AI Enhancement**: Automated compliance auditor verifying that all store policy changes are reflected in policy text.
- **User Impact**: 100% confidence that their privacy and consumer rights are respected.
- **Market Impact**: Guaranteed 1-pass approval across Apple App Store and Google Play reviews; zero rejection risk.

---

## WEB APP 10: Cross-Device Encrypted Cloud Sync & Account Console

### 1. Product Vision
The centralized web console allowing users to manage their cross-device FREED ecosystem. Users can manage active mobile and extension devices, inspect cloud backup encryption status, download their personal data archives, and manage subscription seats.

### 2. UX System
- **Feel**: Secure, precision-engineered, modern, reassuring.
- **Key Interactions**: Device pairing via QR code, active session revocation, data export download, subscription management.

### 3. UI Structure (All Screens)
1. **Console Overview**: Active connected devices (iPhone, Pixel, Mac Chrome Extension), master encryption key status.
2. **Device Manager**: List of authorized clients with 1-click remote session revocation.
3. **Data Portability Center**: Download complete JSON archive of streak history, check-in reflections, and habit metrics.
4. **Subscription Management**: Manage Apple IAP / Google Play / Stripe subscription status and family seats.

### 4. AI Features
- **Security Anomaly Detection**: Alerts user via push if a new device authorization is attempted from an unrecognized IP.

### 5. Competitor Comparison
| Dimension | FREED Account Console | Opal Web Dashboard | 1Password Console | Bitwarden Vault |
|---|---|---|---|---|
| **Data Architecture** | Zero-knowledge encrypted sync | Cloud account settings | Zero-knowledge vault | Zero-knowledge vault |
| **Device Continuity** | Mobile + Chromium + Safari | Mobile only | Cross-platform | Cross-platform |
| **Data Portability** | 1-Click complete JSON export | Limited export | Full export | Full export |

### 6. Master Task List
#### Task W10.1: Multi-Device QR Code Encrypted Sync Bridge
- **Research**:
  👉 Research using the internet before implementing
  - Competitor analysis: Signal desktop QR linking and WhatsApp web device synchronization.
  - UX patterns: High-density QR code scan, immediate pairing animation, encrypted secret exchange.
  - User pain points: Having to re-enter streaks, habits, and blocked apps manually on a new computer.
- **Problem**: Desktop extensions and mobile apps operate in isolated data silos without unified streak progress.
- **Solution**:
  - Frontend changes: Build `website/console/sync.html` displaying ephemeral pairing QR code.
  - Backend changes: End-to-end encrypted WebSocket / Supabase channel transferring local state securely.
  - UX improvements: Instant haptic confirmation on mobile; desktop extension immediately displays matching streak clock.
- **Implementation Steps**:
  1. Generate public/private keypair on desktop extension.
  2. Display QR code encoding public key and ephemeral pairing channel.
  3. Mobile app scans QR code, encrypts current `RecoveryState` with desktop key, and transmits payload.
- **Animations**: Smooth pairing checkmark burst on desktop upon successful sync.
- **AI Enhancement**: Automatically synchronizes personalized Clara AI prompt context across all user devices.
- **User Impact**: One unified recovery journey across all phone and computer screens.
- **Market Impact**: Unifies the ecosystem, creating high product defensibility and zero churn.

---

# SECTION 3: GLOBAL DESIGN SYSTEM (Appllama HIG Benchmark)

## 1. Shared Principles
1. **Clarity Over Decoration**: Every pixel, animation, and color exists to reduce anxiety and build self-mastery. We eliminate all random starfield particle animations, multi-colored gradients, and decorative noise.
2. **Platform Baseline**: Built on Expo Router Stack, React Native Reanimated 4, Gesture Handler, and FlashList.
3. **One Accent, Locked**: The palette is carried by neutral slates (`#0A0D0C` to `#1C2420`); the single accent is **Forest Emerald** (`#09653A` dark / `#10B981` light), spent only where primary action and recovery progress live.
4. **One Grey Family**: Cool, organic slate greys throughout — never mixing warm brown greys with cool blue greys.
5. **Continuous Squircle Geometry**: `borderCurve: 'continuous'` applied universally across every card, button, and sheet.

---

## 2. Color Tokens (Dual-Theme System)

| Token Path | Light Mode (`#HEX`) | Dark Mode (`#HEX`) | Semantic Role |
|---|---|---|---|
| `surface.canvas` | `#F6F9F7` | `#0A0D0C` | Root app background |
| `surface.default` | `#FFFFFF` | `#131916` | Card and sheet surfaces |
| `surface.raised` | `#FFFFFF` | `#1A221E` | Modals and elevated dialogs |
| `content.primary` | `#0D1612` | `#F1F6F3` | Main headlines and body text |
| `content.secondary` | `#4B5E55` | `#93A89E` | Secondary captions and subtitles |
| `content.tertiary` | `#7C9187` | `#5C7268` | Placeholder text and inactive icons |
| `action.primary` | `#09653A` | `#10B981` | Primary CTA buttons, active toggles |
| `action.onPrimary` | `#FFFFFF` | `#041C10` | Text on primary CTA |
| `status.protected` | `#09653A` | `#10B981` | Safe, protected, active streak |
| `status.attention` | `#B45309` | `#F59E0B` | Needs permission or check-in |
| `status.risk` | `#B91C1C` | `#EF4444` | Intercept moment, blocked domain |
| `border.subtle` | `rgba(13,22,18,0.08)` | `rgba(241,246,243,0.08)` | Card outlines, dividers |

---

## 3. Typography Hierarchy & Tabular Numerals

| Role | Font Family | Size | Line Height | Weight | Variant |
|---|---|---|---|---|---|
| **Large Title** | System (SF Pro / Roboto) | 34pt | 41pt | Heavy (800) | Standard |
| **Title 1** | System | 28pt | 34pt | Bold (700) | Standard |
| **Title 2** | System | 22pt | 28pt | Bold (700) | Standard |
| **Headline** | System | 17pt | 22pt | Semibold (600) | Standard |
| **Body** | System | 16pt | 22pt | Regular (400) | Standard |
| **Caption** | System | 13pt | 18pt | Medium (500) | Standard |
| **Numeric Display** | System | 34–64pt | Proportional | Heavy (800) | `tabular-nums` |
| **Counter / Metric**| System | 14–24pt | Proportional | Bold (700) | `tabular-nums` |

---

## 4. Spacing, Elevation & Continuous Shapes
- **Base Grid**: 8pt unit scale (`4`, `8`, `12`, `16`, `24`, `32`, `40`, `48`).
- **Gaps**: Use flexbox `gap: 8 | 12 | 16 | 24`, avoiding margin stacking.
- **Shape Scale**:
  - Buttons: `borderRadius: 999`, `borderCurve: 'continuous'`, `minHeight: 48` (touch target standard).
  - Cards: `borderRadius: 20`, `borderCurve: 'continuous'`, `padding: 16`.
  - Inputs: `borderRadius: 12`, `borderCurve: 'continuous'`, `minHeight: 52`.
  - Modals / Sheets: `borderRadius: 28`, `borderCurve: 'continuous'`.
- **Elevation**: Semantic CSS `boxShadow` tokens replacing deprecated `shadow*` properties.

---

## 5. Animation & Motion Principles
- **Responsive Springs (User-Driven Gestures)**:
  `const SNAP = { duration: 400, dampingRatio: 1 };` Seed `withSpring` with release gesture velocity.
- **Narrative Timing (System State Transitions)**:
  `withTiming(target, { duration: 240, easing: Easing.bezier(0.23, 1, 0.32, 1) })`.
  Exits are always faster than entrances (150ms exit vs 220ms entrance).
- **Press Feedback**: Immediate on `onPressIn` (100–150ms): `scale: 0.97` on buttons; spring back to `1.0` on release.
- **Reduce Motion Support**: Automatically collapses spatial translation into gentle cross-fades when `useReducedMotion()` is active.

---

# SECTION 4: FILE ORGANIZATION & CODE MODULARIZATION

## 1. Clean Directory Structure

```
FREED/
├── app/                              # Expo Router file-based routes
│   ├── _layout.tsx                   # Root Safe Area + Theme Provider + Stack
│   ├── index.tsx                     # Entry router dispatch
│   ├── (tabs)/                       # Bottom Tab Navigator
│   │   ├── _layout.tsx               # Tab bar configuration & active SF Symbols
│   │   ├── index.tsx                 # Today recovery dashboard
│   │   ├── shield.tsx                # Focus Shield & DNS Guard
│   │   ├── progress.tsx              # Analytics, Milestones & Reboot path
│   │   └── profile.tsx               # Profile, Encrypted backup & Settings
│   ├── modal/                        # Full-screen and sheet modals
│   │   ├── intercept.tsx             # Urge circuit breaker
│   │   ├── coach.tsx                 # Clara AI conversational assistant
│   │   ├── paywall.tsx               # Subscription & 7-day trial flow
│   │   ├── breathing.tsx             # Guided breathing visualizer
│   │   ├── challenge.tsx             # Active urge-surfing challenge
│   │   └── checkin.tsx               # Daily intention and evening review
│   └── onboarding/                   # One-way door onboarding funnel
│       ├── welcome.tsx               # Value proposition & language
│       ├── quiz.tsx                  # 5-step clinical diagnostic
│       ├── calculation.tsx           # Animated dopamine reboot calculation
│       ├── apps.tsx                  # Restricted app selection
│       └── setup.tsx                 # VPN & Screen Time permission wizard
├── src/
│   ├── components/                   # Reusable atomic UI components
│   │   ├── ui/
│   │   │   ├── Button.tsx            # Continuous squircle pill button
│   │   │   ├── Card.tsx              # Semantic elevated card
│   │   │   ├── Switch.tsx            # Native switch wrapper
│   │   │   ├── Metric.tsx            # Tabular numeral stat card
│   │   │   └── TabularText.tsx       # Auto tabular-nums text wrapper
│   │   └── feedback/
│   │       ├── BreathingOrb.tsx      # Synced Reanimated breathing circle
│   │       ├── StreakOrb.tsx         # Central time counter
│   │       └── InlineNotice.tsx      # Status notification card
│   ├── features/                     # Feature domain logic & screens
│   │   ├── today/                    # Today domain (HomeScreen, StreakOrb, DailyPledge)
│   │   ├── shield/                   # Shield domain (ShieldScreen, FocusShield, DnsHealth)
│   │   ├── progress/                 # Progress domain (Analytics, Milestones, UrgeHeatmap)
│   │   ├── coach/                    # Clara AI domain (CoachPanel, MessageBubble)
│   │   └── intervention/             # Intercept domain (InterceptScreen, BreathingScreen)
│   ├── design-system/                # Design tokens & motion
│   │   ├── tokens.ts                 # Light & Dark semantic color tokens
│   │   ├── theme.tsx                 # ThemeProvider and useTheme()
│   │   └── motion.ts                 # Reanimated springs, curves, and timings
│   ├── lib/                          # Core business logic & native adapters
│   │   ├── blocking-engine.ts        # Fast on-device domain classifier
│   │   ├── ai-coach.ts               # Clara AI prompt orchestration
│   │   ├── recovery-state.ts         # SQLite/MMKV persistent state
│   │   └── monetization.ts           # RevenueCat IAP engine
│   └── data/                         # Static library articles & challenges
├── extension/                        # Desktop MV3 browser extension
│   ├── popup/                        # Extension popup UI
│   ├── blocked/                      # Calming intercept page
│   └── options/                      # Settings & rule manager
└── website/                          # Public landing page & legal portal
```

---

## 2. Refactoring & Modularization Roadmap
1. **Phase 1: Token & Theme Foundations**: Connect semantic tokens to light/dark themes and inject into `src/design-system/theme.tsx`.
2. **Phase 2: Atomic UI Primitives**: Standardize `Button`, `Card`, `Metric`, and `StreakOrb` with `borderCurve: 'continuous'`, tabular numbers, and press springs.
3. **Phase 3: Screen Extraction**: Deconstruct `src/features/freed-app.tsx` into modular directories under `src/features/`.
4. **Phase 4: Simulator Verification Loop**: Validate all flows on iOS Simulator and Android Emulator for sustained 60fps and zero glitches.

---

# FINAL STANDARD & DEFINITION OF DONE

Every app and experience in the FREED ecosystem is engineered to be:
- **Simpler than competitors**: Zero confusing settings; works automatically on install.
- **Faster than competitors**: Zero-latency on-device DNS resolution (< 1ms cache hits); instant 60fps animations.
- **More useful than competitors**: Combines unbypassable blocking, physiological somatic intervention, and AI coaching.
- **More delightful than competitors**: Continuous squircle geometry, tabular typography, and calibrated haptic feedback.

**The Goal**:
👉 Build products that make users say:
*“Why doesn’t anything else work this well?”*
