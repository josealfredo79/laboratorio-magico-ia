// Ranking del día, guardado en el navegador del stand (localStorage).
// Cada jugador recibe un nombre de científico/a para encontrarse en la tabla.
const CLAVE = "laboratorio-ranking";
const CIENTIFICOS = [
  "Curie", "Einstein", "Newton", "Tesla", "Darwin", "Lovelace", "Galileo", "Hipatia",
  "Turing", "Franklin", "Mendeléiev", "Kepler", "Faraday", "Pasteur", "Sagan", "Noether",
];
const POR_ACTIVIDAD = 10;

const hoy = () => new Date().toLocaleDateString("sv"); // AAAA-MM-DD
const vacio = () => ({ fecha: hoy(), contador: 0, tablas: {} });

function leer() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE));
    if (datos?.fecha === hoy()) return datos;
  } catch {}
  return vacio();
}

function guardar(datos) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(datos));
  } catch {}
}

// Más rápido = más puntos, con un mínimo de 100 por terminar.
export const puntosPorTiempo = (segundos, maximo = 1000) => Math.max(100, Math.round(maximo - segundos * 8));

export const ranking = {
  registrar(actividad, puntos) {
    const datos = leer();
    datos.contador++;
    const alias = `${CIENTIFICOS[(datos.contador - 1) % CIENTIFICOS.length]} #${datos.contador}`;
    const tabla = [...(datos.tablas[actividad] ?? []), { alias, puntos: Math.round(puntos) }];
    tabla.sort((a, b) => b.puntos - a.puntos);
    const lugar = tabla.findIndex((fila) => fila.alias === alias) + 1;
    datos.tablas[actividad] = tabla.slice(0, POR_ACTIVIDAD);
    guardar(datos);
    return { alias, lugar };
  },

  top(actividad, n = 5) {
    return (leer().tablas[actividad] ?? []).slice(0, n);
  },

  reiniciar() {
    guardar(vacio());
  },
};

// Panel que va rotando entre las actividades que ya tienen puntajes hoy.
export function crearPanelRanking(elemento, modos) {
  let indice = 0;
  let tiempo = 0;

  function pintar() {
    const conPuntos = modos.filter((m) => ranking.top(m.id).length);
    if (!conPuntos.length) {
      elemento.innerHTML = "<b>🏆 Ranking de hoy</b><p>¡Termina una actividad y aparece aquí!</p>";
      return;
    }
    const modo = conPuntos[indice % conPuntos.length];
    const filas = ranking
      .top(modo.id)
      .map((f) => `<li><span>${f.alias}</span><span>${f.puntos} pts</span></li>`)
      .join("");
    elemento.innerHTML = `<b>🏆 Ranking de hoy · ${modo.icono} ${modo.titulo}</b><ol>${filas}</ol>`;
  }

  return {
    pintar,
    actualizar(dt) {
      tiempo += dt;
      if (tiempo < 6) return;
      tiempo = 0;
      indice++;
      pintar();
    },
  };
}
