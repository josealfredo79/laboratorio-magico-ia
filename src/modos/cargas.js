// Cargas eléctricas: cada mano es una carga (+ o −). Se dibujan las líneas de campo
// y partículas de prueba que fluyen de + a −. El puño cambia el signo.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearExplosion, crearEtiqueta } from "../escena/efectos.js";
import { listaRetos } from "../ui/hud.js";
import { puntosPorTiempo } from "../ui/ranking.js";
import contenido from "../contenido/cargas.json";

const V = THREE.Vector3;

const LINEAS_POR_CARGA = 14;
const PASOS_LINEA = 120;
const PASO = 0.12;
const MAX_CARGAS = 2; // manos; si faltan, se completan con cargas fijas
const MAX_SEGMENTOS = MAX_CARGAS * LINEAS_POR_CARGA * PASOS_LINEA;
const PARTICULAS = 140;
const CERCA = 3.5; // distancia para "atraer" o "repeler"
const CHISPA = 1.1;
const COLORES = { 1: 0xff4d4d, [-1]: 0x4d7cff };

let e = null;
const aux = new V();

function campo(p, cargas, salida) {
  salida.set(0, 0, 0);
  for (const c of cargas) {
    aux.subVectors(p, c.pos);
    const r2 = Math.max(aux.lengthSq(), 0.05);
    salida.addScaledVector(aux, c.q / (r2 * Math.sqrt(r2)));
  }
  return salida;
}

function crearCarga() {
  const grupo = new THREE.Group();
  const esfera = new THREE.Mesh(
    new THREE.SphereGeometry(0.42, 32, 16),
    new THREE.MeshStandardMaterial({ color: COLORES[1], emissive: COLORES[1], emissiveIntensity: 0.5 }),
  );
  const mas = crearEtiqueta("+", { tamano: 0.75 });
  const menos = crearEtiqueta("−", { tamano: 0.75 });
  grupo.add(esfera, mas, menos);
  grupo.userData = { esfera, mas, menos };
  return grupo;
}

function pintarCarga(objeto, q) {
  const { esfera, mas, menos } = objeto.userData;
  esfera.material.color.set(COLORES[q]);
  esfera.material.emissive.set(COLORES[q]);
  mas.visible = q > 0;
  menos.visible = q < 0;
}

function trazarLineas(cargas, vista) {
  const pos = e.lineas.geometry.attributes.position;
  const fuentes = cargas.some((c) => c.q > 0) ? cargas.filter((c) => c.q > 0) : cargas;
  const limiteX = vista.mundoAncho / 2 + 0.5;
  const limiteY = vista.mundoAlto / 2 + 0.5;
  const p = new V();
  const E = new V();
  let n = 0;

  for (const fuente of fuentes) {
    const sentido = Math.sign(fuente.q); // las líneas salen de + y entran a −
    for (let k = 0; k < LINEAS_POR_CARGA; k++) {
      const angulo = (k / LINEAS_POR_CARGA) * Math.PI * 2 + e.giro;
      p.set(fuente.pos.x + Math.cos(angulo) * 0.45, fuente.pos.y + Math.sin(angulo) * 0.45, 0);
      for (let paso = 0; paso < PASOS_LINEA; paso++) {
        campo(p, cargas, E);
        if (E.lengthSq() < 1e-8) break;
        E.normalize().multiplyScalar(PASO * sentido);
        pos.setXYZ(n * 2, p.x, p.y, 0);
        p.add(E);
        pos.setXYZ(n * 2 + 1, p.x, p.y, 0);
        n++;
        if (Math.abs(p.x) > limiteX || Math.abs(p.y) > limiteY) break;
        if (cargas.some((c) => c !== fuente && c.pos.distanceTo(p) < 0.35)) break;
      }
    }
  }
  pos.needsUpdate = true;
  e.lineas.geometry.setDrawRange(0, n * 2);
}

function reubicarParticula(i, cargas, vista) {
  const positivas = cargas.filter((c) => c.q > 0);
  const p = e.particulas[i];
  if (positivas.length) {
    const c = positivas[i % positivas.length];
    const angulo = Math.random() * Math.PI * 2;
    p.pos.set(c.pos.x + Math.cos(angulo) * 0.5, c.pos.y + Math.sin(angulo) * 0.5, 0);
  } else {
    p.pos.set((Math.random() - 0.5) * vista.mundoAncho, (Math.random() - 0.5) * vista.mundoAlto, 0);
  }
  p.edad = Math.random() * 2;
}

function moverParticulas(cargas, vista, dt) {
  const pos = e.puntos.geometry.attributes.position;
  const E = new V();
  e.particulas.forEach((p, i) => {
    campo(p.pos, cargas, E);
    p.pos.addScaledVector(E.normalize(), 2.5 * dt); // una carga de prueba + sigue al campo
    p.edad += dt;
    const fuera = Math.abs(p.pos.x) > vista.mundoAncho / 2 || Math.abs(p.pos.y) > vista.mundoAlto / 2;
    const atrapada = cargas.some((c) => c.q < 0 && c.pos.distanceTo(p.pos) < 0.4);
    if (fuera || atrapada || p.edad > 5) reubicarParticula(i, cargas, vista);
    pos.setXYZ(i, p.pos.x, p.pos.y, 0.05);
  });
  pos.needsUpdate = true;
}

