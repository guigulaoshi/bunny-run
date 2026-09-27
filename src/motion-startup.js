export function motionHint(phase, tracking, fresh, restarting = false) {
  if (phase === "connecting") return "\u6B63\u5728\u8FDE\u63A5\u6444\u50CF\u5934\u2026";
  if (phase === "loading") return "\u6B63\u5728\u51C6\u5907\u52A8\u4F5C\u8BC6\u522B\u2026";
  if (phase === "tracking") {
    if (!tracking.tracked || !fresh) return "\u8BF7\u8BA9\u5934\u90E8\u6216\u80A9\u8180\u8FDB\u5165\u955C\u5934";
    if (!tracking.ready) return "\u8BF7\u7AD9\u7A33\u7247\u523B\uFF0C\u6B63\u5728\u6821\u51C6\u2026";
    return restarting ? "\u8DF3\u4E00\u6B21\u91CD\u65B0\u5F00\u59CB" : "\u8DF3\u4E00\u6B21 \xB7 \u5F00\u59CB";
  }
  return restarting ? "\u6309\u7A7A\u683C\u91CD\u65B0\u5F00\u59CB" : "\u6309\u7A7A\u683C\u5F00\u59CB";
}
export async function prepareMotion({ play, load, isCurrent, ready, list }) {
  await Promise.all([play(), load()]);
  if (!isCurrent()) return false;
  ready();
  try {
    await list();
  } catch {
  }
  return isCurrent();
}
