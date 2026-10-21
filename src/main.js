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
import { MODOS, DISPONIBLES } from "./modos/index.js";

const video = document.getElementById("camara");
const hud = crearHud();

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
  const ctx = { ...escena, video, hud, sonido, manos: [], cara: null, pose: null, salir: () => activar(null) };
  const menu = crearMenu(MODOS, (m) => activar(m));

  function activar(nuevo) {
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
    }
  }

  document.getElementById("volver").addEventListener("click", () => activar(null));

  // Teclas de depuración: 1–9 modos, Esc menú, D modo científico, F fps.
  addEventListener("keydown", (e) => {
    if (e.key === "Escape") activar(null);
    else if (e.key >= "1" && e.key <= "9" && DISPONIBLES[e.key - 1]) activar(DISPONIBLES[e.key - 1]);
    else if (e.key.toLowerCase() === "d") activar(DISPONIBLES.find((m) => m.id === "cientifico"));
    else if (e.key.toLowerCase() === "f") document.getElementById("fps").classList.toggle("oculto");
  });

  hud.carga(null);
  menu.mostrar();

  let previo = performance.now();
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
    // Un error en una actividad no debe congelar el stand: se registra y se vuelve al menú.
    try {
      if (modo) modo.actualizar(ctxCuadro, dt);
      else menu.actualizar(manos);
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
