import { anchorAt, featuresAt, validateModel, predictJump, WINDOW_MS } from "./jump-features.js";
export class LearnedJumpDetector {
  constructor(model = null) {
    this.model = model && validateModel(model);
    this.reset();
  }
  setModel(model) {
    this.model = validateModel(model);
    this.reset();
  }
  reset() {
    this.rows = [];
    this.key = "";
    this.source = "";
    this.armed = false;
    this.lastJump = -Infinity;
  }
  update(points, now, sensitivity = 1) {
    const anchor = anchorAt(points, this.source);
    if (!anchor) {
      this.reset();
      return { tracked: false, ready: false, jump: false };
    }
    const previous = this.rows.at(-1);
    if (anchor.key !== this.key || previous && (now <= previous.t || now - previous.t > 200)) this.reset();
    this.key = anchor.key;
    this.source = anchor.source;
    this.rows.push({ t: now, y: anchor.y });
    while (this.rows.length > 1 && this.rows[1].t < now - WINDOW_MS - 160) this.rows.shift();
    const x = featuresAt(this.rows, now);
    if (!x || !this.model) return { tracked: true, ready: false, jump: false, source: this.source };
    const probability = predictJump(x, this.model);
    if (probability < 0.3) this.armed = true;
    const threshold = Math.max(0.5, Math.min(0.8, 0.65 / (Number.isFinite(sensitivity) ? sensitivity : 1)));
    let jump = false;
    if (this.armed && probability >= threshold && now - this.lastJump > 500) {
      jump = true;
      this.armed = false;
      this.lastJump = now;
    }
    return { tracked: true, ready: true, jump, source: this.source, probability };
  }
}
