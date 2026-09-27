export function createScoreStars() {
  let lastScore = 0, active = [];
  return { update(score, phase, dt) {
    if (phase === "idle" || score < lastScore) {
      active = [];
      lastScore = score;
    }
    for (const star of active) star.age += Math.max(0, dt);
    active = active.filter((star) => star.age < 1.3);
    const gain = Math.max(0, score - lastScore);
    if (gain) {
      const occupied = new Set(active.map((star) => star.lane));
      const origin = active.length ? active[0].lane % 1 : -(gain - 1) / 2;
      const candidates = [];
      const radius = active.length + gain + Math.ceil(Math.abs(origin));
      for (let i = -radius; i <= radius; i++) if (!occupied.has(origin + i)) candidates.push(origin + i);
      candidates.sort((a, b) => Math.abs(a) - Math.abs(b) || a - b);
      for (const lane of candidates.slice(0, gain).sort((a, b) => a - b)) active.push({ age: 0, lane });
    }
    lastScore = score;
    return active;
  } };
}
export function starSlot(lane) {
  return { x: lane * 0.28, y: 0 };
}
