// Constructor de moléculas: pellizca átomos y únelos al átomo central respetando su valencia.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearExplosion, crearEtiqueta } from "../escena/efectos.js";
import contenido from "../contenido/moleculas.json";

const V = THREE.Vector3;
const rad = THREE.MathUtils.degToRad;

const ELEMENTOS = {
  H: { nombre: "hidrógeno", color: 0xf2f5ff, texto: "#1a1f3a", radio: 0.38, valencia: 1 },
  O: { nombre: "oxígeno", color: 0xff3b3b, radio: 0.55, valencia: 2 },
  C: { nombre: "carbono", color: 0x4a4a4a, radio: 0.6, valencia: 4 },
  N: { nombre: "nitrógeno", color: 0x3f6cff, radio: 0.57, valencia: 3 },
};

// Direcciones de los enlaces según la forma real de cada molécula.
const lineal = () => [new V(-1, 0, 0), new V(1, 0, 0)];
function angular(angulo) {
  const m = rad(angulo / 2);
  return [new V(-Math.sin(m), -Math.cos(m), 0), new V(Math.sin(m), -Math.cos(m), 0)];
}
// Tres enlaces en pirámide separados por `angulo` entre sí: cos θ = 1.5c² − 0.5.
function piramidal(angulo) {
  const c = Math.sqrt((Math.cos(rad(angulo)) + 0.5) / 1.5);
  const s = Math.sqrt(1 - c * c);
  return [90, 210, 330].map((f) => new V(s * Math.cos(rad(f)), -c, s * Math.sin(rad(f))));
}
const tetraedrica = () => [new V(0, 1, 0), ...piramidal(109.47)];

const RETOS = [
  { id: "H2O", formula: "H₂O", nombre: "agua", centro: "O", ligando: "H", orden: 1,
    direcciones: angular(104.5), forma: "angular, 104.5°", extras: ["C", "N"] },
  { id: "CO2", formula: "CO₂", nombre: "dióxido de carbono", centro: "C", ligando: "O", orden: 2,
    direcciones: lineal(), forma: "lineal, 180° con dobles enlaces", extras: ["H", "N"] },
  { id: "CH4", formula: "CH₄", nombre: "metano", centro: "C", ligando: "H", orden: 1,
    direcciones: tetraedrica(), forma: "tetraédrica, 109.5°", extras: ["O", "N"] },
  { id: "NH3", formula: "NH₃", nombre: "amoníaco", centro: "N", ligando: "H", orden: 1,
    direcciones: piramidal(107), forma: "piramidal, 107°", extras: ["O", "C"] },
];

const DISTANCIA_AGARRE = 0.75; // además del radio del átomo
const DISTANCIA_ENLACE = 2.3;
const ESPERA_SIGUIENTE = 8; // segundos mostrando las tarjetas

const geometriaEsfera = new THREE.SphereGeometry(1, 32, 16);
const geometriaEnlace = new THREE.CylinderGeometry(0.08, 0.08, 1, 12);

let estado = null;

function crearAtomo(simbolo) {
  const el = ELEMENTOS[simbolo];
  const atomo = new THREE.Group();
  const esfera = new THREE.Mesh(
    geometriaEsfera,
    new THREE.MeshStandardMaterial({ color: el.color, emissive: el.color, emissiveIntensity: 0.15, roughness: 0.35 }),
  );
  esfera.scale.setScalar(el.radio);
  atomo.add(esfera, crearEtiqueta(simbolo, { color: el.texto, tamano: el.radio * 1.3 }));
  atomo.userData = { simbolo, esfera };
  return atomo;
}

