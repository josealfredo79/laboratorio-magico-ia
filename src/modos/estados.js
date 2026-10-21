// Estados de la materia: la separación de las manos es la temperatura del agua.
// Las partículas vibran (sólido), se deslizan (líquido) o vuelan (gas).
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearEtiqueta } from "../escena/efectos.js";
import { listaRetos } from "../ui/hud.js";
import contenido from "../contenido/estados.json";

const V = THREE.Vector3;

const N = 100;
const RADIO = 0.12;
const CAJA = { ancho: 6, alto: 4.4, fondo: 1, y: -0.8 };
const T_MIN = -30;
const T_MAX = 140;
const DISTANCIA_CHOQUE = 0.28;

const ESTADOS = {
  solido: { nombre: "🧊 SÓLIDO (hielo)", corto: "Sólido" },
  liquido: { nombre: "💧 LÍQUIDO (agua)", corto: "Líquido" },
  gas: { nombre: "💨 GAS (vapor)", corto: "Gas" },
};
const CAMBIOS = {
  "solido>liquido": "🧊→💧 ¡Fusión! A 0 °C el hielo se derrite",
  "liquido>gas": "💧→💨 ¡Ebullición! A 100 °C el agua hierve",
  "gas>liquido": "💨→💧 ¡Condensación! El vapor vuelve a ser agua",
  "liquido>solido": "💧→🧊 ¡Solidificación! El agua se congela",
  "solido>gas": "🧊→💨 ¡Cambio directo a gas!",
  "gas>solido": "💨→🧊 ¡Cambio directo a sólido!",
};

let e = null;

const estadoDe = (t) => (t < 0 ? "solido" : t < 100 ? "liquido" : "gas");
const normalizada = (t) => (t - T_MIN) / (T_MAX - T_MIN);

function redDeHielo() {
  const lado = 10;
  const sep = 0.28;
  const base = CAJA.y - CAJA.alto / 2 + 0.25;
  return Array.from({ length: N }, (_, i) =>
    new V(((i % lado) - (lado - 1) / 2) * sep, base + Math.floor(i / lado) * sep, 0),
  );
}

function simular(dt) {
  const tn = normalizada(e.t);
  const estado = estadoDe(e.t);
  const velocidadObjetivo = estado === "gas" ? 3 + 6 * tn : 0.6 + 2.5 * tn;
  const minX = -CAJA.ancho / 2 + RADIO;
  const minY = CAJA.y - CAJA.alto / 2 + RADIO;
  const maxY = CAJA.y + CAJA.alto / 2 - RADIO;
  const fz = CAJA.fondo / 2 - RADIO;

  for (let i = 0; i < N; i++) {
    const p = e.pos[i];
    const v = e.vel[i];
    if (estado === "solido") {
      // Resorte hacia su lugar en la red de hielo + vibración térmica.
      v.addScaledVector(e.red[i].clone().sub(p), 60 * dt);
      v.multiplyScalar(1 - 6 * dt);
      v.x += (Math.random() - 0.5) * (2 + 30 * tn) * dt * 10;
      v.y += (Math.random() - 0.5) * (2 + 30 * tn) * dt * 10;
    } else {
      if (estado === "liquido") v.y -= 7 * dt;
      // Termostato: acerca la rapidez de cada partícula a la de su temperatura.
      const rapidez = v.length() || 0.01;
      v.multiplyScalar(1 + (velocidadObjetivo / rapidez - 1) * 0.08);
      v.x += (Math.random() - 0.5) * dt * 4;
    }
  }

  // Choques entre partículas (no en sólido: ahí manda la red).
  if (estado !== "solido") {
    for (let i = 0; i < N; i++) {
      for (let j = i + 1; j < N; j++) {
        const d = e.pos[i].distanceTo(e.pos[j]);
        if (d >= DISTANCIA_CHOQUE || d === 0) continue;
        const empuje = e.pos[i].clone().sub(e.pos[j]).multiplyScalar(((DISTANCIA_CHOQUE - d) / d) * 30 * dt);
        e.vel[i].add(empuje);
        e.vel[j].sub(empuje);
      }
    }
  }

  for (let i = 0; i < N; i++) {
    const p = e.pos[i];
    const v = e.vel[i];
    p.addScaledVector(v, dt);
    if (p.x < minX || p.x > -minX) { p.x = THREE.MathUtils.clamp(p.x, minX, -minX); v.x *= -0.9; }
    if (p.y < minY || p.y > maxY) { p.y = THREE.MathUtils.clamp(p.y, minY, maxY); v.y *= -0.9; }
    if (Math.abs(p.z) > fz) { p.z = Math.sign(p.z) * fz; v.z *= -0.9; }
  }
}

