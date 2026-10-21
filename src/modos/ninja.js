// Ninja de Elementos: corta átomos con el dedo para formar compuestos.
// Vidas, combos, poderes, 3 niveles, insignias y modo duelo de 2 jugadores.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearExplosion, crearEtiqueta } from "../escena/efectos.js";
import { crearBotonera } from "../ui/botonera.js";
import contenido from "../contenido/ninja.json";

const V = THREE.Vector3;
const azar = THREE.MathUtils.randFloat;
const elegir = (lista) => lista[Math.floor(Math.random() * lista.length)];

const GRAVEDAD = 9.8;
const VIDAS = 3;
const VELOCIDAD_CORTE = 5; // unidades/s mínimas del dedo para que corte
const VENTANA_COMBO = 0.35; // s entre cortes para encadenar combo
const DURACION_PODER = 5;
const DURACION_FRENESI = 20;
const DURACION_DUELO = 60;
const PUNTOS_RASTRO = 14;
const CUENTA_ATRAS = 3;

const ELEMENTOS = {
  H: { color: 0xf2f5ff, texto: "#1a1f3a", radio: 0.42 },
  O: { color: 0xff3b3b, radio: 0.5 },
  C: { color: 0x4a4a4a, radio: 0.52 },
  N: { color: 0x3f6cff, radio: 0.5 },
  Na: { color: 0xab5cf2, radio: 0.56 },
  Cl: { color: 0x2fd65a, radio: 0.54 },
};
const COMPUESTOS = {
  H2O: { formula: "H₂O", nombre: "agua", atomos: { O: 1, H: 2 } },
  NaCl: { formula: "NaCl", nombre: "sal de mesa", atomos: { Na: 1, Cl: 1 } },
  CO2: { formula: "CO₂", nombre: "dióxido de carbono", atomos: { C: 1, O: 2 } },
  NH3: { formula: "NH₃", nombre: "amoníaco", atomos: { N: 1, H: 3 } },
  CH4: { formula: "CH₄", nombre: "metano", atomos: { C: 1, H: 4 } },
};
const NIVELES = [
  { misiones: ["H2O", "NaCl"], cada: 0.95, grupo: 2, bombas: 0.1 },
  { misiones: ["CO2", "NH3", "CH4"], cada: 0.75, grupo: 3, bombas: 0.14 },
  { frenesi: true, cada: 0.35, grupo: 3, bombas: 0.16 },
];
const DUELO = { cada: 0.6, grupo: 3, bombas: 0.14 };
const PODERES = {
  hielo: { etiqueta: "❄", color: 0x9fe8ff, aviso: "❄️ ¡Nitrógeno líquido! Todo va en cámara lenta" },
  iman: { etiqueta: "🧲", color: 0xff5e5e, aviso: "🧲 ¡Imán! Los átomos que necesitas vienen a tu dedo" },
  escudo: { etiqueta: "🛡", color: 0xffd34d, aviso: "🛡️ ¡Escudo! Te protege de una bomba" },
};
const COLORES_JUGADOR = [0x5ef2ff, 0xff5ec8];

const geometriaEsfera = new THREE.SphereGeometry(1, 28, 16);
const geometriaMitad = new THREE.SphereGeometry(1, 20, 12, Math.PI / 2, Math.PI); // mitad con x ≥ 0
const geometriaGema = new THREE.IcosahedronGeometry(1, 0);
const geometriaEnlace = new THREE.CylinderGeometry(0.07, 0.07, 1, 10);

let e = null;

// ---------- Objetos que vuelan ----------

function crearObjeto(tipo, simbolo) {
  let radio, color, etiqueta, colorTexto;
  if (tipo === "atomo") {
    ({ radio, color, texto: colorTexto } = ELEMENTOS[simbolo]);
    etiqueta = simbolo;
  } else if (tipo === "bomba") {
    [radio, color, etiqueta, colorTexto] = [0.5, 0xc6ff00, "☢", "#1a1f00"];
  } else {
    [radio, color, etiqueta] = [0.45, PODERES[simbolo].color, PODERES[simbolo].etiqueta];
  }
  const objeto = new THREE.Group();
  const cuerpo = new THREE.Mesh(
    tipo === "poder" ? geometriaGema : geometriaEsfera,
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: tipo === "atomo" ? 0.2 : 0.6, roughness: 0.35 }),
  );
  cuerpo.scale.setScalar(radio);
  const anillo = new THREE.Mesh(
    new THREE.TorusGeometry(radio * 1.4, 0.05, 8, 32),
    new THREE.MeshBasicMaterial({ color: 0xffe66b }),
  );
  anillo.visible = false;
  objeto.add(cuerpo, anillo, crearEtiqueta(etiqueta, { color: colorTexto, tamano: radio * 1.3 }));
  objeto.userData = { tipo, simbolo, radio, color, cuerpo, anillo, mision: false, vel: new V(), giro: new V() };
  return objeto;
}

