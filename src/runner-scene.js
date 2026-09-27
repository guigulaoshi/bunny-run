import { createBunnyFall } from "./bunny-fall.js";
import { createScoreStars, starSlot } from "./score-stars.js";
import { simplifyBunnyLimbs } from "./bunny-limbs.js";
import { SUN } from "./sun-light.js";
import * as THREE from "./vendor/three.module.min.js";
import { GLTFLoader } from "./vendor/GLTFLoader.js";
import { createToyFinish } from "./toy-finish.js";
import { createCarrot } from "./carrot.js";
import { createCactus } from "./cactus.js";
import { createDesert } from "./desert-scene.js";
import { DINO } from "./dino-game.js";
import { createRubberBody, createSpring, stepSpring } from "./rubber-body.js";
import { createEarChain, stepEarChain, earCurve } from "./elastic-ear.js";
export async function createRunnerScene(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#238fe0");
  const finish = createToyFinish(renderer);
  scene.environment = finish.environment;
  scene.environmentIntensity = 0.45;
  const camera = new THREE.OrthographicCamera(-5, 5, 1.8, -1.8, 0.1, 90);
  camera.position.set(0, 3.45, 15);
  camera.lookAt(0, 1.3, 0);
  scene.add(new THREE.HemisphereLight(16777215, 7374419, 0.85));
  const light = new THREE.DirectionalLight(16773590, 2.8);
  light.position.set(SUN.x, SUN.y, SUN.z);
  light.castShadow = true;
  light.shadow.mapSize.set(2048, 2048);
  light.shadow.radius = 4;
  light.shadow.normalBias = 0.025;
  const fill = new THREE.DirectionalLight(14086143, 0.65);
  fill.position.set(4, 3, -3);
  scene.add(fill);
  Object.assign(light.shadow.camera, { left: -8, right: 8, top: 8, bottom: -8 });
  scene.add(light);
  const desert = await createDesert(scene);
  const bunny = new THREE.Group();
  const model = (await new GLTFLoader().loadAsync(`${import.meta.env.BASE_URL}models/snacky-bunny/bunny.glb`)).scene;
  simplifyBunnyLimbs(model);
  bunny.add(model);
  scene.add(bunny);
  bunny.rotation.y = -Math.PI / 2;
  const eyes = [];
  model.traverse((o) => {
    if (o.isMesh && o.material?.name === "bunny_eye") {
      o.geometry = o.geometry.clone();
      const rest = o.geometry.attributes.position.array.slice();
      const centers = [-1, 1].map((side) => {
        const box = new THREE.Box3();
        for (let i = 0; i < rest.length; i += 3) if (Math.sign(rest[i]) === side) box.expandByPoint(new THREE.Vector3(rest[i], rest[i + 1], rest[i + 2]));
        return box.getCenter(new THREE.Vector3());
      });
      eyes.push({ mesh: o, rest, centers });
    }
  });
  model.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = true;
      const vinyl = (m) => new THREE.MeshPhysicalMaterial({ color: m.color || 16777215, map: m.map, roughness: 0.29, metalness: 0, clearcoat: 0.28, clearcoatRoughness: 0.34, envMapIntensity: 0.9 });
      o.material = Array.isArray(o.material) ? o.material.map(vinyl) : vinyl(o.material);
    }
  });
  model.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  model.traverseVisible((node) => {
    if (node.isMesh) {
      node.geometry.computeBoundingBox();
      bounds.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
    }
  });
  const head = model.getObjectByName("head");
  head?.geometry?.computeBoundingBox();
  const headTop = head?.geometry ? head.localToWorld(new THREE.Vector3(0, head.geometry.boundingBox.max.y, 0)).y : bounds.max.y;
  const scale = 1.5 * (DINO.height / 100) / Math.max(0.1, headTop - bounds.min.y);
  bunny.scale.setScalar(scale);
  model.position.y = -bounds.min.y;
  const limbs = [];
  for (const [name, side, isLeg] of [
    ["armL", 1, false],
    ["armR", -1, false],
    ["footL", 1, true],
    ["footR", -1, true]
  ]) {
    const node = model.getObjectByName(name);
    if (!node) continue;
    const pivot = new THREE.Group();
    pivot.position.copy(node.position);
    if (isLeg) pivot.position.y += 0.014;
    node.parent.add(pivot);
    node.position.sub(pivot.position);
    pivot.add(node);
    limbs.push({ pivot, side, isLeg, spring: createSpring() });
  }
  for (const name of ["short_leg_footL", "short_leg_footR"]) {
    const leg = model.getObjectByName(name);
    if (leg) leg.visible = false;
  }
  const ears = ["earL", "earR"].map((name) => {
    const node = model.getObjectByName(name), surfaces = [];
    if (node) node.scale.y *= 1.1;
    node?.traverse((o) => {
      if (o.isMesh) {
        o.geometry = o.geometry.clone();
        o.geometry.computeBoundingBox();
        surfaces.push({ mesh: o, rest: o.geometry.attributes.position.array.slice() });
      }
    });
    const min = Math.min(...surfaces.map((s) => s.mesh.geometry.boundingBox.min.y));
    const max = Math.max(...surfaces.map((s) => s.mesh.geometry.boundingBox.max.y));
    return { surfaces, min, span: Math.max(0.01, max - min), chain: createEarChain() };
  });
  const obstacles = /* @__PURE__ */ new Map(), carrots = /* @__PURE__ */ new Map();
  function createObstacle(o) {
    const group = createCactus(o.kind, o.width, o.height, o.variant);
    scene.add(group);
    return group;
  }
  const starShape = new THREE.Shape();
  const starPoints = Array.from({ length: 10 }, (_, i) => {
    const angle = Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 0.048 : 0.102;
    return new THREE.Vector2(Math.cos(angle) * r, Math.sin(angle) * r);
  });
  for (let i = 0; i < 10; i++) {
    const point = starPoints[i], before = point.clone().lerp(starPoints[(i + 9) % 10], 0.16), after = point.clone().lerp(starPoints[(i + 1) % 10], 0.16);
    if (i === 0) starShape.moveTo(before.x, before.y);
    else starShape.lineTo(before.x, before.y);
    starShape.quadraticCurveTo(point.x, point.y, after.x, after.y);
  }
  starShape.closePath();
  const starGeometry = new THREE.ExtrudeGeometry(starShape, { depth: 0.035, bevelEnabled: true, bevelThickness: 0.014, bevelSize: 9e-3, bevelSegments: 4, steps: 1, curveSegments: 5 });
  starGeometry.translate(0, 0, -0.0175);
  const stars = [];
  function addScoreStar() {
    const mesh = new THREE.Mesh(starGeometry, new THREE.MeshPhysicalMaterial({ color: "#ffd333", roughness: 0.32, metalness: 0, clearcoat: 0.32, clearcoatRoughness: 0.3, emissive: "#ffc329", emissiveIntensity: 0.18, envMapIntensity: 0.8, transparent: true, depthWrite: false, depthTest: false }));
    mesh.visible = false;
    mesh.renderOrder = 20;
    scene.add(mesh);
    stars.push(mesh);
  }
  const scoreStars = createScoreStars(), headBox = new THREE.Box3();
  let activeStars = [], deathAge = 0;
  const rubber = createRubberBody();
  const headSpring = createSpring();
  const headRest = head?.rotation.x || 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let fall = null, lastBodyAngle = -0.1, fallShape = null;
  let takeoffAge = 10;
  let lastTime = 0, lastJumps = 0, lastElapsed = 0, lastEyeAmount = -1;
  return { render(state, now, paused = false) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) || canvas.height !== Math.round(h * renderer.getPixelRatio())) renderer.setSize(w, h, false);
    const dt = paused ? 0 : Math.min(0.05, Math.max(0, (now - (lastTime || now)) / 1e3));
    lastTime = now;
    takeoffAge = state.phase === "playing" && state.jumps > lastJumps ? 0 : takeoffAge + dt;
    if (state.phase !== "playing") takeoffAge = 10;
    activeStars = scoreStars.update(state.score, state.phase, dt);
    deathAge = state.phase === "over" ? deathAge + dt : 0;
    if (state.phase !== "over") {
      fall = null;
      fallShape = null;
    }
    camera.position.x = state.phase === "over" ? Math.sin(deathAge * 65) * 0.065 * Math.exp(-deathAge * 8) : 0;
    const motionDt = state.phase === "playing" ? Math.max(0, Math.min(0.05, state.elapsed - lastElapsed)) : dt;
    lastElapsed = state.elapsed;
    const softness = rubber.update(state, motionDt);
    if (state.phase === "over" && !fall) {
      fallShape = { ...softness };
      fall = createBunnyFall(state.impact || { speed: state.speed, vy: state.vy, y: state.y, contactY: state.y + 55 }, lastBodyAngle, fallShape.vertical, fallShape.horizontal);
    }
    const bodyShape = fallShape || softness;
    bunny.scale.set(scale * bodyShape.horizontal, scale * bodyShape.vertical, scale * bodyShape.horizontal);
    const zoom = (state.viewWidth || 1e3) / 1e3;
    camera.left = -5;
    camera.right = -5 + 10 * zoom;
    camera.top = 2.7 * zoom;
    camera.bottom = -1.8 * zoom;
    camera.position.y = 1.3 * zoom + 2.15;
    camera.lookAt(camera.position.x, 1.3 * zoom, 0);
    if (!reducedMotion.matches && takeoffAge < 0.18) {
      camera.position.y += 0.035 * zoom * Math.cos(takeoffAge * 55) * Math.exp(-takeoffAge * 22);
    }
    camera.updateProjectionMatrix();
    const running = state.phase === "playing" && state.y === 0;
    const phase = state.distance / 160 * Math.PI * 2;
    const stride = Math.sin(phase);
    const bob = running ? 0.025 * (1 - Math.cos(phase * 2)) : 0;
    bunny.position.set((DINO.x + DINO.width / 2) / 100 - 5, state.y / 100 + bob, 0);
    bunny.rotation.set(0, -Math.PI / 2, 0);
    bunny.rotation.z = (state.phase === "playing" ? -0.1 : 0) + softness.lean;
    if (head) head.rotation.x = headRest + stepSpring(headSpring, -softness.lean * 1.8 - (softness.vertical - 1) * 0.7, motionDt, 65, 7);
    if (fall) {
      const pose = fall.step(dt);
      bunny.quaternion.setFromAxisAngle(new THREE.Vector3(0, 0, 1), pose.angle);
      bunny.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.PI / 2));
      bunny.position.x += pose.x;
      bunny.position.y = pose.y;
    } else lastBodyAngle = -0.1 + softness.lean;
    const amount = state.phase === "over" ? Math.min(1, deathAge / 0.1) : 0;
    if (amount !== lastEyeAmount) for (const { mesh, rest, centers } of eyes) {
      const positions = mesh.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const x = rest[i * 3], y = rest[i * 3 + 1], z = rest[i * 3 + 2], center = centers[x < 0 ? 0 : 1];
        const dx = x - center.x;
        positions.setXYZ(i, x + dx * 0.35 * amount, y + (center.y + (y - center.y) * 0.14 + Math.abs(dx) * 0.75 - y) * amount, z);
      }
      positions.needsUpdate = true;
      mesh.geometry.computeVertexNormals();
    }
    lastEyeAmount = amount;
    bunny.updateMatrixWorld(true);
    headBox.setFromObject(head || model);
    while (stars.length < activeStars.length) addScoreStar();
    stars.forEach((mesh, i) => {
      const reward = activeStars[i];
      mesh.visible = Boolean(reward);
      if (!reward) return;
      if (reward.baseY === void 0) {
        reward.scale = zoom;
        reward.baseY = headBox.max.y + 0.18 * zoom;
        reward.baseX = activeStars.find((star) => star.baseX !== void 0)?.baseX ?? (headBox.min.x + headBox.max.x) / 2;
      }
      const slot = starSlot(reward.lane), age = reward.age;
      mesh.position.set(reward.baseX + slot.x * reward.scale, reward.baseY + age * 0.55 * reward.scale, 0.6);
      mesh.quaternion.copy(camera.quaternion);
      mesh.rotateY(0.22 + Math.sin(age * 4) * 0.12);
      mesh.scale.setScalar(reward.scale);
      mesh.material.opacity = age < 1 ? 1 : Math.max(0, (1.3 - age) / 0.3);
    });
    for (const { pivot, side, isLeg, spring } of limbs) {
      const target = running ? stride * side * (isLeg ? 0.45 : -0.85) : state.y > 0 ? isLeg ? -0.45 : -0.7 : 0;
      pivot.rotation.x = stepSpring(spring, target, motionDt, 650, 24);
    }
    for (const ear of ears) {
      stepEarChain(ear.chain, 0, -0.1 - Math.min(0.5, Math.abs(state.vy) / 2e3) - (state.jumps > lastJumps ? 0.85 : 0) - (softness.vertical - 1) * 2, motionDt);
      const curve = earCurve(ear.chain, ear.span);
      for (const { mesh, rest } of ear.surfaces) {
        const pos = mesh.geometry.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          const t = Math.max(0, Math.min(1, (rest[i * 3 + 1] - ear.min) / ear.span));
          const at = t * 6, index = Math.min(5, Math.floor(at)), f = at - index;
          const a = curve[index], b = curve[index + 1];
          pos.setXYZ(i, rest[i * 3], ear.min + a.y + (b.y - a.y) * f, rest[i * 3 + 2] + a.z + (b.z - a.z) * f);
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
      }
    }
    lastJumps = state.jumps;
    for (const o of state.obstacles) {
      if (!obstacles.has(o)) obstacles.set(o, createObstacle(o));
      obstacles.get(o).position.x = (o.x + o.width / 2) / 100 - 5;
    }
    for (const [o, mesh] of obstacles) if (!state.obstacles.includes(o)) {
      scene.remove(mesh);
      mesh.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
      obstacles.delete(o);
    }
    for (const c of state.carrots) {
      if (!carrots.has(c)) {
        const mesh2 = createCarrot();
        scene.add(mesh2);
        carrots.set(c, mesh2);
      }
      const mesh = carrots.get(c);
      mesh.position.set((c.x + c.width / 2) / 100 - 5, (c.bottom + c.height / 2) / 100, 0);
      mesh.rotation.y = state.elapsed * 1.8;
      mesh.rotation.z = -0.2;
    }
    for (const [c, mesh] of carrots) if (!state.carrots.includes(c)) {
      scene.remove(mesh);
      mesh.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
      carrots.delete(c);
    }
    desert.update(state.distance, state.elapsed, state.y, state.speed, zoom, dt);
    finish.render(scene, camera);
  }, captureShareBackground() {
    const hidden = [bunny, ...obstacles.values(), ...carrots.values(), ...stars].map((node) => [node, node.visible]);
    const size = renderer.getSize(new THREE.Vector2()), ratio = renderer.getPixelRatio();
    const center = (camera.left + camera.right) / 2, zoom = (camera.right - camera.left) / 10;
    const plants = [createCactus("regular", 38, 88, 1), createCactus("tall", 88, 132, 2)];
    const cardBunny = bunny.clone(true), cardGeometry = [];
    cardBunny.visible = true;
    cardBunny.position.set(center, 0, 0.6);
    cardBunny.rotation.set(0, Math.PI, 0);
    cardBunny.scale.setScalar(scale * zoom * 1.65);
    const cardHead = cardBunny.getObjectByName("head");
    if (cardHead) cardHead.rotation.x = headRest;
    cardBunny.traverse((node) => {
      const eye = eyes.find((entry) => entry.mesh.geometry === node.geometry);
      if (eye) {
        node.geometry = node.geometry.clone();
        node.geometry.attributes.position.array.set(eye.rest);
        node.geometry.attributes.position.needsUpdate = true;
        node.geometry.computeVertexNormals();
        cardGeometry.push(node.geometry);
      }
    });
    const cardCamera = camera.clone();
    cardCamera.left = center - 5 * zoom;
    cardCamera.right = center + 5 * zoom;
    cardCamera.top = 3.2 * zoom;
    cardCamera.bottom = -2.54 * zoom;
    cardCamera.updateProjectionMatrix();
    try {
      for (const [node] of hidden) node.visible = false;
      scene.add(cardBunny);
      plants.forEach((plant, i) => {
        plant.position.set(center + (i ? 2.7 : -2.7) * zoom, 0, 0.4);
        plant.scale.setScalar(zoom * 1.35);
        scene.add(plant);
      });
      renderer.setPixelRatio(1);
      renderer.setSize(1080, 620, false);
      finish.render(scene, cardCamera);
      const picture = document.createElement("canvas");
      picture.width = 1080;
      picture.height = 620;
      picture.getContext("2d").drawImage(canvas, 0, 0);
      return picture;
    } finally {
      for (const [node, visible] of hidden) node.visible = visible;
      scene.remove(cardBunny);
      for (const geometry of cardGeometry) geometry.dispose();
      for (const plant of plants) {
        scene.remove(plant);
        plant.traverse((node) => {
          node.geometry?.dispose();
          const materials = Array.isArray(node.material) ? node.material : [node.material];
          for (const material of materials) material?.dispose();
        });
      }
      renderer.setPixelRatio(ratio);
      renderer.setSize(size.x, size.y, false);
      finish.render(scene, camera);
    }
  } };
}
