// Efectos visuales reutilizables.
import * as THREE from "three";
import { liberar } from "./escena.js";

// Explosión de partículas de colores. actualizar(dt) devuelve false cuando terminó.
export function crearExplosion(padre, posicion, colores = [0x5ef2ff, 0xff5ec8, 0xffe66b], cantidad = 220) {
  const posiciones = new Float32Array(cantidad * 3);
  const coloresAttr = new Float32Array(cantidad * 3);
  const velocidades = [];
  const color = new THREE.Color();
  for (let i = 0; i < cantidad; i++) {
    posiciones.set([posicion.x, posicion.y, posicion.z], i * 3);
    color.set(colores[i % colores.length]);
    coloresAttr.set([color.r, color.g, color.b], i * 3);
    velocidades.push(new THREE.Vector3().randomDirection().multiplyScalar(2 + Math.random() * 5));
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute("position", new THREE.BufferAttribute(posiciones, 3));
  geometria.setAttribute("color", new THREE.BufferAttribute(coloresAttr, 3));
  const material = new THREE.PointsMaterial({
    size: 0.16, vertexColors: true, transparent: true,
    blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const puntos = new THREE.Points(geometria, material);
  padre.add(puntos);

  let vida = 1.6;
  return {
    actualizar(dt) {
      vida -= dt;
      for (let i = 0; i < cantidad; i++) {
        const v = velocidades[i];
        v.y -= 3 * dt;
        v.multiplyScalar(1 - 1.2 * dt);
        posiciones[i * 3] += v.x * dt;
        posiciones[i * 3 + 1] += v.y * dt;
        posiciones[i * 3 + 2] += v.z * dt;
      }
      geometria.attributes.position.needsUpdate = true;
      material.opacity = Math.max(vida / 1.6, 0);
      if (vida <= 0) liberar(puntos);
      return vida > 0;
    },
  };
}

// Sprite con texto (letras de átomos, nombres de partes, etc.). Se ensancha según el texto.
export function crearEtiqueta(texto, { color = "#ffffff", fondo = null, tamano = 1 } = {}) {
  const fuente = "bold 76px 'Segoe UI', system-ui, sans-serif";
  const lienzo = document.createElement("canvas");
  const g = lienzo.getContext("2d");
  g.font = fuente;
  lienzo.width = Math.max(128, Math.ceil(g.measureText(texto).width + 40));
  lienzo.height = 128;
  if (fondo) {
    g.fillStyle = fondo;
    g.beginPath();
    g.arc(64, 64, 60, 0, Math.PI * 2);
    g.fill();
  }
  g.font = fuente;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineWidth = 8;
  g.strokeStyle = color === "#ffffff" ? "rgba(0,0,0,0.65)" : "rgba(255,255,255,0.8)";
  g.strokeText(texto, lienzo.width / 2, 68);
  g.fillStyle = color;
  g.fillText(texto, lienzo.width / 2, 68);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, depthTest: false }));
  sprite.scale.set((tamano * lienzo.width) / 128, tamano, 1);
  sprite.renderOrder = 10;
  return sprite;
}