function lanzar(ctx, tipo, simbolo) {
  const { vista } = ctx;
  const objeto = crearObjeto(tipo, simbolo);
  e.lado *= -1; // alterna izquierda/derecha (justo para el duelo)
  const x = e.lado * azar(0.05, 0.42) * vista.mundoAncho;
  const altura = vista.mundoAlto * azar(0.55, 0.85);
  objeto.position.set(x, -vista.mundoAlto / 2 - 1, 0);
  objeto.userData.vel.set((-x / vista.mundoAncho) * azar(2, 5), Math.sqrt(2 * GRAVEDAD * altura), 0);
  objeto.userData.giro.set(azar(-2, 2), azar(-2, 2), azar(-2, 2));
  e.capa.add(objeto);
  e.objetos.push(objeto);
}

// Átomos que la misión aún necesita y que no van ya en el aire marcados.
function faltantesSinLanzar() {
  if (!e.mision) return [];
  const pendientes = { ...e.mision.faltan };
  for (const o of e.objetos) if (o.userData.mision) pendientes[o.userData.simbolo]--;
  return Object.keys(pendientes).filter((s) => pendientes[s] > 0);
}

function lanzarGrupo(ctx, config) {
  const cantidad = 1 + Math.floor(Math.random() * config.grupo);
  for (let i = 0; i < cantidad; i++) {
    const r = Math.random();
    if (r < config.bombas) lanzar(ctx, "bomba", "U");
    else if (r < config.bombas + 0.05) lanzar(ctx, "poder", elegir(Object.keys(PODERES)));
    else {
      const faltan = faltantesSinLanzar();
      lanzar(ctx, "atomo", faltan.length && Math.random() < 0.55 ? elegir(faltan) : elegir(Object.keys(ELEMENTOS)));
    }
  }
}

// Marca con anillo dorado solo los átomos que todavía sirven para la misión.
function actualizarMarcas() {
  const pendientes = { ...(e.mision?.faltan ?? {}) };
  const atomos = e.objetos.filter((o) => o.userData.tipo === "atomo");
  for (const o of atomos) {
    const d = o.userData;
    d.mision = d.mision && pendientes[d.simbolo] > 0;
    if (d.mision) pendientes[d.simbolo]--;
  }
  for (const o of atomos) {
    const d = o.userData;
    if (!d.mision && pendientes[d.simbolo] > 0) {
      d.mision = true;
      pendientes[d.simbolo]--;
    }
    d.anillo.visible = d.mision;
  }
}

function quitarObjeto(objeto) {
  const indice = e.objetos.indexOf(objeto);
  if (indice < 0) return; // ya se quitó (p. ej. el juego terminó en este mismo cuadro)
  e.objetos.splice(indice, 1);
  liberar(objeto);
}

// Parte el objeto en dos mitades que salen volando en direcciones opuestas al corte.
function partir(objeto, direccion) {
  const { radio, color, vel } = objeto.userData;
  const perpendicular = new V(-direccion.y, direccion.x, 0).normalize();
  for (const lado of [1, -1]) {
    const mitad = new THREE.Mesh(
      geometriaMitad,
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3, transparent: true, side: THREE.DoubleSide }),
    );
    mitad.scale.setScalar(radio);
    mitad.position.copy(objeto.position);
    mitad.rotation.z = Math.atan2(perpendicular.y * lado, perpendicular.x * lado);
    e.capa.add(mitad);
    e.restos.push({ malla: mitad, vel: vel.clone().multiplyScalar(0.3).addScaledVector(perpendicular, lado * 3), vida: 0.9 });
  }
  e.efectos.push(crearExplosion(e.capa, objeto.position.clone(), [color, 0xffffff], 60));
  quitarObjeto(objeto);
}

