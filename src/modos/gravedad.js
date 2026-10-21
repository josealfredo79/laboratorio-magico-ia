// Gravedad en otros planetas: lanza una pelota con la mano y encesta con distinta g.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearExplosion } from "../escena/efectos.js";
import { crearBotonera } from "../ui/botonera.js";
import { listaRetos } from "../ui/hud.js";
import { puntosPorTiempo } from "../ui/ranking.js";
import contenido from "../contenido/gravedad.json";

const V = THREE.Vector3;

const PLANETAS = [
  { id: "tierra", nombre: "Tierra", icono: "🌍", g: 9.81, suelo: 0x2f8f3a, trazo: 0x5ef2ff },
  { id: "luna", nombre: "Luna", icono: "🌕", g: 1.62, suelo: 0x9a9a9a, trazo: 0xffffff },
  { id: "marte", nombre: "Marte", icono: "🔴", g: 3.71, suelo: 0xc1440e, trazo: 0xff7b4a },
  { id: "jupiter", nombre: "Júpiter", icono: "🪐", g: 24.79, suelo: 0xd8a35d, trazo: 0xffd36b },
];

const RADIO = 0.35; // 1 unidad del mundo = 1 metro
const FACTOR_LANZAMIENTO = 0.4; // la mano cruza la pantalla muy rápido: se escala a m/s creíbles
const VELOCIDAD_MAX = 9;
const MAX_TRAZO = 600;
const MAX_VUELO = 14; // s, por si la pelota se pierde muy alto en la Luna

let e = null;

function crearTrazo(color) {
  const geometria = new THREE.BufferGeometry().setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array(MAX_TRAZO * 3), 3),
  );
  geometria.setDrawRange(0, 0);
  return new THREE.Line(geometria, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85 }));
}

function casa(vista) {
  return new V(-vista.mundoAncho * 0.33, e.sueloY + 1.8, 0);
}

function colocarCesta(vista) {
  const x = THREE.MathUtils.randFloat(0.02, 0.26) * vista.mundoAncho;
  const y = THREE.MathUtils.randFloat(e.sueloY + 1.6, vista.mundoAlto / 2 - 3);
  e.cesta.position.set(x, y, 0);
}

function cambiarPlaneta(ctx, id) {
  e.planeta = PLANETAS.find((p) => p.id === id);
  e.suelo.material.color.set(e.planeta.suelo);
  e.botonera.marcar(id);
  const relacion = Math.round((e.planeta.g / 9.81) * 100);
  ctx.hud.aviso(`${e.planeta.icono} ${e.planeta.nombre}: g = ${e.planeta.g} m/s² (${relacion} % de la Tierra)`, "ok");
  ctx.sonido.click();
}

function lanzar() {
  e.vel.multiplyScalar(FACTOR_LANZAMIENTO).clampLength(0, VELOCIDAD_MAX);
  e.fase = "volando";
  e.vuelo = { y0: e.pelota.position.y, alturaMax: e.pelota.position.y, t: 0, aterrizo: false, reposo: 0 };

  // Cada planeta guarda su último trazo para comparar parábolas.
  let trazo = e.trazos.get(e.planeta.id);
  if (!trazo) {
    trazo = crearTrazo(e.planeta.trazo);
    e.capa.add(trazo);
    e.trazos.set(e.planeta.id, trazo);
  }
  trazo.userData.n = 0;
  trazo.geometry.setDrawRange(0, 0);
  e.trazoActual = trazo;
}

function agregarPuntoTrazo(p) {
  const trazo = e.trazoActual;
  if (trazo.userData.n >= MAX_TRAZO) return;
  trazo.geometry.attributes.position.setXYZ(trazo.userData.n++, p.x, p.y, p.z);
  trazo.geometry.attributes.position.needsUpdate = true;
  trazo.geometry.setDrawRange(0, trazo.userData.n);
}

