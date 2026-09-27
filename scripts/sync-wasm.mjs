import { cp, mkdir } from "node:fs/promises";
import { join } from "node:path";

const source = join(process.cwd(), "node_modules/@mediapipe/tasks-vision/wasm");
const target = join(process.cwd(), "public/vendor/mediapipe/wasm");
await mkdir(target, { recursive: true });
for (const name of [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
]) {
  await cp(join(source, name), join(target, name));
}
console.log("MediaPipe WASM files copied to public/vendor/mediapipe/wasm");
