// ¿Cómo ve el ojo?: un ojo 3D que te mira, abre la pupila con poca luz, parpadea contigo
// y un corte lateral muestra cómo el cristalino enfoca según tu distancia.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearEtiqueta } from "../escena/efectos.js";
import { listaRetos } from "../ui/hud.js";
import { puntosPorTiempo } from "../ui/ranking.js";
import contenido from "../contenido/ojo.json";

const V = THREE.Vector3;
const RADIO_OJO = 1.8;
const MM_A_MUNDO = 0.075; // pupila de 8 mm = 0.6 unidades

let e = null;

// Brillo promedio de la cámara (0 = oscuro, 1 = muy iluminado).
const lienzoLuz = document.createElement("canvas");
lienzoLuz.width = 32;
lienzoLuz.height = 18;
const pincelLuz = lienzoLuz.getContext("2d", { willReadFrequently: true });
function medirLuz(video) {
  if (video.readyState < 2) return null;
  pincelLuz.drawImage(video, 0, 0, 32, 18);
  const datos = pincelLuz.getImageData(0, 0, 32, 18).data;
  let suma = 0;
  for (let i = 0; i < datos.length; i += 4) suma += 0.2126 * datos[i] + 0.7152 * datos[i + 1] + 0.0722 * datos[i + 2];
  return suma / (datos.length / 4) / 255;
}

function texturaIris() {
  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = 256;
  const g = lienzo.getContext("2d");
  const degradado = g.createRadialGradient(128, 128, 20, 128, 128, 128);
  degradado.addColorStop(0, "#1b3f7a");
  degradado.addColorStop(0.6, "#3a7bd5");
  degradado.addColorStop(1, "#0d2147");
  g.fillStyle = degradado;
  g.fillRect(0, 0, 256, 256);
  g.strokeStyle = "rgba(160, 220, 255, 0.35)";
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2;
    g.beginPath();
    g.moveTo(128 + Math.cos(a) * 30, 128 + Math.sin(a) * 30);
    g.lineTo(128 + Math.cos(a) * 124, 128 + Math.sin(a) * 124);
    g.stroke();
  }
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

function crearOjo() {
  const ojo = new THREE.Group();
  const esclerotica = new THREE.Mesh(
    new THREE.SphereGeometry(RADIO_OJO, 48, 32),
    new THREE.MeshStandardMaterial({ color: 0xf7f3ee, roughness: 0.35 }),
  );
  const iris = new THREE.Mesh(new THREE.CircleGeometry(0.78, 48), new THREE.MeshStandardMaterial({ map: texturaIris() }));
  iris.position.z = RADIO_OJO + 0.01;
  const pupila = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ color: 0x000000 }));
  pupila.position.z = RADIO_OJO + 0.02;
  const cornea = new THREE.Mesh(
    new THREE.SphereGeometry(0.95, 32, 16, 0, Math.PI * 2, 0, Math.PI / 3),
    new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.12, roughness: 0, metalness: 0.2 }),
  );
  cornea.rotation.x = Math.PI / 2;
  cornea.position.z = RADIO_OJO - 0.6;

  // Párpados: dos medias esferas que giran para cerrarse.
  const piel = new THREE.MeshStandardMaterial({ color: 0xd9a77a, roughness: 0.8, side: THREE.DoubleSide });
  const superior = new THREE.Mesh(new THREE.SphereGeometry(RADIO_OJO + 0.06, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), piel);
  const inferior = new THREE.Mesh(
    new THREE.SphereGeometry(RADIO_OJO + 0.05, 48, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
    piel,
  );

  const globo = new THREE.Group(); // lo que gira para mirarte
  globo.add(esclerotica, iris, pupila, cornea);
  ojo.add(globo, superior, inferior);
  ojo.userData = { globo, pupila, superior, inferior };
  return ojo;
}

