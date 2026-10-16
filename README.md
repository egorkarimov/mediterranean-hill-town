# Borgo Solare · Isometric Mediterranean Hill Town

**Live Website:** [https://egorkarimov.github.io/mediterranean-hill-town/](https://egorkarimov.github.io/mediterranean-hill-town/)

An interactive, animated 3D isometric Mediterranean hill town artwork built with **Bun**, **Effect** (Backend & Domain Schemas), **Foldkit** (Elm-inspired Model-View-Update architecture with SSR + static prerendering + client hydration), and **Three.js**.

## Stack & Architecture

- **Runtime:** [Bun](https://bun.sh)
- **Backend & Shared Domain:** [Effect (`effect@4.0.0`)](https://effect.website) — `Schema.Class`, `Context.Service`, `Layer`, deterministic procedural Borgo telemetry generator, and HTTP routes (`/api/town`, `/api/town/generate`, `/api/town/bells`)
- **Frontend & SSR:** [Foldkit (`foldkit@0.168.0`)](https://foldkit.dev) — `Runtime.makeProgram`, `Server.renderToString`, `Runtime.hydrate`, `Mount.defineStream`, `Command.define`, `Subscription.make`, and `@foldkit/vite-plugin` SSR + SSG prerendering
- **3D Isometric Artwork:** [Three.js (`three@0.175.0`)](https://threejs.org) — Procedural terraced limestone cliffs, Roman stone viaduct, Duomo cathedral with majolica-tiled cupola and swinging bronze Campanile bell, Piazza del Sole with tiered fountain and festoon string lights, rotating windmill sails, striped Faro lighthouse with sweeping beam, bobbing & sailing Gozzo wooden boats with wake trails, wheeling seagulls, swaying cypresses & olive groves, chimney smoke, and nocturnal fireflies.

## Features

- **4 Regional Mediterranean Palettes:** Amalfi Terracotta, Santorini Caldera, Cinque Terre Pastel, and Tuscan Sunstone
- **4 Solar Phases + Auto Solar Cycle:** Dawn Mist, High Noon, Golden Hour, and Starlit Night
- **5 Isometric Camera Presets + Full Orbit/Zoom/Pan & Raycast Inspection:** Overview, Piazza & Duomo, Marina & Viaduct, Faro & Windmill, and Aerial Isometric
- **Interactive Campanile Bell Chimes:** Ring the bronze cathedral bell to trigger visual shockwave rings and synthesized acoustic bell harmonics

## Local Development

```bash
# Install dependencies
bun install

# Start Vite SSR + Effect API development server
bun run dev

# Typecheck & run tests (Foldkit Story + Effect API tests)
bun run typecheck
bun run test

# Build production SSR + static prerendered bundle
bun run build

# Run production Bun + Effect SSR server
bun run start
```
