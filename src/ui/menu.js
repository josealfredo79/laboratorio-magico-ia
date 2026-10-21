// Menú principal: tarjetas por zona que se eligen apuntando (o con clic).
export const ZONAS = [
  { id: "fisica", titulo: "⚛️ Física" },
  { id: "quimica", titulo: "🧪 Química" },
  { id: "biologia", titulo: "🫀 Biología" },
  { id: "ia", titulo: "🤖 IA y Arcade" },
];

export function crearMenu(modos, alElegir) {
  const menu = document.getElementById("menu");
  const sub = document.getElementById("menu-sub");
  const zonas = document.getElementById("menu-zonas");

  for (const zona of ZONAS) {
    const columna = document.createElement("section");
    columna.className = "zona";
    const titulo = document.createElement("h2");
    titulo.textContent = zona.titulo;
    columna.append(titulo);

    for (const modo of modos.filter((m) => m.zona === zona.id)) {
      const boton = document.createElement("button");
      boton.className = "actividad dwell";
      boton.disabled = !!modo.proximamente;
      boton.innerHTML = `<span class="icono"></span><span><b></b><span class="desc"></span></span>`;
      boton.querySelector(".icono").textContent = modo.icono;
      boton.querySelector("b").textContent = modo.titulo;
      boton.querySelector(".desc").textContent = modo.descripcion;
      boton.addEventListener("click", () => alElegir(modo));
      columna.append(boton);
    }
    zonas.append(columna);
  }

  return {
    mostrar: () => menu.classList.remove("oculto"),
    ocultar: () => menu.classList.add("oculto"),
    actualizar(manos) {
      sub.textContent = manos.some((m) => !m.raton)
        ? "👋 ¡Te veo! Mantén el dedo sobre una actividad"
        : "✋ Levanta la mano y apunta a una actividad";
    },
  };
}
