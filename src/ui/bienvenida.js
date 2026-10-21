// Pantalla de bienvenida: aparece cuando nadie juega, con un átomo 3D,
// datos curiosos y el ranking del día para atraer visitantes al stand.
import * as THREE from "three";
import { liberar } from "../escena/escena.js";
import { crearPanelRanking } from "./ranking.js";
import gravedad from "../contenido/gravedad.json";
import theremin from "../contenido/theremin.json";
import cargas from "../contenido/cargas.json";
import moleculas from "../contenido/moleculas.json";
import estados from "../contenido/estados.json";
import rayosx from "../contenido/rayosx.json";
import ojo from "../contenido/ojo.json";
import cientifico from "../contenido/cientifico.json";

const DATOS = [
  ...[gravedad, theremin, cargas, estados, rayosx, ojo, cientifico].flatMap((c) => c.datos),
  ...["H2O", "CO2", "CH4", "NH3"].flatMap((id) => moleculas[id].datos),
];
const CADA_DATO = 7; // s

function crearAtomo() {
  const atomo = new THREE.Group();
  const nucleo = new THREE.Group();
  for (let i = 0; i < 7; i++) {
    const particula = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 20, 12),
      new THREE.MeshStandardMaterial({ color: i % 2 ? 0xff4d4d : 0x4d7cff, emissive: i % 2 ? 0x661111 : 0x112266 }),
    );
    particula.position.randomDirection().multiplyScalar(0.3);
    nucleo.add(particula);
  }
  atomo.add(nucleo);

  const electrones = [];
  [0, Math.PI / 3, -Math.PI / 3].forEach((giro, i) => {
    const orbita = new THREE.Group();
    // Primero se inclina y luego se gira en el plano de la pantalla: el clásico símbolo del átomo.
    orbita.rotation.order = "ZYX";
    orbita.rotation.set(1.2, 0, giro);
    orbita.add(new THREE.Mesh(
      new THREE.TorusGeometry(2.6, 0.02, 8, 96),
      new THREE.MeshBasicMaterial({ color: 0x5ef2ff, transparent: true, opacity: 0.6 }),
    ));
    const electron = new THREE.Mesh(
      new THREE.SphereGeometry(0.14, 16, 10),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    electron.userData.angulo = (i * Math.PI * 2) / 3;
    orbita.add(electron);
    electrones.push(electron);
    atomo.add(orbita);
  });
  atomo.userData = { nucleo, electrones };
  return atomo;
}

export function crearBienvenida({ escena, menu, modos }) {
  const pantalla = document.getElementById("bienvenida");
  const dato = document.getElementById("bienvenida-dato");
  const panel = crearPanelRanking(document.getElementById("bienvenida-ranking"), modos);
  let atomo = null;
  let tiempoDato = 0;
  let indiceDato = Math.floor(Math.random() * DATOS.length);

  const mostrarDato = () => {
    indiceDato = (indiceDato + 1) % DATOS.length;
    dato.textContent = DATOS[indiceDato];
  };

  const api = {
    visible: false,

    mostrar() {
      if (api.visible) return;
      api.visible = true;
      menu.ocultar();
      pantalla.classList.remove("oculto");
      atomo = crearAtomo();
      atomo.position.set(0, -0.2, -1);
      escena.add(atomo);
      mostrarDato();
      panel.pintar();
    },

    ocultar() {
      if (!api.visible) return;
      api.visible = false;
      pantalla.classList.add("oculto");
      liberar(atomo);
      atomo = null;
      menu.mostrar();
    },

    actualizar(dt) {
      if (!api.visible) return;
      const { nucleo, electrones } = atomo.userData;
      atomo.rotation.y += dt * 0.35;
      nucleo.rotation.x += dt * 0.8;
      for (const electron of electrones) {
        electron.userData.angulo += dt * 2.2;
        electron.position.set(Math.cos(electron.userData.angulo) * 2.6, Math.sin(electron.userData.angulo) * 2.6, 0);
      }
      tiempoDato += dt;
      if (tiempoDato > CADA_DATO) {
        tiempoDato = 0;
        mostrarDato();
      }
      panel.actualizar(dt);
    },
  };
  return api;
}
