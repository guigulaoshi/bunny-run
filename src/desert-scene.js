import { sunBillboardPosition } from "./sun-light.js";
import { sceneryParallaxGLSL } from "./scenery-motion.js";
import { createForestCards } from "./forest-cards.js";
import { createCloudSky } from "./cloud-sky.js";
import * as THREE from "./vendor/three.module.min.js";
const matte = (color) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.12, clearcoatRoughness: 0.45 });
function grassTexture() {
  const size = 256, canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d"), image = ctx.createImageData(size, size);
  let seed = 9231;
  const random = () => {
    seed = seed * 1664525 + 1013904223 >>> 0;
    return seed / 4294967296;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * Math.PI * 2, v = y / size * Math.PI * 2;
    const patch = Math.sin(u * 2 + Math.sin(v)) * 5 + Math.cos(v * 3 + u) * 4 + Math.sin(u * 5 - v * 2) * 3;
    const grain = (random() - 0.5) * 2, offset = (y * size + x) * 4;
    image.data[offset] = 111 + patch * 0.6 + grain;
    image.data[offset + 1] = 163 + patch * 0.6 + grain;
    image.data[offset + 2] = 53 + patch * 0.4 + grain;
    image.data[offset + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
function seeded(seed) {
  let value = seed + 1947;
  return () => {
    value = value * 1664525 + 1013904223 >>> 0;
    return value / 4294967296;
  };
}
const MOUNTAIN_WIDTH = 35;
function mountainGeometry(seed) {
  const random = seeded(seed * 139), peaks = Array.from({ length: 24 }, () => ({ x: (random() - 0.5) * MOUNTAIN_WIDTH, h: 0.45 + random() * 1.05, w: 0.45 + random() * 0.85 }));
  const vertices = [], colors = [], indices = [], columns = 600, rows = 4;
  for (let i = 0; i <= columns; i++) {
    const x = (i / columns - 0.5) * MOUNTAIN_WIDTH, phase = i / columns * Math.PI * 2;
    let height = 0.15;
    for (const p of peaks) for (const offset of [-MOUNTAIN_WIDTH, 0, MOUNTAIN_WIDTH]) height += p.h * Math.exp(-(((x - p.x + offset) / p.w) ** 2));
    height = 0.5 * 2.1 * (1 - Math.exp(-height / 2.1)) * (0.93 + 0.07 * Math.sin(phase * 27 + seed));
    for (let j = 0; j <= rows; j++) {
      const t = j / rows, y = -2 + (height + 2) * t;
      vertices.push(x, y, 0);
      const color = new THREE.Color("#64816d").lerp(new THREE.Color("#94ae96"), Math.pow(t, 3) * 0.7 + 0.025 * Math.sin(phase * 11 + seed));
      colors.push(color.r, color.g, color.b);
      if (i < columns && j < rows) {
        const k = i * (rows + 1) + j;
        indices.push(k, k + rows + 1, k + 1, k + 1, k + rows + 1, k + rows + 2);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
export async function createDesert(scene) {
  const nearTexture = grassTexture();
  nearTexture.repeat.set(20, 29.5 * 9 / 26);
  const geometry = new THREE.PlaneGeometry(40, 29.5, 1, 12);
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, -0.025, 0.75);
  const groundMaterial = new THREE.MeshStandardMaterial({ map: nearTexture, color: 16777215, roughness: 0.52 });
  const sunlightVisibility = { value: 1 }, groundTravel = { value: 0 };
  groundMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.sunlightVisibility = sunlightVisibility;
    shader.uniforms.groundTravel = groundTravel;
    shader.vertexShader = "varying float groundDepth;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      groundDepth=(modelMatrix*vec4(position,1.0)).z;`);
    shader.fragmentShader = "varying float groundDepth;\nuniform float groundTravel;\n" + sceneryParallaxGLSL + "\n" + shader.fragmentShader;
    const groundMap = THREE.ShaderChunk.map_fragment.replace(
      "texture2D( map, vMapUv )",
      "texture2D( map, vMapUv + vec2(groundTravel*.5*groundSpeedAtDepth(groundDepth),0.0) )"
    );
    shader.fragmentShader = shader.fragmentShader.replace("#include <map_fragment>", groundMap);
    shader.fragmentShader = "uniform float sunlightVisibility;\n" + shader.fragmentShader;
    const lighting = THREE.ShaderChunk.lights_fragment_begin.replace(
      "getDirectionalLightInfo( directionalLight, directLight );",
      `getDirectionalLightInfo( directionalLight, directLight );
       #if UNROLLED_LOOP_INDEX == 0
       directLight.direction = normalize( ( viewMatrix * vec4( -8.0, 8.0, -6.0, 0.0 ) ).xyz );
       #endif`
    );
    const cloudLighting = lighting.replace(
      "getShadow( directionalShadowMap[ i ],",
      "mix( 1.0, max( 0.0, 1.0 - 2.7 * ( 1.0 - getShadow( directionalShadowMap[ i ],"
    ).replace("vDirectionalShadowCoord[ i ] ) : 1.0;", "vDirectionalShadowCoord[ i ] ) ) ), sunlightVisibility ) : 1.0;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", cloudLighting);
    shader.fragmentShader = shader.fragmentShader.replace("#include <opaque_fragment>", `
      float cloudCover=1.0-sunlightVisibility;
      float groundLuma=dot(outgoingLight,vec3(.2126,.7152,.0722));
      outgoingLight=mix(outgoingLight,vec3(groundLuma),cloudCover*.14)*(1.0-cloudCover*.10);
      #include <opaque_fragment>`);
  };
  const ground = new THREE.Mesh(geometry, groundMaterial);
  ground.receiveShadow = true;
  scene.add(ground);
  const forest = await createForestCards(scene);
  const ridge = mountainGeometry(7), ridgeMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const ridgeSunX = { value: 0 }, ridgeZoom = { value: 1 };
  ridgeMaterial.onBeforeCompile = (shader) => {
    shader.uniforms.ridgeSunX = ridgeSunX;
    shader.uniforms.ridgeZoom = ridgeZoom;
    shader.vertexShader = "uniform float ridgeSunX;\nuniform float ridgeZoom;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace("#include <begin_vertex>", `#include <begin_vertex>
      float sunGap=((modelMatrix*vec4(position,1.0)).x-ridgeSunX)/(1.5*ridgeZoom);

      transformed.y-=1.4*ridgeZoom*exp(-sunGap*sunGap)/.55;`);
  };
  const mountains = Array.from({ length: 3 }, () => {
    const mesh = new THREE.Mesh(ridge, ridgeMaterial);
    mesh.scale.y = 0.55;
    mesh.position.set(0, -0.25, -20);
    scene.add(mesh);
    return mesh;
  });
  const sky = createCloudSky(scene);
  const wrap = (x, width) => ((x + width / 2) % width + width) % width - width / 2;
  return { update(distance, elapsed = 0, bunnyY = 0, speed = 280, zoom = 1, dt = 0) {
    const travel = distance / 100;
    ground.scale.x = zoom;
    ground.position.x = (zoom - 1) * 5;
    nearTexture.repeat.x = 20 * zoom;
    nearTexture.offset.x = 10 * (1 - zoom);
    groundTravel.value = travel;
    const sunlight = sky.update(distance, elapsed, zoom, dt);
    sunlightVisibility.value = sunlight;
    forest.update(distance, zoom, sunlight);
    ridgeSunX.value = sunBillboardPosition(zoom).x;
    ridgeZoom.value = zoom;
    mountains.forEach((mountain, i) => {
      mountain.scale.x = zoom;
      mountain.position.x = wrap(i * MOUNTAIN_WIDTH * zoom - travel * 0.028, 3 * MOUNTAIN_WIDTH * zoom) + (zoom - 1) * 5;
    });
  } };
}
