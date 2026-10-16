# Borgo Solare — Mediterranean Isometric Hill Town

An interactive 3D animated isometric Mediterranean hill town artwork built with **Three.js**, powered by a **Bun + Effect** backend and a **Foldkit (TEA) Server-Side Rendered (SSR)** frontend.

## Architecture

- **Runtime & Server (`src/server/bunServer.ts`)**: **Bun** (`Bun.serve`) hosting static assets, Effect HTTP API endpoints, and the compiled Foldkit SSR Web Fetch handler (`dist/server/fetch.js`).
- **Backend (`src/server/townService.ts`)**: **Effect 4 (`effect@4.0.0`)** `Context.Service` & `Layer` (`TownServiceLive`) providing:
  - Per-request SSR `Flags` resolution from cookies and URL query parameters (`?palette=Santorini&time=GoldenHour&seed=42`).
  - `GET /api/town` — current town snapshot & meteorological telemetry.
  - `POST /api/town/generate` — Schema-validated procedural Mediterranean hill town generation.
  - `POST /api/town/bells` — Campanile bronze bell chime telemetry.
- **Frontend (`src/main.ts`, `src/entry.server.ts`, `src/entry.ts`)**: **Foldkit (`foldkit@0.168.0`)** with **Server-Side Rendering (`foldkit/experimental/server`)** and in-place client hydration (`Runtime.hydrate`):
  - Single `Schema.Struct` `Model` & `Flags`.
  - Past-tense fact `Message` union (`defineMessageUnion`) and pure exhaustive `update`.
  - Explicit `Command.define` side effects (`SyncTownScene`, `PersistTownPreferences`, `RequestNewTownFromBackend`, `TriggerCampanileBells`, `ExpireBellResonance`).
  - `Mount.defineStream` (`MountTownViewport`) binding the Three.js WebGL lifecycle (`Effect.acquireRelease`) to `#town-canvas-container`, pausing during DevTools time-travel via `viewStateChanges`, and streaming 3D raycast landmark clicks back into Foldkit as `SelectedDistrictFromCanvas` Messages.
  - `Subscription.make` driving continuous solar elevation cycling when enabled.
- **3D Artwork (`src/three/isometricTown.ts`)**: **Three.js** orthographic isometric diorama featuring:
  - Multi-tiered sculpted limestone cliffs, coastal sea stacks, Roman viaduct bridge, and stepped cobblestone alleys.
  - Hilltop **Duomo di Santa Maria** with ribbed majolica cupola, rose window, and **Campanile** with a swinging bronze bell & acoustic chime rings.
  - Central **Piazza del Mercato** with an animated 3-tier marble fountain, café parasols, and warm overhead festoon string lights.
  - Western Ridge **Mulino a Vento** (stone grain windmill) with 4 rotating timber-and-canvas sails.
  - **Porto Vecchio & Faro** striped lighthouse with rotating volumetric light beam and 6 wooden **Gozzo** fishing boats (moored & actively sailing with wakes).
  - Soaring seagull flock with flapping wings, swaying cypress & olive trees, rising chimney smoke puffs, and evening fireflies across 4 regional palettes (`Amalfi`, `CinqueTerre`, `Santorini`, `Provence`) and 4 times of day (`Dawn`, `Midday`, `GoldenHour`, `Starlight`).

## Getting Started

```bash
# Install dependencies
bun install

# Start Vite SSR + Effect API development server
bun run dev

# Run Foldkit Story & Effect API tests
bun run test

# Build client + SSR bundles and start the production Bun + Effect server
bun run build
bun run start
```
