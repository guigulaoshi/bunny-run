import { simplifyBunnyLimbs } from "./bunny-limbs.js";
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
export async function renderReadyBunny(canvas, iconCanvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(180, 126, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0, 0);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(16777215, 10462875, 2.2));
  const light = new THREE.DirectionalLight(16774631, 2.4);
  light.position.set(-3, 5, 6);
  scene.add(light);
  const model = (await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/snacky-bunny/bunny.glb`)).scene;
  scene.add(model);
  simplifyBunnyLimbs(model);
  for (const name of ["short_leg_footL", "short_leg_footR"]) {
    const node = model.getObjectByName(name);
    if (node) node.visible = false;
  }
  for (const name of ["earL", "earR"]) {
    const node = model.getObjectByName(name);
    if (node) node.scale.y *= 1.1;
  }
  const armPivots = [];
  for (const name of ["armL", "armR"]) {
    const arm = model.getObjectByName(name);
    if (!arm) continue;
    const pivot = new THREE.Group();
    pivot.position.copy(arm.position);
    pivot.position.y += 0.09;
    arm.parent.add(pivot);
    arm.position.sub(pivot.position);
    pivot.add(arm);
    pivot.rotation.x = Math.PI / 2;
    armPivots.push(pivot);
  }
  model.rotation.y = Math.PI;
  model.traverse((o) => {
    if (o.isMesh) {
      const convert = (m) => new THREE.MeshPhysicalMaterial({ color: m.color, map: m.map, roughness: 0.29, clearcoat: 0.28, clearcoatRoughness: 0.34 });
      o.material = Array.isArray(o.material) ? o.material.map(convert) : convert(o.material);
    }
  });
  const box = new THREE.Box3().setFromObject(model), size = box.getSize(new THREE.Vector3()), center = box.getCenter(new THREE.Vector3());
  const half = Math.max(size.y * 0.56, size.x * 0.56 / (180 / 126));
  const camera = new THREE.OrthographicCamera(-half * 180 / 126, half * 180 / 126, half, -half, 0.1, 20);
  camera.position.set(center.x, center.y + 0.12, 8);
  camera.lookAt(center);
  if (iconCanvas) {
    const head = model.getObjectByName("head");
    if (head) {
      const visibility = model.children.map((child) => [child, child.visible]);
      for (const child of model.children) child.visible = child === head;
      const headBox = new THREE.Box3().setFromObject(head), headSize = headBox.getSize(new THREE.Vector3()), headCenter = headBox.getCenter(new THREE.Vector3());
      const aspect = iconCanvas.width / iconCanvas.height, halfHeight = Math.max(headSize.y, headSize.x / aspect) * 0.54;
      const iconCamera = new THREE.OrthographicCamera(-halfHeight * aspect, halfHeight * aspect, halfHeight, -halfHeight, 0.1, 20);
      iconCamera.position.set(headCenter.x, headCenter.y, 8);
      iconCamera.lookAt(headCenter);
      renderer.setSize(iconCanvas.width, iconCanvas.height, false);
      renderer.render(scene, iconCamera);
      iconCanvas.getContext("2d").drawImage(canvas, 0, 0, iconCanvas.width, iconCanvas.height);
      for (const [child, visible] of visibility) child.visible = visible;
      renderer.setSize(180, 126, false);
    }
  }
  renderer.render(scene, camera);
  return { render(now, visible, animate = true) {
    if (!visible) return;
    const phase = now % 1800 / 1e3;
    const local = phase < 0.6 ? phase : -1;
    const bounce = animate && local >= 0 ? Math.sin(local / 0.6 * Math.PI) : 0;
    model.position.y = bounce * size.y * 0.22;
    model.scale.set(1 - bounce * 0.04, 1 + bounce * 0.06, 1 - bounce * 0.04);
    for (const pivot of armPivots) pivot.rotation.x = -0.15 - bounce * 0.2;
    camera.zoom = 0.76;
    camera.updateProjectionMatrix();
    renderer.render(scene, camera);
  } };
}
