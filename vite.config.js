import { defineConfig } from "vite";

export default defineConfig({
  // Rutas relativas: funciona igual en localhost y en GitHub Pages (/laboratorio-magico-ia/).
  base: "./",
  // La app corre local en la feria: el tamaño del bundle no importa.
  build: { chunkSizeWarningLimit: 2000 },
});