function pintar() {
  const m = new THREE.Matrix4();
  const color = new THREE.Color();
  const escala = estadoDe(e.t) === "gas" ? 1.6 : 1;
  for (let i = 0; i < N; i++) {
    e.particulas.setMatrixAt(i, m.makeTranslation(e.pos[i].x, e.pos[i].y, e.pos[i].z));
    // Azul = lenta (fría), rojo = rápida (caliente).
    const rapidez = Math.min(e.vel[i].length() / (4 * escala), 1);
    e.particulas.setColorAt(i, color.setHSL(0.62 - 0.62 * rapidez, 0.9, 0.55));
  }
  e.particulas.instanceMatrix.needsUpdate = true;
  e.particulas.instanceColor.needsUpdate = true;

  const tn = normalizada(e.t);
  e.relleno.scale.y = Math.max(tn, 0.02);
  e.relleno.position.y = e.termometro.base + (e.termometro.alto * e.relleno.scale.y) / 2;
  e.relleno.material.color.setHSL(0.62 - 0.62 * tn, 0.9, 0.55);
}

function crearTermometro(ctx) {
  const alto = 5;
  const x = -ctx.vista.mundoAncho * 0.36;
  const base = -alto / 2 - 0.6;
  const tubo = new THREE.Mesh(
    new THREE.CylinderGeometry(0.28, 0.28, alto, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.15, side: THREE.DoubleSide }),
  );
  tubo.position.set(x, base + alto / 2, 0);
  const relleno = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, alto, 24), new THREE.MeshBasicMaterial());
  relleno.position.x = x;
  e.capa.add(tubo, relleno);
  for (const grados of [0, 100]) {
    const etiqueta = crearEtiqueta(`${grados} °C`, { tamano: 0.45 });
    etiqueta.position.set(x + 1, base + alto * normalizada(grados), 0);
    const marca = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    marca.position.set(x, etiqueta.position.y, 0);
    e.capa.add(etiqueta, marca);
  }
  e.relleno = relleno;
  e.termometro = { alto, base };
}

export default {
  id: "estados",
  zona: "quimica",
  icono: "🌡️",
  titulo: "Estados de la materia",
  descripcion: "Calienta y enfría partículas con tus manos",

  iniciar(ctx) {
    e = {
      capa: new THREE.Group(),
      t: -20,
      red: redDeHielo(),
      visitados: new Set(["solido"]),
      completado: false,
    };
    e.pos = e.red.map((p) => p.clone());
    e.vel = e.red.map(() => new V());
    e.estado = estadoDe(e.t);
    ctx.escena.add(e.capa);

    e.particulas = new THREE.InstancedMesh(
      new THREE.SphereGeometry(RADIO, 16, 10),
      new THREE.MeshStandardMaterial({ roughness: 0.3 }),
      N,
    );
    e.particulas.setColorAt(0, new THREE.Color());
    const caja = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(CAJA.ancho, CAJA.alto, CAJA.fondo)),
      new THREE.LineBasicMaterial({ color: 0x9fd8ff }),
    );
    caja.position.y = CAJA.y;
    e.capa.add(e.particulas, caja);
    crearTermometro(ctx);

    ctx.hud.modo(this.titulo, "🙌 Separa las manos para CALENTAR y júntalas para ENFRIAR (con una mano: súbela o bájala)");
  },

  actualizar(ctx, dt) {
    // Temperatura objetivo según las manos.
    const manos = ctx.manos;
    let tn = null;
    if (manos.length >= 2) {
      const d = Math.abs(manos[0].pantalla.x - manos[1].pantalla.x) / ctx.vista.ancho;
      tn = THREE.MathUtils.clamp((d - 0.1) / 0.6, 0, 1);
    } else if (manos.length === 1) {
      tn = THREE.MathUtils.clamp(1 - manos[0].pantalla.y / ctx.vista.alto, 0, 1);
    }
    if (tn !== null) e.t += (T_MIN + tn * (T_MAX - T_MIN) - e.t) * Math.min(1, dt * 2);

    const pasos = 3;
    for (let i = 0; i < pasos; i++) simular(Math.min(dt, 0.05) / pasos);
    pintar();

    const estado = estadoDe(e.t);
    if (estado !== e.estado) {
      ctx.hud.aviso(CAMBIOS[`${e.estado}>${estado}`], "ok");
      ctx.sonido.acierto();
      e.estado = estado;
      e.visitados.add(estado);
    }

    if (!e.completado && e.visitados.size === 3) {
      e.completado = true;
      ctx.sonido.exito();
      ctx.hud.tarjetas({
        logro: ["¡Recorriste los 3 estados!", "Fusión a 0 °C y ebullición a 100 °C (a nivel del mar)."],
        dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
        carrera: ["Si te gustó, estudia:", contenido.carreras],
      });
    }

    ctx.hud.stats(
      `🌡️ ${Math.round(e.t)} °C → ${ESTADOS[estado].nombre}<br>` +
        listaRetos(Object.entries(ESTADOS).map(([id, s]) => [s.corto, e.visitados.has(id)])),
    );
  },

  detener() {
    liberar(e.capa);
    e = null;
  },
};
