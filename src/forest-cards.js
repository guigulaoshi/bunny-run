import { meadowCoverage, meadowDepth } from "./forest-edge.js";
import { sceneryParallax, forestRetreat } from "./scenery-motion.js";
import { SUN_SHADOW } from "./sun-light.js";
import * as THREE from "./vendor/three.module.min.js";
const TREE_VARIANTS = 4;
const FOREST_EDGE = -2.6;
const TREE_SHADOW_OPACITY = 0.594;
const rng = (seed) => () => {
  seed = seed * 1664525 + 1013904223 >>> 0;
  return seed / 4294967296;
};
function texture(kind, colorIndex = 0) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 384;
  const ctx = canvas.getContext("2d"), random = rng(4821 + kind * 971);
  if (kind === 4) {
    for (let i = 0; i < 38; i++) {
      const x = 12 + random() * 232, y = 210 + random() * 140, lean = (random() - 0.5) * 90;
      ctx.fillStyle = ["#709447", "#91b45c", "#527c3d"][i % 3];
      ctx.beginPath();
      ctx.moveTo(x - 4, 382);
      ctx.quadraticCurveTo(x + lean * 0.2, y + 35, x + lean, y);
      ctx.quadraticCurveTo(x + lean * 0.45, y + 65, x + 5, 382);
      ctx.fill();
    }
  }
  if (kind >= 5 && kind <= 7) {
    const palette = ["#fff4d6", "#ffd45c", "#f58eaf", "#b9a0ef", "#f5b17c", "#e65d83", "#a5d6f2", "#ffffff"];
    {
      const x = 128, y = 205, type = kind - 5;
      ctx.strokeStyle = "#568443";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(x, 384);
      ctx.quadraticCurveTo(x - 12, y + 50, x, y);
      ctx.stroke();
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1.5, 1.5);
      ctx.fillStyle = palette[colorIndex];
      const petals = [5, 8, 6][type];
      for (let petal = 0; petal < petals; petal++) {
        const angle = petal * Math.PI * 2 / petals;
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        if (type === 2) {
          ctx.moveTo(7, 0);
          ctx.quadraticCurveTo(26, -20, 50, 0);
          ctx.quadraticCurveTo(26, 20, 7, 0);
        } else ctx.ellipse(26, 0, 24, type === 1 ? 9 : 16, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.fillStyle = type === 2 ? "#9b5834" : "#dba944";
      ctx.beginPath();
      ctx.arc(0, 0, type === 1 ? 14 : 12, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
  if (kind === 8) {
    ctx.fillStyle = "#604027";
    ctx.beginPath();
    ctx.ellipse(128, 239, 77, 134, 0, 0, Math.PI * 2);
    ctx.fill();
    for (let row = 0; row < 8; row++) {
      const y = 125 + row * 31, half = 67 * Math.sin((row + 0.8) / 9 * Math.PI);
      const count = 2 + Math.round(half / 18);
      for (let col = 0; col < count; col++) {
        const x = 128 + (col - (count - 1) / 2) * (half * 2 / count);
        const shine = ctx.createLinearGradient(x, y - 16, x, y + 17);
        shine.addColorStop(0, "#c09159");
        shine.addColorStop(0.45, "#986435");
        shine.addColorStop(1, "#5d3c27");
        ctx.fillStyle = shine;
        ctx.beginPath();
        ctx.moveTo(x, y - 18);
        ctx.bezierCurveTo(x + 24, y - 8, x + 22, y + 8, x, y + 18);
        ctx.bezierCurveTo(x - 22, y + 8, x - 24, y - 8, x, y - 18);
        ctx.fill();
      }
    }
  }
  if (kind === 9) {
    for (let i = 0; i < 18; i++) {
      const x = 25 + random() * 206, y = 35 + random() * 314, angle = random() * Math.PI * 2, length = 25 + random() * 42;
      ctx.strokeStyle = ["#967248", "#ae8958", "#786444", "#66704a"][i % 4];
      ctx.lineWidth = 2 + random();
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + Math.cos(angle + 0.15) * length * 0.5, y + Math.sin(angle + 0.15) * length * 0.5, x + Math.cos(angle) * length, y + Math.sin(angle) * length);
      ctx.stroke();
    }
  }
  const result = new THREE.CanvasTexture(canvas);
  result.colorSpace = THREE.SRGBColorSpace;
  return result;
}
async function treeTextures() {
  const map = await new THREE.TextureLoader().loadAsync(`${import.meta.env.BASE_URL}textures/pine.png`);
  map.colorSpace = THREE.SRGBColorSpace;
  const canvas = document.createElement("canvas"), image = map.image;
  canvas.width = image.width;
  canvas.height = image.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let left = canvas.width, right = -1, top = canvas.height, bottom = -1;
  for (let y = 0; y < canvas.height; y++) for (let x = 0; x < canvas.width; x++) {
    if (pixels[(y * canvas.width + x) * 4 + 3] > 114) {
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (right >= left) {
    map.offset.set(left / canvas.width, (canvas.height - 1 - bottom) / canvas.height);
    map.repeat.set((right - left + 1) / canvas.width, (bottom - top + 1) / canvas.height);
  }
  return Array(TREE_VARIANTS).fill(map);
}
function distantCanopy() {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d"), random = rng(91724);
  ctx.fillStyle = "#3c6046";
  ctx.fillRect(0, 115, 1024, 141);
  for (let row = 0; row < 4; row++) for (let i = 0; i < 150; i++) {
    const x = i / 150 * 1024 + (random() - 0.5) * 10, y = 20 + row * 42 + random() * 25;
    const h = 42 + random() * 40, w = 12 + random() * 15;
    ctx.fillStyle = ["#648564", "#54775a", "#476b50", "#3c6046"][row];
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x - w, y + h);
    ctx.closePath();
    ctx.fill();
    ctx.fillRect(x - w, y + h - 2, w * 2, 256 - y - h + 2);
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = 5;
  return map;
}
export const treeParallax = sceneryParallax;
export async function createForestCards(scene) {
  const random = rng(27431), geometry = new THREE.PlaneGeometry(1, 1);
  geometry.translate(0, 0.5, 0);
  const flowerVariants = 24;
  const maps = [...await treeTextures(), texture(4), ...Array.from({ length: flowerVariants }, (_, i) => texture(5 + i % 3, Math.floor(i / 3))), texture(8)];
  const materials = Array.from({ length: maps.length }, (_, kind) => new THREE.MeshBasicMaterial({ map: maps[kind], alphaTest: 0.45, side: THREE.DoubleSide }));
  const shadows = [], batches = [], dummy = new THREE.Object3D(), wrap = (x, w) => ((x + w / 2) % w + w) % w - w / 2;
  const canopyMap = distantCanopy();
  const canopy = new THREE.Mesh(new THREE.PlaneGeometry(40, 0.64), new THREE.MeshBasicMaterial({ map: canopyMap, alphaTest: 0.4 }));
  canopy.position.set(0, 0.29, -10.4);
  scene.add(canopy);
  for (let layer = 0; layer < 6; layer++) for (let kind = 0; kind < TREE_VARIANTS; kind++) {
    const count = [20, 32, 50, 72, 100, 128][layer], mesh = new THREE.InstancedMesh(geometry, materials[kind], count), items = [];
    for (let i = 0; i < count; i++) {
      const h = 0.85 * (1 + random() * 0.7) * (1 - layer * 0.125);
      items.push({ x: (i * TREE_VARIANTS + kind) / (count * TREE_VARIANTS) * 40 + (random() - 0.5) * 0.22, z: -2.6 - layer * 1.28 - random() * 0.8, h: h * 0.9, w: h * (0.62 + random() * 0.38) });
      const tint = new THREE.Color().setHSL(0.28, 0.1 + layer * 0.015, 0.86 - layer * 0.035);
      mesh.setColorAt(i, tint);
    }
    mesh.frustumCulled = false;
    scene.add(mesh);
    batches.push({ mesh, items, forest: true });
    if (layer < 2) {
      const shadow = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial({ map: maps[kind], color: "#243b26", transparent: true, opacity: TREE_SHADOW_OPACITY, alphaTest: 1e-3, depthWrite: false, side: THREE.DoubleSide }), count);
      shadow.frustumCulled = false;
      shadow.renderOrder = 1;
      scene.add(shadow);
      shadows.push({ mesh: shadow, items });
    }
  }
  const grassRandom = rng(53841), grassItems = [];
  for (let i = 0; i < 700; i++) {
    const p = { x: grassRandom() * 40, z: 3 - grassRandom() * 13, h: 0.09 + grassRandom() * 0.19, w: 0.18 + grassRandom() * 0.28 };
    if (grassRandom() < meadowCoverage(p.z)) grassItems.push(p);
  }
  const grass = new THREE.InstancedMesh(geometry, materials[TREE_VARIANTS], grassItems.length);
  grass.frustumCulled = false;
  scene.add(grass);
  batches.push({ mesh: grass, items: grassItems, meadow: true });
  const flowerRandom = rng(82641), flowerItems = [];
  for (let row = 0; row < 35; row++) for (let col = 0; col < 100; col++) {
    flowerItems.push({
      x: (col + 0.15 + flowerRandom() * 0.7) * 0.4,
      z: -4.5 + ((row < 18 ? row : 17 - row) + 0.15 + flowerRandom() * 0.7) * 0.4,
      h: 0.09 + flowerRandom() * 0.1,
      w: 0.12 + flowerRandom() * 0.1,
      variant: Math.floor(flowerRandom() * flowerVariants)
    });
  }
  const coverageRandom = rng(82944);
  const scatteredFlowers = flowerItems.filter((p) => coverageRandom() < meadowCoverage(p.z));
  for (let variant = 0; variant < flowerVariants; variant++) {
    const items = scatteredFlowers.filter((p) => p.variant === variant);
    const flowers = new THREE.InstancedMesh(geometry, materials[TREE_VARIANTS + 1 + variant], items.length);
    flowers.frustumCulled = false;
    scene.add(flowers);
    batches.push({ mesh: flowers, items, meadow: true });
  }
  const coneRandom = rng(71562), coneItems = [];
  for (let i = 0; i < 145; i++) {
    const h = 0.08 + coneRandom() * 0.08;
    const p = { x: coneRandom() * 40, z: FOREST_EDGE + 1.2 - coneRandom() * 6.2, h, w: h * (0.7 + coneRandom() * 0.4), tilt: (coneRandom() - 0.5) * 1.1 };
    if (coneRandom() > meadowCoverage(p.z - forestRetreat(1))) coneItems.push(p);
  }
  const cones = new THREE.InstancedMesh(geometry, materials[materials.length - 1], coneItems.length);
  cones.frustumCulled = false;
  scene.add(cones);
  batches.push({ mesh: cones, items: coneItems, forest: true });
  const needleRandom = rng(39327), needleItems = [];
  for (let i = 0; i < 850; i++) {
    const p = {
      x: needleRandom() * 40,
      z: FOREST_EDGE + 1.2 - needleRandom() * 7.4,
      w: 0.18 + needleRandom() * 0.23,
      h: 0.22 + needleRandom() * 0.3,
      tilt: needleRandom() * Math.PI * 2
    };
    if (needleRandom() > meadowCoverage(p.z - forestRetreat(1))) needleItems.push(p);
  }
  const needles = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: texture(9), alphaTest: 0.2, side: THREE.DoubleSide, depthWrite: false }), needleItems.length);
  needles.frustumCulled = false;
  scene.add(needles);
  batches.push({ mesh: needles, items: needleItems, ground: true, forest: true });
  return { update(distance, zoom, sunlight = 1) {
    const retreat = forestRetreat(zoom);
    canopy.position.z = -10.4 - retreat;
    canopyMap.offset.x = distance / 100 * 0.035 / 8 + 2.5 * (1 - zoom);
    canopy.position.x = (zoom - 1) * 5;
    canopy.scale.x = zoom;
    canopyMap.repeat.x = 5 * zoom;
    dummy.rotation.set(0, 0, 0);
    for (const { mesh, items, ground, forest, meadow } of batches) {
      for (let i = 0; i < items.length; i++) {
        const p = items[i], z = meadow ? meadowDepth(p.z, zoom) : p.z - (forest ? retreat : 0), speed = sceneryParallax(z);
        dummy.position.set(wrap(p.x - distance / 100 * speed, 40) + (zoom - 1) * 5, ground ? -0.012 : -0.015, z);
        dummy.rotation.set(ground ? -Math.PI / 2 : 0, 0, p.tilt || 0);
        dummy.scale.set(p.w, p.h, 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
    dummy.rotation.set(-Math.PI / 2, 0, -Math.atan2(SUN_SHADOW.x, -SUN_SHADOW.z));
    for (const { mesh, items } of shadows) {
      mesh.material.opacity = TREE_SHADOW_OPACITY * sunlight;
      for (let i = 0; i < items.length; i++) {
        const p = items[i];
        dummy.position.set(wrap(p.x - distance / 100 * sceneryParallax(p.z - retreat), 40) + (zoom - 1) * 5, 1e-3, p.z - retreat);
        dummy.scale.set(p.w, p.h * Math.hypot(SUN_SHADOW.x, SUN_SHADOW.z), 1);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  } };
}
