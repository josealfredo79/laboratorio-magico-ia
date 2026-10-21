import { defineConfig } from "vite";

// La app corre local en la feria: el tamaño del bundle no importa.
export default defineConfig({
  build: { chunkSizeWarningLimit: 2000 },
});
