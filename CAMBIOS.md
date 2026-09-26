# Cambios — rama `Mimo-V2.6-Pro`

Mejoras sobre `master`, en 4 pasos. Sin cambios de gameplay.

## 1. Estabilidad
- Fugas de memoria GPU: se liberan geometrías, materiales y texturas de unidades, partículas y nameplates; `dispose()` completo al cerrar.
- La curación ya no deja el tinte verde permanente en el personaje.
- Las animaciones se encolan (nunca se pierde un callback) y los turnos se reintentan en vez de perderse.
- Nameplates memoizados, clave de tirada unificada entre el dado 3D y el texto, `dt` con límite, resize con debounce y `localStorage` protegido.

## 2. i18n y render único
- El log del combate ahora es dato traducible (`logKey` + parámetros): pasa de `unit.criminal → unit.shambler (6)` a `Criminal golpea a Tambaleante por 6`.
- Una interacción renderiza una vez (antes 2-3).
- Números de balance en `game/balance.ts`; el "20%" de la wiki sale de la constante real.

## 3. Accesibilidad
- El foco de teclado sobrevive a los re-renders; `aria-live` en turno y log; iconos ocultos a lectores.
- Enter/Space respetan el botón enfocado, se ignoran modificadores y repeticiones.
- Foco visible en todos los botones, `prefers-reduced-motion` y `lang` del documento dinámico.

## 4. Limpieza y rendimiento
- RNG y texturas de canvas compartidas (`src/util/`), hex grid con 4 materiales en vez de 36.
- Audio con buffer de ruido cacheado, nodos desconectados y música con ruta según `BASE_URL`.
- Código muerto eliminado y `userData` de picking tipado.

**Verificación:** `npm run build` limpio y partida probada en navegador (título → despliegue → combate con teclado, dados, turnos enemigos, wiki e idiomas), sin errores de consola.
