import { CHALLENGE_TEMPLATES, CHALLENGE_TEMPLATE_COUNT, pickChallengeTemplates } from "@/data/challenge-templates";

console.log(`Total templates: ${CHALLENGE_TEMPLATE_COUNT}`);

const byCat = new Map<string, number>();
for (const t of CHALLENGE_TEMPLATES) {
  byCat.set(t.category, (byCat.get(t.category) ?? 0) + 1);
}
console.log("By category:", Object.fromEntries(byCat));

const sample = pickChallengeTemplates({
  streakDays: 5,
  attemptsToday: 2,
  hour: 23,
  mood: "stressed",
  premium: false,
  preferredCategories: ["breathing", "physical"]
});
console.log("\nSample picks for late-night high-urge user:");
for (const c of sample) {
  console.log(`  - ${c.title} [${c.category}, ${c.intensity}, ${c.durationSec}s]`);
}
