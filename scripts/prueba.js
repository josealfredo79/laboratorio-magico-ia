// Prueba de humo: abre la app con cámara falsa, juega las 4 moléculas con el ratón
// y revisa que no haya errores en consola. Requiere `npm run dev` corriendo.
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";

const URL = process.env.URL ?? "http://localhost:5173/?prueba"; // ?prueba: sin bienvenida ni salida por inactividad
const CAPTURAS = process.env.CAPTURAS ?? "capturas";
await mkdir(CAPTURAS, { recursive: true });

const navegador = await chromium.launch({
  args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--enable-unsafe-swiftshader"],
});
const pagina = await navegador.newPage({ viewport: { width: 1600, height: 900 } });
const errores = [];
pagina.on("console", (m) => m.type() === "error" && !m.text().startsWith("INFO:") && errores.push(m.text()));
pagina.on("pageerror", (e) => errores.push(e.message));

const espera = (ms) => pagina.waitForTimeout(ms);
const captura = (nombre) => pagina.screenshot({ path: `${CAPTURAS}/${nombre}.png` });

await pagina.goto(URL);
await pagina.waitForSelector("#carga.oculto", { state: "attached", timeout: 60000 });
await espera(500);
await captura("1-menu");
  console.log("FPS:", await pagina.evaluate(() => new Promise((ok) => { let n = 0; const t0 = performance.now(); const f = () => (performance.now() - t0 < 1000 ? (n++, requestAnimationFrame(f)) : ok(n)); requestAnimationFrame(f); })));
console.log("✔ Menú cargado");

const ir = (id) => pagina.evaluate((id) => window.__lab.ir(id), id);
const stats = () => pagina.textContent("#hud-stats");
const comprobar = (condicion, mensaje) => {
  if (condicion) console.log(`✔ ${mensaje}`);
  else errores.push(`✘ ${mensaje}`);
};

// ---------- Recorrido por todas las actividades ----------
await ir("gravedad");
await espera(1500);
const pelota = await pagina.evaluate(() => window.__lab.ctx.mundoAPantalla(window.__lab.modo.estado.pelota.position));
// Esperas largas: sin GPU el navegador de prueba va a pocos cuadros por segundo.
await pagina.mouse.move(pelota.x, pelota.y);
await espera(800);
await pagina.mouse.down();
await espera(1200);
await pagina.mouse.move(pelota.x + 250, pelota.y - 250, { steps: 3 });
await espera(400);
await pagina.mouse.up();
await espera(2500);
comprobar(await pagina.evaluate(() => window.__lab.modo.estado.trazos.size > 0), "Gravedad: la pelota se lanzó y dejó trazo");
await pagina.click(".botonera button:nth-child(2)"); // Luna
await espera(800);
comprobar((await stats()).includes("Luna"), "Gravedad: cambio a la Luna");
await captura("5-gravedad");

for (const [id, texto, nombre] of [
  ["theremin", "Hz", "Theremín"],
  ["cargas", "r =", "Cargas"],
  ["estados", "°C", "Estados de la materia"],
  ["ojo", "Pupila", "Ojo"],
  ["cientifico", "Manos", "Modo científico"],
]) {
  await ir(id);
  await pagina.mouse.move(1100, 300, { steps: 4 });
  await espera(2500);
  comprobar((await stats()).includes(texto), `${nombre}: muestra datos en vivo`);
  await captura(`6-${id}`);
}

await ir("rayosx");
await espera(2500);
comprobar(await pagina.evaluate(() => document.body.classList.contains("rayosx")), "Rayos X: cámara en modo radiografía");
await captura("7-rayosx");
await ir(null);
comprobar(!(await pagina.evaluate(() => document.body.classList.contains("rayosx"))), "Rayos X: se limpia al salir");

await ir("quiz");
await espera(1000);
await pagina.click(".botonera button:first-child");
await espera(800);
comprobar(/Correcto|Incorrecto/.test(await pagina.textContent("#aviso")), "Quiz: respuesta evaluada");
await captura("8-quiz");

