# Architecture decisions

## ADR-001: Browser-first, dependency-free ES modules
Use an HTML/CSS/Canvas frontend and Node's built-in test runner. No engine/build framework is needed to validate the game mechanic. `npm run build` packages static modules for hosting. This is a **provisional choice**: reassess Godot, Pixi, Phaser, or a custom renderer after measuring entity counts, iteration speed and desktop needs. Avoid irreversible coupling.

## ADR-002: Deterministic simulation and platform ports
`stepWorld(world, input, dt)` is the only clock-driven state transition. The browser owns `requestAnimationFrame`, fixed-step accumulation, controls and rendering. The world uses a seeded pseudo-random generator; tests can repeat sequences. The future PC port should adapt input, audio, windowing and distribution without importing Web UI into core.

## ADR-003: Shared-world spell communication
Species each have independent three-rule programs. Spells perceive local enemies, allies and short-lived `mark` entities. A mark has its creator species, position and TTL; other species can sense it. This enables compositional spell programming without a hardcoded named spell combination.

## ADR-004: Bounded emergence
Agents spend energy over time and for actions. Splitting divides existing energy and incurs overhead, rather than printing it. Every action has a cooldown; global spells/marks/enemies are capped. No mutation, arbitrary scripting or recursive trigger execution in Feature 01.

## ADR-005: Evidence-driven changes
Borrow Orven's Change → Criteria → Evidence → Gate discipline in docs, PR template, tests and CI. Do **not** claim to have installed Orven or to possess an autonomous multi-agent harness. Human/gameplay review must complement tests.

## Key risks
- A deterministic simulation can still be hard for humans to reason about: show per-agent last rule and counts of cross-species signals.
- The default program might be ineffective without tuning: manual browser review is required, and balance should be treated as provisional.
- Browser device/browser matrix is not covered by Node tests.
