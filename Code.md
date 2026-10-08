# Code map

| Contract | Implementation | Evidence |
| --- | --- | --- |
| Seeded RNG, simulation clock, world state | `src/core/world.js` | `tests/world.test.js` |
| Programmable rune language and validation | `src/core/program.js` | `tests/world.test.js` |
| Autonomous spells and cross-spell mark protocol | `src/core/world.js` | `tests/world.test.js` |
| Canvas renderer | `src/web/render.js` | browser manual check |
| DOM controls, editing, input, upgrade flow | `src/web/main.js` | browser manual check |
| Design, architecture and milestones | `docs/` | PR acceptance criteria |
| Pull-request gates | `.github/workflows/ci.yml` | Actions status |

## Dependency direction

```
web entry + renderer -> core/program + core/world
tests ----------------> core/program + core/world
future desktop adapter -> core
core -X-> DOM / Canvas / browser storage / desktop SDK
```

The core deliberately exports plain JavaScript data and functions so a platform adapter can call it with a fixed `dt`.

| Typed channels and rule compatibility | `src/core/program.js` | `tests/composition.test.js` |
| Deterministic replay recording and verification | `src/core/replay.js` | `tests/composition.test.js` |
| Behavior traces, energy exchange and telemetry | `src/core/world.js` + `src/web/main.js` | `tests/composition.test.js` + browser acceptance |
| Browser acceptance / screenshots | `scripts/browser-smoke.mjs`, `tests/browser-acceptance.js` | GitHub Actions browser job |