// ---------- Partida completa de moléculas ----------
await ir("moleculas");
await espera(600);

// Posiciones en pantalla de los átomos sueltos y del centro de la molécula.
const leer = () =>
  pagina.evaluate(() => {
    const e = window.__lab.modo.estado;
    const { mundoAPantalla } = window.__lab.ctx;
    return {
      fase: e.fase,
      indice: e.indice,
      centro: mundoAPantalla(e.molecula.position),
      sueltos: e.sueltos.map((a) => ({ simbolo: a.userData.simbolo, ...mundoAPantalla(a.position) })),
    };
  });

async function arrastrar(desde, hasta) {
  await pagina.mouse.move(desde.x, desde.y, { steps: 3 });
  await espera(80);
  await pagina.mouse.down();
  await espera(150);
  await pagina.mouse.move(hasta.x, hasta.y, { steps: 12 });
  await espera(300);
  await pagina.mouse.up();
  await espera(250);
}

const LIGANDO = { 0: "H", 1: "O", 2: "H", 3: "H" };
for (let reto = 0; reto < 4; reto++) {
  let estado = await leer();
  // Primero un átomo equivocado: debe rechazarse.
  const malo = estado.sueltos.find((a) => a.simbolo !== LIGANDO[reto]);
  await arrastrar(malo, estado.centro);
  const aviso = await pagina.textContent("#aviso");
  if (!aviso.includes("no va aquí")) errores.push(`Reto ${reto}: no se rechazó el átomo ${malo.simbolo}`);

  for (let intento = 0; intento < 15 && (estado = await leer()).fase === "jugando"; intento++) {
    const bueno = estado.sueltos.find((a) => a.simbolo === LIGANDO[reto]);
    if (!bueno) { errores.push(`Reto ${reto}: no quedan átomos ${LIGANDO[reto]}`); break; }
    await arrastrar(bueno, estado.centro);
  }
  await espera(900);
  await captura(`2-molecula-${reto + 1}`);
  console.log(`✔ Reto ${reto + 1} completado (fase: ${estado.fase})`);
  if (reto < 3) {
    for (let t = 0; t < 120 && (await leer()).indice !== reto + 1; t++) await espera(500);
    await espera(400);
  }
}
// Final: tarjetas con puntos y nombre de científico/a en el ranking.
for (let t = 0; t < 120 && (await leer()).fase !== "final"; t++) await espera(1000);
await espera(1000);
await captura("3-final");
const logro = await pagina.textContent(".tarjeta.logro");
comprobar(/pts/.test(logro) && /#\d+/.test(logro), "Moléculas: puntaje registrado en el ranking");

await pagina.keyboard.press("Escape");
await espera(500);
const enMenu = await pagina.isVisible("#menu");
console.log(enMenu ? "✔ Esc vuelve al menú" : "✘ Esc no volvió al menú");
comprobar((await pagina.textContent("#menu-ranking")).includes("pts"), "Menú: muestra el ranking del día");
await captura("9-menu-ranking");

// Pantalla de bienvenida: sin ?prueba aparece tras 20 s sin nadie frente a la cámara.
await pagina.goto(URL.replace("?prueba", ""));
await pagina.waitForSelector("#carga.oculto", { state: "attached", timeout: 60000 });
await espera(24000);
comprobar(await pagina.isVisible("#bienvenida"), "Bienvenida: aparece cuando nadie juega");
comprobar((await pagina.textContent("#bienvenida-ranking")).includes("pts"), "Bienvenida: muestra el ranking");
await captura("10-bienvenida");
await pagina.mouse.move(400, 400);
await pagina.mouse.move(800, 500, { steps: 5 });
await espera(1500);
comprobar(!(await pagina.isVisible("#bienvenida")) && (await pagina.isVisible("#menu")), "Bienvenida: se quita al detectar a alguien");

await navegador.close();
if (errores.length) {
  console.error("\n✘ Errores:\n" + errores.join("\n"));
  process.exit(1);
}
console.log(`\n✅ Todo bien. Capturas en ${CAPTURAS}/`);
