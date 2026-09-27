export const FEATURE_VERSION = "visible-anchor-16x2-v1";
export const WINDOW_MS = 600;
export const STEP_MS = 40;
export const GROUPS = [
  { name: "\u80A9\u8180", ids: [11, 12] },
  { name: "\u5934\u90E8", ids: [0, 2, 5] },
  { name: "\u9ACB\u90E8", ids: [23, 24] }
];
export const usable = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= 0.55 && p.x > 0 && p.x < 1 && p.y > 0 && p.y < 1;
export function anchorAt(points, preferred = "", groups = GROUPS) {
  const order = [...groups].sort((a, b) => Number(b.name === preferred) - Number(a.name === preferred));
  for (const group of order) {
    const ids = group.ids.filter((i) => usable(points?.[i]));
    if (!ids.length) continue;
    return {
      key: `${group.name}:${ids.join(",")}`,
      source: group.name,
      y: ids.reduce((s, i) => s + points[i].y, 0) / ids.length
    };
  }
  return null;
}
export function featuresAt(rows, now) {
  if (rows.length < 2 || rows[0].t > now - WINDOW_MS) return null;
  const selected = [];
  let cursor = 0;
  for (let i = 0; i < 16; i++) {
    const target = now - WINDOW_MS + i * STEP_MS;
    while (cursor + 1 < rows.length && rows[cursor + 1].t <= target) cursor++;
    const a = rows[cursor], b = rows[cursor + 1];
    if (a.t > target || target - a.t > 120) return null;
    const y = b && b.t <= now && b.t - a.t <= 160 ? a.y + (b.y - a.y) * (target - a.t) / (b.t - a.t) : a.y;
    selected.push(y);
  }
  return selected.flatMap((y, i) => [(y - selected[0]) * 10, i ? (y - selected[i - 1]) * 10 : 0]);
}
export function validateModel(model) {
  const finite = (a) => Array.isArray(a) && a.every(Number.isFinite);
  if (model?.featureVersion !== FEATURE_VERSION || model.mean?.length !== 32 || !finite(model.mean) || model.scale?.length !== 32 || !finite(model.scale) || model.scale.some((x) => x <= 0) || model.bias1?.length !== 32 || !finite(model.bias1) || model.weights1?.length !== 32 || !model.weights1.every((a) => a.length === 32 && finite(a)) || model.weights2?.length !== 32 || !finite(model.weights2) || !Number.isFinite(model.bias2)) {
    throw new Error("Incompatible jump model");
  }
  return model;
}
export function predictJump(features, model) {
  const x = features.map((v, i) => (v - model.mean[i]) / model.scale[i]);
  const hidden = model.bias1.map((b, j) => Math.max(0, b + x.reduce((s, v, i) => s + v * model.weights1[i][j], 0)));
  const z = model.bias2 + hidden.reduce((s, v, i) => s + v * model.weights2[i], 0);
  return 1 / (1 + Math.exp(-z));
}
