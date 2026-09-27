import * as THREE from "./vendor/three.module.min.js";
export function createCarrot() {
  const group = new THREE.Group();
  const orange = new THREE.MeshPhysicalMaterial({ color: "#ff922e", roughness: 0.34, clearcoat: 0.2, clearcoatRoughness: 0.4 });
  const profile = new THREE.SplineCurve([
    new THREE.Vector2(0, -0.2),
    new THREE.Vector2(0.018, -0.19),
    new THREE.Vector2(0.043, -0.13),
    new THREE.Vector2(0.078, -0.045),
    new THREE.Vector2(0.103, 0.055),
    new THREE.Vector2(0.091, 0.112),
    new THREE.Vector2(0.05, 0.137),
    new THREE.Vector2(0, 0.14)
  ]);
  const root = new THREE.Mesh(new THREE.LatheGeometry(profile.getPoints(40), 32), orange);
  group.add(root);
  const greens = ["#4b9c39", "#78be47", "#378c42"].map((color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.43, clearcoat: 0.12 }));
  for (let i = 0; i < 5; i++) {
    const a = (i - 2) * 0.48;
    const leaf = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), greens[i % 3]);
    leaf.scale.set(0.042, 0.102, 0.018);
    leaf.position.set(Math.sin(a) * 0.075, 0.2 + Math.cos(a) * 0.035, i % 2 ? -0.02 : 0.01);
    leaf.rotation.z = -a;
    leaf.rotation.y = (i - 2) * 0.2;
    group.add(leaf);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(8e-3, 0.011, 0.09, 8), greens[0]);
    stem.position.set(Math.sin(a) * 0.025, 0.16, 0);
    stem.rotation.z = -a * 0.6;
    group.add(stem);
  }
  const crease = new THREE.MeshStandardMaterial({ color: "#dc731f", roughness: 0.7 });
  for (let i = 0; i < 3; i++) {
    const y = -0.1 + i * 0.075, r = [0.055, 0.084, 0.1][i];
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-r * 0.45, y + 8e-3, r * 0.88),
      new THREE.Vector3(0, y, r),
      new THREE.Vector3(r * 0.3, y + 3e-3, r * 0.95)
    ]);
    group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 10, 25e-4, 4, false), crease));
  }
  for (const child of group.children) child.position.y -= 0.065;
  return group;
}
