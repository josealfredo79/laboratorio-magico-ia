// Detectores de MediaPipe cargados desde /models y /wasm (sin internet).
import { FilesetResolver, HandLandmarker, FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

// En algunos celulares la GPU nunca responde: tras este tiempo se usa la CPU.
const ESPERA_GPU = 12000;

const conLimite = (promesa, ms) =>
  Promise.race([promesa, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error("la GPU no respondió")), ms))]);

// Descarga un archivo informando el avance (0..1). Así la pantalla de carga muestra un %.
async function descargar(url, alAvanzar) {
  const respuesta = await fetch(url);
  if (!respuesta.ok) throw new Error(`no se pudo descargar ${url.split("/").pop()} (HTTP ${respuesta.status})`);
  // Ojo: si el servidor comprime (GitHub Pages lo hace), content-length es el tamaño
  // comprimido y llegan MÁS bytes que eso. Por eso se juntan trozos y el % se limita a 99.
  const total = Number(respuesta.headers.get("content-length")) || 0;
  if (!respuesta.body || !total) return new Uint8Array(await respuesta.arrayBuffer());
  const lector = respuesta.body.getReader();
  const trozos = [];
  let recibido = 0;
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    recibido += value.length;
    alAvanzar?.(Math.min(recibido / total, 0.99));
  }
  const datos = new Uint8Array(recibido);
  let posicion = 0;
  for (const trozo of trozos) {
    datos.set(trozo, posicion);
    posicion += trozo.length;
  }
  return datos;
}

async function crearTarea(Clase, vision, modelo, opciones) {
  for (const delegate of ["GPU", "CPU"]) {
    try {
      const tarea = Clase.createFromOptions(vision, {
        baseOptions: { modelAssetBuffer: modelo, delegate },
        runningMode: "VIDEO",
        ...opciones,
      });
      return await (delegate === "GPU" ? conLimite(tarea, ESPERA_GPU) : tarea);
    } catch (error) {
      if (delegate === "CPU") throw error;
      console.warn(`${Clase.name}: GPU no disponible, usando CPU`, error);
    }
  }
}

// BASE_URL respeta la subcarpeta de GitHub Pages ("./" en la versión publicada).
const BASE = import.meta.env.BASE_URL;

// alAvanzar(fraccion) informa la descarga inicial (motor de IA + modelo de manos).
export async function crearDetector(alAvanzar) {
  const vision = await FilesetResolver.forVisionTasks(`${BASE}wasm`);
  // Se descarga primero el motor (queda en caché del navegador) y luego el modelo de manos.
  await descargar(vision.wasmBinaryPath, (f) => alAvanzar?.(f * 0.55));
  const modeloManos = await descargar(`${BASE}models/hand_landmarker.task`, (f) => alAvanzar?.(0.55 + f * 0.45));
  const manos = await crearTarea(HandLandmarker, vision, modeloManos, {
    numHands: 2,
    minHandDetectionConfidence: 0.6,
    minHandPresenceConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  let cara = null;
  let cargandoCara = null;
  let pose = null;
  let cargandoPose = null;
  let ultimoCuadro = -1;

  return {
    // La cara se carga solo cuando un modo la necesita (ahorra GPU).
    asegurarCara() {
      cargandoCara ??= descargar(`${BASE}models/face_landmarker.task`)
        .then((modelo) => crearTarea(FaceLandmarker, vision, modelo, { numFaces: 1, outputFaceBlendshapes: true }))
        .then((tarea) => (cara = tarea));
      return cargandoCara;
    },

    asegurarPose() {
      cargandoPose ??= descargar(`${BASE}models/pose_landmarker_lite.task`)
        .then((modelo) => crearTarea(PoseLandmarker, vision, modelo, { numPoses: 1 }))
        .then((tarea) => (pose = tarea));
      return cargandoPose;
    },

    // Devuelve null si la cámara no tiene un cuadro nuevo.
    detectar(video, ahora, { conCara = false, conPose = false } = {}) {
      if (video.readyState < 2 || video.currentTime === ultimoCuadro) return null;
      ultimoCuadro = video.currentTime;
      return {
        manos: manos.detectForVideo(video, ahora),
        cara: conCara && cara ? cara.detectForVideo(video, ahora) : null,
        pose: conPose && pose ? pose.detectForVideo(video, ahora) : null,
      };
    },
  };
}
