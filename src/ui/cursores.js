// Un círculo por mano. Mantener el cursor sobre un botón .dwell lo "presiona".
const TIEMPO_DWELL = 1300; // ms

export function crearCursores() {
  const contenedor = document.getElementById("cursores");
  const cursores = new Map(); // id -> { el, objetivo, desde }

  function bajoElPunto(x, y) {
    for (const el of document.querySelectorAll(".dwell")) {
      if (el.disabled || el.offsetParent === null) continue;
      const r = el.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return el;
    }
    return null;
  }

  return {
    actualizar(manos, ahora) {
      const vistos = new Set();
      for (const mano of manos) {
        vistos.add(mano.id);
        let cursor = cursores.get(mano.id);
        if (!cursor) {
          cursor = { el: document.createElement("div"), objetivo: null, desde: 0 };
          cursor.el.className = "cursor";
          contenedor.append(cursor.el);
          cursores.set(mano.id, cursor);
        }
        const { x, y } = mano.pantalla;
        cursor.el.style.transform = `translate(${x}px, ${y}px)`;
        cursor.el.classList.toggle("pellizco", mano.pellizco);

        // El ratón hace clic normal; solo las manos usan "mantener encima".
        const objetivo = mano.raton ? null : bajoElPunto(x, y);
        if (objetivo !== cursor.objetivo) {
          cursor.objetivo?.classList.remove("encima");
          objetivo?.classList.add("encima");
          cursor.objetivo = objetivo;
          cursor.desde = ahora;
        }
        const progreso = objetivo ? Math.min((ahora - cursor.desde) / TIEMPO_DWELL, 1) : 0;
        cursor.el.style.setProperty("--p", progreso);
        if (progreso >= 1) {
          cursor.desde = Infinity; // no repetir hasta salir del botón
          objetivo.classList.remove("encima");
          objetivo.click();
        }
      }

      for (const [id, cursor] of cursores) {
        if (vistos.has(id)) continue;
        cursor.objetivo?.classList.remove("encima");
        cursor.el.remove();
        cursores.delete(id);
      }
    },
  };
}
