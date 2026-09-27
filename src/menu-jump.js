export function menuJump(phase, tracking, now, gameOverAt) {
  return Boolean(tracking.tracked && tracking.ready && tracking.jump && (phase === "idle" || phase === "over" && now - gameOverAt >= 800));
}
