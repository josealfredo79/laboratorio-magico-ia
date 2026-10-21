// Textos en pantalla: carga, encabezado del modo, avisos y tarjetas finales.
const $ = (id) => document.getElementById(id);

function elemento(etiqueta, clase, texto) {
  const el = document.createElement(etiqueta);
  if (clase) el.className = clase;
  if (texto != null) el.textContent = texto;
  return el;
}

// [["Atraer", true], ["Repeler", false]] → "✅ Atraer · ⬜ Repeler"
export function listaRetos(retos) {
  return retos.map(([texto, hecho]) => `${hecho ? "✅" : "⬜"} ${texto}`).join(" · ");
}

export function crearHud() {
  let temporizadorAviso = null;
  let ultimasStats = "";

  return {
    carga(texto) {
      $("carga").classList.toggle("oculto", texto == null);
      if (texto != null) $("carga-texto").textContent = texto;
    },

    modo(titulo, instruccion = "") {
      const visible = titulo != null;
      $("hud").classList.toggle("oculto", !visible);
      $("volver").classList.toggle("oculto", !visible);
      if (!visible) return;
      $("hud-titulo").textContent = titulo;
      $("hud-instruccion").textContent = instruccion;
      this.stats("");
    },

    instruccion(texto) {
      $("hud-instruccion").textContent = texto;
    },

    // Acepta HTML propio (barras, negritas). Solo escribe si cambió.
    stats(html) {
      if (html === ultimasStats) return;
      ultimasStats = html;
      $("hud-stats").innerHTML = html;
    },

    aviso(texto, tipo = "", ms = 2600) {
      const aviso = $("aviso");
      aviso.textContent = texto;
      aviso.className = tipo;
      // Reinicia la animación de entrada.
      void aviso.offsetWidth;
      clearTimeout(temporizadorAviso);
      temporizadorAviso = setTimeout(() => aviso.classList.add("oculto"), ms);
    },

    // { logro: [titulo, texto], dato: [titulo, texto], carrera: [titulo, texto] }
    tarjetas(contenido) {
      const contenedor = $("tarjetas");
      contenedor.replaceChildren();
      const iconos = { logro: "✅", dato: "💡", carrera: "🎓" };
      for (const tipo of ["logro", "dato", "carrera"]) {
        if (!contenido[tipo]) continue;
        const [titulo, texto] = contenido[tipo];
        const tarjeta = elemento("div", `tarjeta ${tipo}`);
        const cuerpo = elemento("div");
        cuerpo.append(elemento("b", null, titulo), elemento("p", null, texto));
        tarjeta.append(elemento("span", "icono", iconos[tipo]), cuerpo);
        contenedor.append(tarjeta);
      }
      contenedor.classList.remove("oculto");
    },

    ocultarTarjetas() {
      $("tarjetas").classList.add("oculto");
    },

    fps(valor) {
      $("fps").textContent = `${valor} FPS`;
    },
  };
}
