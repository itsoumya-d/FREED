import assert from "node:assert/strict";

import { buildRecoveryAnalyticsSnapshot } from "../src/lib/recovery-analytics";
import {
  calculateRecoveryXp,
  calculateStreakDaysFrom,
  createDefaultRecoveryState,
  getLocalDateKey,
  getPledgeStreakDays,
  getRecoveryMilestone,
  hydrateRecoveryState,
  localDateKeyDiffDays,
  recordDailyPledge,
  summarizeCheckIns,
  touchRecoveryState,
  type RecoveryState
} from "../src/lib/recovery-state";

// Frozen-time suite for every derived value that counts calendar days. It must pass in ANY
// timezone, so it runs separately under TZ=America/New_York (DST 2026-03-08 / 2026-11-01),
// TZ=Europe/London (2026-03-29 / 2026-10-25), TZ=Australia/Sydney (2026-04-05 / 2026-10-04)
// and TZ=Asia/Kolkata / TZ=UTC as no-DST controls.

const zone = process.env.TZ && process.env.TZ.length > 0 ? process.env.TZ : "(host default)";

function localDate(year: number, month: number, day: number, hour = 12, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function addLocalDays(date: Date, days: number) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

/** Independent oracle: day count from calendar fields only (Date.UTC is pure arithmetic). */
function calendarDayDiff(from: Date, to: Date) {
  return Math.round(
    (Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) -
      Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) /
      86_400_000
  );
}

// --- shared calendar helper -------------------------------------------------------------

assert.equal(localDateKeyDiffDays("2026-01-01", "2026-04-11"), 100);
assert.equal(localDateKeyDiffDays("2026-04-11", "2026-01-01"), -100);
assert.equal(localDateKeyDiffDays("2026-03-07", "2026-03-08"), 1);
assert.equal(localDateKeyDiffDays("2026-10-31", "2026-11-01"), 1);
assert.equal(localDateKeyDiffDays("not-a-date", "2026-01-01"), 0);
assert.equal(localDateKeyDiffDays("2026-01-01", "2026-13-45"), 0);

// --- streak across each zone's own DST transition ---------------------------------------

const longAgoStart = localDate(2026, 1, 1, 9, 0);
const longAgoDay = localDate(2026, 4, 11, 9, 0);
assert.equal(calculateStreakDaysFrom(longAgoStart.toISOString(), longAgoDay), 100);
assert.equal(
  calculateStreakDaysFrom(longAgoStart.toISOString(), longAgoDay),
  calendarDayDiff(longAgoStart, longAgoDay)
);

// Southern-hemisphere spring forward (Australia/Sydney loses an hour on 2026-10-04).
const sydneyStart = localDate(2026, 9, 5, 9, 0);
const sydneyDay = localDate(2026, 10, 5, 9, 0);
assert.equal(calculateStreakDaysFrom(sydneyStart.toISOString(), sydneyDay), 30);

// The transition day itself must count as exactly one day, on the short and the long day.
assert.equal(calculateStreakDaysFrom(localDate(2026, 3, 7).toISOString(), localDate(2026, 3, 8)), 1);
assert.equal(calculateStreakDaysFrom(localDate(2026, 10, 31).toISOString(), localDate(2026, 11, 1)), 1);

// Same window, same expected number, from the two streak APIs the UI shows side by side.
let pledgeState: RecoveryState = createDefaultRecoveryState();
const pledgeSpan = calendarDayDiff(sydneyStart, sydneyDay);
for (let index = 0; index <= pledgeSpan; index += 1) {
  pledgeState = recordDailyPledge(pledgeState, addLocalDays(sydneyStart, index));
}
assert.equal(pledgeState.pledges.length, pledgeSpan + 1);
const pledgeStreak = getPledgeStreakDays(pledgeState, sydneyDay);
const recoveryStreak = calculateStreakDaysFrom(sydneyStart.toISOString(), sydneyDay);
assert.equal(pledgeStreak, 31, "one pledge per calendar day is 31 days inclusive");
assert.equal(pledgeStreak - 1, recoveryStreak, "the two streak numbers must agree for one user, one day");

// A clock ahead of the start date can never produce a negative streak.
assert.equal(calculateStreakDaysFrom(localDate(2026, 6, 10).toISOString(), localDate(2026, 6, 1)), 0);
assert.equal(calculateStreakDaysFrom(null, localDate(2026, 6, 10)), 0);

// --- persisted streak survives a backwards device clock ---------------------------------

const rollbackStart = localDate(2026, 1, 1, 9, 0);
const rolledBack = touchRecoveryState(
  {
    ...createDefaultRecoveryState(),
    recoveryStartedAt: rollbackStart.toISOString(),
    streakDays: 30,
    bestStreakDays: 34,
    lastOpenedAt: localDate(2026, 1, 31, 20, 0).toISOString()
  },
  localDate(2026, 1, 20, 8, 0).toISOString()
);
assert.equal(rolledBack.streakDays, 30, "a clock jump backwards must not zero the day streak");
assert.equal(rolledBack.bestStreakDays, 34);
assert.equal(rolledBack.lastOpenedAt, localDate(2026, 1, 31, 20, 0).toISOString(), "open watermark never moves back");

// Forward progress still counts after a rollback was observed.
const recovered = touchRecoveryState(rolledBack, localDate(2026, 2, 10, 8, 0).toISOString());
assert.equal(recovered.streakDays, 40);
assert.equal(recovered.bestStreakDays, 40);