function crearCorte(capa, centro) {
  const corte = new THREE.Group();
  corte.position.copy(centro);
  const linea = (puntos, color) => {
    const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(puntos), new THREE.LineBasicMaterial({ color }));
    corte.add(l);
    return l;
  };
  const arco = (cx, r, desde, hasta) =>
    Array.from({ length: 41 }, (_, i) => {
      const a = THREE.MathUtils.degToRad(desde + ((hasta - desde) * i) / 40);
      return new V(cx + Math.cos(a) * r, Math.sin(a) * r, 0);
    });

  linea(arco(0, 1.6, 0, 360), 0xdddddd); // globo ocular
  linea(arco(-1.0, 0.75, 130, 230), 0x9fd8ff); // córnea
  const retina = new THREE.Mesh(
    new THREE.TorusGeometry(1.6, 0.05, 8, 40, THREE.MathUtils.degToRad(100)),
    new THREE.MeshBasicMaterial({ color: 0xff6b6b }),
  );
  retina.rotation.z = THREE.MathUtils.degToRad(-50);
  const cristalino = new THREE.Mesh(
    new THREE.CircleGeometry(0.55, 40),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.6 }),
  );
  cristalino.position.x = -0.95;
  corte.add(retina, cristalino);

  const objeto = linea([new V(), new V()], 0xffe66b);
  const etiquetaObjeto = crearEtiqueta("Objeto", { tamano: 0.32 });
  corte.add(etiquetaObjeto);
  const imagen = linea([new V(1.5, 0, 0), new V(1.5, -0.35, 0)], 0xffe66b);
  const rayos = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(12 * 3), 3)),
    new THREE.LineBasicMaterial({ color: 0xfff3a0, transparent: true, opacity: 0.8 }),
  );
  corte.add(rayos);

  const etiquetas = [
    ["Córnea", -1.9, 1.0],
    ["Cristalino", -0.95, -0.85],
    ["Retina", 2.05, 0.9],
    ["Imagen al revés", 1.6, -0.75],
  ];
  for (const [texto, x, y] of etiquetas) {
    const etiqueta = crearEtiqueta(texto, { tamano: 0.32 });
    etiqueta.position.set(x, y, 0);
    corte.add(etiqueta);
  }
  capa.add(corte);
  return { corte, cristalino, objeto, etiquetaObjeto, imagen, rayos };
}

function actualizarCorte(cercania) {
  const { cristalino, objeto, etiquetaObjeto, rayos } = e.corte;
  cristalino.scale.x = 0.25 + 0.4 * cercania; // más grueso para enfocar de cerca
  const x = -1.9 - (2.6 - 1.8 * cercania); // el objeto se acerca contigo
  etiquetaObjeto.position.set(x, 1.1, 0);
  const punta = new V(x, 0.8, 0);
  objeto.geometry.setFromPoints([new V(x, 0, 0), punta, new V(x - 0.15, 0.6, 0), punta, new V(x + 0.15, 0.6, 0)]);

  const foco = new V(1.5, -0.35, 0);
  const pos = rayos.geometry.attributes.position;
  [0.45, 0, -0.45].forEach((y, i) => {
    const lente = new V(-0.95, y * 0.9, 0);
    pos.setXYZ(i * 4, punta.x, punta.y, 0);
    pos.setXYZ(i * 4 + 1, lente.x, lente.y, 0);
    pos.setXYZ(i * 4 + 2, lente.x, lente.y, 0);
    pos.setXYZ(i * 4 + 3, foco.x, foco.y, 0);
  });
  pos.needsUpdate = true;
}

