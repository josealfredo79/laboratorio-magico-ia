// Convierte el resultado de HandLandmarker en "manos" listas para los modos.
import { suavizar, estaPellizcando, manoAbierta, esPuno, puntoMedio } from "./gestos.js";

const memoria = new Map(); // id -> { lm, pellizco }

export function procesarManos(resultado, escena) {
  const manos = [];
  const vistas = new Set();

  resultado.landmarks.forEach((crudos, i) => {
    let id = resultado.handedness[i]?.[0]?.categoryName ?? `mano${i}`;
    if (vistas.has(id)) id += i;
    vistas.add(id);

    const previa = memoria.get(id);
    const lm = suavizar(previa?.lm, crudos, 0.55);
    const pellizco = estaPellizcando(lm, previa?.pellizco ?? false);
    memoria.set(id, { lm, pellizco });

    const pinza = puntoMedio(lm[4], lm[8]);
    manos.push({
      id,
      lm,
      pellizco,
      abierta: manoAbierta(lm),
      puno: esPuno(lm),
      punta: escena.normAMundo(lm[8].x, lm[8].y), // punta del índice en el mundo 3D
      pinza: escena.normAMundo(pinza.x, pinza.y), // entre pulgar e índice
      pantalla: escena.normAPantalla(lm[8].x, lm[8].y), // píxeles, para el cursor
    });
  });

  for (const id of memoria.keys()) if (!vistas.has(id)) memoria.delete(id);
  return manos;
}

// Sin cámara (o para pruebas) el ratón actúa como una mano: clic = pellizco.
export function crearRaton(escena) {
  const estado = { x: 0, y: 0, abajo: false, ultimo: -Infinity };
  const mover = (e) => Object.assign(estado, { x: e.clientX, y: e.clientY, ultimo: performance.now() });
  addEventListener("pointermove", mover);
  addEventListener("pointerdown", (e) => { mover(e); estado.abajo = true; });
  addEventListener("pointerup", (e) => { mover(e); estado.abajo = false; });

  return {
    mano(ahora) {
      if (!estado.abajo && ahora - estado.ultimo > 3000) return null;
      const punto = escena.pantallaAMundo(estado.x, estado.y);
      return {
        id: "raton",
        lm: null,
        pellizco: estado.abajo,
        abierta: false,
        puno: false,
        punta: punto,
        pinza: punto.clone(),
        pantalla: { x: estado.x, y: estado.y },
        raton: true,
      };
    },
  };
}
