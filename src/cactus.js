import * as THREE from "./vendor/three.module.min.js";
function padGeometry() {
  const geometry = new THREE.SphereGeometry(1, 32, 24);
  const p = geometry.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const y = p.getY(i), t = (y + 1) / 2;
    p.setXYZ(i, p.getX(i) * 0.098 * (0.6 + 0.48 * t), t * 0.23, p.getZ(i) * 0.028);
  }
  geometry.computeVertexNormals();
  return geometry;
}
export function createCactus(kind = "regular", width = 38, height = 48, variant = 0) {
  const group = new THREE.Group(), geometry = padGeometry();
  const green = new THREE.MeshPhysicalMaterial({ color: "#679148", roughness: 0.3, metalness: 0, clearcoat: 0.26, clearcoatRoughness: 0.35, envMapIntensity: 0.85 });
  const areole = new THREE.MeshStandardMaterial({ color: "#d9c99a", roughness: 0.8 });
  const dotGeometry = new THREE.SphereGeometry(38e-4, 6, 4);
  const spineGeometry = new THREE.ConeGeometry(13e-4, 0.017, 4);
  function pad(parent, x, y, angle = 0, turn = 0) {
    const piece = new THREE.Group();
    piece.position.set(x, y, 0);
    piece.rotation.set(0, turn, angle);
    piece.add(new THREE.Mesh(geometry, green));
    for (const side of [-1, 1]) for (let row = 0; row < 4; row++) for (let col = -1; col <= 1; col++) {
      const py = 0.055 + row * 0.041, px = col * 0.037 + (row % 2 ? 6e-3 : 0);
      const t = py / 0.23, ny = t * 2 - 1, rx = 0.098 * (0.6 + 0.48 * t);
      const surface = 1 - ny * ny - (px / rx) ** 2;
      if (surface <= 0) continue;
      const z = side * (0.028 * Math.sqrt(surface) + 1e-3);
      const dot = new THREE.Mesh(dotGeometry, areole);
      dot.position.set(px, py, z);
      piece.add(dot);
      if ((row + col) % 2 === 0) {
        const spine = new THREE.Mesh(spineGeometry, areole);
        spine.position.set(px, py + 3e-3, z + side * 6e-3);
        spine.rotation.x = side * Math.PI / 3;
        piece.add(spine);
      }
    }
    parent.add(piece);
    return piece;
  }
  const fruitMaterial = new THREE.MeshPhysicalMaterial({ color: "#c94b65", roughness: 0.32, clearcoat: 0.22, clearcoatRoughness: 0.38, envMapIntensity: 0.85 });
  const fruitGeometry = new THREE.SphereGeometry(1, 12, 8);
  function fruits(parent, count = 2) {
    for (let i = 0; i < count; i++) {
      const fruit = new THREE.Mesh(fruitGeometry, fruitMaterial);
      fruit.scale.set(0.02, 0.029, 0.02);
      fruit.position.set((i - (count - 1) / 2) * 0.036, 0.235 - Math.abs(i - (count - 1) / 2) * 9e-3, 4e-3);
      fruit.rotation.z = (i - (count - 1) / 2) * -0.25;
      parent.add(fruit);
      const scar = new THREE.Mesh(dotGeometry, areole);
      scar.position.copy(fruit.position);
      scar.position.y += 0.028;
      parent.add(scar);
    }
  }
  if (kind === "tall") {
    const base = pad(group, 0, 0, 0.025);
    const middle = pad(base, 0, 0.195, -0.08);
    const upper = pad(middle, 8e-3, 0.185, 0.12);
    const branch = pad(middle, -0.042, 0.17, 0.44, 0.12);
    fruits(upper, 3);
    fruits(branch, 2);
    if (variant > 0.5) {
      const side = pad(base, 0.046, 0.17, -0.48, -0.1);
      fruits(side, 1);
    }
  } else if (kind === "wide") {
    const root = pad(group, 0, 0, 0);
    const left = pad(root, -0.041, 0.192, 0.44, 0.1);
    const right = pad(root, 0.041, 0.192, -0.44, -0.1);
    fruits(left, 2);
    fruits(right, 1);
  } else {
    const root = pad(group, 0, 0, 0);
    pad(root, 0, 0.205, 0, 0.07);
  }
  group.scale.setScalar(2);
  const bounds = new THREE.Box3().setFromObject(group);
  const center = (bounds.min.x + bounds.max.x) / 2;
  for (const child of group.children) {
    child.position.x -= center / 2;
    child.position.y -= bounds.min.y / 2;
  }
  group.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return group;
}
