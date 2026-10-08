# Arcanomata · 咒衍

**Program spells. Witness emergence.**

An experimental, **web-first** survivor-like in which spells are autonomous agents. Program two spell species independently, let them communicate using short-lived arcane marks, and survive waves of enemies. No backend, login, LLM inference, or runtime network required.

## Play locally

Requires Node.js 22+ (zero runtime or build dependencies):

```sh
npm run dev
# open http://localhost:4173
```

Use **WASD / arrow keys** to move, **P** to pause, **R** to restart. Edit the three trigger/action rules for each spell species in the right sidebar. Select an orb to inspect its energy and latest behavior. Earn upgrades by killing enemies; survive three minutes to win.

## Commands

- `npm test` — deterministic model and cross-spell protocol tests
- `npm run check` — syntax checks, tests, and deployable static bundle validation
- `npm run build` — create self-contained `dist/`
- `npm run dev` — serve the source site locally

## Why web first?

`src/core/` is a deterministic headless simulation without DOM/canvas dependencies. `src/web/` owns browser input, UI, and rendering. A future PC shell (Tauri/Electron or a different native frontend) can reuse the simulation and spell program schema without rewriting rules. PC packaging is intentionally **not** implemented yet.

## AI-native development

Start with [AGENTS.md](AGENTS.md), [Code.md](Code.md), [product spec](docs/PRODUCT.md), and [architecture](docs/ARCHITECTURE.md). Our Change/Criteria/Evidence/Gate workflow draws on [Orven](https://github.com/Civitasv/orven), without taking a runtime dependency on it. See [development workflow](docs/WORKFLOW.md).

## Status

This is a narrow vertical slice, not a production game. Cross-spell communication is implemented through sensed marks. Spatial flocking, persistent spell evolution, save files, audio, automated browser playtests, and PC packaging are later milestones.

## Web preview deployment (optional)

The CI run attaches a `arcanomata-web` downloadable static bundle to the PR. After merging into `master`, for an online playable URL: enable **Settings → Pages → Build and deployment: GitHub Actions**, then manually run **Actions → Deploy Web Preview → Run workflow** on `master`. The deploy workflow publishes the same `dist/` bundle to GitHub Pages, normally at `https://civitasv.github.io/Arcanomata/`. This preview is not active until Pages is configured and a deploy succeeds.
