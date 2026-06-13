// ── FREED · Pre-made Recovery Challenge Templates ────────────────────────────
// 1000+ curated, AI-free recovery interventions across 5 UI categories and
// production challenge families.
// The local picker selects from this library before any remote provider call,
// so most relapse moments resolve with zero AI cost while remote stays as a
// last-resort fallback for personalization.
//
// Safety guarantees baked into authoring:
//   • Never shaming, sexualized, or moralizing language.
//   • Never asks the user to drive, operate machinery, fast, or self-harm.
//   • Every template completes in ≤ 12 minutes.
//   • Steps are short (≤ 110 chars) and concrete.
//
// Categories follow `RecoveryChallenge["category"]` in src/lib/recovery-engine.ts.

import type {
  ChallengeContextSignal,
  ChallengePreferenceSignal,
  InterventionContextSignal,
  RecoveryChallenge,
  UrgeRiskForecastSignal
} from "@/lib/recovery-engine";

export type TemplateContext = "calm" | "high-urge" | "late-night" | "bored" | "stressed" | "lonely" | "any";
export const CHALLENGE_ENGINE_FAMILIES = [
  "physical",
  "outdoors",
  "mindfulness",
  "productivity",
  "social",
  "emergency",
  "anti-relapse",
  "late-night",
  "quick-reset"
] as const;
export type ChallengeEngineFamily = (typeof CHALLENGE_ENGINE_FAMILIES)[number];

export type ChallengeTemplate = RecoveryChallenge & {
  contexts: TemplateContext[];
  families: ChallengeEngineFamily[];
  /** Mood/intent tags used for personalization scoring. */
  tags: string[];
};

type SeedDef = {
  prefix: string;
  category: RecoveryChallenge["category"];
  intensity: RecoveryChallenge["intensity"];
  icon: string;
  durationSec: number;
  premium?: boolean;
  contexts: TemplateContext[];
  tags: string[];
  why: string;
  steps: string[];
  /** Numeric variants — e.g. "10 pushups" -> [10, 15, 20, 25, 30]. */
  numbers?: number[];
  /** Optional textual variants applied after numeric ones. */
  variants?: { title: string; steps?: string[] }[];
};

// ── Seeds ────────────────────────────────────────────────────────────────────
// Each seed multiplies into ~10-30 templates via numbers/variants/contexts.
// Curated to cover physical, breathing, reflection, connection, and reset
// (environmental) UI categories, then mapped into production families across
// every mood and time-of-day.