function crearEnlaces(desde, hasta, orden) {
  const enlaces = new THREE.Group();
  const eje = hasta.clone().sub(desde);
  const largo = eje.length();
  const dir = eje.clone().normalize();
  const perpendicular = new V().crossVectors(dir, Math.abs(dir.z) > 0.9 ? new V(1, 0, 0) : new V(0, 0, 1)).normalize();
  for (let i = 0; i < orden; i++) {
    const desplazamiento = (i - (orden - 1) / 2) * 0.2;
    const cilindro = new THREE.Mesh(geometriaEnlace, new THREE.MeshStandardMaterial({ color: 0xdde3ff, roughness: 0.4 }));
    cilindro.scale.y = largo;
    cilindro.quaternion.setFromUnitVectors(new V(0, 1, 0), dir);
    cilindro.position.copy(desde).addScaledVector(eje, 0.5).addScaledVector(perpendicular, desplazamiento);
    enlaces.add(cilindro);
  }
  return enlaces;
}

function iniciarReto(ctx) {
  const reto = RETOS[estado.indice];
  const { vista } = ctx;

  // Molécula en el centro con su átomo central y "huecos" fantasma donde van los enlaces.
  estado.molecula = new THREE.Group();
  estado.molecula.position.set(0, -0.3, 0);
  estado.molecula.rotation.x = 0.25;
  estado.capa.add(estado.molecula);
  estado.molecula.add(crearAtomo(reto.centro));

  const centro = ELEMENTOS[reto.centro];
  const ligando = ELEMENTOS[reto.ligando];
  const largo = (centro.radio + ligando.radio) * 1.25 + 0.35;
  estado.huecos = reto.direcciones.map((dir) => {
    const fantasma = new THREE.Mesh(
      geometriaEsfera,
      new THREE.MeshBasicMaterial({ color: ligando.color, transparent: true, opacity: 0.25, depthWrite: false }),
    );
    fantasma.scale.setScalar(ligando.radio);
    fantasma.position.copy(dir).multiplyScalar(largo);
    estado.molecula.add(fantasma);
    return fantasma;
  });

  // Átomos sueltos alrededor: los necesarios + distractores.
  const simbolos = [...reto.direcciones.map(() => reto.ligando), ...reto.extras];
  const giro = Math.random() * Math.PI * 2;
  estado.sueltos = simbolos
    .sort(() => Math.random() - 0.5)
    .map((simbolo, i) => {
      const angulo = giro + (i / simbolos.length) * Math.PI * 2;
      const origen = new V(Math.cos(angulo) * vista.mundoAncho * 0.36, Math.sin(angulo) * vista.mundoAlto * 0.31 - 0.4, 0);
      const atomo = crearAtomo(simbolo);
      atomo.position.copy(origen);
      atomo.userData.origen = origen.clone();
      atomo.userData.casa = origen.clone();
      atomo.userData.fase = Math.random() * 10;
      estado.capa.add(atomo);
      return atomo;
    });

  estado.fase = "jugando";
  estado.tiempo = 0;
  estado.manos.clear();
  ctx.hud.ocultarTarjetas();
  ctx.hud.instruccion(
    `Forma ${reto.formula} (${reto.nombre}). 🤏 Pellizca un átomo y suéltalo junto al ${centro.nombre}, que forma ${centro.valencia} enlaces.`,
  );
}

function terminarReto() {
  liberar(estado.molecula);
  for (const atomo of estado.sueltos) liberar(atomo);
  estado.sueltos = [];
}

