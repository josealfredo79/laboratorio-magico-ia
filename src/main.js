import "./estilos.css";
import { iniciarCamara } from "./vision/camara.js";
import { crearDetector } from "./vision/detector.js";
import { fijarAspecto } from "./vision/gestos.js";
import { procesarManos, crearRaton } from "./vision/manos.js";
import { crearEscena } from "./escena/escena.js";
import { crearHud } from "./ui/hud.js";
import { crearCursores } from "./ui/cursores.js";
import { crearMenu } from "./ui/menu.js";
import { sonido } from "./ui/sonido.js";
import { ranking, crearPanelRanking } from "./ui/ranking.js";
import { crearBienvenida } from "./ui/bienvenida.js";
import { MODOS, DISPONIBLES } from "./modos/index.js";

const video = document.getElementById("camara");
const hud = crearHud();

// Sin nadie frente a la cámara: tras 20 s en el menú sale la bienvenida,
// y tras 60 s dentro de una actividad se vuelve al menú.
const BIENVENIDA_TRAS = 20000;
const SALIR_DE_ACTIVIDAD_TRAS = 60000;
// ?prueba desactiva esos temporizadores (scripts/prueba.js).
const modoPrueba = new URLSearchParams(location.search).has("prueba");

// Evita que la pantalla se apague durante la feria.
function mantenerPantallaEncendida() {
  navigator.wakeLock?.request("screen").catch(() => {});
}

async function arrancar() {
  hud.carga("📷 Encendiendo la cámara…");
  try {
    await iniciarCamara(video);
    fijarAspecto(video.videoWidth / video.videoHeight);
  } catch (error) {
    console.warn("Sin cámara: se usará el ratón", error);
    hud.aviso("📷 No hay cámara: usa el ratón (clic = pellizco)", "error", 6000);
  }

  hud.carga("🧠 Cargando la inteligencia artificial…");
  const detector = await crearDetector();
  const escena = crearEscena(document.getElementById("lienzo"), video);
  const raton = crearRaton(escena);
  const cursores = crearCursores();

  let modo = null;
  const ctx = {
    ...escena, video, hud, sonido, manos: [], cara: null, pose: null,
    salir: () => activar(null),
    // Cierre común de una actividad: tarjetas + registro en el ranking del día.
    terminar(tarjetas, puntos) {
      const { alias, lugar } = ranking.registrar(modo.id, puntos);
      const [titulo, texto] = tarjetas.logro;
      const medalla = lugar <= 5 ? `🏆 ¡Lugar ${lugar} del día como ${alias}!` : `🔬 Eres ${alias}`;
      hud.tarjetas({ ...tarjetas, logro: [titulo, `${texto} ⭐ ${puntos} pts · ${medalla}`] });
      panelMenu.pintar();
    },
  };
  const menu = crearMenu(MODOS, (m) => activar(m));
  const panelMenu = crearPanelRanking(document.getElementById("menu-ranking"), MODOS);
  const bienvenida = crearBienvenida({ escena: escena.escena, menu, modos: MODOS });

  function activar(nuevo) {
    bienvenida.ocultar();
    if (modo) modo.detener(ctx);
    modo = nuevo;
    ctx.cara = null;
    ctx.pose = null;
    hud.ocultarTarjetas();
    sonido.click();
    if (modo) {
      menu.ocultar();
      if (modo.necesita?.cara) {
        detector.asegurarCara().catch((e) => {
          console.error(e);
          hud.aviso("No se pudo cargar el detector de cara", "error");
        });
      }
      if (modo.necesita?.pose) {
        detector.asegurarPose().catch((e) => {
          console.error(e);
          hud.aviso("No se pudo cargar el detector de cuerpo", "error");
        });
      }
      modo.iniciar(ctx);
    } else {
      hud.modo(null);
      menu.mostrar();
      panelMenu.pintar();
    }
  }

  document.getElementById("volver").addEventListener("click", () => activar(null));

  // Teclas del operador: 1–9 y 0 modos, Esc menú, D modo científico, F fps, R reinicia el ranking.
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") activar(null);
    else if (e.key.toLowerCase() === "r") {
      ranking.reiniciar();
      panelMenu.pintar();
      hud.aviso("🏆 Ranking del día reiniciado", "ok");
    }
    else if (/^[0-9]$/.test(e.key)) {
      const actividad = DISPONIBLES[e.key === "0" ? 9 : e.key - 1];
      if (actividad) activar(actividad);
    }
    else if (e.key.toLowerCase() === "d") activar(DISPONIBLES.find((m) => m.id === "cientifico"));
    else if (e.key.toLowerCase() === "f") document.getElementById("fps").classList.toggle("oculto");
  });

  hud.carga(null);
  menu.mostrar();
  panelMenu.pintar();
  mantenerPantallaEncendida();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") mantenerPantallaEncendida();
  });

  let previo = performance.now();
  let ultimaPresencia = previo;
  let cuadros = 0;
  let inicioFps = previo;

  function cuadro(ahora) {
    const dt = Math.min((ahora - previo) / 1000, 0.1);
    previo = ahora;

    const resultado = detector.detectar(video, ahora, {
      conCara: !!modo?.necesita?.cara,
      conPose: !!modo?.necesita?.pose,
    });
    if (resultado) {
      ctx.manos = procesarManos(resultado.manos, escena);
      ctx.cara = resultado.cara;
      ctx.pose = resultado.pose;
    }
    const manos = ctx.manos.length ? ctx.manos : [raton.mano(ahora)].filter(Boolean);
    const ctxCuadro = manos === ctx.manos ? ctx : { ...ctx, manos };

    cursores.actualizar(manos, ahora);
    if (manos.length) ultimaPresencia = ahora;
    const sinNadie = ahora - ultimaPresencia;
    if (!modoPrueba && modo && sinNadie > SALIR_DE_ACTIVIDAD_TRAS) activar(null);
    if (!modoPrueba && !modo) {
      if (sinNadie > BIENVENIDA_TRAS) bienvenida.mostrar();
      else bienvenida.ocultar();
    }

    // Un error en una actividad no debe congelar el stand: se registra y se vuelve al menú.
    try {
      if (modo) modo.actualizar(ctxCuadro, dt);
      else if (bienvenida.visible) bienvenida.actualizar(dt);
      else {
        menu.actualizar(manos);
        panelMenu.actualizar(dt);
      }
    } catch (error) {
      console.error(`Error en la actividad "${modo?.id}":`, error);
      hud.aviso("😅 Algo falló en esta actividad. Volvemos al menú.", "error", 4000);
      try {
        activar(null);
      } catch {
        modo = null;
        hud.modo(null);
        menu.mostrar();
      }
    }
    escena.render();

    cuadros++;
    if (ahora - inicioFps > 1000) {
      hud.fps(cuadros);
      cuadros = 0;
      inicioFps = ahora;
    }
    requestAnimationFrame(cuadro);
  }
  requestAnimationFrame(cuadro);

  // Para pruebas automáticas (scripts/prueba.js).
  window.__lab = {
    ctx,
    ir: (id) => activar(id ? MODOS.find((m) => m.id === id) : null),
    get modo() { return modo; },
  };
}

arrancar().catch((error) => {
  console.error(error);
  hud.carga(`⚠️ Error al iniciar: ${error.message}`);
});
