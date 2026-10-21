// Theremín: la altura de una mano da la nota y la otra el volumen. Se ve la onda en 3D.
import * as THREE from "three";
import * as Tone from "tone";
import { liberar } from "../escena/escena.js";
import { crearEtiqueta } from "../escena/efectos.js";
import { listaRetos } from "../ui/hud.js";
import { puntosPorTiempo } from "../ui/ranking.js";
import { sonidoActivo } from "../ui/sonido.js";
import contenido from "../contenido/theremin.json";

const NOTAS = ["Do", "Do#", "Re", "Re#", "Mi", "Fa", "Fa#", "Sol", "Sol#", "La", "La#", "Si"];
const F_MIN = 130.81; // Do3
const OCTAVAS = 3; // hasta Do6
const VELOCIDAD_SONIDO = 343; // m/s en el aire a 20 °C
const PUNTOS_ONDA = 600;
const TOLERANCIA_CENTS = 30;
const SOSTENER = 1; // s afinado para lograr la nota

const OBJETIVOS = [
  { nombre: "La4", f: 440 },
  { nombre: "Do5", f: 523.25 },
  { nombre: "Mi4", f: 329.63 },
  { nombre: "Sol4", f: 392 },
];

const alturaAFrecuencia = (t) => F_MIN * 2 ** (t * OCTAVAS);
const frecuenciaAAltura = (f) => Math.log2(f / F_MIN) / OCTAVAS;
const centsEntre = (f, ref) => 1200 * Math.log2(f / ref);

function nombreNota(f) {
  const midi = 69 + 12 * Math.log2(f / 440);
  const n = Math.round(midi);
  return { nombre: `${NOTAS[((n % 12) + 12) % 12]}${Math.floor(n / 12) - 1}`, cents: Math.round((midi - n) * 100) };
}

let e = null;

function crearAudio() {
  const reverb = new Tone.Freeverb({ roomSize: 0.7, wet: 0.25 }).toDestination();
  const vibrato = new Tone.Vibrato(5, 0.08).connect(reverb);
  const ganancia = new Tone.Gain(0).connect(vibrato);
  const oscilador = new Tone.Oscillator({ type: "sine", frequency: 440 }).connect(ganancia).start();
  return { reverb, vibrato, ganancia, oscilador };
}

function colocarObjetivo(ctx) {
  const objetivo = OBJETIVOS[e.indice];
  e.guia.visible = !!objetivo;
  if (!objetivo) return;
  const y = ctx.pantallaAMundo(0, (1 - frecuenciaAAltura(objetivo.f)) * ctx.vista.alto).y;
  e.guia.position.y = y;
  if (e.etiqueta) liberar(e.etiqueta);
  e.etiqueta = crearEtiqueta(`🎯 ${objetivo.nombre} (${objetivo.f} Hz)`, { color: "#ffe66b", tamano: 0.55 });
  e.etiqueta.position.set(-ctx.vista.mundoAncho / 2 + 2.2, y + 0.35, 0);
  e.capa.add(e.etiqueta);
}

