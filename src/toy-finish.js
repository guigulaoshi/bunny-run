import * as THREE from "./vendor/three.module.min.js";
export function createToyFinish(renderer) {
  const studio = new THREE.Scene();
  studio.background = new THREE.Color("#acbcc6");
  for (const [x, y, z, w, h, intensity] of [[-4, 7, 5, 5, 4, 3], [5, 4, -2, 3, 5, 1.6]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(intensity, intensity * 0.96, intensity * 0.9), side: THREE.DoubleSide }));
    panel.position.set(x, y, z);
    panel.lookAt(0, 0, 0);
    studio.add(panel);
  }
  const pmrem = new THREE.PMREMGenerator(renderer), environment = pmrem.fromScene(studio, 0.06);
  studio.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  pmrem.dispose();
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
  target.depthTexture = new THREE.DepthTexture(1, 1);
  const material = new THREE.ShaderMaterial({
    uniforms: { picture: { value: target.texture }, depth: { value: target.depthTexture }, pixel: { value: new THREE.Vector2(1, 1) } },
    vertexShader: "varying vec2 uvScreen;void main(){uvScreen=uv;gl_Position=vec4(position.xy,0.,1.);}",
    fragmentShader: `uniform sampler2D picture;uniform sampler2D depth;uniform vec2 pixel;varying vec2 uvScreen;
      void main(){
        float d=texture2D(depth,uvScreen).r;
        float blur=smoothstep(.202,.306,d)*1.7;
        vec3 color=texture2D(picture,uvScreen).rgb*4.;float weight=4.;
        for(int i=0;i<8;i++){
          float a=float(i)*.785398;vec2 p=uvScreen+vec2(cos(a),sin(a))*pixel*blur;
          float tapDepth=texture2D(depth,p).r;
          float w=1.-smoothstep(.014,.042,abs(tapDepth-d));
          color+=texture2D(picture,p).rgb*w;weight+=w;
        }
        color/=weight;
        float luma=dot(color,vec3(.2126,.7152,.0722));
        color=mix(vec3(luma),color,1.08);
        vec2 edge=(uvScreen-.5)*vec2(.8,1.);
        color*=1.-.12*dot(edge,edge);
        gl_FragColor=vec4(max(color,vec3(0.)),1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    depthTest: false,
    depthWrite: false
  });
  const screen = new THREE.Scene(), camera = new THREE.Camera();
  screen.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material));
  const size = new THREE.Vector2();
  return { environment: environment.texture, render(scene, camera3d) {
    renderer.getDrawingBufferSize(size);
    if (target.width !== size.x || target.height !== size.y) {
      target.setSize(size.x, size.y);
      material.uniforms.pixel.value.set(1 / size.x, 1 / size.y);
    }
    renderer.setRenderTarget(target);
    renderer.render(scene, camera3d);
    renderer.setRenderTarget(null);
    renderer.render(screen, camera);
  } };
}
