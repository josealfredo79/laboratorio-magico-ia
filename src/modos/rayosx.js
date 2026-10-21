// Rayos X: dibuja tu esqueleto sobre tu cuerpo (PoseLandmarker + manos).
// Señala un hueso con el dedo para conocerlo.
import * as THREE from "three";
import { HandLandmarker } from "@mediapipe/tasks-vision";
import { liberar } from "../escena/escena.js";
import { listaRetos } from "../ui/hud.js";
import { puntosPorTiempo } from "../ui/ranking.js";
import contenido from "../contenido/rayosx.json";

const V = THREE.Vector3;

// Puntos de PoseLandmarker: 7/8 orejas, 11/12 hombros, 13/14 codos, 15/16 muñecas,
// 23/24 caderas, 25/26 rodillas, 27/28 tobillos. Impares = lado izquierdo de la persona.
const HUESOS = [
  { id: "clavicula", a: 11, b: 12, grosor: 0.07 },
  { id: "humero", a: 11, b: 13, grosor: 0.1, lado: 15 },
  { id: "humero", a: 12, b: 14, grosor: 0.1, lado: 16 },
  { id: "radio", a: 13, b: 15, grosor: 0.05, doble: true, lado: 15 },
  { id: "radio", a: 14, b: 16, grosor: 0.05, doble: true, lado: 16 },
  { id: "pelvis", a: 23, b: 24, grosor: 0.14 },
  { id: "femur", a: 23, b: 25, grosor: 0.12 },
  { id: "femur", a: 24, b: 26, grosor: 0.12 },
  { id: "tibia", a: 25, b: 27, grosor: 0.06, doble: true },
  { id: "tibia", a: 26, b: 28, grosor: 0.06, doble: true },
];
const VERTEBRAS = 12;
const COSTILLAS = 6;
const RETOS = ["craneo", "clavicula", "costillas", "columna", "humero"];
const SOSTENER = 0.6;
const VISIBLE = 0.5;
const CONEXIONES_MANO = HandLandmarker.HAND_CONNECTIONS;

let e = null;

function colocarCilindro(malla, a, b, grosor) {
  const eje = new V().subVectors(b, a);
  const largo = eje.length();
  malla.visible = largo > 0.01;
  if (!malla.visible) return;
  malla.position.copy(a).addScaledVector(eje, 0.5);
  malla.scale.set(grosor, largo, grosor);
  malla.quaternion.setFromUnitVectors(new V(0, 1, 0), eje.divideScalar(largo));
}