function mostrarPuntos(posicion, texto, color = "#ffe66b") {
  const sprite = crearEtiqueta(texto, { color, tamano: 0.6 });
  sprite.position.copy(posicion).setZ(0.5);
  e.capa.add(sprite);
  e.popups.push({ sprite, vida: 0.9 });
}

// ---------- Reglas del juego ----------

function cortar(ctx, objeto, direccion, jugador) {
  const d = objeto.userData;
  const posicion = objeto.position.clone();
  partir(objeto, direccion);

  if (d.tipo === "bomba") {
    if (e.duelo) {
      jugador.puntos = Math.max(0, jugador.puntos - 200);
      mostrarPuntos(posicion, "−200", "#ff6b6b");
      ctx.sonido.error();
    } else {
      perderVida(ctx, "☢ ¡Cortaste uranio radiactivo!");
    }
    e.efectos.push(crearExplosion(e.capa, posicion, [0xc6ff00, 0xffffff], 200));
    return;
  }
  if (d.tipo === "poder") {
    activarPoder(ctx, d.simbolo);
    return;
  }

  const ahora = performance.now() / 1000;
  jugador.combo = ahora - jugador.ultimoCorte < VENTANA_COMBO ? jugador.combo + 1 : 1;
  jugador.ultimoCorte = ahora;
  e.comboMaximo = Math.max(e.comboMaximo, jugador.combo);

  const sirve = e.mision?.faltan[d.simbolo] > 0;
  const base = sirve ? 100 : e.frenesi ? 50 : 25;
  const puntos = base * jugador.combo;
  jugador.puntos += puntos;
  mostrarPuntos(posicion, jugador.combo > 1 ? `+${puntos} x${jugador.combo} COMBO!` : `+${puntos}`);
  if (jugador.combo >= 3) ctx.sonido.acierto();
  else ctx.sonido.agarrar();

  if (sirve) {
    e.mision.faltan[d.simbolo]--;
    if (Object.values(e.mision.faltan).every((n) => n === 0)) completarCompuesto(ctx, jugador);
  }
}

function activarPoder(ctx, poder) {
  ctx.sonido.enlace();
  ctx.hud.aviso(PODERES[poder].aviso, "ok", 2200);
  if (poder === "hielo") e.lento = DURACION_PODER;
  else if (poder === "iman") e.iman = DURACION_PODER;
  else e.escudo = true;
}

function perderVida(ctx, motivo) {
  if (e.escudo) {
    e.escudo = false;
    ctx.hud.aviso("🛡️ ¡El escudo te salvó!", "ok", 1800);
    ctx.sonido.enlace();
    return;
  }
  e.vidas--;
  e.sinRasguno = false;
  ctx.sonido.error();
  ctx.hud.aviso(`${motivo} ${e.vidas > 0 ? `Te quedan ${e.vidas} ❤️` : ""}`, "error", 2000);
  const ui = document.getElementById("ui");
  ui.classList.add("destello");
  setTimeout(() => ui.classList.remove("destello"), 350);
  if (e.vidas <= 0) terminarJuego(ctx, false);
}

function mostrarMolecula(compuesto) {
  const molecula = new THREE.Group();
  const simbolos = Object.entries(compuesto.atomos).flatMap(([s, n]) => Array(n).fill(s));
  const [centro, ...ligandos] = simbolos;
  const crearEsfera = (s) => {
    const esfera = new THREE.Mesh(geometriaEsfera, new THREE.MeshStandardMaterial({ color: ELEMENTOS[s].color, roughness: 0.35 }));
    esfera.scale.setScalar(ELEMENTOS[s].radio);
    return esfera;
  };
  molecula.add(crearEsfera(centro));
  ligandos.forEach((s, i) => {
    const angulo = (i / ligandos.length) * Math.PI * 2 + Math.PI / 2;
    const destino = new V(Math.cos(angulo), Math.sin(angulo), 0).multiplyScalar(1.3);
    const esfera = crearEsfera(s);
    esfera.position.copy(destino);
    const enlace = new THREE.Mesh(geometriaEnlace, new THREE.MeshStandardMaterial({ color: 0xdde3ff }));
    enlace.scale.y = 1.3;
    enlace.position.copy(destino).multiplyScalar(0.5);
    enlace.quaternion.setFromUnitVectors(new V(0, 1, 0), destino.clone().normalize());
    molecula.add(esfera, enlace);
  });
  const nombre = crearEtiqueta(`${compuesto.formula} · ${compuesto.nombre}`, { color: "#5dff9d", tamano: 0.7 });
  nombre.position.y = -2.1;
  molecula.add(nombre);
  molecula.position.set(0, 0.8, -1);
  e.capa.add(molecula);
  e.moleculas.push({ grupo: molecula, vida: 2.5 });
}

