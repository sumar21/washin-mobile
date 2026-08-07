// Match tolerante del nombre del técnico para el FRONT. Es solo un reexport: la fuente única es
// api/_lib/tecnico.ts (ahí está el porqué y los casos que cubre), igual que src/lib/version.ts.
//
// Existe para que el gate de la UI (¿este incidente/ventilación es mío?) use EXACTAMENTE el mismo
// criterio que el scoping del backend. Si el front comparara más estricto, el backend traería el
// incidente y la pantalla lo mostraría sin botones — el técnico lo ve y no lo puede tocar.
// El módulo no tiene imports ni side effects, así que Vite lo inlinea sin arrastrar nada del api/.
export { mismoTecnico, variantesNombreTecnico } from "../../api/_lib/tecnico";
