# Zombies por Turnos

Demo de combate por turnos contra oleadas de zombis. Construido con TypeScript, Vite y Three.js.

## Características

- Combate por turnos en grilla hexagonal
- Tres personajes jugables: deportista, médico y criminal
- Oleadas progresivas de zombis
- Sistema de XP y niveles permanentes (guardado en `localStorage`)
- Pantalla de despliegue antes de cada ronda
- Música y efectos de sonido

## Cómo se juega

1. En el título podés cambiar el idioma, silenciar el audio y abrir el **escuadrón** (gastar XP en subir niveles) o la **wiki** de zombis.
2. Antes de cada ronda posicionás al escuadrón: elegís una ficha y después un hexágono. La formación se conserva para las rondas siguientes.
3. En combate el orden de turnos lo define la velocidad. En tu turno elegís **Atacar** o **Especial** (se carga con 2 ataques básicos) y después el objetivo.
4. Al limpiar la oleada el escuadrón vuelve a estar completo y cada zombi eliminado otorga XP.

Cada personaje tiene su rol: el deportista contraataca al nivel 3 o superior, el médico cura a todo el escuadrón con su especial, y el criminal pega más fuerte pero recibe daño de retroceso.

## Controles

| Acción | Teclado | Mouse / táctil |
| --- | --- | --- |
| Empezar / confirmar | `Enter` o `Espacio` | Botones |
| Elegir acción u objetivo | `←` `→` / `A` `D` / `W` `S` | Clic en botones y enemigos |
| Volver / cancelar | `Esc` o `Retroceso` | Botón **Cancelar** |

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

## Estructura

- `src/game/` — reglas y estado: fases, turnos, progresión y números de balance (`balance.ts`).
- `src/combat/` — escena Three.js, grilla hexagonal, dados físicos y animaciones.
- `src/ui/` — interfaz DOM, acciones de combate y control por teclado.
- `src/i18n/strings.ts` — todo el texto de interfaz en inglés y español.
- `src/audio/` — música y efectos de sonido.

## Persistencia

- `zpt-profile`: XP, niveles, mejor ronda y bajas totales.
- `zpt-muted`: preferencia de silencio.

## Deploy

El proyecto es una SPA estática de Vite. Cualquier host estático (Vercel, Netlify, GitHub Pages) funciona con:

- **Build command:** `npm run build`
- **Output directory:** `dist`

## Licencia

Proyecto privado / demo personal.
