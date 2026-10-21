// Funciones puras sobre los 21 puntos de una mano (coordenadas normalizadas 0..1).
// Índices: 0 muñeca · 4 pulgar · 8 índice · 12 medio · 16 anular · 20 meñique.

let aspecto = 16 / 9; // ancho/alto del video, para medir distancias reales

export function fijarAspecto(valor) {
  if (valor > 0) aspecto = valor;
}

export function distancia(a, b) {
  return Math.hypot((a.x - b.x) * aspecto, a.y - b.y);
}

export function puntoMedio(a, b) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
}

export function tamanoMano(lm) {
  return distancia(lm[0], lm[9]);
}

// Separación pulgar–índice relativa al tamaño de la mano (independiente de la distancia a la cámara).
export function aperturaPinza(lm) {
  return distancia(lm[4], lm[8]) / tamanoMano(lm);
}

// Con histéresis para que el pellizco no parpadee en el límite.
export function estaPellizcando(lm, antes) {
  const apertura = aperturaPinza(lm);
  return antes ? apertura < 0.45 : apertura < 0.28;
}

export function dedoExtendido(lm, punta) {
  return distancia(lm[punta], lm[0]) > distancia(lm[punta - 2], lm[0]) * 1.1;
}

export function manoAbierta(lm) {
  return [8, 12, 16, 20].every((punta) => dedoExtendido(lm, punta));
}

export function esPuno(lm) {
  return [8, 12, 16, 20].every((punta) => !dedoExtendido(lm, punta));
}

// 👍 / 👎: cuatro dedos doblados y el pulgar claramente arriba o abajo de los nudillos.
export function pulgar(lm) {
  if (!esPuno(lm)) return null;
  const margen = 0.35 * tamanoMano(lm);
  const nudillos = [5, 9, 13, 17].map((i) => lm[i].y);
  if (lm[4].y < Math.min(...nudillos) - margen) return "arriba";
  if (lm[4].y > Math.max(...nudillos) + margen) return "abajo";
  return null;
}

export function nombreGesto(lm, pellizco) {
  if (pellizco) return "🤏 Pellizco";
  const [indice, medio, anular, menique] = [8, 12, 16, 20].map((p) => dedoExtendido(lm, p));
  if (indice && medio && anular && menique) return "✋ Mano abierta";
  if (!indice && !medio && !anular && !menique) {
    const p = pulgar(lm);
    return p === "arriba" ? "👍 Pulgar arriba" : p === "abajo" ? "👎 Pulgar abajo" : "✊ Puño";
  }
  if (indice && medio && !anular && !menique) return "✌️ Paz";
  if (indice && !medio && !anular && !menique) return "☝️ Apuntando";
  if (indice && menique && !medio && !anular) return "🤘 Rock";
  return "🖐️ Mano";
}

// Filtro exponencial: alfa alto = responde rápido, alfa bajo = más suave.
export function suavizar(previos, nuevos, alfa) {
  if (!previos) return nuevos.map(({ x, y, z }) => ({ x, y, z }));
  return nuevos.map((p, i) => ({
    x: previos[i].x + (p.x - previos[i].x) * alfa,
    y: previos[i].y + (p.y - previos[i].y) * alfa,
    z: previos[i].z + (p.z - previos[i].z) * alfa,
  }));
}
