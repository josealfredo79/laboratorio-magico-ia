// Registro de actividades en el orden del menú (y de las teclas 1–9 y 0).
// Un modo con `proximamente: true` aparece bloqueado en el menú.
import gravedad from "./gravedad.js";
import theremin from "./theremin.js";
import cargas from "./cargas.js";
import moleculas from "./moleculas.js";
import estados from "./estados.js";
import rayosx from "./rayosx.js";
import ojo from "./ojo.js";
import cientifico from "./cientifico.js";
import quiz from "./quiz.js";
import ninja from "./ninja.js";

export const MODOS = [gravedad, theremin, cargas, moleculas, estados, rayosx, ojo, cientifico, quiz, ninja];

export const DISPONIBLES = MODOS.filter((m) => !m.proximamente);
