# Zombies por Turnos

Demo de combate por turnos contra oleadas de zombis. Construido con TypeScript, Vite y Three.js.

## Características

- Combate por turnos en grilla hexagonal
- Tres personajes jugables: deportista, médico y criminal
- Oleadas progresivas de zombis
- Sistema de XP y niveles permanentes (guardado en `localStorage`)
- Pantalla de despliegue antes de cada ronda
- Música y efectos de sonido

## Requisitos

- Node.js 18+

## Desarrollo

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Deploy

El proyecto es una SPA estática de Vite. Cualquier host estático (Vercel, Netlify, GitHub Pages) funciona con:

- **Build command:** `npm run build`
- **Output directory:** `dist`

## 🧪 Benchmark de modelos de IA

Este repo también funciona como banco de pruebas: distintos modelos de IA generan pull requests contra `master` y cada PR se evalúa con la misma rúbrica. Las reglas completas (rúbrica con anclajes, protocolo y reglas de consistencia) viven en la página [Evaluación de modelos · zombies-por-turnos](https://app.notion.com/p/54b9353985b74aca9120bf3c48e95de1), que es la fuente de verdad (Notion, acceso privado).

### Cómo se evalúa

- **Inspección estática solamente**: el revisor no compila ni ejecuta el juego. Lee el diff línea por línea y traza el flujo afectado de punta a punta (despliegue → combate → fin de ronda), buscando errores lógicos, estados rotos y casos borde no manejados.
- **10 criterios ponderados, todos puntuados siempre de 0 a 5**: corrección funcional (20 %), cobertura del objetivo (15 %), calidad y estructura del código (15 %), lógica de combate y grilla hex (10 %), manejo de errores y casos borde (10 %), testing y verificabilidad (10 %), balance y progresión (5 %), seguridad y dependencias (5 %), rendimiento (5 %), documentación e i18n (5 %).
- **Veredicto** según el puntaje ponderado (0–100): 85+ 🟢 aprobar · 70–84 🟡 aprobar con cambios menores · 50–69 🟠 pedir cambios · 0–49 🔴 rechazar. Si el build no compila a la inspección, el veredicto tiene techo 🟠.
- **Regla de convivencia**: partir de una base desactualizada y traer conflictos con `master` pone techo 3 a la corrección funcional; romper o deshacer trabajo ajeno ya mergeado también descuenta en la cobertura del objetivo.
- Un 5 implica cero observaciones en ese criterio; los puntajes 0, 1 y 5 exigen evidencia (`archivo:línea`). Se evalúa el resultado, no el esfuerzo ni la intención.
- La review con la tabla de puntajes se publica en cada PR y el resultado se registra en la base «Evaluaciones» de la página enlazada.

### Resultados

| PR | Modelo | Puntaje | Veredicto | Estado |
| --- | --- | --- | --- | --- |
| [#1](https://github.com/Mitranium/zombies-por-turnos/pull/1) | MiMo-V2.6-Pro | 96/100 | 🟢 Aprobar | Mergeado |
| [#2](https://github.com/Mitranium/zombies-por-turnos/pull/2) | DeepSeek-V4.1-Flash | 85/100 | 🟢 Aprobar | Cerrado |
| [#3](https://github.com/Mitranium/zombies-por-turnos/pull/3) | GLM-5.3-Max | 96/100 | 🟢 Aprobar | Mergeado |

## Licencia

Proyecto privado / demo personal.
