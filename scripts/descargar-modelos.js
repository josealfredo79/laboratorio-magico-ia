// Descarga los modelos de MediaPipe y copia los archivos WASM a public/
// para que la app funcione SIN internet en la feria.
import { cp, mkdir, writeFile, access } from "node:fs/promises";

const BASE = "https://storage.googleapis.com/mediapipe-models";
const MODELOS = {
  "hand_landmarker.task": `${BASE}/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task`,
  "face_landmarker.task": `${BASE}/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`,
  "gesture_recognizer.task": `${BASE}/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task`,
  "pose_landmarker_lite.task": `${BASE}/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`,
};

await mkdir("public/models", { recursive: true });
for (const [nombre, url] of Object.entries(MODELOS)) {
  const destino = `public/models/${nombre}`;
  try { await access(destino); console.log(`✔ ${nombre} (ya existe)`); continue; } catch {}
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${nombre}: HTTP ${res.status}`);
  await writeFile(destino, Buffer.from(await res.arrayBuffer()));
  console.log(`⬇ ${nombre}`);
}
await cp("node_modules/@mediapipe/tasks-vision/wasm", "public/wasm", { recursive: true });
console.log("✔ wasm copiado a public/wasm");
