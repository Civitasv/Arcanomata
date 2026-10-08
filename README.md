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

## Typed signals, cross-spell energy and replays (F02/F03)

Signal channels are **beacon**, **danger** and **supply**. Each rule includes a channel and source filter (other/self/any) when reading signals, and the channel written when producing a mark. Nearby allies can explicitly transfer energy by configuring `感知同伴 → 转移能量`. Unlike predefined spell recipes, combinations arise from marks and energy transfers interpreted by ordinary autonomous agents.

Select a spell to view its causal trace, target, resource delta and cross-species reads. The HUD tracks peak entity counts and update cost. Export a run recording (seed + fixed-tick inputs + edits + upgrades) and import it to reproduce the final state. These are **deterministic replay artifacts**, not a video format.

`npm run test:browser` runs headless Chromium acceptance checks for the rule editor, movement, pause/retry, upgrades, agent inspector, and responsive UI. On CI, the browser check is required for automatic merge. Local execution requires Chrome/Chromium installed; set `CHROME_BIN` when needed.
