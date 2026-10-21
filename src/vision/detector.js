// Detectores de MediaPipe cargados desde /models y /wasm (sin internet).
import { FilesetResolver, HandLandmarker, FaceLandmarker, PoseLandmarker } from "@mediapipe/tasks-vision";

async function crearTarea(Clase, vision, modelo, opciones) {
  for (const delegate of ["GPU", "CPU"]) {
    try {
      return await Clase.createFromOptions(vision, {
        baseOptions: { modelAssetPath: modelo, delegate },
        runningMode: "VIDEO",
        ...opciones,
      });
    } catch (error) {
      if (delegate === "CPU") throw error;
      console.warn(`${Clase.name}: GPU no disponible, usando CPU`, error);
    }
  }
}

export async function crearDetector() {
  const vision = await FilesetResolver.forVisionTasks("/wasm");
  const manos = await crearTarea(HandLandmarker, vision, "/models/hand_landmarker.task", {
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
      cargandoCara ??= crearTarea(FaceLandmarker, vision, "/models/face_landmarker.task", {
        numFaces: 1,
        outputFaceBlendshapes: true,
      }).then((tarea) => (cara = tarea));
      return cargandoCara;
    },

    asegurarPose() {
      cargandoPose ??= crearTarea(PoseLandmarker, vision, "/models/pose_landmarker_lite.task", {
        numPoses: 1,
      }).then((tarea) => (pose = tarea));
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
