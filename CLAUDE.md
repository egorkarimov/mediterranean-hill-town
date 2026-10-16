# Borgo Solare — Loom Book

Borgo Solare is an interactive isometric Mediterranean hill town written as a [Loom](https://github.com/athrio-com/loom) book (`effect@4.0.0`, `foldkit@0.168.0` SSR, `three@0.175.0`, and Bun).

## Working with the corpus

The source of truth is the `.loom` files in `corpus/`. The `.ts` files in `src/` are generated from them by tangling and must never be edited by hand.

- **Reading or searching** — read `.loom` files in `corpus/`. Do not read or search `src/` to understand the codebase; everything in `src/` comes from a `.loom` file and the `.loom` file also has the prose explaining why it is the way it is.
- **Editing** — edit the `.loom` file in `corpus/`, then run `loom tangle corpus` to regenerate `src/`.
- **Adding or renaming chapters** — update the `Part R, Chapter N: <Title>` (or `Part R: <Part Name>` + `Chapter 1: <Title>` on the first chapter of a part) in frontmatter, then run `loom toc corpus/book.loom` to regenerate the `# Table of Contents {TOC}` block in `corpus/book.loom`.
- **Verifying** — after tangling, run `./node_modules/.bin/tsc --noEmit`, `./node_modules/.bin/vitest run`, and `./node_modules/.bin/vite build`. Compiler or test errors report line numbers in `src/`; trace the error back to the section in the `.loom` file that tangled it and fix it there.
- **Skills** — read `.claude/skills/prose/SKILL.md` and `.claude/skills/code/SKILL.md` before writing or editing any `.loom` file. Both apply to every change.

## Corpus structure

- [`corpus/book.loom`](corpus/book.loom) — Book introduction and generated Table of Contents
- **Part I — The Domain of the Borgo**
  - [`corpus/01-the-domain/01-atmosphere-and-geography.loom`](corpus/01-the-domain/01-atmosphere-and-geography.loom) → `src/shared/domain.ts`
- **Part II — The Effect Backend**
  - [`corpus/02-the-server/01-the-town-service.loom`](corpus/02-the-server/01-the-town-service.loom) → `src/server/townService.ts`
  - [`corpus/02-the-server/02-the-bun-server.loom`](corpus/02-the-server/02-the-bun-server.loom) → `src/server/bunServer.ts`
- **Part III — The Isometric World in Three.js**
  - [`corpus/03-the-isometric-world/01-palettes-and-atmosphere.loom`](corpus/03-the-isometric-world/01-palettes-and-atmosphere.loom) → `src/three/palettes.ts`
  - [`corpus/03-the-isometric-world/02-architecture-of-the-promontory.loom`](corpus/03-the-isometric-world/02-architecture-of-the-promontory.loom) → `src/three/architecture.ts`
  - [`corpus/03-the-isometric-world/03-the-living-viewport.loom`](corpus/03-the-isometric-world/03-the-living-viewport.loom) → `src/three/isometricTown.ts`
- **Part IV — The Foldkit SSR Application**
  - [`corpus/04-the-foldkit-app/01-the-application.loom`](corpus/04-the-foldkit-app/01-the-application.loom) → `src/main.ts`
  - [`corpus/04-the-foldkit-app/02-hydration-and-prerendering.loom`](corpus/04-the-foldkit-app/02-hydration-and-prerendering.loom) → `src/entry.server.ts`, `src/entry.ts`
  - [`corpus/04-the-foldkit-app/03-stories-and-verification.loom`](corpus/04-the-foldkit-app/03-stories-and-verification.loom) → `src/main.test.ts`
