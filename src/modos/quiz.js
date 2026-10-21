// Quiz científico: verdadero o falso respondiendo con 👍 / 👎 (o apuntando a un botón).
import { pulgar } from "../vision/gestos.js";
import { crearBotonera } from "../ui/botonera.js";
import contenido from "../contenido/quiz.json";

const PREGUNTAS = 6;
const SOSTENER = 0.7; // s con el pulgar arriba/abajo para responder
const ESPERA_RESPUESTA = 4.5;

let e = null;

function mostrarPregunta() {
  const pregunta = e.preguntas[e.indice];
  e.caja.textContent = pregunta.texto;
  e.fase = "pregunta";
  e.gesto = null;
  e.sostenido = 0;
  e.botonera.mostrar(true);
}

function responder(ctx, valor) {
  if (e.fase !== "pregunta") return;
  const pregunta = e.preguntas[e.indice];
  const correcto = valor === pregunta.respuesta;
  if (correcto) e.aciertos++;
  ctx.sonido[correcto ? "acierto" : "error"]();
  ctx.hud.aviso(`${correcto ? "✅ ¡Correcto!" : "❌ Incorrecto."} ${pregunta.explicacion}`, correcto ? "ok" : "error", ESPERA_RESPUESTA * 1000);
  e.caja.textContent = `${pregunta.texto}\n${pregunta.respuesta ? "👍 VERDADERO" : "👎 FALSO"}`;
  e.botonera.mostrar(false);
  e.fase = "respuesta";
  e.espera = ESPERA_RESPUESTA;
}

function terminar(ctx) {
  e.fase = "final";
  e.botonera.mostrar(false);
  const nivel = e.aciertos === PREGUNTAS ? "¡Perfecto! 🏆" : e.aciertos >= PREGUNTAS / 2 ? "¡Muy bien! 🌟" : "¡Sigue aprendiendo! 💪";
  e.caja.textContent = `${nivel} Acertaste ${e.aciertos} de ${PREGUNTAS}`;
  ctx.sonido.exito();
  ctx.hud.tarjetas({
    logro: [`${e.aciertos} de ${PREGUNTAS} respuestas correctas`, "Repasaste física, química, biología e IA."],
    dato: ["¿Sabías que…?", "Las preguntas que fallaste son las que más aprendes: tu cerebro recuerda mejor después de equivocarse."],
    carrera: ["Si te gustó, estudia:", contenido.carreras],
  });
}

export default {
  id: "quiz",
  zona: "ia",
  icono: "❓",
  titulo: "Quiz científico",
  descripcion: "Verdadero o falso: responde con 👍 o 👎",

  iniciar(ctx) {
    const mezcladas = [...contenido.preguntas].sort(() => Math.random() - 0.5);
    e = { preguntas: mezcladas.slice(0, PREGUNTAS), indice: 0, aciertos: 0 };

    e.caja = document.createElement("div");
    e.caja.className = "quiz";
    document.getElementById("ui").append(e.caja);
    e.botonera = crearBotonera(
      "centro",
      [
        { id: "si", texto: "👍 Verdadero" },
        { id: "no", texto: "👎 Falso" },
      ],
      (id) => responder(ctx, id === "si"),
    );

    ctx.hud.modo(this.titulo, "Responde con 👍 (verdadero) o 👎 (falso) y sostén el gesto, o apunta a un botón");
    mostrarPregunta();
  },

  actualizar(ctx, dt) {
    if (e.fase === "pregunta") {
      const gesto = ctx.manos.map((m) => m.lm && pulgar(m.lm)).find(Boolean) ?? null;
      e.sostenido = gesto && gesto === e.gesto ? e.sostenido + dt : 0;
      e.gesto = gesto;
      if (e.sostenido >= SOSTENER) responder(ctx, gesto === "arriba");
    } else if (e.fase === "respuesta") {
      e.espera -= dt;
      if (e.espera <= 0) {
        e.indice++;
        if (e.indice < PREGUNTAS) mostrarPregunta();
        else terminar(ctx);
      }
    }

    const progreso = e.gesto
      ? ` · ${e.gesto === "arriba" ? "👍" : "👎"} ${"▓".repeat(Math.round((e.sostenido / SOSTENER) * 6)).padEnd(6, "░")}`
      : "";
    ctx.hud.stats(
      e.fase === "final"
        ? `⭐ ${e.aciertos} de ${PREGUNTAS}`
        : `Pregunta ${e.indice + 1} de ${PREGUNTAS} · ✅ ${e.aciertos} aciertos${progreso}`,
    );
  },

  detener() {
    e.caja.remove();
    e.botonera.quitar();
    e = null;
  },
};
