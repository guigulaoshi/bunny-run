export function createSpring(value = 0) {
  return { value, velocity: 0 };
}
export function stepSpring(spring, target, dt, stiffness = 105, damping = 9) {
  if (!(dt > 0) || !Number.isFinite(dt)) return spring.value;
  const duration = Math.min(dt, 0.1);
  const steps = Math.ceil(duration / 5e-3), h = duration / steps;
  for (let i = 0; i < steps; i++) {
    spring.velocity += ((target - spring.value) * stiffness - damping * spring.velocity) * h;
    spring.value += spring.velocity * h;
  }
  return spring.value;
}
export function createRubberBody() {
  const stretch = createSpring(), sway = createSpring();
  let wasAirborne = false, lastJumps = 0;
  return {
    update(state, dt) {
      const airborne = state.y > 0;
      if (state.jumps < lastJumps || state.phase === "idle") {
        stretch.value = stretch.velocity = sway.value = sway.velocity = 0;
        wasAirborne = false;
      }
      if (state.jumps > lastJumps) {
        stretch.velocity += 9;
        sway.velocity -= 1.05;
      }
      if (wasAirborne && !airborne) {
        stretch.velocity -= 8.5;
        sway.velocity += 1.2;
      }
      lastJumps = state.jumps;
      wasAirborne = airborne;
      const phase = state.distance / 160 * Math.PI * 2;
      const running = state.phase === "playing" && !airborne;
      const target = airborne ? 0.12 : running ? Math.sin(phase * 2) * 0.24 : 0;
      const elongation = Math.max(-0.48, Math.min(0.85, stepSpring(stretch, target, dt, 85, 7)));
      const lean = stepSpring(sway, running ? Math.sin(phase) * 0.055 : 0, dt, 70, 7);
      const vertical = 1 + elongation;
      return { vertical, horizontal: 1 / Math.sqrt(vertical), lean };
    }
  };
}
