// Botones grandes dentro de una actividad. Se eligen apuntando (dwell) o con clic.
// posicion: "derecha" (columna) o "centro" (fila grande a media pantalla).
export function crearBotonera(posicion, opciones, alElegir) {
  const contenedor = document.createElement("div");
  contenedor.className = `botonera ${posicion}`;
  const botones = new Map();
  for (const { id, texto } of opciones) {
    const boton = document.createElement("button");
    boton.className = "dwell";
    boton.textContent = texto;
    boton.addEventListener("click", () => alElegir(id));
    botones.set(id, boton);
    contenedor.append(boton);
  }
  document.getElementById("ui").append(contenedor);

  return {
    marcar(id) {
      for (const [clave, boton] of botones) boton.classList.toggle("activo", clave === id);
    },
    mostrar(visible) {
      contenedor.classList.toggle("oculto", !visible);
    },
    quitar() {
      contenedor.remove();
    },
  };
}
