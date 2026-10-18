(() => {
  const k = "freed.recovery.state.v1";
  const st = JSON.parse(localStorage.getItem(k) || "{}");
  const D = (n) => "2026-09-" + n;
  st.recoveryStartedAt = "2026-09-26T18:40:00.000Z";
  st.streakDays = 0; st.bestStreakDays = 0;
  st.pledges = [26, 25, 24].map((n) => ({ dateKey: D(n), createdAt: "2026-09-" + n + "T18:45:00.000Z" }));
  st.dailyHabits = ["cold-shower", "exercise", "meditation"].map((key) => ({ key, label: key, dateKey: D(26), completed: true, updatedAt: "2026-09-26T19:00:00.000Z" }));
  st.dailyCheckIns = [{ id: "seed-1", dateKey: D(26), mood: "steady", urgeLevel: 2, sleepQuality: 3, reflection: "seed", createdAt: "2026-09-26T19:00:00.000Z", updatedAt: "2026-09-26T19:00:00.000Z" }];
  localStorage.setItem(k, JSON.stringify(st));
  return { seededDateKeys: st.pledges.map((p) => p.dateKey), start: st.recoveryStartedAt };
})()