export default {
  id: "cargas",
  zona: "fisica",
  icono: "⚡",
  titulo: "Cargas eléctricas",
  descripcion: "Tus manos son cargas + y −",

  iniciar(ctx) {
    e = {
      inicio: performance.now(),
      capa: new THREE.Group(),
      signos: new Map(), // id de mano -> +1 / −1
      punos: new Map(), // id de mano -> estaba en puño
      retos: { atraer: false, repeler: false, chispa: false },
      efectos: [],
      giro: 0,
      esperaChispa: 0,
      completado: false,
    };
    ctx.escena.add(e.capa);

    e.lineas = new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTOS * 6), 3),
      ),
      new THREE.LineBasicMaterial({ color: 0xffe66b, transparent: true, opacity: 0.55 }),
    );
    e.particulas = Array.from({ length: PARTICULAS }, () => ({ pos: new V(), edad: 0 }));
    e.puntos = new THREE.Points(
      new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICULAS * 3), 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.09, transparent: true, opacity: 0.9 }),
    );
    e.objetos = [crearCarga(), crearCarga()];
    e.capa.add(e.lineas, e.puntos, ...e.objetos);
    e.particulas.forEach((_, i) => reubicarParticula(i, [], ctx.vista));

    ctx.hud.modo(this.titulo, "✋ Cada mano es una carga · ✊ Haz puño para cambiar su signo (+ ↔ −) · Con ratón: clic");
  },

  actualizar(ctx, dt) {
    e.efectos = e.efectos.filter((ef) => ef.actualizar(dt));
    e.giro += dt * 0.2;
    e.esperaChispa -= dt;

    // Cargas de las manos (centro de la palma). La primera es +, la segunda −.
    const manos = ctx.manos.slice(0, MAX_CARGAS);
    const cargas = manos.map((mano) => {
      if (!e.signos.has(mano.id)) e.signos.set(mano.id, [...e.signos.values()].includes(1) ? -1 : 1);
      const cerrada = mano.raton ? mano.pellizco : mano.puno;
      if (cerrada && !e.punos.get(mano.id)) {
        e.signos.set(mano.id, -e.signos.get(mano.id));
        ctx.sonido.click();
      }
      e.punos.set(mano.id, cerrada);
      const pos = mano.lm ? ctx.normAMundo(mano.lm[9].x, mano.lm[9].y) : mano.punta.clone();
      return { pos: pos.setZ(0), q: e.signos.get(mano.id) };
    });
    for (const id of e.signos.keys()) if (!manos.some((m) => m.id === id)) e.signos.delete(id);
    // Sin manos se ve un dipolo fijo; con una mano, esa mano interactúa con una carga − fija.
    if (cargas.length === 0) cargas.push({ pos: new V(-2.5, -0.3, 0), q: 1, fija: true });
    if (cargas.length === 1) cargas.push({ pos: new V(cargas[0].fija ? 2.5 : 0, -0.3, 0), q: -1, fija: true });

    e.objetos.forEach((objeto, i) => {
      objeto.visible = i < cargas.length;
      if (!objeto.visible) return;
      objeto.position.lerp(cargas[i].pos, 0.6);
      pintarCarga(objeto, cargas[i].q);
    });

    trazarLineas(cargas, ctx.vista);
    moverParticulas(cargas, ctx.vista, dt);

    // Interacción entre las dos cargas: Coulomb.
    const [a, b] = cargas;
    const r = a.pos.distanceTo(b.pos);
    const opuestas = a.q !== b.q;
    if (r < CERCA) e.retos[opuestas ? "atraer" : "repeler"] = true;
    if (opuestas && r < CHISPA && e.esperaChispa <= 0) {
      e.retos.chispa = true;
      e.esperaChispa = 1.5;
      e.efectos.push(crearExplosion(e.capa, a.pos.clone().lerp(b.pos, 0.5), [0xffffff, 0xffe66b, 0x9fd8ff], 160));
      ctx.sonido.chispa();
      ctx.hud.aviso("⚡ ¡Descarga! Así se forma un rayo, pero en miniatura", "ok", 1800);
    }

    if (!e.completado && Object.values(e.retos).every(Boolean)) {
      e.completado = true;
      ctx.sonido.exito();
      ctx.terminar({
        logro: ["¡Dominaste la electricidad!", "Atrajiste, repeliste y produjiste una descarga."],
        dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
        carrera: ["Si te gustó, estudia:", contenido.carreras],
      }, puntosPorTiempo((performance.now() - e.inicio) / 1000, 1000));
    }

    const fuerza = Math.min(4 / (r * r), 1);
    const barra = "▓".repeat(Math.round(fuerza * 10)).padEnd(10, "░");
    ctx.hud.stats(
      `${opuestas ? "🧲 Se ATRAEN (cargas opuestas)" : "↔️ Se REPELEN (cargas iguales)"} · ` +
        `r = ${r.toFixed(1)} · F ∝ 1/r² ${barra}<br>` +
        listaRetos([
          ["Atraer", e.retos.atraer],
          ["Repeler", e.retos.repeler],
          ["Chispa (acerca + y −)", e.retos.chispa],
        ]),
    );
  },

  detener() {
    liberar(e.capa);
    e = null;
  },
};
