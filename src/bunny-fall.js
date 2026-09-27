import { JUMP_GRAVITY } from "./dino-game.js";
export function createBunnyFall(impact, angle = 0, vertical = 1, horizontal = 1) {
  const rx = 0.3 * horizontal, ry = 0.52 * vertical, inertia = (rx * rx + ry * ry) / 4;
  const offset = ry;
  const body = {
    x: -Math.sin(angle) * offset,
    y: impact.y / 100 + Math.cos(angle) * offset,
    vx: 0,
    vy: impact.vy / 100,
    angle,
    omega: 0,
    grounded: false
  };
  const speed = impact.speed / 100;
  if (impact.normalY) {
    const impulse = -1.16 * Math.min(0, body.vy);
    body.vy += impulse;
    body.vx = speed * 0.18;
    body.omega = (impact.contactX || 0) * impulse / inertia;
  } else {
    const impulse = -speed * 1.14;
    body.vx = speed + impulse;
    const lever = Math.max(-ry * 0.8, Math.min(ry * 0.8, impact.contactY / 100 - body.y));
    body.omega = -lever * impulse / inertia;
  }
  body.omega = Math.max(-14, Math.min(14, body.omega));
  function step(dt) {
    const duration = Math.max(0, Math.min(0.1, dt)), steps = Math.max(1, Math.ceil(duration / 4e-3)), h = duration / steps;
    for (let i = 0; i < steps; i++) {
      body.vy -= JUMP_GRAVITY / 100 * h;
      body.x += body.vx * h;
      body.y += body.vy * h;
      body.angle += body.omega * h;
      body.omega *= Math.exp(-0.35 * h);
      const sn = Math.sin(body.angle), cs = Math.cos(body.angle);
      const support = Math.hypot(rx * sn, ry * cs);
      body.grounded = body.y <= support;
      if (body.grounded) {
        body.y = support;
        const contactX = (ry * ry - rx * rx) * sn * cs / support, contactY = -support;
        const normalVelocity = body.vy + body.omega * contactX;
        let impulse = 0;
        if (normalVelocity < 0) {
          const bounce = normalVelocity < -0.8 ? 0.13 : 0;
          impulse = -(1 + bounce) * normalVelocity / (1 + contactX * contactX / inertia);
          body.vy += impulse;
          body.omega += contactX * impulse / inertia;
        }
        const tangentVelocity = body.vx - body.omega * contactY;
        const frictionLimit = 0.75 * (impulse + JUMP_GRAVITY / 100 * h);
        const friction = Math.max(-frictionLimit, Math.min(frictionLimit, -tangentVelocity / (1 + contactY * contactY / inertia)));
        body.vx += friction;
        body.omega -= contactY * friction / inertia;
        body.omega *= Math.exp(-4 * h);
      }
    }
    return {
      x: body.x + Math.sin(body.angle) * offset,
      y: body.y - Math.cos(body.angle) * offset,
      angle: body.angle,
      vy: body.vy,
      omega: body.omega,
      grounded: body.grounded
    };
  }
  return { step, body };
}
