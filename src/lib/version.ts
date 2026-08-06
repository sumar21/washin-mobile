// Versión de la app para el FRONT. Es solo un reexport: la fuente única es api/_lib/version.ts
// (ahí está el formato y cómo se bumpea en cada release).
//
// Vite la inlinea en el bundle en tiempo de compilación, así que es la versión del bundle que el
// técnico tiene cacheado en el celular (la mobile es una PWA). Esa es la gracia: si alguna vez se
// pidiera a la API, mostraría siempre la última y nunca delataría un cliente sin actualizar.
export { APP_VERSION } from "../../api/_lib/version";
