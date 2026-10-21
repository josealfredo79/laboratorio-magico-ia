# 🧪 Laboratorio Mágico IA

App web interactiva para ferias vocacionales: **la cámara web reconoce tus manos, cara y cuerpo** con inteligencia artificial y juegas con **física, química y biología en 3D**. Cada actividad termina mostrando un dato curioso y las **carreras universitarias** relacionadas.

Funciona **sin internet** y sin tocar nada: se controla con gestos.

## Actividades

| Zona | Actividad | Cómo se juega |
|---|---|---|
| ⚛️ Física | 🪐 Gravedad en otros planetas | Lanza una pelota y encesta en la Tierra, Luna, Marte y Júpiter |
| ⚛️ Física | 🎵 Theremín de ondas | Haz música moviendo las manos: frecuencia y volumen |
| ⚛️ Física | ⚡ Cargas eléctricas | Tus manos son cargas + y −: líneas de campo y chispas |
| 🧪 Química | 🔬 Constructor de moléculas | Pellizca átomos y forma H₂O, CO₂, CH₄ y NH₃ en 3D |
| 🧪 Química | 🌡️ Estados de la materia | Separa las manos para calentar: sólido → líquido → gas |
| 🫀 Biología | 🦴 Rayos X | Tu esqueleto sobre tu cuerpo; señala tus huesos |
| 🫀 Biología | 👁️ ¿Cómo ve el ojo? | Pupila, cristalino y retina reaccionan a ti |
| 🤖 IA | 🔬 ¿Cómo me ve la IA? | Los 21 puntos de tu mano y 478 de tu cara en vivo |
| 🤖 IA | ❓ Quiz científico | Verdadero o falso con 👍 / 👎 |
| 🎮 Arcade | ⚔️ Ninja de Elementos | Corta átomos con el dedo y forma compuestos: vidas, combos, poderes, 3 niveles, insignias y duelo de 2 jugadores |

Incluye ranking del día, pantalla de bienvenida automática y modo quiosco para el stand.

## Tecnologías

[Three.js](https://threejs.org) (3D) · [MediaPipe Tasks Vision](https://ai.google.dev/edge/mediapipe/solutions/vision) (manos, cara y cuerpo) · [Tone.js](https://tonejs.github.io) (sonido) · [Vite](https://vite.dev)

## Cómo correrlo

Requiere Node.js 20+ y Chrome con cámara web.

```bash
npm install
npm run modelos   # descarga los modelos de IA (una sola vez)
npm run dev       # abre http://localhost:5173
```

Sin cámara, el ratón funciona como mano (clic sostenido = pellizco).

**Teclas:** `1`–`9` y `0` actividades · `Esc` menú · `F` FPS · `R` reiniciar ranking.

**Día de la feria:** ver [`feria/LEEME.md`](feria/LEEME.md).
