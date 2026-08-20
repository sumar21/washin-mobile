import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // ⚠️ INVARIANTE: HOY ESTA APP NO SE RECARGA SOLA. NO ROMPERLA.
      //
      // "autoUpdate" suena a que el service worker recarga la página al detectar un deploy, pero
      // con esta configuración NO lo hace: el `window.location.reload()` de autoUpdate vive en
      // `virtual:pwa-register` (node_modules/vite-plugin-pwa/dist/client/build/register.js:38-42)
      // y ese módulo SOLO entra al bundle si alguien lo importa. Como nadie lo importa,
      // `injectRegister:"auto"` se resuelve a "script" (dist/index.js:509-510) y se inyecta el
      // registerSW.js simple (dist/index.js:182-193), que es un `navigator.serviceWorker.register`
      // pelado: sin listeners, sin `controllerchange`, sin reload.
      //
      // Lo que "autoUpdate" SÍ hace acá es forzar `skipWaiting` + `clientsClaim`
      // (dist/index.js:1003-1006): el SW nuevo toma control de la pestaña abierta EN SILENCIO,
      // sin recargarla. El bundle viejo sigue corriendo con el estado de React intacto y el
      // código nuevo entra recién en el próximo arranque de la página.
      //
      // Consecuencia: el día que alguien importe `virtual:pwa-register` (p. ej. para agregar el
      // toast de "hay una versión nueva"), se enciende ese reload incondicional y un técnico con
      // el formulario a medio llenar lo pierde entero. Si hace falta forzar la actualización, la
      // forma segura es `registerType:"prompt"` + llamar a `updateServiceWorker()` SOLO con el
      // formulario limpio. El guard está en src/lib/pwa-sin-reload.test.ts.
      //
      // (La versión que corre el técnico se ve en el login — src/lib/version.ts —, que es la
      // señal para saber si actualizó.)
      registerType: "autoUpdate",
      includeAssets: ["logo-washinn.jpg", "favicon.ico"],
      manifest: {
        name: "Washinn",
        short_name: "Washinn",
        description: "Gestión de mantenimiento técnico Wash-Inn",
        theme_color: "#0a66c2",
        background_color: "#ffffff",
        display: "standalone",
        orientation: "portrait",
        start_url: "/",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true,
    // Para desarrollo full-stack: corré `vercel dev` (sirve las funciones de /api
    // en el puerto 3000) y `npm run dev` aparte; este proxy enruta /api hacia él.
    // Alternativamente, usá solo `vercel dev`.
    proxy: {
      "/api": {
        target: process.env.VITE_API_PROXY || "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
});
