// Modo científico: muestra lo que "ve" la IA (puntos de manos y cara) con datos en vivo.
import * as THREE from "three";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { liberar } from "../escena/escena.js";
import { aperturaPinza, nombreGesto } from "../vision/gestos.js";
import contenido from "../contenido/cientifico.json";

const MAX_MANOS = 2;
const PUNTOS_MANO = 21;
const PUNTOS_CARA = 478;
const CONEXIONES = HandLandmarker.HAND_CONNECTIONS;
const PROFUNDIDAD = 6; // exagera la z de MediaPipe para que se note en 3D

const EXPRESIONES = [
  ["eyeBlinkLeft", "😉 Parpadeo izq."],
  ["eyeBlinkRight", "😉 Parpadeo der."],
  ["jawOpen", "😮 Boca abierta"],
  ["mouthSmileLeft", "😄 Sonrisa"],
  ["browInnerUp", "🤨 Cejas arriba"],
];

let grupo, articulaciones, huesos, cara, ultimaStats;
const auxiliar = new THREE.Object3D();

function aMundo(ctx, p) {
  return ctx.normAMundo(p.x, p.y, THREE.MathUtils.clamp(-p.z * PROFUNDIDAD, -2, 2));
}

export default {
  id: "cientifico",
  zona: "ia",
  icono: "🔬",
  titulo: "¿Cómo me ve la IA?",
  descripcion: "Mira los puntos que detecta en tu mano y cara",
  necesita: { cara: true },

  iniciar(ctx) {
    grupo = new THREE.Group();
    ctx.escena.add(grupo);

    articulaciones = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.09, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0x5ef2ff, emissive: 0x2299aa }),
      MAX_MANOS * PUNTOS_MANO,
    );
    huesos = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(MAX_MANOS * CONEXIONES.length * 6), 3),
      ),
      new THREE.LineBasicMaterial({ color: 0xff5ec8 }),
    );
    cara = new THREE.Points(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(PUNTOS_CARA * 3), 3),
      ),
      new THREE.PointsMaterial({ color: 0x5dff9d, size: 0.045 }),
    );
    grupo.add(articulaciones, huesos, cara);
    ultimaStats = 0;

    ctx.hud.modo(this.titulo, "Mueve tus manos y haz caras: esto es lo que entiende la computadora");
    ctx.hud.tarjetas({
      dato: ["¿Cómo funciona?", contenido.concepto],
      logro: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
      carrera: ["Si te gustó, estudia:", contenido.carreras],
    });
  },

  actualizar(ctx, dt) {
    const manos = ctx.manos.filter((m) => m.lm).slice(0, MAX_MANOS);

    // Manos: esferas en las 21 articulaciones y líneas entre ellas.
    const lineas = huesos.geometry.attributes.position;
    for (let h = 0; h < MAX_MANOS; h++) {
      const mano = manos[h];
      for (let i = 0; i < PUNTOS_MANO; i++) {
        if (mano) {
          auxiliar.position.copy(aMundo(ctx, mano.lm[i]));
          auxiliar.scale.setScalar([4, 8, 12, 16, 20].includes(i) ? 1.5 : 1);
        } else {
          auxiliar.scale.setScalar(0);
        }
        auxiliar.updateMatrix();
        articulaciones.setMatrixAt(h * PUNTOS_MANO + i, auxiliar.matrix);
      }
      CONEXIONES.forEach(({ start, end }, c) => {
        const base = (h * CONEXIONES.length + c) * 2;
        const a = mano ? aMundo(ctx, mano.lm[start]) : null;
        const b = mano ? aMundo(ctx, mano.lm[end]) : null;
        lineas.setXYZ(base, a?.x ?? 0, a?.y ?? 0, a?.z ?? -50);
        lineas.setXYZ(base + 1, b?.x ?? 0, b?.y ?? 0, b?.z ?? -50);
      });
    }
    articulaciones.instanceMatrix.needsUpdate = true;
    lineas.needsUpdate = true;

    // Cara: nube de 478 puntos.
    const puntosCara = ctx.cara?.faceLandmarks?.[0];
    cara.visible = !!puntosCara;
    if (puntosCara) {
      const pos = cara.geometry.attributes.position;
      puntosCara.forEach((p, i) => {
        const v = aMundo(ctx, p);
        pos.setXYZ(i, v.x, v.y, v.z);
      });
      pos.needsUpdate = true;
    }

    // Datos en vivo, unas 8 veces por segundo para que se puedan leer.
    ultimaStats -= dt;
    if (ultimaStats > 0) return;
    ultimaStats = 0.12;
    const total = manos.length * PUNTOS_MANO + (puntosCara ? PUNTOS_CARA : 0);
    let html = `🖐️ Manos: ${manos.length} · 🙂 Cara: ${puntosCara ? "sí" : "no"} · 📍 Puntos: ${total}`;
    for (const mano of manos) {
      html += `<br>${mano.id === "Left" ? "Mano A" : "Mano B"}: ${nombreGesto(mano.lm, mano.pellizco)}
        · pinza = ${aperturaPinza(mano.lm).toFixed(2)}`;
    }
    const expresiones = ctx.cara?.faceBlendshapes?.[0]?.categories;
    if (expresiones) {
      const valor = Object.fromEntries(expresiones.map((c) => [c.categoryName, c.score]));
      html += `<div class="barras">${EXPRESIONES.map(
        ([clave, nombre]) =>
          `<span>${nombre}</span><span class="barra"><i style="width:${Math.round((valor[clave] ?? 0) * 100)}%"></i></span>`,
      ).join("")}</div>`;
    }
    ctx.hud.stats(html);
  },

  detener() {
    liberar(grupo);
  },
};