export default {
  id: "theremin",
  zona: "fisica",
  icono: "🎵",
  titulo: "Theremín de ondas",
  descripcion: "Haz música moviendo las manos en el aire",

  iniciar(ctx) {
    e = { inicio: performance.now(), capa: new THREE.Group(), indice: 0, sostenido: 0, fase: 0, f: 440, volumen: 0, avisoAudio: 0 };
    ctx.escena.add(e.capa);
    e.audio = crearAudio();

    e.onda = new THREE.Line(
      new THREE.BufferGeometry().setAttribute(
        "position",
        new THREE.BufferAttribute(new Float32Array(PUNTOS_ONDA * 3), 3),
      ),
      new THREE.LineBasicMaterial({ color: 0x5ef2ff }),
    );
    e.guia = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-ctx.vista.mundoAncho / 2, 0, 0),
        new THREE.Vector3(ctx.vista.mundoAncho / 2, 0, 0),
      ]),
      new THREE.LineDashedMaterial({ color: 0xffe66b, dashSize: 0.3, gapSize: 0.2 }),
    );
    e.guia.computeLineDistances();
    e.capa.add(e.onda, e.guia);
    colocarObjetivo(ctx);

    ctx.hud.modo(
      this.titulo,
      "☝️ Mano derecha: sube o baja para cambiar la nota · ✋ Mano izquierda: sube para más volumen",
    );
  },

  actualizar(ctx, dt) {
    const { vista } = ctx;

    // La mano del lado derecho de la pantalla da la nota; la del izquierdo, el volumen.
    const manos = [...ctx.manos].sort((a, b) => b.pantalla.x - a.pantalla.x);
    const altura = (m) => THREE.MathUtils.clamp(1 - m.pantalla.y / vista.alto, 0, 1);
    const tono = manos[0];
    const volumen = manos.length > 1 ? altura(manos[1]) : tono ? 0.7 : 0;

    if (tono) e.f = alturaAFrecuencia(altura(tono));
    e.volumen += (volumen - e.volumen) * Math.min(1, dt * 10);
    e.audio.oscilador.frequency.rampTo(e.f, 0.05);
    e.audio.ganancia.gain.rampTo(e.volumen * 0.6, 0.05);

    if (!sonidoActivo()) {
      e.avisoAudio -= dt;
      if (e.avisoAudio <= 0) {
        ctx.hud.aviso("🔈 Haz clic una vez en la pantalla para activar el sonido", "error", 4000);
        e.avisoAudio = 5;
      }
    }

    // Onda visible: longitud de onda proporcional a 1/f y amplitud según el volumen.
    e.fase += dt * Math.PI * 3;
    const lambdaVisual = 600 / e.f;
    const amplitud = 0.15 + 1.6 * e.volumen;
    const pos = e.onda.geometry.attributes.position;
    for (let i = 0; i < PUNTOS_ONDA; i++) {
      const x = (i / (PUNTOS_ONDA - 1) - 0.5) * vista.mundoAncho;
      pos.setXYZ(i, x, -0.4 + amplitud * Math.sin((2 * Math.PI * x) / lambdaVisual - e.fase), 0);
    }
    pos.needsUpdate = true;
    e.onda.material.color.setHSL(0.55 - frecuenciaAAltura(e.f) * 0.55, 1, 0.6);

    // Reto: sostener la nota objetivo.
    const objetivo = OBJETIVOS[e.indice];
    if (objetivo && tono) {
      const afinado = Math.abs(centsEntre(e.f, objetivo.f)) < TOLERANCIA_CENTS;
      e.sostenido = afinado ? e.sostenido + dt : Math.max(0, e.sostenido - dt * 2);
      if (e.sostenido >= SOSTENER) {
        ctx.sonido.acierto();
        ctx.hud.aviso(`✔ ¡Tocaste ${objetivo.nombre} = ${objetivo.f} Hz!`, "ok");
        e.indice++;
        e.sostenido = 0;
        colocarObjetivo(ctx);
        if (e.indice === OBJETIVOS.length) {
          ctx.sonido.exito();
          ctx.hud.instruccion("🎶 ¡Eres músico/a científico/a! Ahora toca libremente.");
          ctx.terminar({
            logro: ["¡Afinaste las 4 notas!", "La4 = 440 Hz, Do5 = 523 Hz, Mi4 = 330 Hz y Sol4 = 392 Hz."],
            dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
            carrera: ["Si te gustó, estudia:", contenido.carreras],
          }, puntosPorTiempo((performance.now() - e.inicio) / 1000, 1500));
        }
      }
    }

    const nota = nombreNota(e.f);
    const barra = objetivo ? ` · ${"▓".repeat(Math.round((e.sostenido / SOSTENER) * 8)).padEnd(8, "░")}` : "";
    ctx.hud.stats(
      `🎵 ${nota.nombre} ${nota.cents >= 0 ? "+" : ""}${nota.cents}¢ · f = ${Math.round(e.f)} Hz · ` +
        `λ = ${(VELOCIDAD_SONIDO / e.f).toFixed(2)} m · 🔊 ${Math.round(e.volumen * 100)} %` +
        `<br>${objetivo ? `🎯 Toca ${objetivo.nombre}${barra}<br>` : ""}` +
        listaRetos(OBJETIVOS.map((o, i) => [o.nombre, i < e.indice])),
    );
  },

  detener() {
    const { oscilador, ganancia, vibrato, reverb } = e.audio;
    oscilador.stop();
    for (const nodo of [oscilador, ganancia, vibrato, reverb]) nodo.dispose();
    liberar(e.capa);
    e = null;
  },
};
