export type LibraryArticle = {
  id: string;
  title: string;
  tag: string;
  readMinutes: number;
  summary: string;
  paragraphs: string[];
};

// Short in-app recovery readings shown in the Library. Kept local on purpose:
// no network fetch, nothing leaves the device.
export const LIBRARY_ARTICLES: readonly LibraryArticle[] = [
  {
    id: "urge-wave",
    title: "How urges peak and fade",
    tag: "Mindfulness",
    readMinutes: 5,
    summary: "Cravings behave like waves: they rise, crest, and pass whether or not you act on them.",
    paragraphs: [
      "An urge is not a command. It is a temporary spike in your brain's reward system, and it follows a predictable arc: it climbs, it peaks, and then it falls. Most people misread the peak as permanent, which is exactly when they give in. Naming the arc — \"this is the crest, the fall is next\" — converts an emergency into weather.",
      "Research on urge surfing shows that a typical craving loses most of its intensity within 15 to 30 minutes if it is not fed. You do not have to defeat the urge. You only have to outlast it, and the wave does most of the work for you.",
      "The practical move: when an urge hits, start a timer, take three slow breaths, and describe the sensation like a reporter — where it lives in your body, how strong it is out of ten. Observing an urge reliably shrinks it faster than fighting it.",
      "FREED's breathing exercise and challenges exist precisely to fill those minutes. Each urge you surf weakens the circuit that produced it. Each one you act on trains the opposite. The wave always passes; the question is only what it leaves behind."
    ]
  },
  {
    id: "identity",
    title: "Build identity, not just willpower",
    tag: "Psychology",
    readMinutes: 5,
    summary: "Lasting change comes from who you believe you are, not from how hard you resist.",
    paragraphs: [
      "Willpower is a sprinter. Identity is a marathon runner. Studies on self-control consistently find that people who rely on raw resistance burn out, while people who see themselves as \"someone who doesn't do that anymore\" barely experience a fight at all.",
      "The difference is framing. \"I can't watch that\" sounds like deprivation imposed from outside. \"I don't watch that\" sounds like a fact about who you are. Reframing from can't to don't has been shown to measurably improve refusal rates.",
      "Identity is built with evidence. Every completed challenge, every surfed urge, every honest check-in is a vote for the person you are becoming. No single vote decides the election — FREED's streak and progress screens exist to make the accumulating evidence visible.",
      "Practical step: write one sentence in your check-in that starts with \"I am the kind of person who…\". Make it small and true. Then collect proof. Willpower gets you through tonight; identity gets you through the year."
    ]
  },
  {
    id: "movement",
    title: "Why movement helps cravings",
    tag: "Behavior",
    readMinutes: 5,
    summary: "Exercise changes the brain chemistry that cravings hijack — quickly, and on your side.",
    paragraphs: [
      "Cravings run on dopamine and stress hormones. Movement runs on them too — but it converts them. A brisk ten-minute walk raises dopamine and serotonin through healthy channels, drops cortisol, and reliably reduces cue reactivity, which is the brain's knee-jerk pull toward old habits.",
      "The effect is fast. Studies find measurable reductions in craving intensity after even five to ten minutes of moderate movement, with the strongest effects for outdoor walking and brief intense effort like stairs or jumping jacks.",
      "Movement also does something subtler: it proves agency. A craving says you have no choice; choosing to move your body is a physical demonstration that you do. That proof matters more in the moment than any argument.",
      "This is why FREED's challenges lean physical — cold showers, walks, stretches, exercise snacks. You are not distracting yourself. You are giving the reward system a better offer at the exact moment it is listening."
    ]
  },
  {
    id: "relapse-data",
    title: "Make relapse data useful",
    tag: "Recovery",
    readMinutes: 5,
    summary: "A slip is a data point, not a verdict. What you log and how you read it decides the trend.",
    paragraphs: [
      "Shame says a slip erases everything. Data says a slip is a sample with a timestamp, a trigger, and a context. People who recover longest are not the ones who never slip — they are the ones who mine every slip for the pattern behind it.",
      "The method is simple. After a slip, log three things: the time window, the trigger (boredom, stress, loneliness, late night), and the missing guardrail. One slip is noise. Three slips with the same trigger are a route map, and routes can be blocked.",
      "FREED turns this into the urge-risk forecast and your progress screen: when your logged slips cluster at 11pm on stressful days, the app can warn you before that window opens instead of judging you after it closes.",
      "The reframe that matters: you are not a person who failed. You are an analyst holding a new data point. Analysts adjust the plan and continue. That is also, not coincidentally, exactly what your streak statistics do — they keep counting."
    ]
  }
];