function completarCompuesto(ctx, jugador) {
  const id = e.mision.id;
  const compuesto = COMPUESTOS[id];
  e.formados.add(id);
  jugador.puntos += 500;
  mostrarMolecula(compuesto);
  e.efectos.push(crearExplosion(e.capa, new V(0, 0.8, -1), undefined, 250));
  ctx.sonido.exito();
  ctx.hud.aviso(`💥 ¡${compuesto.formula} = ${compuesto.nombre}! +500 · ${contenido.compuestos[id]}`, "ok", 3500);
  siguienteMision(ctx);
}

function nuevaMision(id) {
  e.mision = { id, faltan: { ...COMPUESTOS[id].atomos } };
}

function siguienteMision(ctx) {
  if (e.duelo) {
    nuevaMision(elegir(Object.keys(COMPUESTOS).filter((id) => id !== e.mision.id)));
  } else if (e.colaMisiones.length) {
    nuevaMision(e.colaMisiones.shift());
  } else {
    e.mision = null;
    if (e.nivel === 1) e.tiempoMisiones = e.tiempo;
    iniciarNivel(ctx, e.nivel + 1);
  }
}

function iniciarNivel(ctx, indice) {
  e.nivel = indice;
  const nivel = NIVELES[indice];
  e.pausa = 2.2;
  e.frenesi = !!nivel.frenesi;
  if (e.frenesi) {
    e.restante = DURACION_FRENESI;
    ctx.hud.aviso("🔥 ¡NIVEL 3: REACCIÓN EN CADENA! Corta todo lo que puedas en 20 s", "ok", 2500);
  } else {
    e.colaMisiones = [...nivel.misiones];
    nuevaMision(e.colaMisiones.shift());
    if (indice > 0) ctx.hud.aviso(`🎉 ¡Nivel ${indice + 1}!`, "ok", 2000);
  }
}

function insignias() {
  const lista = [];
  if (e.formados.has("NaCl")) lista.push("🧂 Maestro de la Sal");
  if (e.comboMaximo >= 4) lista.push(`🔥 Combo x${e.comboMaximo}`);
  if (e.formados.size === Object.keys(COMPUESTOS).length) lista.push("🧪 Químico Total");
  if (!e.duelo && e.sinRasguno && e.nivel === 2) lista.push("🛡️ Sin un rasguño");
  if (e.tiempoMisiones && e.tiempoMisiones < 75) lista.push("⚡ Ninja Veloz");
  return lista;
}

function terminarJuego(ctx, gano) {
  e.fase = "fin";
  for (const objeto of [...e.objetos]) partir(objeto, new V(1, 0, 0));
  const ganadas = insignias();
  const textoInsignias = ganadas.length ? ` Insignias: ${ganadas.join(", ")}.` : "";
  const dato = e.formados.size ? contenido.compuestos[elegir([...e.formados])] : contenido.bomba;

  if (e.duelo) {
    const [j1, j2] = e.jugadores;
    const titulo = j1.puntos === j2.puntos ? "🤝 ¡Empate!" : `🏆 ¡Gana el Jugador ${j1.puntos > j2.puntos ? "1 🔵" : "2 🔴"}!`;
    ctx.terminar({
      logro: [titulo, `🔵 ${j1.puntos} pts vs 🔴 ${j2.puntos} pts.${textoInsignias}`],
      dato: ["¿Sabías que…?", dato],
      carrera: ["Si te gustó, estudia:", contenido.carreras],
    }, Math.max(j1.puntos, j2.puntos));
  } else {
    ctx.terminar({
      logro: [
        gano ? "🏆 ¡Eres un Ninja de Elementos!" : "💀 ¡Fin del juego!",
        `Formaste ${e.formados.size} compuestos · Combo máximo x${e.comboMaximo}.${textoInsignias}`,
      ],
      dato: ["¿Sabías que…?", dato],
      carrera: ["Si te gustó, estudia:", contenido.carreras],
    }, e.jugadores[0].puntos);
  }
  ctx.sonido.exito();
  ctx.hud.instruccion("¿Otra partida? Elige 1 o 2 jugadores");
  mostrarEleccion(ctx);
}

