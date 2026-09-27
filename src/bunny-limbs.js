import * as THREE from "./vendor/three.module.min.js";
export function simplifyBunnyLimbs(model) {
  const pink = new THREE.MeshPhysicalMaterial({ color: "#efa1b7", roughness: 0.42, clearcoat: 0.12, clearcoatRoughness: 0.45 });
  pink.name = "bunny_pink_beans";
  for (const name of ["foot_surface_footL", "foot_surface_footR"]) {
    model.getObjectByName(name)?.traverse((node) => {
      if (node.isMesh) node.material = pink;
    });
  }
  model.traverse((node) => {
    if (node.isMesh && node.material?.name === "bunny_shorts") node.visible = false;
  });
  for (const name of ["short_leg_footL", "short_leg_footR"]) {
    const leg = model.getObjectByName(name);
    if (leg) leg.visible = false;
  }
  for (const name of ["footL", "footR"]) {
    const foot = model.getObjectByName(name);
    if (foot) foot.position.y += 0.14;
  }
  for (const [name, side] of [["armL", -1], ["armR", 1]]) {
    const arm = model.getObjectByName(name);
    if (!arm) continue;
    let fur;
    arm.traverse((node) => {
      if (node.isMesh) {
        if (node.material?.name === "bunny_fur") fur = node.material;
        node.visible = false;
      }
    });
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), fur);
    mesh.scale.set(0.095, 0.19, 0.105);
    mesh.position.set(side * 0.015, -0.055, 0);
    mesh.rotation.z = side * 0.14;
    arm.add(mesh);
    const beanGeometry = new THREE.SphereGeometry(1, 24, 16);
    const positions = beanGeometry.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      positions.setX(i, positions.getX(i) + 0.17 * (1 - y * y));
    }
    beanGeometry.computeVertexNormals();
    const palm = new THREE.Mesh(beanGeometry, pink);
    palm.position.set(side * 0.015, -0.125, -0.089);
    palm.scale.set(0.052, 0.066, 0.025);
    palm.rotation.z = side * 0.14;
    arm.add(palm);
    for (let i = 0; i < 3; i++) {
      const toe = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), pink);
      toe.scale.set(0.014, 0.02, 9e-3);
      toe.position.set(side * 0.015 + (i - 1) * 0.032, -0.047, -0.104);
      arm.add(toe);
    }
  }
}