function canasta(ctx) {
  e.cestas.add(e.planeta.id);
  e.efectos.push(crearExplosion(e.capa, e.cesta.position.clone()));
  ctx.sonido.exito();
  ctx.hud.aviso(`🏀 ¡Canasta en ${e.planeta.nombre}!`, "ok");
  colocarCesta(ctx.vista);

  if (e.cestas.size === PLANETAS.length && !e.completado) {
    e.completado = true;
    ctx.terminar({
      logro: ["¡Encestaste en los 4 mundos!", "Mismo brazo, distinta gravedad: en la Luna la pelota sube unas 6 veces más alto que en la Tierra."],
      dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
      carrera: ["Si te gustó, estudia:", contenido.carreras],
    }, puntosPorTiempo((performance.now() - e.inicio) / 1000, 3000));
  }
}

function moverPelota(ctx, dt) {
  const { vista } = ctx;
  const p = e.pelota.position;
  const limiteX = vista.mundoAncho / 2 - RADIO;
  const pasos = 4;
  const h = dt / pasos;

  for (let i = 0; i < pasos; i++) {
    const yAntes = p.y;
    e.vel.y -= e.planeta.g * h;
    p.addScaledVector(e.vel, h);

    // ¿Entró por el aro bajando?
    const c = e.cesta.position;
    if (yAntes > c.y && p.y <= c.y && Math.abs(p.x - c.x) < 0.5) canasta(ctx);

    if (p.y - RADIO < e.sueloY) {
      p.y = e.sueloY + RADIO;
      e.vel.y = -e.vel.y * 0.55;
      e.vel.x *= 0.8;
      if (!e.vuelo.aterrizo) {
        e.vuelo.aterrizo = true;
        e.ultimo = { altura: e.vuelo.alturaMax - e.vuelo.y0, tiempo: e.vuelo.t };
      }
    }
    if (Math.abs(p.x) > limiteX) {
      p.x = Math.sign(p.x) * limiteX;
      e.vel.x = -e.vel.x * 0.6;
    }
  }

  e.vuelo.t += dt;
  e.vuelo.alturaMax = Math.max(e.vuelo.alturaMax, p.y);
  e.pelota.rotation.z -= e.vel.x * dt * 2;
  if (!e.vuelo.aterrizo) agregarPuntoTrazo(p);

  // Rodando en el suelo hasta detenerse: vuelve a su lugar.
  const enSuelo = p.y - RADIO <= e.sueloY + 0.01 && Math.abs(e.vel.y) < 0.6;
  e.vuelo.reposo = enSuelo && e.vel.length() < 0.4 ? e.vuelo.reposo + dt : 0;
  if (e.vuelo.reposo > 0.6 || e.vuelo.t > MAX_VUELO) {
    e.fase = "lista";
    p.copy(casa(vista));
    e.vel.set(0, 0, 0);
  }
}