function intentarEnlazar(ctx, atomo) {
  const reto = RETOS[estado.indice];
  const { simbolo } = atomo.userData;
  if (simbolo !== reto.ligando) {
    const nombres = [...new Set([reto.centro, reto.ligando])].map((s) => ELEMENTOS[s].nombre).join(" y ");
    ctx.hud.aviso(`❌ El ${ELEMENTOS[simbolo].nombre} no va aquí: el ${reto.nombre} solo tiene ${nombres}.`, "error");
    ctx.sonido.error();
    atomo.userData.casa.copy(atomo.userData.origen);
    return;
  }

  // Ocupa el hueco libre más cercano a donde se soltó.
  const posicion = atomo.getWorldPosition(new V());
  const hueco = estado.huecos
    .filter((h) => h.visible)
    .sort((a, b) => a.getWorldPosition(new V()).distanceTo(posicion) - b.getWorldPosition(new V()).distanceTo(posicion))[0];
  hueco.visible = false;

  estado.sueltos.splice(estado.sueltos.indexOf(atomo), 1);
  atomo.position.copy(hueco.position);
  estado.molecula.add(atomo);
  estado.molecula.add(crearEnlaces(new V(), hueco.position, reto.orden));
  ctx.sonido.enlace();

  const faltan = estado.huecos.filter((h) => h.visible).length;
  if (faltan > 0) {
    const enlaces = (reto.direcciones.length - faltan) * reto.orden;
    ctx.hud.aviso(
      `✔ ¡Enlace${reto.orden === 2 ? " doble" : ""}! El ${ELEMENTOS[reto.centro].nombre} lleva ${enlaces} de ${ELEMENTOS[reto.centro].valencia} enlaces.`,
      "ok", 1800,
    );
  } else {
    completarReto(ctx);
  }
}

function completarReto(ctx) {
  const reto = RETOS[estado.indice];
  const segundos = Math.round(estado.tiempo);
  const puntos = Math.max(100, 1000 - segundos * 12);
  estado.puntos += puntos;
  estado.fase = "exito";
  estado.espera = ESPERA_SIGUIENTE;
  estado.efectos.push(crearExplosion(estado.capa, estado.molecula.position));
  ctx.sonido.exito();

  // Los átomos que sobraron se van.
  for (const atomo of estado.sueltos) liberar(atomo);
  estado.sueltos = [];

  const info = contenido[reto.id];
  ctx.hud.instruccion(`¡Molécula de ${reto.nombre} completa! Forma ${reto.forma}.`);
  ctx.hud.tarjetas({
    logro: [`¡Formaste ${reto.formula}! +${puntos} pts`, `${reto.nombre[0].toUpperCase() + reto.nombre.slice(1)} en ${segundos} s. Su forma es ${reto.forma}.`],
    dato: ["¿Sabías que…?", info.datos[Math.floor(Math.random() * info.datos.length)]],
    carrera: ["Si te gustó, estudia:", info.carreras],
  });
}

function actualizarManos(ctx) {
  const vistas = new Set();
  for (const mano of ctx.manos) {
    vistas.add(mano.id);
    const memoria = estado.manos.get(mano.id) ?? { antes: false, atomo: null };
    estado.manos.set(mano.id, memoria);

    if (mano.pellizco && !memoria.antes && !memoria.atomo) {
      // Solo agarra al empezar a pellizcar, y el átomo libre más cercano.
      const cercano = estado.sueltos
        .filter((a) => !a.userData.sujeto)
        .map((a) => [a, a.position.distanceTo(mano.pinza)])
        .filter(([a, d]) => d < ELEMENTOS[a.userData.simbolo].radio + DISTANCIA_AGARRE)
        .sort((a, b) => a[1] - b[1])[0]?.[0];
      if (cercano) {
        cercano.userData.sujeto = true;
        memoria.atomo = cercano;
        ctx.sonido.agarrar();
      }
    }

    if (memoria.atomo) {
      if (mano.pellizco) {
        memoria.atomo.position.lerp(new V(mano.pinza.x, mano.pinza.y, 0.5), 0.6);
      } else {
        soltar(ctx, memoria);
      }
    }
    memoria.antes = mano.pellizco;
  }

  // Si una mano desaparece con un átomo agarrado, se suelta.
  for (const [id, memoria] of estado.manos) {
    if (vistas.has(id)) continue;
    if (memoria.atomo) soltar(ctx, memoria);
    estado.manos.delete(id);
  }
}

function soltar(ctx, memoria) {
  const atomo = memoria.atomo;
  memoria.atomo = null;
  atomo.userData.sujeto = false;
  atomo.position.z = 0;
  if (atomo.position.distanceTo(estado.molecula.position) < DISTANCIA_ENLACE) {
    intentarEnlazar(ctx, atomo);
  } else {
    atomo.userData.casa.copy(atomo.position); // se queda flotando donde lo dejaste
    ctx.sonido.soltar();
  }
}