export default {
  id: "ojo",
  zona: "biologia",
  icono: "👁️",
  titulo: "¿Cómo ve el ojo?",
  descripcion: "Pupila, cristalino y retina en acción",
  necesita: { cara: true },

  iniciar(ctx) {
    const { vista } = ctx;
    e = {
      inicio: performance.now(),
      capa: new THREE.Group(),
      luz: 0.5,
      pupilaMm: 4,
      cercania: 0,
      cierre: 0,
      medirEn: 0,
      parpadeoAuto: 4,
      retos: { pupila: false, cristalino: false, parpadeo: false },
      completado: false,
    };
    ctx.escena.add(e.capa);
    e.ojo = crearOjo();
    e.ojo.position.set(-vista.mundoAncho * 0.2, -0.5, 0);
    e.capa.add(e.ojo);
    e.corte = crearCorte(e.capa, new V(vista.mundoAncho * 0.22, -0.5, 0));

    ctx.hud.modo(this.titulo, "✋ Tapa la cámara con la mano · 🚶 Acércate y aléjate · 😉 Parpadea");
  },

  actualizar(ctx, dt) {
    const cara = ctx.cara?.faceLandmarks?.[0];

    // Luz: se mide unas 7 veces por segundo. Sin cámara, mantener clic = oscuridad.
    e.medirEn -= dt;
    if (e.medirEn <= 0) {
      e.medirEn = 0.15;
      const luz = medirLuz(ctx.video);
      e.luz = luz ?? (ctx.manos.some((m) => m.raton && m.pellizco) ? 0.02 : 0.5);
    }
    const oscuridad = 1 - THREE.MathUtils.clamp((e.luz - 0.08) / 0.45, 0, 1);
    e.pupilaMm += (2 + 6 * oscuridad - e.pupilaMm) * Math.min(1, dt * 3);
    e.ojo.userData.pupila.scale.setScalar(e.pupilaMm * MM_A_MUNDO);

    // Distancia: el ancho de la cara (mejillas 234–454) crece al acercarte.
    if (cara) {
      const ancho = Math.hypot((cara[454].x - cara[234].x) * (16 / 9), cara[454].y - cara[234].y);
      e.cercania += (THREE.MathUtils.clamp((ancho - 0.25) / 0.35, 0, 1) - e.cercania) * Math.min(1, dt * 4);
    }
    actualizarCorte(e.cercania);

    // El ojo te sigue con la mirada (cara o, si no hay, la mano).
    const objetivo = cara ? ctx.normAMundo(cara[1].x, cara[1].y) : ctx.manos[0]?.punta;
    const { globo, superior, inferior } = e.ojo.userData;
    if (objetivo) {
      const dx = objetivo.x - e.ojo.position.x;
      const dy = objetivo.y - e.ojo.position.y;
      globo.rotation.y += (THREE.MathUtils.clamp(dx * 0.1, -0.5, 0.5) - globo.rotation.y) * 0.15;
      globo.rotation.x += (THREE.MathUtils.clamp(-dy * 0.1, -0.4, 0.4) - globo.rotation.x) * 0.15;
    }

    // Parpadeo: copia el tuyo; sin cara, parpadea solo de vez en cuando.
    const expresiones = ctx.cara?.faceBlendshapes?.[0]?.categories;
    let cierre = 0;
    if (expresiones) {
      const valor = (nombre) => expresiones.find((c) => c.categoryName === nombre)?.score ?? 0;
      cierre = THREE.MathUtils.clamp(((valor("eyeBlinkLeft") + valor("eyeBlinkRight")) / 2 - 0.25) / 0.4, 0, 1);
      if (cierre > 0.7) e.retos.parpadeo = true;
    } else {
      e.parpadeoAuto -= dt;
      if (e.parpadeoAuto < 0) cierre = 1;
      if (e.parpadeoAuto < -0.15) e.parpadeoAuto = 3 + Math.random() * 3;
    }
    e.cierre += (cierre - e.cierre) * Math.min(1, dt * 18);
    superior.rotation.x = -1.25 * (1 - e.cierre);
    inferior.rotation.x = 1.0 * (1 - e.cierre);

    if (e.pupilaMm > 6.5) e.retos.pupila = true;
    if (e.cercania > 0.7) e.retos.cristalino = true;
    if (!e.completado && Object.values(e.retos).every(Boolean)) {
      e.completado = true;
      ctx.sonido.exito();
      ctx.terminar({
        logro: ["¡Entendiste cómo ves!", "La pupila regula la luz, el cristalino enfoca y la retina capta la imagen."],
        dato: ["¿Sabías que…?", contenido.datos[Math.floor(Math.random() * contenido.datos.length)]],
        carrera: ["Si te gustó, estudia:", contenido.carreras],
      }, puntosPorTiempo((performance.now() - e.inicio) / 1000, 1000));
    }

    ctx.hud.stats(
      `👁️ Pupila: ${e.pupilaMm.toFixed(1)} mm · 💡 Luz: ${Math.round(e.luz * 100)} % · ` +
        `🔍 Cristalino: ${e.cercania > 0.5 ? "grueso (ves de cerca)" : "delgado (ves de lejos)"}<br>` +
        listaRetos([
          ["Pupila abierta (tapa la cámara)", e.retos.pupila],
          ["Enfoca de cerca (acércate)", e.retos.cristalino],
          ["Parpadea", e.retos.parpadeo],
        ]),
    );
  },

  detener() {
    liberar(e.capa);
    e = null;
  },
};