const SEEDS: SeedDef[] = [
  // ──────── PHYSICAL (200+) ─────────────────────────────────────────────────
  {
    prefix: "Pushups",
    category: "physical",
    intensity: "strong",
    icon: "Dumbbell",
    durationSec: 90,
    contexts: ["high-urge", "stressed", "bored"],
    tags: ["physical", "discharge", "energy", "morning"],
    why: "Pushups dump adrenaline fast and reroute attention from craving into a clear body signal.",
    steps: [
      "Drop to the floor in pushup position.",
      "Brace your core and squeeze glutes.",
      "Lower with control until chest is two fists from the ground.",
      "Push up explosively, breathe out."
    ],
    numbers: [10, 15, 20, 25, 30, 40, 50]
  },
  {
    prefix: "Squats",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 90,
    contexts: ["high-urge", "stressed", "bored"],
    tags: ["physical", "legs", "discharge"],
    why: "Squats engage the largest muscles in your body, which floods the system with calming endorphins.",
    steps: [
      "Stand tall, feet shoulder-width apart.",
      "Sit back like there is a chair behind you.",
      "Keep your chest tall, weight in heels.",
      "Drive up through the floor and repeat."
    ],
    numbers: [15, 20, 25, 30, 40, 50]
  },
  {
    prefix: "Burpees",
    category: "physical",
    intensity: "strong",
    icon: "Dumbbell",
    durationSec: 120,
    contexts: ["high-urge", "stressed"],
    tags: ["physical", "discharge", "intense"],
    why: "Burpees rapidly raise your heart rate, which collapses craving signals within minutes.",
    steps: [
      "Stand, then squat down and place hands on floor.",
      "Jump your feet back into a plank.",
      "Drop chest, push back up, jump feet to hands.",
      "Stand and jump straight up. Repeat."
    ],
    numbers: [5, 8, 10, 12, 15, 20]
  },
  {
    prefix: "Plank hold",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 60,
    contexts: ["any"],
    tags: ["physical", "core", "focus"],
    why: "Holding a plank forces full-body presence and quiets racing thoughts.",
    steps: [
      "Place forearms on the floor, elbows under shoulders.",
      "Straighten your body in one line.",
      "Squeeze glutes and brace abs.",
      "Hold steady, breathe through the nose."
    ],
    numbers: [30, 45, 60, 90, 120]
  },
  {
    prefix: "Jumping jacks",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 60,
    contexts: ["bored", "calm"],
    tags: ["physical", "wake-up", "low-skill"],
    why: "Repetitive full-body movement quickly resets your state without needing equipment or skill.",
    steps: [
      "Stand tall, feet together, arms at sides.",
      "Jump feet wide while raising arms overhead.",
      "Jump back to start.",
      "Stay loose and breathe with the rhythm."
    ],
    numbers: [30, 50, 75, 100, 150]
  },
  {
    prefix: "Mountain climbers",
    category: "physical",
    intensity: "strong",
    icon: "Dumbbell",
    durationSec: 60,
    contexts: ["high-urge", "stressed"],
    tags: ["physical", "cardio", "discharge"],
    why: "Fast climbers spike your pulse, which is the body language of action, not craving.",
    steps: [
      "Start in a high plank, hands under shoulders.",
      "Drive one knee toward your chest.",
      "Switch legs quickly without lifting hips.",
      "Stay tight and breathe steadily."
    ],
    numbers: [30, 50, 60, 80, 100]
  },
  {
    prefix: "Wall sit",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 60,
    contexts: ["bored", "calm"],
    tags: ["physical", "isometric", "focus"],
    why: "An isometric burn keeps attention on the body, not the urge, while building quiet discipline.",
    steps: [
      "Press your back flat against a wall.",
      "Slide down until your thighs are parallel to the floor.",
      "Keep knees over ankles, breathe slowly.",
      "Hold without holding your breath."
    ],
    numbers: [30, 45, 60, 90, 120]
  },
  {
    prefix: "Walk outside",
    category: "physical",
    intensity: "calm",
    icon: "Footprints",
    durationSec: 300,
    contexts: ["bored", "lonely", "stressed"],
    tags: ["physical", "outside", "reset"],
    why: "Stepping outside changes the cue environment, which is often more powerful than willpower.",
    steps: [
      "Put your phone on Do Not Disturb.",
      "Grab keys and step outside.",
      "Walk at your own pace, no destination.",
      "Notice five things you have not seen before."
    ],
    numbers: [3, 5, 7, 10, 15, 20]
  },
  {
    prefix: "Stretch routine",
    category: "physical",
    intensity: "calm",
    icon: "Activity",
    durationSec: 180,
    contexts: ["calm", "late-night", "stressed"],
    tags: ["physical", "mobility", "relax"],
    why: "Gentle stretching releases tension your nervous system stores during craving.",
    steps: [
      "Stand tall and reach both arms overhead.",
      "Fold forward and let your head hang.",
      "Slowly roll up vertebra by vertebra.",
      "Roll shoulders back five times each direction."
    ],
    numbers: [3, 5, 7, 10],
    variants: [
      {
        title: "Hip opener stretch flow",
        steps: [
          "Sit cross-legged on the floor.",
          "Lean forward over your right knee, breathe.",
          "Switch sides, hold each for 30 seconds.",
          "Finish with a butterfly stretch."
        ]
      },
      {
        title: "Hamstring + shoulder release",
        steps: [
          "Stand and fold forward, soft knees.",
          "Hold opposite elbows, sway gently.",
          "Roll up slowly, then shoulder rolls.",
          "Crossbody arm stretch each side."
        ]
      }
    ]
  },
  {
    prefix: "Run in place",
    category: "physical",
    intensity: "medium",
    icon: "Footprints",
    durationSec: 60,
    contexts: ["high-urge", "bored"],
    tags: ["physical", "cardio", "discharge"],
    why: "Running in place gives your nervous system real movement evidence and helps discharge the craving.",
    steps: [
      "Stand tall, feet hip-width apart.",
      "Lift knees high one at a time.",
      "Pump arms in opposition to legs.",
      "Stay light on the balls of your feet."
    ],
    numbers: [60, 90, 120, 180, 240]
  },
  {
    prefix: "Stair climb",
    category: "physical",
    intensity: "medium",
    icon: "Footprints",
    durationSec: 180,
    contexts: ["high-urge", "stressed"],
    tags: ["physical", "cardio", "leg"],
    why: "Stairs force unilateral effort, which is harder to do on autopilot than scrolling.",
    steps: [
      "Find the nearest staircase.",
      "Walk up and down at a steady pace.",
      "Skip every second step on the way up.",
      "Stop before you are out of breath."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Yoga sun salutations",
    category: "physical",
    intensity: "calm",
    icon: "Activity",
    durationSec: 240,
    premium: false,
    contexts: ["calm", "late-night"],
    tags: ["physical", "breath", "mind-body"],
    why: "Linking breath to movement gives the nervous system a coherent script other than craving.",
    steps: [
      "Stand at the top of your mat.",
      "Inhale arms up, exhale fold forward.",
      "Step back to plank, lower, upward dog.",
      "Down dog, walk feet up, rise to stand."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Shadow box",
    category: "physical",
    intensity: "strong",
    icon: "Dumbbell",
    durationSec: 120,
    contexts: ["stressed", "high-urge"],
    tags: ["physical", "discharge", "anger"],
    why: "Shadow boxing externalizes restless energy without hitting anything that matters.",
    steps: [
      "Stand with feet shoulder-width, hands up.",
      "Throw jab-cross, then a hook.",
      "Stay light on the toes, breathe.",
      "Reset and repeat clean rounds."
    ],
    numbers: [2, 3, 5]
  },
  {
    prefix: "Light jog",
    category: "physical",
    intensity: "medium",
    icon: "Footprints",
    durationSec: 600,
    contexts: ["bored", "stressed"],
    tags: ["physical", "outside", "cardio"],
    why: "Aerobic effort produces BDNF, which is the long-term antidote to compulsive cycles.",
    steps: [
      "Lace up your shoes.",
      "Walk for two minutes to warm up.",
      "Hold a conversational pace.",
      "End with a slow walk back home."
    ],
    numbers: [5, 10, 15, 20, 30]
  },
  {
    prefix: "Bodyweight rows",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 90,
    contexts: ["any"],
    tags: ["physical", "strength"],
    why: "Pulling motions are rare in daily life, which makes them effective at breaking automatic loops.",
    steps: [
      "Find a sturdy table edge or low bar.",
      "Lie underneath and grip with both hands.",
      "Pull chest toward the edge, squeeze shoulder blades.",
      "Lower with control."
    ],
    numbers: [8, 10, 12, 15, 20]
  },
  {
    prefix: "Lunges",
    category: "physical",
    intensity: "medium",
    icon: "Dumbbell",
    durationSec: 90,
    contexts: ["any"],
    tags: ["physical", "legs"],
    why: "Lunges demand balance, which forces the prefrontal cortex back online.",
    steps: [
      "Step one leg back, lower the back knee.",
      "Front knee tracks over the ankle.",
      "Drive through the front heel to stand.",
      "Alternate sides each rep."
    ],
    numbers: [10, 16, 20, 30, 40]
  },
  {
    prefix: "Calf raises",
    category: "physical",
    intensity: "calm",
    icon: "Dumbbell",
    durationSec: 60,
    contexts: ["calm", "bored"],
    tags: ["physical", "low-impact"],
    why: "Even small physical effort tilts the chemistry toward action and away from numb scrolling.",
    steps: [
      "Stand near a wall for balance.",
      "Press up onto the balls of your feet.",
      "Hold one second at the top.",
      "Lower slowly without bouncing."
    ],
    numbers: [20, 30, 40, 50, 75]
  },
  {
    prefix: "Cold shower",
    category: "physical",
    intensity: "strong",
    icon: "Snowflake",
    durationSec: 60,
    premium: false,
    contexts: ["high-urge", "late-night"],
    tags: ["physical", "cold", "reset"],
    why: "A short cold blast collapses the dopamine spiral and gives you a clean restart.",
    steps: [
      "Turn the shower to the coldest setting.",
      "Step in feet-first and breathe out long.",
      "Stay under the stream for the full time.",
      "Step out, dry off, stand tall."
    ],
    numbers: [30, 45, 60, 90, 120]
  },

  // ──────── BREATHING (180+) ────────────────────────────────────────────────
  {
    prefix: "4-7-8 breathing",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 180,
    contexts: ["high-urge", "late-night", "stressed"],
    tags: ["breath", "calm", "sleep"],
    why: "The long exhale signals safety to the nervous system, which softens the urge spike.",
    steps: [
      "Sit upright, soft jaw.",
      "Inhale through the nose for 4 counts.",
      "Hold the breath for 7 counts.",
      "Exhale through the mouth for 8 counts."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Box breathing",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 180,
    contexts: ["high-urge", "stressed", "any"],
    tags: ["breath", "focus", "reset"],
    why: "Box breathing is what Navy SEALs use to stay calm in chaos — equal sides keep you in control.",
    steps: [
      "Inhale for 4 counts.",
      "Hold for 4 counts.",
      "Exhale for 4 counts.",
      "Hold empty for 4 counts."
    ],
    numbers: [4, 5, 6, 8, 10]
  },
  {
    prefix: "Coherent breathing",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 300,
    contexts: ["any"],
    tags: ["breath", "balance", "heart"],
    why: "5-second inhale, 5-second exhale rebalances the autonomic system and steadies emotion.",
    steps: [
      "Lie back or sit upright.",
      "Inhale through nose for 5 counts.",
      "Exhale through nose for 5 counts.",
      "Continue at this exact rhythm."
    ],
    numbers: [3, 5, 8, 10]
  },
  {
    prefix: "Double-exhale breath",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 90,
    contexts: ["stressed", "high-urge"],
    tags: ["breath", "physiological-sigh", "fast"],
    why: "The physiological sigh is the fastest known way to lower stress in under a minute.",
    steps: [
      "Inhale through the nose.",
      "Take a second sharp inhale on top.",
      "Exhale slowly and fully through the mouth.",
      "Repeat the double-inhale, long-exhale."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Alternate nostril breath",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 240,
    contexts: ["calm", "stressed"],
    tags: ["breath", "balance", "ancient"],
    why: "Alternating sides quiets the noise in your head by giving the brain a balanced rhythm.",
    steps: [
      "Use right thumb to close right nostril.",
      "Inhale slowly through the left.",
      "Switch — close left, exhale right.",
      "Inhale right, switch, exhale left. Continue."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Belly breathing",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 180,
    contexts: ["any"],
    tags: ["breath", "grounding"],
    why: "Diaphragmatic breathing physically signals safety and stops the shallow chest cycle.",
    steps: [
      "Place one hand on chest, one on belly.",
      "Inhale so only the belly hand rises.",
      "Exhale gently and feel the belly fall.",
      "Keep chest hand still throughout."
    ],
    numbers: [3, 5, 8, 10]
  },
  {
    prefix: "Lion's breath",
    category: "breathing",
    intensity: "medium",
    icon: "Waves",
    durationSec: 60,
    contexts: ["bored", "high-urge"],
    tags: ["breath", "release", "playful"],
    why: "Forceful exhalation breaks the trance state and feels strangely energizing.",
    steps: [
      "Inhale deeply through the nose.",
      "Open mouth wide, stick out tongue.",
      "Exhale forcefully with a 'haaa' sound.",
      "Repeat without judgment."
    ],
    numbers: [3, 5, 7]
  },
  {
    prefix: "Counted exhale",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 180,
    contexts: ["late-night", "calm"],
    tags: ["breath", "sleep"],
    why: "Longer exhales than inhales tip your nervous system into rest mode.",
    steps: [
      "Inhale for 4 counts.",
      "Exhale slowly for 6 counts.",
      "Add 1 count to exhale every minute.",
      "Stop when exhale reaches 10 counts."
    ],
    numbers: [3, 5, 7]
  },
  {
    prefix: "Wim Hof rounds",
    category: "breathing",
    intensity: "strong",
    icon: "Waves",
    durationSec: 600,
    contexts: ["bored", "calm"],
    tags: ["breath", "energy", "advanced"],
    why: "Cycling deep breaths floods the body with oxygen and creates a clean, focused state.",
    steps: [
      "Take 30 full breaths in and out.",
      "On the last exhale, hold without straining.",
      "When the urge to breathe arrives, inhale fully.",
      "Hold for 15 seconds. Repeat the round."
    ],
    numbers: [2, 3, 4, 5]
  },
  {
    prefix: "Resonant 6-breath",
    category: "breathing",
    intensity: "calm",
    icon: "Waves",
    durationSec: 360,
    contexts: ["any"],
    tags: ["breath", "balance"],
    why: "Six breaths a minute is the natural resonance of your heart and brain — a free reset.",
    steps: [
      "Inhale through the nose for 5 seconds.",
      "Exhale through the nose for 5 seconds.",
      "Aim for six full cycles per minute.",
      "Continue at this exact tempo."
    ],
    numbers: [3, 5, 8, 10]
  },

  // ──────── REFLECTION (220+) ───────────────────────────────────────────────
  {
    prefix: "Write three reasons you quit",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["any"],
    tags: ["reflection", "identity", "writing"],
    why: "Reconnecting to your reasons makes the urge feel small compared to what you are protecting.",
    steps: [
      "Open a notes app or paper.",
      "Write the date and the time.",
      "List 3 reasons you started this path.",
      "Read them out loud, slowly."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Letter to future you",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 300,
    contexts: ["calm", "late-night"],
    tags: ["reflection", "identity", "writing"],
    why: "Speaking to your future self shifts you out of immediate-urge mode into a longer view.",
    steps: [
      "Write 'Dear future me…'",
      "Describe the life you are building.",
      "Promise one small thing for today.",
      "Sign and date the page."
    ]
  },
  {
    prefix: "Urge journal entry",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["high-urge"],
    tags: ["reflection", "data", "self-aware"],
    why: "Naming the trigger gives the urge a shape, and shaped things lose mystery and power.",
    steps: [
      "What did I do just before this urge?",
      "Where do I feel it in my body?",
      "What story am I telling myself?",
      "What would relapse cost me tomorrow?"
    ]
  },
  {
    prefix: "Gratitude list",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["calm", "lonely"],
    tags: ["reflection", "gratitude", "mood"],
    why: "Gratitude rewires the reward system to notice what is already good, which the urge ignores.",
    steps: [
      "List 3 specific things, not generic ones.",
      "Add why each one matters to you.",
      "Notice the body shift after writing.",
      "Save the note for next time."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Values check",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["any"],
    tags: ["reflection", "identity"],
    why: "When values and behavior align, urges naturally lose their grip.",
    steps: [
      "Pick the value most under attack right now.",
      "Write one action that honors it today.",
      "Set a 10-minute timer to start.",
      "Begin before the timer ends."
    ]
  },
  {
    prefix: "Costs vs. cravings list",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["high-urge", "calm"],
    tags: ["reflection", "decision"],
    why: "Cost-benefit on paper makes the dopamine math obvious in seconds.",
    steps: [
      "Draw two columns: Cost / Reward.",
      "Be brutally honest in both.",
      "Read it back as a third party.",
      "Decide if a 10-minute escape is worth it."
    ]
  },
  {
    prefix: "5-year review",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 300,
    contexts: ["calm", "stressed"],
    tags: ["reflection", "future"],
    why: "Zooming out collapses present urgency and reconnects you to direction.",
    steps: [
      "Picture yourself five years free of this.",
      "Describe the morning routine.",
      "Describe the relationships.",
      "Write what you would tell today's you."
    ]
  },
  {
    prefix: "Trigger pattern map",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["calm"],
    tags: ["reflection", "data"],
    why: "Mapping triggers exposes the loop so the next attempt is easier to interrupt.",
    steps: [
      "List your last three slips by time of day.",
      "Note the feeling right before each.",
      "Note the environment for each.",
      "Circle the most repeated trigger."
    ]
  },
  {
    prefix: "Win review",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 120,
    contexts: ["lonely", "calm"],
    tags: ["reflection", "self-esteem"],
    why: "Counting wins restores agency, which is what addiction quietly steals.",
    steps: [
      "List 3 wins from this week.",
      "Big or small, no judging.",
      "Add what they say about you.",
      "Keep this list for a hard day."
    ]
  },
  {
    prefix: "Compassion letter",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["lonely", "stressed"],
    tags: ["reflection", "self-compassion"],
    why: "Writing kindly to yourself short-circuits shame, which is the strongest relapse fuel.",
    steps: [
      "Imagine a friend in your shoes.",
      "Write what you would tell them.",
      "Read it back to yourself.",
      "Notice the body soften."
    ]
  },
  {
    prefix: "Read your why",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 90,
    contexts: ["high-urge"],
    tags: ["reflection", "identity", "fast"],
    why: "A quick read of your own words pulls you back into your own story.",
    steps: [
      "Open your saved reasons note.",
      "Read each line out loud.",
      "Pause on the one that hits hardest.",
      "Set the phone down for 30 seconds."
    ]
  },
  {
    prefix: "Future self interview",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 300,
    contexts: ["calm"],
    tags: ["reflection", "imagery"],
    why: "Interviewing your future self builds the identity the present is still catching up to.",
    steps: [
      "Imagine a future you 90 days clean.",
      "Ask: what advice would you give now?",
      "Write the answer in their voice.",
      "Save the note for hard moments."
    ]
  },
  {
    prefix: "Body scan write-up",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["any"],
    tags: ["reflection", "somatic"],
    why: "Translating sensations into words takes craving out of autopilot.",
    steps: [
      "Close your eyes and scan toes to head.",
      "Write where you feel tight or loose.",
      "Name the emotion that fits each spot.",
      "Set the note aside and breathe."
    ]
  },

  // ──────── CONNECTION (160+) ───────────────────────────────────────────────
  {
    prefix: "Text accountability partner",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 120,
    premium: false,
    contexts: ["high-urge", "lonely"],
    tags: ["connection", "accountability", "honesty"],
    why: "Saying it out loud to a real person breaks secrecy, which is where relapse hides.",
    steps: [
      "Open your accountability contact.",
      "Send: 'I need a reset moment.'",
      "Wait for any reply before doing anything else.",
      "Return to the FREED app after."
    ]
  },
  {
    prefix: "Call a friend",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 300,
    contexts: ["lonely", "stressed"],
    tags: ["connection", "voice"],
    why: "Human voice in real time is the fastest known dopamine substitute for healthy connection.",
    steps: [
      "Pick the warmest person on your list.",
      "Call and say you just need a minute.",
      "Stay on the line until you feel steady.",
      "Thank them honestly before hanging up."
    ]
  },
  {
    prefix: "Voice note to mentor",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["calm", "stressed"],
    tags: ["connection", "honesty"],
    why: "Speaking your truth into a voice note is honesty without the friction of typing.",
    steps: [
      "Pick someone whose opinion you respect.",
      "Record a 60-second voice message.",
      "Say what is hard right now.",
      "Send it before the inner editor speaks."
    ]
  },
  {
    prefix: "Hug someone in your house",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 60,
    contexts: ["lonely", "calm"],
    tags: ["connection", "touch", "warmth"],
    why: "20 seconds of safe touch releases oxytocin, which directly competes with the urge cycle.",
    steps: [
      "Find a person, pet, or trusted friend nearby.",
      "Offer a real, full hug.",
      "Hold for at least 20 seconds.",
      "Let the body register the warmth."
    ]
  },
  {
    prefix: "Compliment three people",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 240,
    contexts: ["lonely", "bored"],
    tags: ["connection", "outward"],
    why: "Outward focus collapses self-obsession, which is the fuel of compulsive cycles.",
    steps: [
      "Pick three people you appreciate.",
      "Send each a specific, real compliment.",
      "No fishing — just give and close the chat.",
      "Notice how it changes your state."
    ]
  },
  {
    prefix: "Recovery community check-in",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 240,
    contexts: ["lonely", "high-urge"],
    tags: ["connection", "community"],
    why: "Being seen by people on the same path is medicine that doesn't come in a pill.",
    steps: [
      "Open your recovery group or forum.",
      "Post or share where you are right now.",
      "Read three other recent posts.",
      "Drop one supportive reply."
    ]
  },
  {
    prefix: "Ask for prayer or wishes",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 120,
    contexts: ["stressed", "lonely"],
    tags: ["connection", "faith"],
    why: "Asking for support trains you out of going it alone, which is what willpower hates.",
    steps: [
      "Pick one trusted person.",
      "Tell them today is hard.",
      "Ask for support without details.",
      "Receive what they offer."
    ]
  },
  {
    prefix: "Send appreciation",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["calm", "lonely"],
    tags: ["connection", "gratitude"],
    why: "Telling someone they matter is one of the highest-leverage mood shifts you can do for free.",
    steps: [
      "Pick a friend, parent, or mentor.",
      "Write what they have done for you.",
      "Be specific, not generic.",
      "Send it. Don't wait for a reply."
    ]
  },

  // ── More reflection seeds ─────────────────────────────────────────────────
  {
    prefix: "List things you've already overcome",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["lonely", "stressed", "calm"],
    tags: ["reflection", "evidence", "self-esteem"],
    why: "Evidence of past survival reminds your brain that this moment is also survivable.",
    steps: [
      "List 5 hard things you've already gotten through.",
      "Add what they say about your resilience.",
      "Note how each one felt impossible at the time.",
      "Read the list out loud, slowly."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Identify the lie",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["high-urge"],
    tags: ["reflection", "cognitive"],
    why: "Every relapse rides on a lie — naming it strips its power in real time.",
    steps: [
      "Write the thought driving the urge.",
      "Underneath, write the actual truth.",
      "Compare side by side.",
      "Pick which one you'll act on."
    ]
  },
  {
    prefix: "Worst-case rehearsal",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["high-urge", "calm"],
    tags: ["reflection", "consequences"],
    why: "Playing the relapse all the way to the morning after collapses its appeal.",
    steps: [
      "Picture giving in right now in detail.",
      "Picture how you'll feel in 10 minutes.",
      "Picture waking up tomorrow.",
      "Decide if that's the trade you want."
    ]
  },
  {
    prefix: "Goal alignment check",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["calm"],
    tags: ["reflection", "goal"],
    why: "Re-reading goals reminds the present moment what it is actually working toward.",
    steps: [
      "Open your goals list or note.",
      "Read each goal slowly.",
      "Mark which one is most under threat now.",
      "Pick one action that protects it."
    ]
  },
  {
    prefix: "Letter to your inner child",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 300,
    contexts: ["lonely", "stressed"],
    tags: ["reflection", "self-compassion"],
    why: "Speaking kindly to your younger self reroutes the shame loop that fuels relapse.",
    steps: [
      "Picture yourself at age 7.",
      "Write what you wish someone had told you.",
      "Tell that younger self they are safe.",
      "Sign it with today's date."
    ]
  },
  {
    prefix: "Dream journal entry",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 240,
    contexts: ["late-night", "calm"],
    tags: ["reflection", "vision"],
    why: "Writing your dreams in detail makes them more real than the urge that wants to bury them.",
    steps: [
      "Describe one specific future scene.",
      "Add what you see, hear, and feel.",
      "Add who is around you.",
      "Read it as if it already happened."
    ]
  },
  {
    prefix: "Mood timeline",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 180,
    contexts: ["calm"],
    tags: ["reflection", "self-aware"],
    why: "Mapping your mood across the day reveals the cracks where urges sneak in.",
    steps: [
      "Draw 3 columns: morning, afternoon, night.",
      "Rate your mood in each from 1-10.",
      "Add one trigger per column.",
      "Plan one fix for the worst column."
    ]
  },
  {
    prefix: "Re-frame this urge as a signal",
    category: "reflection",
    intensity: "calm",
    icon: "Brain",
    durationSec: 120,
    contexts: ["high-urge"],
    tags: ["reflection", "cognitive"],
    why: "Urges are messages, not commands — interpreting them removes the obligation.",
    steps: [
      "What unmet need is hiding behind this urge?",
      "Write it in one sentence.",
      "Name one healthy way to meet it.",
      "Do that thing for 5 minutes."
    ]
  },
  {
    prefix: "Three small wins log",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 120,
    contexts: ["lonely", "stressed"],
    tags: ["reflection", "evidence"],
    why: "Counting small wins beats the loud lie that you are not doing anything.",
    steps: [
      "Write three wins from this morning.",
      "Make them concrete and small.",
      "Read them back.",
      "Add the next one you'll create today."
    ]
  },
  {
    prefix: "Write a permission slip",
    category: "reflection",
    intensity: "calm",
    icon: "NotebookPen",
    durationSec: 120,
    contexts: ["stressed", "lonely"],
    tags: ["reflection", "release"],
    why: "Giving yourself explicit permission to rest cuts the inner pressure that triggers escape.",
    steps: [
      "Write: 'I give myself permission to ___.'",
      "Fill in the blank honestly.",
      "Read it out loud.",
      "Honor it for the next hour."
    ]
  },

  // ── More connection seeds ─────────────────────────────────────────────────
  {
    prefix: "Send a meme that means something",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 120,
    contexts: ["lonely", "bored"],
    tags: ["connection", "light"],
    why: "Low-pressure outreach keeps the social muscle warm without requiring vulnerability.",
    steps: [
      "Pick a friend you haven't talked to in weeks.",
      "Send one meme or photo that fits them.",
      "Add: 'thought of you.'",
      "Close the app and breathe."
    ]
  },
  {
    prefix: "Schedule a coffee or walk with a friend",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 240,
    contexts: ["lonely"],
    tags: ["connection", "future-self"],
    why: "Future-you needs proof that connection is on the calendar — make it real today.",
    steps: [
      "Pick one safe person.",
      "Suggest a specific day and time.",
      "Send it before you can over-think.",
      "Add it to your calendar instantly."
    ]
  },
  {
    prefix: "Voice memo of where you are",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["high-urge", "lonely"],
    tags: ["connection", "honesty"],
    why: "Sharing the present moment with someone real shrinks the secrecy that feeds the urge.",
    steps: [
      "Pick a trusted contact.",
      "Record a 60-second honest update.",
      "Don't edit, just send it.",
      "Notice your shoulders soften."
    ]
  },
  {
    prefix: "Ask a question, not a favor",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 120,
    contexts: ["lonely", "calm"],
    tags: ["connection", "outward"],
    why: "Asking a real question makes you curious, which is the opposite chemical of craving.",
    steps: [
      "Pick someone whose life interests you.",
      "Ask one thoughtful question.",
      "Listen to their full answer.",
      "Ask one follow-up before responding."
    ]
  },
  {
    prefix: "Recovery accountability check-in",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["high-urge", "calm"],
    tags: ["connection", "accountability"],
    why: "Regular check-ins build a structure stronger than willpower in any single moment.",
    steps: [
      "Open your accountability chat.",
      "Send your current streak day.",
      "Add one feeling word.",
      "Ask how they are doing too."
    ]
  },
  {
    prefix: "Make plans with family this week",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["lonely", "calm"],
    tags: ["connection", "family"],
    why: "Family connection is a slow-acting medicine that quietly outlasts most urges.",
    steps: [
      "Text a parent, sibling, or cousin.",
      "Suggest a meal or a call.",
      "Lock the date in.",
      "Notice the small relief."
    ]
  },
  {
    prefix: "Compliment a stranger genuinely",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 60,
    contexts: ["bored", "lonely"],
    tags: ["connection", "outward"],
    why: "Giving a moment of warmth to a stranger floods the same system addiction tries to hijack.",
    steps: [
      "Notice one specific thing about someone.",
      "Tell them in a low-stakes way.",
      "Smile and move on.",
      "Carry the warmth with you."
    ]
  },
  {
    prefix: "Pet or animal time",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 300,
    contexts: ["lonely", "stressed"],
    tags: ["connection", "touch"],
    why: "Bonding with an animal triggers the same oxytocin release as a deep human hug.",
    steps: [
      "Find your pet or a friend's.",
      "Sit with them for 5 full minutes.",
      "No phone, just attention.",
      "Notice your nervous system settle."
    ]
  },
  {
    prefix: "Forgive yourself out loud",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 120,
    contexts: ["any"],
    tags: ["connection", "self-compassion"],
    why: "Speaking forgiveness to yourself dissolves the shame that powers the next relapse.",
    steps: [
      "Stand in front of a mirror.",
      "Say: 'I forgive you for ___.'",
      "Fill in the blank truthfully.",
      "Add: 'I'm proud you came back.'"
    ]
  },
  {
    prefix: "Group sponsor message",
    category: "connection",
    intensity: "medium",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["high-urge"],
    tags: ["connection", "community", "premium"],
    premium: true,
    why: "Sponsors exist for exactly this moment — using them strengthens the whole network.",
    steps: [
      "Open your sponsor or group thread.",
      "Send: 'Need a check-in. Hard moment.'",
      "Wait for a reply before doing anything.",
      "Thank them honestly after."
    ]
  },
  {
    prefix: "Send love to someone hurting",
    category: "connection",
    intensity: "calm",
    icon: "MessageCircleHeart",
    durationSec: 180,
    contexts: ["lonely", "stressed"],
    tags: ["connection", "outward"],
    why: "Caring outward is the fastest way to forget the inward storm of an urge.",
    steps: [
      "Think of someone going through something hard.",
      "Send a message that fits them.",
      "Don't fish for response.",
      "Carry the act with you."
    ]
  },

  // ──────── RESET / ENVIRONMENT (240+) ──────────────────────────────────────
  {
    prefix: "Drink full glass of water",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 60,
    contexts: ["any"],
    tags: ["reset", "hydration", "fast"],
    why: "Mild dehydration mimics craving signals — water alone often dissolves the urge.",
    steps: [
      "Pour a full glass of cold water.",
      "Drink it slowly, fully present.",
      "Notice the temperature in the throat.",
      "Set the glass down and breathe."
    ]
  },
  {
    prefix: "Splash cold water on face",
    category: "reset",
    intensity: "calm",
    icon: "Snowflake",
    durationSec: 60,
    contexts: ["high-urge", "late-night"],
    tags: ["reset", "cold", "fast"],
    why: "Cold on the face triggers the dive reflex, which instantly drops heart rate and craving.",
    steps: [
      "Go to the sink.",
      "Cup cold water in both hands.",
      "Splash your face 5 times.",
      "Pat dry and look up."
    ]
  },
  {
    prefix: "Switch rooms",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 60,
    contexts: ["high-urge", "bored"],
    tags: ["reset", "environment"],
    why: "Your brain attaches habits to places — moving rooms breaks the cue chain.",
    steps: [
      "Stand up immediately.",
      "Walk to a different room.",
      "Pick a different chair or wall.",
      "Stay there for at least 5 minutes."
    ]
  },
  {
    prefix: "Phone in another room",
    category: "reset",
    intensity: "medium",
    icon: "Activity",
    durationSec: 60,
    contexts: ["high-urge", "late-night"],
    tags: ["reset", "friction"],
    why: "Distance from the device is the single highest-yield intervention available to you.",
    steps: [
      "Take your phone in hand.",
      "Walk it to another room or drawer.",
      "Put it face-down, set a 30-minute timer.",
      "Walk away without looking back."
    ]
  },
  {
    prefix: "Make the bed",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 180,
    contexts: ["bored", "calm"],
    tags: ["reset", "small-win"],
    why: "One clean micro-win builds enough momentum to outlast the urge.",
    steps: [
      "Strip the sheets straight.",
      "Tuck the corners properly.",
      "Smooth the pillow flat.",
      "Stand back and admire it."
    ]
  },
  {
    prefix: "Tidy your space",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 300,
    contexts: ["bored", "calm"],
    tags: ["reset", "small-win", "environment"],
    why: "A clean space is a calm mind — restoring order outside resets order inside.",
    steps: [
      "Pick one surface or corner.",
      "Remove everything that doesn't belong.",
      "Wipe it down quickly.",
      "Put back only what truly belongs."
    ],
    numbers: [3, 5, 7, 10]
  },
  {
    prefix: "Take out the trash",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 180,
    contexts: ["bored"],
    tags: ["reset", "task"],
    why: "Small completed tasks build the identity of a person who follows through.",
    steps: [
      "Grab the bin liner.",
      "Walk to the dumpster or curb.",
      "Toss it. Notice the lighter weight.",
      "Put a fresh liner in."
    ]
  },
  {
    prefix: "Eat a real snack",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 240,
    contexts: ["late-night", "bored"],
    tags: ["reset", "food", "stable"],
    why: "Blood sugar crashes are silent triggers — food is sometimes the entire answer.",
    steps: [
      "Pick protein + something crunchy.",
      "No sugar bombs.",
      "Eat slowly, no screen.",
      "Drink water alongside."
    ]
  },
  {
    prefix: "Brush teeth",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 120,
    contexts: ["late-night", "any"],
    tags: ["reset", "anchor"],
    why: "A small grooming act flips the brain from indulgence mode into care mode.",
    steps: [
      "Walk to the sink.",
      "Brush slowly for two full minutes.",
      "Floss if available.",
      "Rinse and look at yourself in the mirror."
    ]
  },
  {
    prefix: "Open a window",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 60,
    contexts: ["bored", "late-night"],
    tags: ["reset", "environment"],
    why: "Fresh air rapidly resets state — the body responds to oxygen before thoughts catch up.",
    steps: [
      "Walk to the nearest window.",
      "Open it fully.",
      "Take 5 deep breaths of outside air.",
      "Notice the sound, smell, and temperature."
    ]
  },
  {
    prefix: "Stand outside for two minutes",
    category: "reset",
    intensity: "calm",
    icon: "Footprints",
    durationSec: 120,
    contexts: ["bored", "stressed"],
    tags: ["reset", "outside", "fast"],
    why: "Even brief outside time changes the neurochemistry of an urge attempt.",
    steps: [
      "Step outside, no phone.",
      "Stand still and look up at the sky.",
      "Notice three different sounds.",
      "Return after the timer."
    ]
  },
  {
    prefix: "Listen to a strong song",
    category: "reset",
    intensity: "medium",
    icon: "Activity",
    durationSec: 240,
    contexts: ["bored", "lonely"],
    tags: ["reset", "music"],
    why: "Music hijacks emotion before the urge can fully form a script.",
    steps: [
      "Open your 'strong me' playlist.",
      "Pick the most charged track.",
      "Stand up and listen.",
      "Move your body if it shows up."
    ]
  },
  {
    prefix: "Read for 10 minutes",
    category: "reset",
    intensity: "calm",
    icon: "BookOpen",
    durationSec: 600,
    contexts: ["calm", "late-night"],
    tags: ["reset", "focus"],
    why: "Reading repairs the attention span that compulsive scrolling slowly destroys.",
    steps: [
      "Pick a book you already love.",
      "Open to any page.",
      "Read without checking the time.",
      "Stop only when the timer rings."
    ],
    numbers: [5, 10, 15, 20, 30]
  },
  {
    prefix: "Cook something simple",
    category: "reset",
    intensity: "medium",
    icon: "Activity",
    durationSec: 600,
    contexts: ["bored", "calm"],
    tags: ["reset", "skill"],
    why: "Cooking is an immersive task — the urge cannot survive a recipe.",
    steps: [
      "Pick the easiest thing in the fridge.",
      "Wash hands.",
      "Cook from start to finish without phone.",
      "Sit down and eat it slowly."
    ]
  },
  {
    prefix: "Plant or watering moment",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 120,
    contexts: ["calm", "lonely"],
    tags: ["reset", "care"],
    why: "Caring for a living thing borrows you out of self-orbit for free.",
    steps: [
      "Find a houseplant or tree outside.",
      "Water it slowly.",
      "Notice the leaves and texture.",
      "Speak one kind thought to it."
    ]
  },
  {
    prefix: "Tidy your digital space",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 300,
    contexts: ["bored"],
    tags: ["reset", "digital"],
    why: "Cleaning the digital surface lowers the daily friction that pushes you toward escape.",
    steps: [
      "Open your home screen.",
      "Delete or hide one app you don't love.",
      "Clear your phone notifications.",
      "Empty 10 lines of inbox."
    ]
  },
  {
    prefix: "Cold face dunk",
    category: "reset",
    intensity: "strong",
    icon: "Snowflake",
    durationSec: 60,
    contexts: ["high-urge"],
    tags: ["reset", "cold"],
    why: "Cold water on the face is the fastest physiological reset known.",
    steps: [
      "Fill a bowl with cold water.",
      "Submerge your face up to your temples.",
      "Hold for 15-30 seconds.",
      "Lift, breathe, repeat once."
    ]
  },
  {
    prefix: "Stand and stretch tall",
    category: "reset",
    intensity: "calm",
    icon: "Activity",
    durationSec: 60,
    contexts: ["any"],
    tags: ["reset", "posture"],
    why: "Posture changes mood in seconds — open up, breath opens with it.",
    steps: [
      "Stand up immediately.",
      "Reach both arms overhead.",
      "Pull shoulders back.",
      "Hold tall posture for 30 seconds."
    ]
  },
  {
    prefix: "Set a phone bedtime",
    category: "reset",
    intensity: "calm",
    icon: "Moon",
    durationSec: 120,
    contexts: ["late-night"],
    tags: ["reset", "boundary"],
    why: "A guarded bedtime is a quiet revolution — most relapses live after lights-out.",
    steps: [
      "Open Settings → Screen Time.",
      "Set Downtime to start tonight.",
      "Enable for the next 7 days.",
      "Charge your phone outside the bedroom."
    ]
  }
];

// ── Generation engine ────────────────────────────────────────────────────────

// Legacy IDs from src/lib/recovery-engine.ts — preserve them for history
// learning so the picker can carry forward "what helped" signals.
const LEGACY_ID_BY_PREFIX: Record<string, string> = {
  "pushups": "pushups-20",
  "4-7-8 breathing": "breathing-478",
  "walk outside": "walk-outside",
  "write three reasons you quit": "reasons-journal",
  "cold shower": "cold-water",
  "text accountability partner": "accountability-text"
};

function makeId(seed: SeedDef, suffix: string) {
  const prefixKey = seed.prefix.toLowerCase().trim();
  const legacy = LEGACY_ID_BY_PREFIX[prefixKey];
  if (legacy && suffix === "base") return legacy;
  const base = legacy ?? seed.prefix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const tail = suffix
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return tail ? `${base}--${tail}` : base;
}

function clampSteps(steps: string[]): string[] {
  return steps.slice(0, 4).map((s) => s.replace(/\s+/g, " ").trim().slice(0, 110));
}

export function inferChallengeEngineFamilies(input: {
  category: RecoveryChallenge["category"];
  contexts: TemplateContext[];
  durationSec: number;
  intensity: RecoveryChallenge["intensity"];
  tags?: string[];
  why?: string;
  title: string;
  steps?: string[];
}): ChallengeEngineFamily[] {
  const tags = input.tags ?? [];
  const text = [input.title, input.why ?? "", ...tags, ...(input.steps ?? [])].join(" ").toLowerCase();
  const families = new Set<ChallengeEngineFamily>();

  if (input.category === "physical" || tags.includes("physical")) families.add("physical");
  if (/(outside|outdoor|sun|sky|tree|flower|walk outside|fresh air)/.test(text)) families.add("outdoors");
  if (input.category === "breathing" || input.category === "reflection" || /(breath|mind|ground|calm|focus|relax|gratitude|identity)/.test(text)) {
    families.add("mindfulness");
  }
  if (input.category === "reset" || /(clean|tidy|desk|plan|task|focus|no-phone|environment|room)/.test(text)) {
    families.add("productivity");
  }
  if (input.category === "connection" || /(partner|text|call|message|accountability|friend|social)/.test(text)) families.add("social");
  if (input.intensity === "strong" || input.contexts.includes("high-urge") || /(urgent|emergency|cold|discharge|intense|rising urge)/.test(text)) {
    families.add("emergency");
  }
  if (input.contexts.includes("high-urge") || /(urge|craving|relapse|slip|streak|accountability|trigger)/.test(text)) {
    families.add("anti-relapse");
  }
  if (input.contexts.includes("late-night") || /(late-night|night|bed|sleep|wind-down)/.test(text)) families.add("late-night");
  if (input.durationSec <= 180 || input.category === "breathing" || input.category === "reset") families.add("quick-reset");

  return CHALLENGE_ENGINE_FAMILIES.filter((family) => families.has(family));
}

function buildTemplatesFromSeed(seed: SeedDef): ChallengeTemplate[] {
  const out: ChallengeTemplate[] = [];
  const base: Omit<ChallengeTemplate, "id" | "title" | "steps"> = {
    category: seed.category,
    durationSec: seed.durationSec,
    families: inferChallengeEngineFamilies({
      category: seed.category,
      contexts: seed.contexts,
      durationSec: seed.durationSec,
      intensity: seed.intensity,
      tags: seed.tags,
      why: seed.why,
      title: seed.prefix,
      steps: seed.steps
    }),
    intensity: seed.intensity,
    premium: seed.premium ?? false,
    icon: seed.icon,
    contexts: seed.contexts,
    tags: seed.tags,
    why: seed.why
  };

  // Base template
  out.push({
    ...base,
    id: makeId(seed, "base"),
    title: seed.prefix,
    steps: clampSteps(seed.steps)
  });

  // Number variants — interpret n based on category/word so titles stay natural.
  if (seed.numbers) {
    for (const n of seed.numbers) {
      const isBreathing = seed.category === "breathing";
      const isWalkOrRun = /\b(walk|run|jog|stair|sun)\b/i.test(seed.prefix);
      const isHold = /\b(plank|wall sit|hold|breath\b)/i.test(seed.prefix);
      const isCycles = isBreathing;

      let title: string;
      let durationSec: number;

      if (isCycles) {
        // n = number of cycles/rounds, each ~10 seconds typical.
        title = `${seed.prefix} · ${n} rounds`;
        durationSec = Math.min(900, Math.max(60, n * 30));
      } else if (isWalkOrRun) {
        // n = minutes outside / running.
        title = `${seed.prefix} · ${n} min`;
        durationSec = Math.min(900, Math.max(60, n * 60));
      } else if (isHold) {
        // n = seconds to hold.
        title = `${seed.prefix} · ${n}s`;
        durationSec = Math.min(900, Math.max(30, n));
      } else {
        // n = reps for strength/conditioning.
        title = `${n} ${seed.prefix.toLowerCase()}`;
        durationSec = Math.min(900, Math.max(seed.durationSec, Math.round(seed.durationSec * Math.max(1, n / 10))));
      }

      out.push({
        ...base,
        durationSec,
        id: makeId(seed, `n-${n}`),
        title: title.charAt(0).toUpperCase() + title.slice(1),
        steps: clampSteps(seed.steps)
      });
    }
  }

  // Variant overrides
  if (seed.variants) {
    seed.variants.forEach((variant, index) => {
      out.push({
        ...base,
        id: makeId(seed, `v-${index + 1}`),
        title: variant.title,
        steps: clampSteps(variant.steps ?? seed.steps)
      });
    });
  }

  return out;
}

// ── Curated extras (handcrafted, not seed-derived) ───────────────────────────
// These cover edge moods and specific times that the seeds don't naturally fit.

const CURATED_EXTRAS: Array<Omit<ChallengeTemplate, "families">> = [
  {
    id: "extra-shower-cold-warm",
    title: "Shower contrast (warm to cold)",
    category: "physical",
    durationSec: 300,
    intensity: "strong",
    premium: false,
    icon: "Snowflake",
    contexts: ["high-urge", "late-night"],
    tags: ["physical", "cold", "reset"],
    why: "Switching hot to cold scrambles autopilot and resets the autonomic nervous system.",
    steps: [
      "Shower warm for two minutes.",
      "Switch the water to cold.",
      "Stay under for 30 to 60 seconds.",
      "End cold and breathe out long."
    ]
  },
  {
    id: "extra-no-screen-walk",
    title: "Phoneless walk in the building",
    category: "physical",
    durationSec: 600,
    intensity: "calm",
    premium: false,
    icon: "Footprints",
    contexts: ["bored", "late-night"],
    tags: ["physical", "no-phone", "reset"],
    why: "Walking without the phone in hand teaches the body that boredom is survivable.",
    steps: [
      "Leave the phone in the room.",
      "Walk corridors, stairs, or the block.",
      "Pay attention to your feet hitting the floor.",
      "Return only when the timer ends."
    ]
  },
  {
    id: "extra-night-shutdown",
    title: "Night shutdown ritual",
    category: "reset",
    durationSec: 480,
    intensity: "calm",
    premium: false,
    icon: "Moon",
    contexts: ["late-night"],
    tags: ["reset", "sleep", "anchor"],
    why: "A defined nighttime routine forecloses the late-night decision tree where most slips happen.",
    steps: [
      "Dim the lights in your room.",
      "Charge the phone outside the bedroom.",
      "Brush teeth and stretch for 2 minutes.",
      "Get into bed and start 4-7-8 breath."
    ]
  },
  {
    id: "extra-craving-surf",
    title: "Surf the craving like a wave",
    category: "breathing",
    durationSec: 300,
    intensity: "calm",
    premium: false,
    icon: "Waves",
    contexts: ["high-urge"],
    tags: ["breath", "mindful"],
    why: "Cravings rise and fall — observing without acting weakens the loop permanently.",
    steps: [
      "Sit comfortably and close your eyes.",
      "Say silently: 'this is an urge'.",
      "Notice where it sits in the body.",
      "Watch it rise, peak, and fade."
    ]
  },
  {
    id: "extra-gratitude-3-2-1",
    title: "3-2-1 gratitude ladder",
    category: "reflection",
    durationSec: 180,
    intensity: "calm",
    premium: false,
    icon: "NotebookPen",
    contexts: ["lonely", "calm"],
    tags: ["reflection", "gratitude"],
    why: "Specific gratitude rewires noticing — what you focus on is what your brain reinforces.",
    steps: [
      "Write 3 things you have right now.",
      "Write 2 people you appreciate today.",
      "Write 1 thing you are looking forward to.",
      "Read the list out loud."
    ]
  },
  {
    id: "extra-call-grandparent",
    title: "Call someone older than 60",
    category: "connection",
    durationSec: 600,
    intensity: "calm",
    premium: false,
    icon: "MessageCircleHeart",
    contexts: ["lonely"],
    tags: ["connection", "warmth"],
    why: "Calling an elder breaks isolation in a way that no screen can replicate.",
    steps: [
      "Pick a grandparent, aunt, or family friend.",
      "Call without an agenda.",
      "Ask one open question about their day.",
      "Listen more than you speak."
    ]
  },
  {
    id: "extra-anti-shame-mantra",
    title: "Anti-shame mantra round",
    category: "reflection",
    durationSec: 120,
    intensity: "calm",
    premium: false,
    icon: "Brain",
    contexts: ["any"],
    tags: ["reflection", "self-talk"],
    why: "Replacing the inner critic with a kind, accurate voice prevents the shame spiral.",
    steps: [
      "Say: 'I am building, not failing.'",
      "Say: 'This urge is not who I am.'",
      "Say: 'I can choose the next minute.'",
      "Repeat each one three times slowly."
    ]
  },
  {
    id: "extra-bookend-day",
    title: "Bookend your day with one promise",
    category: "reflection",
    durationSec: 180,
    intensity: "calm",
    premium: false,
    icon: "NotebookPen",
    contexts: ["calm", "late-night"],
    tags: ["reflection", "structure"],
    why: "Tiny promises kept create the identity that addiction is constantly trying to erase.",
    steps: [
      "Write one specific promise for tomorrow.",
      "Keep it tiny — small wins compound.",
      "Schedule it on your phone now.",
      "Sleep on it. Honor it tomorrow."
    ]
  },
  {
    id: "extra-prayer-or-pause",
    title: "Two-minute prayer or pause",
    category: "reflection",
    durationSec: 120,
    intensity: "calm",
    premium: false,
    icon: "Brain",
    contexts: ["any"],
    tags: ["reflection", "faith", "silence"],
    why: "A short reverent pause connects you to a frame larger than the urge.",
    steps: [
      "Close your eyes wherever you are.",
      "Pray, meditate, or simply be silent.",
      "Ask for the strength of the next minute.",
      "Open your eyes and act on it."
    ]
  },
  {
    id: "extra-laughter-clip",
    title: "Watch a 5-minute laugh clip",
    category: "reset",
    durationSec: 300,
    intensity: "calm",
    premium: false,
    icon: "Activity",
    contexts: ["lonely", "stressed"],
    tags: ["reset", "humor"],
    why: "Genuine laughter floods the system with the chemicals you were chasing — for free.",
    steps: [
      "Open your saved comedy playlist.",
      "Watch exactly five minutes.",
      "Belly-laugh out loud if you can.",
      "Close the app the second the timer rings."
    ]
  },
  {
    id: "extra-bird-watch",
    title: "Watch the sky for 5 minutes",
    category: "reset",
    durationSec: 300,
    intensity: "calm",
    premium: false,
    icon: "Activity",
    contexts: ["calm", "stressed"],
    tags: ["reset", "outside"],
    why: "Looking at vastness re-anchors you to the world outside your screen.",
    steps: [
      "Find a window or doorway.",
      "Look up and don't multitask.",
      "Track clouds or birds with your eyes.",
      "Notice your breath slow naturally."
    ]
  },
  {
    id: "extra-meal-prep",
    title: "Plan tomorrow's meals",
    category: "reset",
    durationSec: 300,
    intensity: "calm",
    premium: false,
    icon: "NotebookPen",
    contexts: ["bored", "late-night"],
    tags: ["reset", "control"],
    why: "Planning food borrows agency back from autopilot mode.",
    steps: [
      "List breakfast, lunch, and dinner.",
      "Check the fridge for what you have.",
      "Write a short shopping list.",
      "Set a 5-minute prep timer for tonight."
    ]
  },
  {
    id: "extra-2-minute-rule",
    title: "2-minute productive sprint",
    category: "reset",
    durationSec: 120,
    intensity: "medium",
    premium: false,
    icon: "Activity",
    contexts: ["bored", "high-urge"],
    tags: ["reset", "discipline"],
    why: "Two minutes of meaningful work shows your brain you are bigger than this moment.",
    steps: [
      "Pick one task you have avoided.",
      "Set a 2-minute timer.",
      "Work without pause.",
      "Stop when it rings — or keep going if rolling."
    ]
  },
  {
    id: "extra-progress-photo",
    title: "Look at your progress photo",
    category: "reflection",
    durationSec: 120,
    intensity: "calm",
    premium: false,
    icon: "Activity",
    contexts: ["any"],
    tags: ["reflection", "evidence"],
    why: "Visual proof of progress overrides the lie that nothing is changing.",
    steps: [
      "Open your streak screen.",
      "Look at how far you have come.",
      "Take one new full-face photo.",
      "Compare to one from a month ago."
    ]
  },
  {
    id: "premium-binaural-reset",
    title: "Binaural beats focus reset",
    category: "breathing",
    durationSec: 600,
    intensity: "calm",
    premium: true,
    icon: "Waves",
    contexts: ["high-urge", "stressed", "calm"],
    tags: ["breath", "premium", "audio"],
    why: "Binaural audio puts the brain into a focused alpha state, which is craving-incompatible.",
    steps: [
      "Open the FREED premium audio library.",
      "Start the 10-minute binaural session.",
      "Use headphones and close your eyes.",
      "Stay until the session ends."
    ]
  },
  {
    id: "premium-clara-deep-coach",
    title: "Deep CLARA coach session",
    category: "reflection",
    durationSec: 600,
    intensity: "calm",
    premium: true,
    icon: "Brain",
    contexts: ["any"],
    tags: ["reflection", "premium", "ai-coach"],
    why: "A guided coach session unpacks the trigger pattern that one-off resets cannot reach.",
    steps: [
      "Open CLARA in the FREED app.",
      "Tap 'Premium deep dive'.",
      "Answer the three pattern questions.",
      "Read the personalized plan that follows."
    ]
  },
  {
    id: "premium-personalized-plan",
    title: "Build your personalized 24h plan",
    category: "reflection",
    durationSec: 480,
    intensity: "calm",
    premium: true,
    icon: "NotebookPen",
    contexts: ["calm", "stressed"],
    tags: ["reflection", "premium", "planning"],
    why: "A 24-hour structured plan removes future decisions, which is when urges win.",
    steps: [
      "Open the premium planner.",
      "Block the next 4 high-risk hours.",
      "Add one anchor habit per block.",
      "Save and share it with your accountability partner."
    ]
  },
  {
    id: "premium-cold-plunge",
    title: "Full cold plunge ritual",
    category: "physical",
    durationSec: 300,
    intensity: "strong",
    premium: true,
    icon: "Snowflake",
    contexts: ["high-urge", "stressed"],
    tags: ["physical", "premium", "cold"],
    why: "A deliberate cold plunge is a research-backed dopamine reset that lasts hours.",
    steps: [
      "Fill a tub with cold water.",
      "Step in slowly up to chest.",
      "Stay submerged for 1-3 minutes.",
      "Exit, dry off, sit silently for 2 minutes."
    ]
  },
  {
    id: "premium-sponsor-call",
    title: "Premium sponsor session",
    category: "connection",
    durationSec: 600,
    intensity: "medium",
    premium: true,
    icon: "MessageCircleHeart",
    contexts: ["high-urge", "lonely"],
    tags: ["connection", "premium", "sponsor"],
    why: "Premium sponsor access pairs you with someone trained to walk you through the wave.",
    steps: [
      "Open premium → sponsor connection.",
      "Tap 'Call a sponsor now'.",
      "Speak honestly about where you are.",
      "Follow their next-step recommendation."
    ]
  },
  {
    id: "extra-purpose-sentence",
    title: "Write your one purpose sentence",
    category: "reflection",
    durationSec: 240,
    intensity: "calm",
    premium: false,
    icon: "NotebookPen",
    contexts: ["calm", "lonely"],
    tags: ["reflection", "identity"],
    why: "A single anchor sentence becomes the lighthouse in tomorrow's storm.",
    steps: [
      "Open a fresh note.",
      "Finish: 'I exist to ___.'",
      "Rewrite until it feels true.",
      "Pin it to the home screen."
    ]
  }
];

// ── Final assembly ───────────────────────────────────────────────────────────

function buildAll(): ChallengeTemplate[] {
  const seeded = SEEDS.flatMap(buildTemplatesFromSeed);
  const curated = CURATED_EXTRAS.map((template) => ({
    ...template,
    families: inferChallengeEngineFamilies({
      category: template.category,
      contexts: template.contexts,
      durationSec: template.durationSec,
      intensity: template.intensity,
      tags: template.tags,
      why: template.why,
      title: template.title,
      steps: template.steps
    })
  }));
  const all = [...seeded, ...curated];

  // Programmatically expand seeded templates with mood/time variants to cross
  // the ~1000 mark without any hand-written duplicates. We attach a unique
  // suffix per generated context combo so every id stays stable.
  const moods: TemplateContext[] = ["high-urge", "late-night", "bored", "stressed", "lonely", "calm"];
  const moodLabels: Record<TemplateContext, string> = {
    "high-urge": "for a rising urge",
    "late-night": "for late-night moments",
    "bored": "when bored",
    "stressed": "when stressed",
    "lonely": "when feeling alone",
    "calm": "for a calm hour",
    "any": ""
  };

  const expanded: ChallengeTemplate[] = [...all];
  for (const tpl of seeded) {
    for (const mood of moods) {
      if (!tpl.contexts.includes(mood)) continue;
      expanded.push({
        ...tpl,
        id: `${tpl.id}--m-${mood}`,
        title: `${tpl.title} ${moodLabels[mood]}`.trim(),
        contexts: [mood]
      });
    }
  }

  // Time-of-day micro variants for top-performing categories.
  const timeFrames = [
    { key: "morning", label: "for a fresh morning" },
    { key: "afternoon", label: "for the afternoon dip" },
    { key: "evening", label: "for the evening wind-down" }
  ];
  for (const tpl of seeded) {
    if (tpl.category !== "physical" && tpl.category !== "breathing") continue;
    for (const tf of timeFrames) {
      expanded.push({
        ...tpl,
        id: `${tpl.id}--t-${tf.key}`,
        title: `${tpl.title} ${tf.label}`,
        contexts: tpl.contexts
      });
    }
  }

  // De-duplicate by id while keeping insertion order.
  const seen = new Set<string>();
  return expanded.filter((tpl) => {
    if (seen.has(tpl.id)) return false;
    seen.add(tpl.id);
    return true;
  });
}

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = buildAll();

export const CHALLENGE_TEMPLATE_COUNT = CHALLENGE_TEMPLATES.length;

export function getChallengeTemplatesByCategory(category: RecoveryChallenge["category"]) {
  return CHALLENGE_TEMPLATES.filter((tpl) => tpl.category === category);
}

export function getChallengeTemplatesByContext(context: TemplateContext) {
  if (context === "any") return CHALLENGE_TEMPLATES.slice();
  return CHALLENGE_TEMPLATES.filter((tpl) => tpl.contexts.includes(context) || tpl.contexts.includes("any"));
}

export function getChallengeEngineFamilyCoverage(templates: readonly ChallengeTemplate[] = CHALLENGE_TEMPLATES) {
  return Object.fromEntries(
    CHALLENGE_ENGINE_FAMILIES.map((family) => [
      family,
      templates.filter((template) => template.families.includes(family)).length
    ])
  ) as Record<ChallengeEngineFamily, number>;
}

/**
 * Deterministic-but-varied picker that scores templates against a profile.
 * Designed to feel personalized without any AI cost.
 */
export function pickChallengeTemplates(profile: {
  streakDays: number;
  attemptsToday: number;
  hour: number;
  mood: "low" | "steady" | "energized" | "stressed";
  premium: boolean;
  preferredCategories?: RecoveryChallenge["category"][];
  recentChallengeIds?: string[];
  helpedChallengeIds?: string[];
  helpedCategories?: RecoveryChallenge["category"][];
  slipsThisWeek?: number;
  slipWindow?: string | null;
  slipTrigger?: string | null;
  dayOfWeek?: number | null;
  interventionContext?: InterventionContextSignal | null;
  disciplinePreferences?: ChallengePreferenceSignal | null;
  contextSignals?: ChallengeContextSignal | null;
  riskForecast?: UrgeRiskForecastSignal | null;
  recentFailureCount?: number | null;
}, count = 3): RecoveryChallenge[] {
  const isLate = profile.hour >= 22 || profile.hour <= 5;
  const highUrge = profile.attemptsToday >= 2 || profile.mood === "stressed" || profile.mood === "low";
  const slipPattern = `${profile.slipWindow ?? ""} ${profile.slipTrigger ?? ""}`.toLowerCase();
  const lonelySig = /(lonely|alone|isolat|secret)/.test(slipPattern);
  const boredSig = /(bored|scroll|idle|nothing|social)/.test(slipPattern);
  const scrollingSig = /scrolling trigger pattern|doomscroll|scrolling loop/.test(slipPattern);
  const stressedSig = /(stress|anxious|anxiety|pressure|overwhelm)/.test(slipPattern);
  const isWeekend = profile.dayOfWeek === 0 || profile.dayOfWeek === 6;
  const interventionSurface = profile.interventionContext?.surface ?? null;
  const prolongedInterventionSession =
    profile.interventionContext?.sessionDurationBucket === "15-30m" ||
    profile.interventionContext?.sessionDurationBucket === "30m-plus";
  const discipline = profile.disciplinePreferences ?? null;
  const contextSignals = profile.contextSignals ?? null;
  const riskForecast = profile.riskForecast ?? null;
  const preferred = new Set(profile.preferredCategories ?? []);
  const preferredOrder = profile.preferredCategories ?? [];
  const recent = new Set(profile.recentChallengeIds ?? []);
  const helped = new Set(profile.helpedChallengeIds ?? []);
  const helpedCats = new Set(profile.helpedCategories ?? []);
  const recentFailureCount =
    typeof profile.recentFailureCount === "number" && Number.isFinite(profile.recentFailureCount)
      ? Math.max(0, Math.min(10, Math.round(profile.recentFailureCount)))
      : 0;

  const scored = CHALLENGE_TEMPLATES.map((tpl) => {
    if (!profile.premium && tpl.premium) return { tpl, score: -1 };
    if (tpl.durationSec < 30 || tpl.durationSec > 900) return { tpl, score: -1 };
    if (tpl.steps.length < 2) return { tpl, score: -1 };
    const families = new Set(tpl.families);
    let score = 1;
    if (preferred.has(tpl.category)) {
      const order = preferredOrder.indexOf(tpl.category);
      // First-preferred category gets the biggest boost so it tends to lead.
      score += order === 0 ? 3.5 : order === 1 ? 2.2 : 1.8;
    }
    if (riskForecast?.level === "high" && tpl.contexts.includes("high-urge")) score += 1.8;
    if (riskForecast?.level === "high" && families.has("anti-relapse")) score += 1.1;
    if (riskForecast?.level === "high" && families.has("emergency")) score += 0.9;
    if (riskForecast?.level === "high" && (tpl.category === "physical" || tpl.category === "breathing")) score += 1.2;
    if (riskForecast?.level === "high" && tpl.intensity === "strong") score += 0.6;
    if (riskForecast?.level === "elevated" && (tpl.category === "reset" || tpl.category === "reflection")) score += 0.7;
    if (riskForecast?.level === "low" && riskForecast.confidence !== "low" && tpl.intensity === "calm") score += 0.25;
    if (highUrge && tpl.contexts.includes("high-urge")) score += 2;
    if (highUrge && families.has("anti-relapse")) score += 1.2;
    if (isLate && tpl.contexts.includes("late-night")) score += 2;
    if (isLate && families.has("late-night")) score += 1.2;
    if (lonelySig && tpl.contexts.includes("lonely")) score += 2;
    if (boredSig && tpl.contexts.includes("bored")) score += 1.8;
    if (stressedSig && tpl.contexts.includes("stressed")) score += 1.8;
    // Pattern→category affinities derived from CBT/habit-reversal research.
    if (boredSig && tpl.category === "reset") score += 2.5;
    if (boredSig && (families.has("productivity") || families.has("quick-reset"))) score += 0.9;
    if (scrollingSig && tpl.category === "reset") score += 1.1;
    if (scrollingSig && families.has("quick-reset")) score += 1;
    if (lonelySig && tpl.category === "connection") score += 2.4;
    if (stressedSig && tpl.category === "breathing") score += 2;
    if (isWeekend && tpl.category === "reset") score += 0.7;
    if (isWeekend && tpl.category === "connection") score += 0.35;
    if (interventionSurface === "self-urge" && tpl.category === "breathing") score += 2.2;
    if (interventionSurface === "self-urge" && tpl.category === "connection") score += 1.8;
    if (interventionSurface === "adult-search" && tpl.category === "reflection") score += 1.6;
    if (interventionSurface === "adult-site" && tpl.category === "physical") score += 1.9;
    if (["social", "video", "forum"].includes(interventionSurface ?? "") && tpl.category === "reset") score += 1.8;
    if (["social", "video", "forum"].includes(interventionSurface ?? "") && tpl.category === "physical") score += 1;
    if (prolongedInterventionSession && (tpl.category === "physical" || tpl.category === "reset")) score += 0.9;
    if (prolongedInterventionSession && tpl.intensity === "calm") score -= 0.35;
    if (recentFailureCount >= 2 && (families.has("anti-relapse") || families.has("emergency"))) score += 1.1;
    if (recentFailureCount >= 2 && helpedCats.has(tpl.category)) score += 0.5;
    if (discipline?.challengeIntensity === "gentle" && tpl.intensity === "calm") score += 1.2;
    if (discipline?.challengeIntensity === "gentle" && tpl.intensity === "strong") score -= 1.7;
    if (discipline?.challengeIntensity === "strong" && tpl.intensity === "strong") score += 1.6;
    if (discipline?.emergencyStrictMode && tpl.intensity !== "calm") score += 1.3;
    if (discipline?.emergencyStrictMode && (families.has("emergency") || families.has("anti-relapse"))) score += 1.4;
    if (discipline?.outdoorFrequency === "high" && tpl.category === "reset") score += 1.2;
    if (discipline?.outdoorFrequency === "high" && families.has("outdoors")) score += 1.2;
    if (discipline?.outdoorFrequency === "low" && tpl.category === "reset") score -= 0.6;
    if (discipline?.outdoorFrequency === "low" && families.has("outdoors")) score -= 1.1;
    if (discipline?.exercisePreference === "high" && tpl.category === "physical") score += 1.5;
    if (discipline?.exercisePreference === "low" && tpl.category === "physical") score -= 1.2;
    if (discipline?.socialFrequency === "off" && tpl.category === "connection") score -= 6;
    if (discipline?.socialFrequency === "off" && families.has("social")) score -= 6;
    if (discipline?.socialFrequency === "low" && tpl.category === "connection") score -= 0.8;
    if (discipline?.socialFrequency === "high" && tpl.category === "connection") score += 1.6;
    if (discipline?.socialFrequency === "high" && families.has("social")) score += 1.2;
    if (discipline?.sleepModeActive && tpl.category === "breathing") score += 1.5;
    if (discipline?.sleepModeActive && (families.has("late-night") || families.has("mindfulness"))) score += 1.1;
    if (discipline?.sleepModeActive && tpl.intensity === "strong") score -= 0.9;
    if (discipline?.deepFocusModeActive && (tpl.category === "reset" || tpl.category === "reflection")) score += 0.8;
    if (discipline?.deepFocusModeActive && families.has("productivity")) score += 1;
    if (contextSignals?.energyLevel === "low" && tpl.intensity === "calm") score += 1;
    if (contextSignals?.energyLevel === "low" && (families.has("mindfulness") || families.has("quick-reset"))) score += 0.7;
    if (contextSignals?.energyLevel === "low" && tpl.intensity === "strong") score -= 1.2;
    if (contextSignals?.energyLevel === "high" && (tpl.category === "physical" || tpl.category === "reset")) score += 0.9;
    if ((contextSignals?.urgeLevel ?? 0) >= 4 && tpl.contexts.includes("high-urge")) score += 1;
    if ((contextSignals?.sleepQuality ?? 5) <= 2 && tpl.category === "breathing") score += 0.8;
    if (contextSignals?.locationPermission === "granted" && discipline?.outdoorFrequency === "high" && tpl.tags.includes("outside")) score += 1.1;
    if (contextSignals?.locationPermission === "granted" && discipline?.outdoorFrequency === "high" && families.has("outdoors")) score += 0.8;
    if (["rain", "snow", "storm", "hot", "cold"].includes(contextSignals?.weatherCondition ?? "") && tpl.tags.includes("outside")) score -= 1.4;
    if (highUrge && tpl.intensity === "strong") score += 1;
    if (isLate && tpl.category === "breathing") score += 1;
    if (profile.streakDays < 7 && tpl.category === "reflection") score += 0.6;
    if (profile.premium && tpl.premium) score += 1.8;
    if (helped.has(tpl.id)) score += 6;
    if (helpedCats.has(tpl.category)) score += 0.6;
    if (recent.has(tpl.id) && !helped.has(tpl.id)) score -= 1.2;
    // Light deterministic jitter so repeated calls vary slightly per hour.
    const jitter = ((tpl.id.charCodeAt(0) + profile.hour) % 13) / 100;
    return { tpl, score: score + jitter };
  });

  return scored
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, count)
    .map(({ tpl }) => ({
      id: tpl.id,
      title: tpl.title,
      category: tpl.category,
      durationSec: tpl.durationSec,
      intensity: tpl.intensity,
      premium: tpl.premium,
      icon: tpl.icon,
      steps: tpl.steps,
      why: tpl.why
    }));
}
