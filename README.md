# Zombies por Turnos

Demo de combate por turnos contra oleadas de zombis. Construido con TypeScript, Vite y Three.js.

## Características

- Combate por turnos en grilla hexagonal
- Golpes críticos: si todos los dados caen en su cara máxima, el total cuenta el doble (también para los zombis)
- Tres personajes jugables: deportista, médico y criminal
- Oleadas progresivas de zombis
- Vista previa de la oleada entrante durante el despliegue
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

## Licencia

Proyecto privado / demo personal.
