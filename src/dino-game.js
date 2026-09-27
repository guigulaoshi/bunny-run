import { STUMP_TYPES } from "./stump-types.js";
export const WORLD = { width: 1e3, height: 360, ground: 286 };
export const JUMP_GRAVITY = 1850 / 1.5;
export const DINO = { x: 110, width: 54, height: 70 };
export const JUMP_SPEED = 650;
export const REACTION_TIME = 0.6;
export const JUMP_AIRTIME = 2 * JUMP_SPEED / JUMP_GRAVITY;
const advance = (speed, seconds) => speed * seconds + 4 * seconds * seconds;
export function difficultyFor(speed, score = 0) {
  const progress = 1 - Math.exp(-(Math.max(0, speed - 280) / 1e3 + Math.max(0, score) / 100));
  return { progress, reaction: 0.85 - 0.4 * progress, precision: 0.35 - 0.19 * progress, recovery: 0.22 - 0.12 * progress };
}
export function carrotChances(speed) {
  const progress = 1 - Math.exp(-Math.max(0, speed - 280) / 550);
  return { solo: 0.27 - 0.23 * progress, combo: 0 };
}
export function obstacleGap(speed, width, randomValue, score = 0) {
  const difficulty = difficultyFor(speed, score);
  return advance(speed + 16, JUMP_AIRTIME + difficulty.recovery + 0.8 * Math.max(0, 1 - score / 12)) + randomValue * speed * 0.12;
}
export function visibleCourseWidth(speed, score = 0) {
  const d = difficultyFor(speed, score);
  return Math.max(WORLD.width, DINO.x + DINO.width + advance(speed, Math.max(0.6, d.reaction) + 0.42) + 80);
}
export function clearanceDuration(height) {
  return 2 * Math.sqrt(JUMP_SPEED ** 2 - 2 * JUMP_GRAVITY * (height + 8)) / JUMP_GRAVITY;
}
export function obstaclePoints(obstacle) {
  const type = STUMP_TYPES.find((t) => t.kind === obstacle.kind);
  if (type) return type.points;
  const width = Math.max(0, Math.min(1, (obstacle.width - 28) / 28));
  const height = Math.max(0, Math.min(1, (obstacle.height - 36) / 38));
  const size = (width + height) / 2;
  return size < 1 / 3 ? 1 : 2;
}
export function jumpAccuracy(apexDistance, obstacleCenter, speed) {
  if (!Number.isFinite(apexDistance)) return 0;
  const timingError = Math.abs(apexDistance - obstacleCenter) / Math.max(1, speed);
  return Math.max(0, Math.min(1, 1 - timingError / 0.35));
}
export function cactusReward(obstacle, accuracy) {
  const base = obstaclePoints(obstacle);
  const multiplier = accuracy >= 0.9 ? 1.5 : accuracy >= 0.6 ? 1.25 : 1;
  return Math.min(base * 2, Math.round(base * multiplier));
}
export function obstaclePattern(speed, random, score = 0) {
  const d = difficultyFor(speed, score);
  const roll = random();
  let type = score < 6 ? STUMP_TYPES[0] : roll < 0.33 * (1 - d.progress) ? STUMP_TYPES[0] : roll < 0.75 - 0.55 * d.progress ? STUMP_TYPES[1] : STUMP_TYPES[2];
  const fits = (t) => clearanceDuration(t.height) - (t.width + DINO.width) / speed >= d.precision + 0.045;
  if (!fits(type)) type = STUMP_TYPES[0];
  const width = type.width;
  const first = { ...type, width, offset: 0, variant: random() };
  if (score >= 12 && speed >= 420 && random() < 0.2 + 0.5 * d.progress) {
    const gap = 12 + random() * 10;
    const second = { ...STUMP_TYPES[0], offset: 0, variant: random() };
    const pairBudget = speed * (clearanceDuration(Math.max(type.height, second.height)) - d.precision - 0.045) - DINO.width;
    if (pairBudget >= type.width + gap + second.width) {
      second.offset = first.width + gap;
      return [first, second];
    }
  }
  return [first];
}
export function createDinoGame(random = Math.random) {
  let jumpRecord = null;
  const state = { accuracy: null, impact: null, phase: "idle", distance: 0, score: 0, speed: 280, y: 0, vy: 0, obstacles: [], carrots: [], spawned: 0, collected: 0, spawnRemaining: 500, viewWidth: WORLD.width, cleared: 0, elapsed: 0, jumps: 0 };
  function start() {
    jumpRecord = null;
    Object.assign(state, { accuracy: null, impact: null, phase: "playing", distance: 0, score: 0, speed: 280, y: 0, vy: 0, obstacles: [], carrots: [], spawned: 0, collected: 0, spawnRemaining: 500, viewWidth: WORLD.width, cleared: 0, elapsed: 0, jumps: 0 });
  }
  function jump() {
    if (state.phase !== "playing" || state.y > 0 || state.vy !== 0) return false;
    state.vy = JUMP_SPEED;
    state.jumps++;
    jumpRecord = { id: state.jumps, apex: state.distance + advance(state.speed, JUMP_SPEED / JUMP_GRAVITY), speed: state.speed, measured: false };
    return true;
  }
  function tick(dt) {
    state.elapsed += dt;
    state.speed = Math.sqrt(280 ** 2 + 16 * state.distance);
    state.viewWidth = visibleCourseWidth(state.speed, state.score);
    const previousDistance = state.distance, previousVy = state.vy;
    state.distance += state.speed * dt;
    state.vy -= JUMP_GRAVITY * dt;
    if (jumpRecord && !jumpRecord.measured && previousVy > 0 && state.vy <= 0) {
      jumpRecord.apex = previousDistance + state.speed * (previousVy / JUMP_GRAVITY);
      jumpRecord.speed = state.speed;
      jumpRecord.measured = true;
    }
    state.y = Math.max(0, state.y + state.vy * dt);
    if (state.y === 0) state.vy = 0;
    const travel = state.speed * dt;
    state.spawnRemaining -= travel;
    while (state.spawnRemaining <= 0) {
      const origin = state.viewWidth + 20 + state.spawnRemaining + travel;
      const lesson = state.spawned < 2;
      const carrotRate = carrotChances(state.speed);
      const carrotOnly = lesson || random() < carrotRate.solo;
      const pattern = carrotOnly ? [] : obstaclePattern(state.speed, random, state.score);
      for (const obstacle of pattern) state.obstacles.push({ ...obstacle, x: origin + obstacle.offset, bottom: 0 });
      const span = pattern.length ? pattern.at(-1).offset + pattern.at(-1).width : 32;
      if (carrotOnly) {
        state.carrots.push({ x: origin, width: 32, height: 54, bottom: 135 });
      }
      state.spawned++;
      state.spawnRemaining += obstacleGap(state.speed, span, random(), state.score);
    }
    for (const obstacle of state.obstacles) {
      obstacle.x -= state.speed * dt;
      if (state.y > 0 && DINO.x + DINO.width > obstacle.x && DINO.x < obstacle.x + obstacle.width) {
        obstacle.jumpId = state.jumps;
      }
      if (DINO.x + DINO.width - 6 > obstacle.x + 4 && DINO.x + 7 < obstacle.x + obstacle.width - 4 && state.y + 5 < obstacle.bottom + obstacle.height - 3 && state.y + DINO.height - 4 > obstacle.bottom + 3) {
        const top = obstacle.bottom + obstacle.height;
        const previousY = state.y - state.vy * dt;
        const topHit = state.vy < 0 && previousY + 5 >= top - 3;
        state.impact = {
          speed: state.speed,
          vy: state.vy,
          y: state.y,
          normalY: topHit,
          contactX: (obstacle.x + obstacle.width / 2 - (DINO.x + DINO.width / 2)) / 100,
          contactY: Math.min(top, state.y + DINO.height * 0.8),
          trajectoryAngle: Math.atan2(state.vy, state.speed)
        };
        state.phase = "over";
        break;
      }
      if (!obstacle.cleared && obstacle.x + obstacle.width < DINO.x + 7) {
        obstacle.cleared = true;
        state.cleared++;
        const center = state.distance + obstacle.x + obstacle.width / 2 - (DINO.x + DINO.width / 2);
        const accuracy = jumpRecord && obstacle.jumpId === jumpRecord.id ? jumpAccuracy(jumpRecord.apex, center, jumpRecord.speed) : 0;
        state.accuracy = Math.round(accuracy * 100);
        state.score += cactusReward(obstacle, accuracy);
      }
    }
    for (const carrot of state.carrots) {
      carrot.x -= travel;
      if (state.phase === "playing" && !carrot.collected && state.y > 0 && DINO.x + DINO.width > carrot.x && DINO.x < carrot.x + carrot.width && state.y + DINO.height > carrot.bottom && state.y < carrot.bottom + carrot.height) {
        carrot.collected = true;
        state.collected++;
        state.score++;
      }
    }
    state.carrots = state.carrots.filter((c) => !c.collected && c.x + c.width > -20);
    state.obstacles = state.obstacles.filter((o) => o.x + o.width > -20);
  }
  function step(dt, active = true) {
    if (state.phase !== "playing" || !active || !Number.isFinite(dt) || dt <= 0) return;
    let remaining = Math.min(dt, 0.1);
    while (remaining > 0 && state.phase === "playing") {
      const step2 = Math.min(remaining, 1 / 120);
      tick(step2);
      remaining -= step2;
    }
  }
  return { state, start, jump, step };
}
