// Efectos de sonido con Tone.js. El navegador exige un clic antes de sonar,
// salvo que Chrome se abra con --autoplay-policy=no-user-gesture-required.
import * as Tone from "tone";

let sinte = null;

function listo() {
  if (Tone.getContext().state !== "running") return false;
  sinte ??= new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "triangle" },
    envelope: { attack: 0.005, decay: 0.15, sustain: 0.1, release: 0.4 },
  }).toDestination();
  sinte.volume.value = -8;
  return true;
}

function tocar(notas, duracion = "16n", separacion = 0.08) {
  if (!listo()) return;
  const ahora = Tone.now();
  notas.forEach((nota, i) => sinte.triggerAttackRelease(nota, duracion, ahora + i * separacion));
}

const despertar = () => Tone.start().catch(() => {});
addEventListener("pointerdown", despertar);
addEventListener("keydown", despertar);
despertar();

export const sonidoActivo = () => Tone.getContext().state === "running";

export const sonido = {
  chispa: () => tocar(["C7", "G6", "C7"], "32n", 0.03),
  acierto: () => tocar(["E5", "A5"]),
  agarrar: () => tocar(["C5"]),
  soltar: () => tocar(["G4"]),
  enlace: () => tocar(["E5", "G5"]),
  error: () => tocar(["C3", "B2"], "8n", 0.12),
  exito: () => tocar(["C5", "E5", "G5", "C6"], "8n", 0.1),
  click: () => tocar(["A5"]),
};