export default {
  id: "moleculas",
  zona: "quimica",
  icono: "🔬",
  titulo: "Constructor de moléculas",
  descripcion: "Une átomos con tus manos y forma agua, CO₂…",

  // Para pruebas automáticas (scripts/prueba.js), vía window.__lab.modo.estado.
  get estado() {
    return estado;
  },

  iniciar(ctx) {
    // Todo lo del modo cuelga de "capa" para liberarlo de una sola vez al salir.
    estado = { capa: new THREE.Group(), indice: 0, puntos: 0, manos: new Map(), efectos: [], sueltos: [], tiempo: 0 };
    ctx.escena.add(estado.capa);
    ctx.hud.modo(this.titulo);
    iniciarReto(ctx);
  },

  actualizar(ctx, dt) {
    const ahora = performance.now() / 1000;
    estado.efectos = estado.efectos.filter((e) => e.actualizar(dt));
    estado.molecula.rotation.y += dt * (estado.fase === "jugando" ? 0.35 : 1.2);

    for (const hueco of estado.huecos) hueco.material.opacity = 0.18 + Math.sin(ahora * 4) * 0.1;

    if (estado.fase === "jugando") {
      estado.tiempo += dt;
      actualizarManos(ctx);

      // Átomos sueltos: flotan en su lugar y se iluminan si una mano está cerca.
      for (const atomo of estado.sueltos) {
        const { casa, fase, sujeto, simbolo, esfera } = atomo.userData;
        if (!sujeto) {
          const objetivo = casa.clone();
          objetivo.y += Math.sin(ahora * 1.5 + fase) * 0.12;
          atomo.position.lerp(objetivo, 1 - Math.exp(-dt * 5));
        }
        const cerca = ctx.manos.some(
          (m) => m.pinza.distanceTo(atomo.position) < ELEMENTOS[simbolo].radio + DISTANCIA_AGARRE,
        );
        esfera.material.emissiveIntensity = sujeto ? 0.7 : cerca ? 0.45 : 0.15;
        atomo.scale.setScalar(sujeto ? 1.2 : cerca ? 1.1 : 1);
      }
      ctx.hud.stats(`Reto ${estado.indice + 1} de ${RETOS.length} · ⏱ ${Math.floor(estado.tiempo)} s · ⭐ ${estado.puntos} pts`);
      return;
    }

    estado.espera -= dt;
    if (estado.fase === "exito") {
      ctx.hud.stats(`Siguiente reto en ${Math.ceil(estado.espera)}… · ⭐ ${estado.puntos} pts`);
      if (estado.espera > 0) return;
      terminarReto();
      estado.indice++;
      if (estado.indice < RETOS.length) {
        iniciarReto(ctx);
      } else {
        estado.fase = "final";
        estado.espera = 12;
        estado.molecula = new THREE.Group(); // vacío, para que el giro no falle
        estado.huecos = [];
        estado.efectos.push(crearExplosion(estado.capa, new V(0, 0, 0), undefined, 400));
        ctx.sonido.exito();
        ctx.hud.instruccion("🏆 ¡Completaste las 4 moléculas!");
        ctx.terminar({
          logro: ["¡Eres químico/a!", "Formaste agua, dióxido de carbono, metano y amoníaco."],
          dato: ["Lo que aprendiste", contenido.concepto],
          carrera: ["Si te gustó, estudia:", contenido.carreras],
        }, estado.puntos);
      }
    } else if (estado.fase === "final") {
      ctx.hud.stats(`Volviendo al menú en ${Math.ceil(estado.espera)}…`);
      if (estado.espera <= 0) ctx.salir();
    }
  },

  detener() {
    liberar(estado.capa);
    estado = null;
  },
};