function distanciaASegmento(p, a, b) {
  const ab = new V().subVectors(b, a);
  const t = THREE.MathUtils.clamp(new V().subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

export default {
  id: "rayosx",
  zona: "biologia",
  icono: "🦴",
  titulo: "Rayos X",
  descripcion: "Mira tu esqueleto en movimiento",
  necesita: { pose: true },

  iniciar(ctx) {
    document.body.classList.add("rayosx");
    e = { inicio: performance.now(), capa: new THREE.Group(), encontrados: new Set(), apuntado: null, sostenido: 0, completado: false };
    ctx.escena.add(e.capa);

    e.material = new THREE.MeshStandardMaterial({ color: 0xe8f4ff, emissive: 0x6fb6ff, emissiveIntensity: 0.5 });
    e.resaltado = new THREE.MeshStandardMaterial({ color: 0xfff3a0, emissive: 0xffd000, emissiveIntensity: 0.8 });
    const cilindro = new THREE.CylinderGeometry(1, 1, 1, 12);
    const esfera = new THREE.SphereGeometry(1, 24, 16);
    const nuevaMalla = (geometria) => {
      const malla = new THREE.Mesh(geometria, e.material);
      e.capa.add(malla);
      return malla;
    };

    e.huesos = HUESOS.map((h) => ({ ...h, mallas: h.doble ? [nuevaMalla(cilindro), nuevaMalla(cilindro)] : [nuevaMalla(cilindro)] }));
    e.vertebras = Array.from({ length: VERTEBRAS }, () => nuevaMalla(esfera));
    e.craneo = nuevaMalla(esfera);
    e.craneo.material = e.material.clone();
    e.craneo.material.transparent = true;
    e.craneo.material.opacity = 0.55;
    e.costillas = Array.from({ length: COSTILLAS }, () => {
      const linea = new THREE.Line(
        new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(21 * 3), 3)),
        new THREE.LineBasicMaterial({ color: 0xcfe8ff }),
      );
      e.capa.add(linea);
      return linea;
    });
    e.falanges = Array.from({ length: 2 * CONEXIONES_MANO.length }, () => nuevaMalla(cilindro));

    ctx.hud.modo(this.titulo, "🧍 Párate a 1.5–2 m de la cámara · 👉 Señala tus huesos con el dedo índice");
  },

  actualizar(ctx, dt) {
    const pose = ctx.pose?.landmarks?.[0];
    const p = (i) => ctx.normAMundo(pose[i].x, pose[i].y);
    const ve = (...indices) => indices.every((i) => (pose[i].visibility ?? 1) > VISIBLE);
    const candidatos = []; // { id, distancia(punto) }

    for (const malla of e.capa.children) malla.visible = false;

    if (pose) {
      const hombros = p(11).distanceTo(p(12));
      for (const hueso of e.huesos) {
        if (!ve(hueso.a, hueso.b)) continue;
        const a = p(hueso.a);
        const b = p(hueso.b);
        const grosor = hueso.grosor * hombros * 0.6;
        if (hueso.doble) {
          const lateral = new V(-(b.y - a.y), b.x - a.x, 0).normalize().multiplyScalar(grosor * 1.4);
          colocarCilindro(hueso.mallas[0], a.clone().add(lateral), b.clone().add(lateral), grosor);
          colocarCilindro(hueso.mallas[1], a.clone().sub(lateral), b.clone().sub(lateral), grosor);
        } else {
          colocarCilindro(hueso.mallas[0], a, b, grosor);
        }
        candidatos.push({ id: hueso.id, lado: hueso.lado, mallas: hueso.mallas, distancia: (q) => distanciaASegmento(q, a, b) });
      }

      if (ve(11, 12, 23, 24)) {
        const cuello = p(11).lerp(p(12), 0.5);
        const cadera = p(23).lerp(p(24), 0.5);
        e.vertebras.forEach((v, i) => {
          v.position.copy(cuello).lerp(cadera, i / (VERTEBRAS - 1));
          v.scale.setScalar(hombros * 0.045);
          v.visible = true;
        });
        candidatos.push({ id: "columna", mallas: e.vertebras, distancia: (q) => distanciaASegmento(q, cuello, cadera) });

        // Costillas: arcos en el tercio superior del torso.
        const anchoTorax = hombros * 0.42;
        e.costillas.forEach((linea, k) => {
          const centro = cuello.clone().lerp(cadera, 0.12 + k * 0.07);
          const ancho = anchoTorax * (0.8 + Math.sin((k / COSTILLAS) * Math.PI) * 0.3);
          const pos = linea.geometry.attributes.position;
          for (let i = 0; i <= 20; i++) {
            const angulo = Math.PI * (i / 20);
            pos.setXYZ(i, centro.x + Math.cos(angulo) * ancho, centro.y - Math.sin(angulo) * hombros * 0.12, 0);
          }
          pos.needsUpdate = true;
          linea.visible = true;
        });
        const torax = cuello.clone().lerp(cadera, 0.3);
        candidatos.push({
          id: "costillas",
          mallas: [],
          distancia: (q) => {
            const dx = (q.x - torax.x) / (anchoTorax * 1.1);
            const dy = (q.y - torax.y) / (hombros * 0.35);
            const dentro = Math.hypot(dx, dy) < 1 && Math.abs(q.x - torax.x) > hombros * 0.1;
            return dentro ? 0.01 : Infinity;
          },
        });
      }

      if (ve(7, 8)) {
        const centro = p(7).lerp(p(8), 0.5);
        const radio = p(7).distanceTo(p(8)) * 0.65;
        e.craneo.position.copy(centro);
        e.craneo.scale.set(radio, radio * 1.2, radio);
        e.craneo.visible = true;
        candidatos.push({ id: "craneo", mallas: [e.craneo], distancia: (q) => Math.max(q.distanceTo(centro) - radio, 0) });
      }
    }

    // Huesos de las manos (21 puntos de HandLandmarker).
    ctx.manos.filter((m) => m.lm).slice(0, 2).forEach((mano, h) => {
      const puntos = mano.lm.map((q) => ctx.normAMundo(q.x, q.y));
      CONEXIONES_MANO.forEach(({ start, end }, c) => {
        colocarCilindro(e.falanges[h * CONEXIONES_MANO.length + c], puntos[start], puntos[end], 0.035);
      });
    });

    // ¿Qué hueso señala el dedo? Se ignora el brazo con el que se apunta.
    for (const malla of [...e.huesos.flatMap((h) => h.mallas), ...e.vertebras]) malla.material = e.material;
    let apuntado = null;
    const mano = ctx.manos[0];
    if (mano && pose) {
      const munecaMano = mano.lm ? ctx.normAMundo(mano.lm[0].x, mano.lm[0].y) : mano.punta;
      const ladoQueApunta = p(15).distanceTo(munecaMano) < p(16).distanceTo(munecaMano) ? 15 : 16;
      const umbral = Math.max(0.35, p(11).distanceTo(p(12)) * 0.15);
      apuntado = candidatos
        .filter((c) => c.lado !== ladoQueApunta)
        .map((c) => ({ ...c, d: c.distancia(mano.punta) }))
        .filter((c) => c.d < umbral)
        .sort((a, b) => a.d - b.d)[0];
    }
    if (!apuntado && mano?.lm && ctx.manos[1]?.lm) {
      const otra = ctx.manos[1].lm.map((q) => ctx.normAMundo(q.x, q.y));
      if (Math.min(...otra.map((q) => q.distanceTo(mano.punta))) < 0.4) apuntado = { id: "mano", mallas: [] };
    }

    if (apuntado) {
      for (const malla of apuntado.mallas) if (malla !== e.craneo) malla.material = e.resaltado;
      const info = contenido.huesos[apuntado.id];
      ctx.hud.instruccion(`👉 ${info.nombre}: ${info.dato}`);
      e.sostenido = apuntado.id === e.apuntado ? e.sostenido + dt : 0;
      if (e.sostenido > SOSTENER && RETOS.includes(apuntado.id) && !e.encontrados.has(apuntado.id)) {
        e.encontrados.add(apuntado.id);
        ctx.sonido.acierto();
        ctx.hud.aviso(`✔ ¡Encontraste: ${info.nombre}!`, "ok", 1800);
      }
    } else {
      e.sostenido = 0;
      ctx.hud.instruccion(
        pose
          ? "👉 Señala tus huesos con el dedo índice"
          : "🧍 Párate a 1.5–2 m de la cámara para que vea tu cuerpo",
      );
    }
    e.apuntado = apuntado?.id ?? null;
    e.craneo.material.emissive.set(apuntado?.id === "craneo" ? 0xffd000 : 0x6fb6ff);

    if (!e.completado && e.encontrados.size === RETOS.length) {
      e.completado = true;
      ctx.sonido.exito();
      ctx.terminar({
        logro: ["¡Encontraste los 5 huesos!", "Cráneo, clavícula, costillas, columna y húmero."],
        dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
        carrera: ["Si te gustó, estudia:", contenido.carreras],
      }, puntosPorTiempo((performance.now() - e.inicio) / 1000, 1500));
    }
    ctx.hud.stats(`Encuentra: ${listaRetos(RETOS.map((id) => [contenido.huesos[id].nombre, e.encontrados.has(id)]))}`);
  },

  detener() {
    document.body.classList.remove("rayosx");
    liberar(e.capa);
    e.material.dispose();
    e.resaltado.dispose();
    e = null;
  },
};
