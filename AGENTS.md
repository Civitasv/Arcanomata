# Arcanomata — AI-native collaboration contract

## Start here
1. Read `Code.md`, `docs/PRODUCT.md`, and `docs/ARCHITECTURE.md` before changes.
2. Declare the **Change** (player outcome), acceptance **Criteria**, risks, and planned **Evidence** in the PR.
3. Implement the smallest playable change. Keep pure game simulation independent of browser presentation.
4. Run `npm run check`, record actual outputs, and attach manual gameplay observations for UX changes.
5. Review for gameplay clarity, determinism, balance, edge cases, and cross-spell interactions. Never self-label an author's review as independent.
6. Merge only after checks are green, blocking feedback addressed, and manual acceptance evidence present when required. Do not report an unrun gate as passed.

## Invariants
- Domain state and simulation live only under `src/core/`; no Canvas, DOM, timers, localStorage, or nondeterministic `Math.random()` in core.
- The same seed and fixed-step input sequence must produce the same state.
- All spells follow the same sensor/action semantics; no hardcoded bespoke 'combo spell' recipes.
- Cross-spell synergy must arise through shared-world entities (marks, energy, movement, contacts), not hidden if/else combination tables.
- Guard energy conservation on splitting, cooldowns, entity caps, and negative resource values.
- UI exposes enough information to explain why a spell acted, not merely the resulting visual effect.
- Treat runtime code and content as untrusted. Avoid `eval`, generated JS execution, and remote code loading.
- Web is the first target. New platform adapters may import core, never the reverse.
- CI here is GitHub Actions. No Orven package or external agent runtime is required.
- Make small Conventional Commits. Document spec/contract changes and accompany bugs with regression tests.

## Completion gate
- [ ] Scope and acceptance criteria defined
- [ ] Automated tests for core logic and regressions
- [ ] `npm run check` passes
- [ ] Manual Web gameplay check (for visual changes)
- [ ] Docs and code map updated
- [ ] Independent review performed when available; otherwise explicitly state its absence
- [ ] PR describes evidence and limitations