// ---------- Estela del dedo (espada de luz) ----------

function crearEspada(color) {
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PUNTOS_RASTRO * 2 * 3), 3));
  const indices = [];
  for (let i = 0; i < PUNTOS_RASTRO - 1; i++) {
    const a = i * 2;
    indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  geometria.setIndex(indices);
  const malla = new THREE.Mesh(
    geometria,
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  malla.frustumCulled = false;
  malla.renderOrder = 5;
  e.capa.add(malla);
  return { malla, rastro: [] };
}

function dibujarEspada(espada) {
  const { rastro, malla } = espada;
  const pos = malla.geometry.attributes.position;
  const n = rastro.length;
  for (let i = 0; i < n; i++) {
    const p = rastro[i];
    const siguiente = rastro[Math.min(i + 1, n - 1)];
    const anterior = rastro[Math.max(i - 1, 0)];
    const dir = new V().subVectors(siguiente, anterior);
    const normal = new V(-dir.y, dir.x, 0).normalize().multiplyScalar(0.2 * (i / Math.max(n - 1, 1)));
    pos.setXYZ(i * 2, p.x + normal.x, p.y + normal.y, 0.3);
    pos.setXYZ(i * 2 + 1, p.x - normal.x, p.y - normal.y, 0.3);
  }
  pos.needsUpdate = true;
  malla.geometry.setDrawRange(0, Math.max(0, (n - 1) * 6));
}

function distanciaASegmento(p, a, b) {
  const ab = new V().subVectors(b, a);
  const t = THREE.MathUtils.clamp(new V().subVectors(p, a).dot(ab) / Math.max(ab.lengthSq(), 1e-6), 0, 1);
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

function actualizarEspadas(ctx, dt) {
  const vistas = new Set();
  for (const mano of ctx.manos) {
    vistas.add(mano.id);
    const jugadorIndice = e.duelo && mano.pantalla.x > ctx.vista.ancho / 2 ? 1 : 0;
    let espada = e.espadas.get(mano.id);
    if (!espada) {
      espada = crearEspada(COLORES_JUGADOR[jugadorIndice]);
      e.espadas.set(mano.id, espada);
    }
    espada.malla.material.color.set(COLORES_JUGADOR[jugadorIndice]);

    const punta = mano.punta.clone().setZ(0);
    const previa = espada.rastro[espada.rastro.length - 1];
    espada.rastro.push(punta);
    if (espada.rastro.length > PUNTOS_RASTRO) espada.rastro.shift();
    dibujarEspada(espada);

    // Corta solo si el dedo se mueve rápido (un tajo, no apuntar).
    if (!previa || e.fase !== "jugando" || dt <= 0) continue;
    if (punta.distanceTo(previa) / dt < VELOCIDAD_CORTE) continue;
    const direccion = new V().subVectors(punta, previa);
    for (const objeto of [...e.objetos]) {
      if (distanciaASegmento(objeto.position, previa, punta) < objeto.userData.radio + 0.15) {
        cortar(ctx, objeto, direccion, e.jugadores[jugadorIndice]);
        if (e.fase !== "jugando") break;
      }
    }
  }
  for (const [id, espada] of e.espadas) {
    if (vistas.has(id)) continue;
    liberar(espada.malla);
    e.espadas.delete(id);
  }
}

// ---------- Elección de modo y cuenta atrás ----------

function mostrarEleccion(ctx) {
  e.botonera?.quitar();
  e.botonera = crearBotonera(
    "centro",
    [
      { id: "uno", texto: "👤 1 jugador" },
      { id: "dos", texto: "👥 2 jugadores" },
    ],
    (id) => empezar(ctx, id === "dos"),
  );
}

function empezar(ctx, duelo) {
  e.botonera.quitar();
  e.botonera = null;
  ctx.hud.ocultarTarjetas();
  for (const objeto of [...e.objetos]) quitarObjeto(objeto);
  Object.assign(e, {
    duelo,
    fase: "cuenta",
    cuenta: CUENTA_ATRAS,
    vidas: VIDAS,
    escudo: false,
    lento: 0,
    iman: 0,
    siguiente: 0.5,
    tiempo: 0,
    nivel: 0,
    pausa: 0,
    comboMaximo: 0,
    sinRasguno: true,
    tiempoMisiones: null,
    formados: new Set(),
    jugadores: [0, 1].map(() => ({ puntos: 0, combo: 0, ultimoCorte: 0 })),
  });
  if (duelo) {
    e.frenesi = false;
    e.restante = DURACION_DUELO;
    nuevaMision(elegir(Object.keys(COMPUESTOS)));
    ctx.hud.instruccion("🔵 Jugador 1 a la izquierda · 🔴 Jugador 2 a la derecha · ¡Gana quien haga más puntos en 60 s!");
  } else {
    iniciarNivel(ctx, 0);
    e.pausa = 0;
    ctx.hud.instruccion("☝️ Corta con el dedo índice los átomos con anillo dorado · Evita el ☢ uranio");
  }
}

// ---------- HUD ----------

function textoMision() {
  if (e.frenesi) return `🔥 ¡REACCIÓN EN CADENA! Corta todo · ⏱ ${Math.ceil(e.restante)} s`;
  if (!e.mision) return "";
  const compuesto = COMPUESTOS[e.mision.id];
  const casillas = Object.entries(compuesto.atomos).flatMap(([s, n]) =>
    Array.from({ length: n }, (_, k) => `${s}${k < n - e.mision.faltan[s] ? "✅" : "⬜"}`),
  );
  return `🎯 Forma ${compuesto.formula} (${compuesto.nombre}): ${casillas.join(" ")}`;
}

function actualizarHud(ctx) {
  if (e.fase === "eleccion") return ctx.hud.stats("");
  const poderes = `${e.escudo ? " · 🛡️" : ""}${e.lento > 0 ? " · ❄️" : ""}${e.iman > 0 ? " · 🧲" : ""}`;
  const primera = e.duelo
    ? `🔵 J1: ${e.jugadores[0].puntos} · 🔴 J2: ${e.jugadores[1].puntos} · ⏱ ${Math.ceil(e.restante)} s${poderes}`
    : `${"❤️".repeat(Math.max(e.vidas, 0))}${"🖤".repeat(VIDAS - Math.max(e.vidas, 0))} · ⭐ ${e.jugadores[0].puntos} · Nivel ${e.nivel + 1}/3${poderes}`;
  ctx.hud.stats(`${primera}<br>${e.fase === "cuenta" ? "¡Prepárate!" : textoMision()}`);
}

// ---------- Modo ----------

export default {
  id: "ninja",
  zona: "ia",
  icono: "⚔️",
  titulo: "Ninja de Elementos",
  descripcion: "Corta átomos con el dedo y forma compuestos",

  // Para pruebas automáticas (scripts/prueba.js), vía window.__lab.modo.estado.
  get estado() {
    return e;
  },

  iniciar(ctx) {
    e = {
      capa: new THREE.Group(),
      fase: "eleccion",
      objetos: [],
      restos: [],
      popups: [],
      efectos: [],
      moleculas: [],
      espadas: new Map(),
      jugadores: [{ puntos: 0, combo: 0, ultimoCorte: 0 }],
      lado: 1,
    };
    ctx.escena.add(e.capa);
    e.divisor = new THREE.Mesh(
      new THREE.PlaneGeometry(0.04, ctx.vista.mundoAlto),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }),
    );
    e.divisor.visible = false;
    e.capa.add(e.divisor);
    ctx.hud.modo(this.titulo, "Elige 1 jugador o 2 jugadores (duelo) apuntando a un botón");
    mostrarEleccion(ctx);
  },

  actualizar(ctx, dt) {
    const escala = e.lento > 0 ? 0.4 : 1;
    const dtJuego = dt * escala;
    e.divisor.visible = !!e.duelo && e.fase !== "eleccion";

    actualizarEspadas(ctx, dt);

    if (e.fase === "cuenta") {
      const antes = Math.ceil(e.cuenta);
      e.cuenta -= dt;
      const ahora = Math.ceil(e.cuenta);
      if (ahora !== antes || !e.numero) {
        if (e.numero) liberar(e.numero);
        e.numero = crearEtiqueta(ahora > 0 ? String(ahora) : "¡YA!", { color: "#ffe66b", tamano: 2.4 });
        e.capa.add(e.numero);
        ctx.sonido.click();
      }
      if (e.cuenta <= -0.6) {
        liberar(e.numero);
        e.numero = null;
        e.fase = "jugando";
      }
    } else if (e.fase === "jugando") {
      e.tiempo += dt;
      e.lento = Math.max(0, e.lento - dt);
      e.iman = Math.max(0, e.iman - dt);
      e.pausa = Math.max(0, e.pausa - dt);

      if (e.duelo || e.frenesi) {
        e.restante -= dtJuego;
        if (e.restante <= 0) terminarJuego(ctx, true);
      }
      if (e.fase === "jugando" && e.pausa <= 0) {
        e.siguiente -= dtJuego;
        if (e.siguiente <= 0) {
          const config = e.duelo ? DUELO : NIVELES[e.nivel];
          lanzarGrupo(ctx, config);
          e.siguiente = config.cada * azar(0.8, 1.2);
        }
      }
    }

    actualizarMarcas();

    // Física de los objetos en vuelo.
    const limiteInferior = -ctx.vista.mundoAlto / 2 - 1.5;
    for (const objeto of [...e.objetos]) {
      if (!e.objetos.includes(objeto)) continue;
      const d = objeto.userData;
      d.vel.y -= GRAVEDAD * dtJuego;
      if (e.iman > 0 && d.mision && ctx.manos[0]) {
        d.vel.addScaledVector(ctx.manos[0].punta.clone().setZ(0).sub(objeto.position).normalize(), 14 * dtJuego);
      }
      objeto.position.addScaledVector(d.vel, dtJuego);
      d.cuerpo.rotation.x += d.giro.x * dtJuego;
      d.cuerpo.rotation.y += d.giro.y * dtJuego;
      d.anillo.rotation.z += dtJuego * 2;
      if (d.tipo === "bomba") d.cuerpo.material.emissiveIntensity = 0.5 + Math.sin(e.tiempo * 10) * 0.3;

      if (objeto.position.y < limiteInferior && d.vel.y < 0) {
        const necesario = d.mision && e.mision?.faltan[d.simbolo] > 0;
        quitarObjeto(objeto);
        if (necesario && !e.duelo && e.fase === "jugando") perderVida(ctx, `💨 ¡Se escapó un ${d.simbolo} que necesitabas!`);
      }
    }

    // Mitades, números flotantes, moléculas formadas y explosiones.
    e.restos = e.restos.filter((r) => {
      r.vida -= dt;
      r.vel.y -= GRAVEDAD * dt;
      r.malla.position.addScaledVector(r.vel, dt);
      r.malla.rotation.z += dt * 3;
      r.malla.material.opacity = Math.max(r.vida / 0.9, 0);
      if (r.vida <= 0) liberar(r.malla);
      return r.vida > 0;
    });
    e.popups = e.popups.filter((p) => {
      p.vida -= dt;
      p.sprite.position.y += dt * 1.5;
      p.sprite.material.opacity = Math.max(p.vida / 0.9, 0);
      if (p.vida <= 0) liberar(p.sprite);
      return p.vida > 0;
    });
    e.moleculas = e.moleculas.filter((m) => {
      m.vida -= dt;
      m.grupo.rotation.y += dt * 2;
      m.grupo.scale.setScalar(Math.min(1, (2.5 - m.vida) * 4));
      if (m.vida <= 0) liberar(m.grupo);
      return m.vida > 0;
    });
    e.efectos = e.efectos.filter((ef) => ef.actualizar(dt));

    actualizarHud(ctx);
  },

  detener() {
    e.botonera?.quitar();
    document.getElementById("ui").classList.remove("destello");
    liberar(e.capa);
    e = null;
  },
};
