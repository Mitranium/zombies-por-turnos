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

---

# Cambios — rama `GLM-5.3-Max`

Mejoras sobre `master` (post `Mimo-V2.6-Pro`), en 4 pasos.

## 1. Gameplay
- **Golpes críticos**: si todos los dados caen en su cara máxima, el total de los dados cuenta el doble. Es simétrico (zombis y supervivientes) y se ve en el log (`log.crit` / `log.specialCrit`), en el overlay de dados (tag dorado `¡CRIT!`) y en un burst cómic más grande con más shake de cámara. La wiki explica la regla.

## 2. Estabilidad
- Restauración desde bfcache: `pagehide` destruye la escena 3D; si el navegador restaura la página (botón atrás), ahora se recarga en limpio en vez de quedar una pantalla muerta congelada.
- La música de fondo se pausa cuando la pestaña queda oculta y se reanuda al volver (solo si sonaba).

## 3. UI/UX
- El despliegue muestra la composición exacta de la oleada entrante (misma fuente de datos que `buildWave`) y el nivel de refuerzo de la ronda.
- El log de combate apila una línea por entrada y destaca la más reciente (antes era un blob unido con "·").
- Tras los turnos enemigos el foco de teclado vuelve al botón Atacar, así Enter siempre confirma algo.
- Fix de carrera: el texto del resultado del dado ("= 9 · 18 DAÑO") nunca llegaba a verse: el dado 3D asienta unos milisegundos antes que el texto, el turno avanzaba y ocultaba el overlay a mitad de tirada. Ahora un overlay ocupado se retira solo con su propio timer.

## 4. Limpieza
- El contraataque usa la línea `log.counter` (existía traducida en ambos idiomas pero nunca se usaba).
- Se elimina la cadena muerta `log.heal` y el parámetro siempre-true `wasAlive` de `tryAwardKillXp`.
- El log de combate tiene tope de 60 entradas en memoria (la UI solo muestra las últimas 4).

**Verificación:** `npm run build` limpio y partida probada en navegador: título → despliegue (panel de oleada) → combate con un crítico forzado de forma determinista (log, overlay, foco y baja por XP verificados), sin errores de consola.
