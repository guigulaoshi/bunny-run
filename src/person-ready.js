export function personReady(mode, hasCamera, tracking, now, lastTracked) {
  if (!hasCamera) return true;
  return Boolean(hasCamera && tracking.ready && tracking.tracked && now - lastTracked < 200);
}
