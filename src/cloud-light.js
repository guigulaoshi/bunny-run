export function sampleDensity(data, size, x, y, z) {
  if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) > 0.5) return 0;
  const coords = [x, y, z].map((v) => Math.max(0, Math.min(size - 1, (v + 0.5) * size - 0.5)));
  const base = coords.map(Math.floor), f = coords.map((v, i) => v - base[i]);
  let density = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
    const index = Math.min(size - 1, base[0] + dx) + size * (Math.min(size - 1, base[1] + dy) + size * Math.min(size - 1, base[2] + dz));
    density += data[index] / 255 * (dx ? f[0] : 1 - f[0]) * (dy ? f[1] : 1 - f[1]) * (dz ? f[2] : 1 - f[2]);
  }
  return density;
}
export function sunTransmission(clouds, sun, data, size, zoom = 1) {
  const slope = 2.15 / 15;
  const points = [[0, 0], ...Array.from({ length: 12 }, (_, i) => {
    const angle = i * Math.PI / 6;
    return [0.2 * Math.cos(angle), 0.2 * Math.sin(angle)];
  })];
  let total = 0, fullyCovered = true;
  for (const [ox, oy] of points) {
    let opticalDepth = 0;
    for (const c of clouds) {
      if (c.position.z <= sun.z) continue;
      const volume = c.userData?.density;
      const cloudData = volume?.data || data, cloudSize = volume?.width || size;
      const x = (sun.x + ox * zoom - c.position.x) / c.scale.x;
      if (Math.abs(x) > 0.5) continue;
      for (let i = 0; i < 56; i++) {
        const z = 0.5 - (i + 0.5) / 56;
        const worldZ = c.position.z + z * c.scale.z;
        const y = (sun.y + oy * zoom + slope * (worldZ - sun.z) - c.position.y) / c.scale.y;
        opticalDepth += sampleDensity(cloudData, cloudSize, x, y, z) * (0.17 / 0.022) / 56;
      }
    }
    const transmission = Math.exp(-opticalDepth);
    total += transmission;
    if (transmission > 0.025) fullyCovered = false;
  }
  return fullyCovered ? 0 : Math.min(1, total / points.length);
}
export function smoothSunlight(current, target, dt) {
  return current + (target - current) * (1 - Math.exp(-Math.max(0, dt) / 0.5));
}