// --- saved-data backcompat (D6) ---------------------------------------------------------

// A payload serialized BEFORE the fix carries the bad pre-fix streak (99 instead of 100).
const legacyPayload = JSON.stringify({
  ...createDefaultRecoveryState(),
  recoveryStartedAt: longAgoStart.toISOString(),
  streakDays: 99,
  bestStreakDays: 99,
  lastOpenedAt: longAgoDay.toISOString(),
  dailyCheckIns: [
    {
      id: "checkin-legacy-1",
      dateKey: "2026-04-10",
      mood: "stressed",
      urgeLevel: 4,
      sleepQuality: 5,
      reflection: "legacy note",
      createdAt: localDate(2026, 4, 10, 21, 0).toISOString(),
      updatedAt: localDate(2026, 4, 10, 21, 0).toISOString()
    }
  ]
});

const legacyLoaded = hydrateRecoveryState(JSON.parse(legacyPayload));
assert.equal(legacyLoaded.recoveryStartedAt, longAgoStart.toISOString());
assert.equal(legacyLoaded.streakDays, 99, "loading old saved data must not mutate stored values");
assert.equal(legacyLoaded.dailyCheckIns.length, 1);
assert.equal(legacyLoaded.dailyCheckIns[0].reflection, "legacy note");

const healed = touchRecoveryState(legacyLoaded, localDate(2026, 4, 12, 9, 0).toISOString());
assert.equal(healed.streakDays, 101, "the corrected derivation self-heals the stored number");
assert.equal(healed.bestStreakDays, 101);
assert.equal(healed.dailyCheckIns.length, 1);

// XP follows the corrected streak, so a DST user is not permanently short-changed.
assert.equal(
  calculateRecoveryXp({
    ...legacyLoaded,
    streakDays: healed.streakDays,
    bestStreakDays: healed.bestStreakDays
  }),
  calculateRecoveryXp(legacyLoaded) + 12 * 2 + 4 * 2
);

// --- 7-day analytics window over a DST transition ---------------------------------------

const windowDay = localDate(2026, 11, 4, 9, 0);
const windowState: RecoveryState = {
  ...createDefaultRecoveryState(),
  recoveryStartedAt: localDate(2026, 1, 1, 9, 0).toISOString(),
  relapseRecords: [
    {
      id: "relapse-1",
      occurredAt: localDate(2026, 11, 1, 3, 30).toISOString(),
      previousStreakDays: 304,
      note: "slip",
      trigger: "late-night"
    }
  ]
};
const snapshot = buildRecoveryAnalyticsSnapshot(windowState, windowDay);
const historyKeys = snapshot.productionMetrics.streakHistory.map((bucket) => bucket.dateKey);

assert.equal(historyKeys.length, 7, "a 7-day window containing a DST day must still yield 7 buckets");
assert.equal(new Set(historyKeys).size, 7, "no duplicated date label");
assert.equal(historyKeys[0], "2026-10-29");
assert.equal(historyKeys[6], "2026-11-04");
assert.equal(historyKeys[3], "2026-11-01");
assert.equal(snapshot.productionMetrics.streakHistory[3].relapseResets, 1);
assert.equal(snapshot.productionMetrics.daysSinceLastRelapse, 3, "Nov 1 slip measured on Nov 4 is 3 days");
assert.equal(snapshot.productionMetrics.currentStreakDays, 307, "relapse does not reset the recovery-day counter");

// Sydney's spring forward inside the same window shape.
const sydneyWindow = buildRecoveryAnalyticsSnapshot(windowState, localDate(2026, 10, 7, 9, 0));
const sydneyKeys = sydneyWindow.productionMetrics.streakHistory.map((bucket) => bucket.dateKey);
assert.equal(new Set(sydneyKeys).size, 7);
assert.equal(sydneyKeys[0], "2026-10-01");
assert.equal(sydneyKeys[6], "2026-10-07");

// --- 7-day check-in window over a DST transition ----------------------------------------

let checkInState: RecoveryState = createDefaultRecoveryState();
for (let index = 0; index < 7; index += 1) {
  const day = addLocalDays(localDate(2026, 10, 29, 9, 0), index);
  const dateKey = getLocalDateKey(day);
  checkInState = {
    ...checkInState,
    dailyCheckIns: [
      ...checkInState.dailyCheckIns,
      {
        id: `checkin-${dateKey}`,
        dateKey,
        mood: "stressed",
        urgeLevel: 4,
        sleepQuality: 5,
        reflection: "",
        createdAt: day.toISOString(),
        updatedAt: day.toISOString()
      }
    ]
  };
}
const checkInSummary = summarizeCheckIns(checkInState, localDate(2026, 11, 4, 9, 0));
assert.equal(checkInSummary.total, 7, "the 7-day check-in window must not drop a day at DST");
assert.equal(checkInSummary.averageUrge, 4);

// --- milestone follows the corrected streak --------------------------------------------

assert.equal(
  getRecoveryMilestone({ ...createDefaultRecoveryState(), streakDays: 30 }).title,
  "30-day milestone"
);
assert.equal(getRecoveryMilestone({ ...createDefaultRecoveryState(), streakDays: 29 }).targetDays, 30);

console.log(
  `recovery-time checks passed in TZ=${zone} (streak 100 across DST, 31/30 pledge-vs-recovery agreement, ` +
    "rollback clamp, legacy payload backcompat, 7-day DST windows)"
);
