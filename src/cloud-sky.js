import { sunTransmission, smoothSunlight } from "./cloud-light.js";
import { SUN, sunBillboardPosition } from "./sun-light.js";
import * as THREE from "./vendor/three.module.min.js";
const fract = (x) => x - Math.floor(x);
function noise(x, y, z) {
  const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
  const smooth = (v) => v * v * (3 - 2 * v);
  const fx = smooth(fract(x)), fy = smooth(fract(y)), fz = smooth(fract(z));
  const hash = (a, b, c) => fract(Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453);
  const mix = (a, b, t) => a + (b - a) * t;
  return mix(
    mix(mix(hash(ix, iy, iz), hash(ix + 1, iy, iz), fx), mix(hash(ix, iy + 1, iz), hash(ix + 1, iy + 1, iz), fx), fy),
    mix(mix(hash(ix, iy, iz + 1), hash(ix + 1, iy, iz + 1), fx), mix(hash(ix, iy + 1, iz + 1), hash(ix + 1, iy + 1, iz + 1), fx), fy),
    fz
  );
}
function densityTexture(variant = 0) {
  const size = 64, data = new Uint8Array(size ** 3);
  const shapes = [
    [[-0.24, -0.06, 0, 0.23, 0.25, 0.31], [0, 0.04, 0, 0.28, 0.38, 0.37], [0.26, -0.07, 0, 0.22, 0.23, 0.3], [0.1, -0.15, 0.08, 0.3, 0.2, 0.3]],
    [[-0.27, -0.1, 0, 0.21, 0.18, 0.27], [-0.04, -0.06, 0, 0.29, 0.23, 0.33], [0.24, -0.11, 0, 0.24, 0.17, 0.28]],
    [[-0.19, -0.14, 0, 0.25, 0.23, 0.3], [0.05, 0.08, 0, 0.25, 0.36, 0.33], [0.26, -0.12, 0, 0.2, 0.23, 0.28], [-0.08, 0.24, 0, 0.17, 0.19, 0.23]],
    [[-0.29, -0.12, 0, 0.19, 0.2, 0.27], [-0.13, 0.02, 0, 0.2, 0.29, 0.3], [0.1, -0.08, 0, 0.24, 0.24, 0.33], [0.3, 0.04, 0, 0.17, 0.25, 0.24]]
  ];
  const lobes = shapes[variant];
  for (let z = 0; z < size; z++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = x / (size - 1) - 0.5, py = y / (size - 1) - 0.5, pz = z / (size - 1) - 0.5;
    let envelope = -Infinity;
    for (const [cx, cy, cz, rx, ry, rz] of lobes) envelope = Math.max(envelope, 1 - Math.hypot((px - cx) / rx, (py - cy) / ry, (pz - cz) / rz));
    const n = 0.6 * noise(px * 9 + 13 + variant * 17, py * 9 + 9, pz * 9 + 5) + 0.28 * noise(px * 21 + 8, py * 21 + 4, pz * 21 + 3) + 0.12 * noise(px * 43, py * 43, pz * 43);
    const edge = Math.max(0, Math.min(1, (0.5 - Math.max(Math.abs(px), Math.abs(py), Math.abs(pz))) * 24));
    data[x + size * (y + size * z)] = Math.round(255 * Math.max(0, Math.min(1, (envelope + n * 0.32 - 0.13) * 3.1)) * edge);
  }
  const texture = new THREE.Data3DTexture(data, size, size, size);
  texture.format = THREE.RedFormat;
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  return texture;
}
export function createCloudSky(scene) {
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(60, 20), new THREE.ShaderMaterial({
    depthWrite: false,
    toneMapped: false,
    vertexShader: "varying vec3 skyPos; void main(){skyPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec3 skyPos;
      void main(){float h=smoothstep(-6.0,-.5,skyPos.y);
      vec3 color=mix(vec3(.78,.86,.88),vec3(.025,.20,.61),h);
      float sun=exp(-length((skyPos.xy-vec2(-3.,4.))*vec2(.7,1.))*1.5);
      color+=vec3(.12,.09,.025)*sun;gl_FragColor=vec4(color,1.);}`
  }));
  sky.position.set(0, 3, -36);
  sky.renderOrder = -10;
  scene.add(sky);
  const sun = new THREE.Group();
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 2.7), new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    vertexShader: "varying vec2 sunUv;void main(){sunUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
    fragmentShader: `varying vec2 sunUv;void main(){
      float r=length(sunUv-.5)*2.;
      float core=1.-smoothstep(.143333,.166667,r);
      float inner=exp(-r*r*16.)*.75;
      float outer=exp(-r*r*4.5)*.20*(1.-smoothstep(.7,1.,r));
      float alpha=max(core,inner+outer);
      vec3 color=mix(vec3(1.5,.85,.25),vec3(4.,3.4,2.2),core);
      gl_FragColor=vec4(color*1.18,alpha);
    }`
  }));
  sun.add(glow);
  scene.add(sun);
  const textures = Array.from({ length: 4 }, (_, i) => densityTexture(i));
  const material = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    uniforms: { densityMap: { value: textures[0] }, sunDirection: { value: new THREE.Vector3(SUN.x, SUN.y, SUN.z).normalize() } },
    vertexShader: `out vec3 cloudPoint; void main(){cloudPoint=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `precision highp sampler3D;
      uniform sampler3D densityMap;uniform vec3 sunDirection; in vec3 cloudPoint; out vec4 cloudColor;
      void main(){
        vec3 p=cloudPoint,dir=normalize(vec3(0.,-.09,-1.));
        vec3 rgb=vec3(0.);float alpha=0.;
        for(int i=0;i<56;i++){
          if(any(greaterThan(abs(p),vec3(.501))))break;
          float d=texture(densityMap,p+.5).r;
          if(d>.015){
            float above=texture(densityMap,clamp(p+.5+sunDirection*.14,.001,.999)).r;
            float shade=clamp(.96-above*.36+p.y*.12,.56,1.);
            vec3 light=mix(vec3(.59,.69,.80),vec3(1.,.995,.975),shade);
            float a=1.-exp(-d*.17);rgb+=(1.-alpha)*a*light;alpha+=(1.-alpha)*a;
          }
          if(alpha>.985)break;
          p+=dir*.022;
        }
        if(alpha<.008)discard; cloudColor=vec4(rgb/max(alpha,.001),alpha);
      }`
  });
  const heights = [2.4, 3, 2.65, 3.35, 2.25, 2.85, 3.15, 2.55];
  const clouds = Array.from({ length: 8 }, (_, i) => {
    const texture = textures[i % textures.length], cloudMaterial = material.clone();
    cloudMaterial.uniforms.densityMap.value = texture;
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), cloudMaterial);
    const width = [2.8, 3.8, 2.2, 3.2][i % 4], height = [1.3, 0.85, 1.65, 1.1][i % 4];
    const z = -24 - i % 3 * 2.2;
    cloud.scale.set(width, height, 1.4);
    cloud.position.set(0, heights[i] + z * (2.15 / 15), z);
    cloud.userData.density = texture.image;
    scene.add(cloud);
    return cloud;
  });
  material.dispose();
  let sunlight = 1;
  return { update(distance, elapsed = 0, zoom = 1, dt = 0) {
    const position = sunBillboardPosition(zoom);
    sun.position.set(position.x, position.y, position.z);
    sun.scale.setScalar(zoom);
    sky.scale.x = zoom;
    sky.position.x = (zoom - 1) * 5;
    clouds.forEach((c, i) => {
      c.position.x = ((i * 4.1 * zoom - distance / 100 * (8e-3 + (2 - i % 3) * 2e-3) - elapsed * (0.018 + i % 4 * 4e-3)) % (33 * zoom) + 33 * zoom) % (33 * zoom) - 16.5 * zoom + (zoom - 1) * 5;
    });
    const target = sunTransmission(clouds, position, null, 0, zoom);
    sunlight = smoothSunlight(sunlight, target, dt);
    return sunlight;
  } };
}