export default {
  id: "gravedad",
  zona: "fisica",
  icono: "🪐",
  titulo: "Gravedad en otros planetas",
  descripcion: "Lanza una pelota en la Luna, Marte o Júpiter",

  // Para pruebas automáticas (scripts/prueba.js), vía window.__lab.modo.estado.
  get estado() {
    return e;
  },

  iniciar(ctx) {
    const { vista } = ctx;
    e = {
      inicio: performance.now(),
      capa: new THREE.Group(),
      sueloY: -vista.mundoAlto / 2 + 0.8,
      fase: "lista",
      vel: new V(),
      manos: new Map(),
      trazos: new Map(),
      cestas: new Set(),
      efectos: [],
      ultimo: null,
      completado: false,
    };
    ctx.escena.add(e.capa);

    e.suelo = new THREE.Mesh(
      new THREE.BoxGeometry(vista.mundoAncho + 4, 0.3, 3),
      new THREE.MeshStandardMaterial({ color: PLANETAS[0].suelo, roughness: 0.9 }),
    );
    e.suelo.position.set(0, e.sueloY - 0.15, -0.5);

    e.pelota = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO, 32, 16),
      new THREE.MeshStandardMaterial({ color: 0xff8c1a, emissive: 0xff5a00, emissiveIntensity: 0.25, roughness: 0.5 }),
    );
    e.pelota.position.copy(casa(vista));

    e.cesta = new THREE.Group();
    const aro = new THREE.Mesh(
      new THREE.TorusGeometry(0.6, 0.06, 12, 40),
      new THREE.MeshStandardMaterial({ color: 0xff4d2e, emissive: 0xff2200, emissiveIntensity: 0.4 }),
    );
    const red = new THREE.Mesh(
      new THREE.CylinderGeometry(0.6, 0.35, 0.6, 14, 2, true),
      new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.5 }),
    );
    red.position.y = -0.3;
    aro.rotation.x = Math.PI / 2;
    e.cesta.add(aro, red);
    e.cesta.rotation.x = 0.45; // inclinada para que se vea el aro
    colocarCesta(vista);

    e.capa.add(e.suelo, e.pelota, e.cesta);

    e.botonera = crearBotonera(
      "derecha",
      PLANETAS.map((p) => ({ id: p.id, texto: `${p.icono} ${p.nombre}` })),
      (id) => cambiarPlaneta(ctx, id),
    );
    e.planeta = PLANETAS[0];
    e.botonera.marcar(e.planeta.id);

    ctx.hud.modo(this.titulo, "🤏 Pellizca la pelota, lánzala y encesta. Cambia de planeta con los botones →");
  },

  actualizar(ctx, dt) {
    e.efectos = e.efectos.filter((ef) => ef.actualizar(dt));
    const p = e.pelota.position;

    // Manos: agarrar al iniciar el pellizco cerca de la pelota.
    for (const mano of ctx.manos) {
      const antes = e.manos.get(mano.id) ?? false;
      if (e.fase === "lista" && mano.pellizco && !antes && mano.pinza.distanceTo(p) < RADIO + 0.8) {
        e.fase = "sujeta";
        e.manoId = mano.id;
        e.vel.set(0, 0, 0);
        ctx.sonido.agarrar();
      }
      e.manos.set(mano.id, mano.pellizco);
    }

    if (e.fase === "sujeta") {
      const mano = ctx.manos.find((m) => m.id === e.manoId);
      if (!mano || !mano.pellizco) {
        lanzar();
        ctx.sonido.soltar();
      } else {
        const nueva = new V(mano.pinza.x, Math.max(mano.pinza.y, e.sueloY + RADIO), 0);
        if (dt > 0) e.vel.lerp(nueva.clone().sub(p).divideScalar(dt), 0.5);
        p.copy(nueva);
      }
    } else if (e.fase === "volando") {
      moverPelota(ctx, dt);
    } else {
      const flota = casa(ctx.vista);
      flota.y += Math.sin(performance.now() / 400) * 0.08;
      p.lerp(flota, 0.2);
    }

    const cerca = ctx.manos.some((m) => m.pinza.distanceTo(p) < RADIO + 0.8);
    e.pelota.material.emissiveIntensity = e.fase === "sujeta" ? 0.8 : cerca ? 0.55 : 0.25;
    e.cesta.rotation.y += dt * 0.6;

    const { planeta } = e;
    let linea = `${planeta.icono} ${planeta.nombre}: g = ${planeta.g} m/s²`;
    if (e.fase === "volando" && p.y > ctx.vista.mundoAlto / 2) {
      linea += ` · ⬆️ ¡La pelota va a ${(p.y - e.sueloY).toFixed(1)} m de altura!`;
    } else if (e.ultimo) {
      linea += ` · Último tiro: subió ${e.ultimo.altura.toFixed(1)} m y voló ${e.ultimo.tiempo.toFixed(1)} s`;
    }
    ctx.hud.stats(`${linea}<br>Canastas: ${listaRetos(PLANETAS.map((pl) => [`${pl.icono} ${pl.nombre}`, e.cestas.has(pl.id)]))}`);
  },

  detener() {
    e.botonera.quitar();
    liberar(e.capa);
    e = null;
  },
};
