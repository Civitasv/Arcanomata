# Product spec — Web vertical slice (Feature 01)

## Promise
*Program spells. Witness emergence.* A Vampire Survivors-inspired arena where the player **moves** but does not manually aim or cast. Their power comes from programming autonomous spell species.

## Actual playable loop
1. Move with WASD/arrow keys as enemies home in.
2. Two distinct spells (`scout` and `hunter`) spawn automatically.
3. Each spell species runs its own three programmable trigger/action rules. Existing spells immediately adopt edits.
4. A scout can **sense an enemy and mark its position**. Hunters can **sense marks created by a different spell species and seek them**. This is cross-spell composition via the world, not a special combination.
5. Contact and pulses defeat enemies. Kills grant XP, choose one of three upgrades, repeat until 180 seconds or defeat.
6. Inspect agent energy and last action; experiment with rule edits, replication, and signal sharing.

## First usable language
Five sensors: `enemy`, `ally`, `mark`, `contact`, `tick`.
Seven actions: `seek`, `flee`, `orbit`, `mark`, `pulse`, `split`, `share`.

A rule is `{when, do}`. Exactly three ordered rules per spell species; no scripts/eval. A sensor yields a nearby target (except `tick`); target-dependent movement requires one. Marks are always tagged with the source species. The `mark` sensor looks for marks created by **other** species.

## Emergence hypothesis
- Two independently written programs form an effective scout/hunter loop through local traces.
- Splitting and energy cost may create expansion and collapse, without a bespoke 'swarm' skill.
- Players can explain an outcome by inspecting signals, resources, and active rules.

## Acceptance
- Start, move, survive, die, restart, and win from a single browser page.
- Edit both programs separately at runtime.
- A mark written by scouts can affect hunters through the generic mark sensor.
- Enemy combat, XP, upgrades, pause, and inspector function.
- Seeded deterministic automated tests guard rule interpretation and cap/conservation constraints.
- Static build can be hosted without backend; responsive page also offers touch direction controls.

## Non-goals
Production art/audio, progression saves, content campaign, multiplayer, backend inference, downloadable PC release, automated browser screenshots.

## Backlog
02: Usability tuning / live traces / seeded replays.
03: Energy economy and enemy variety / meaningful 10-minute builds.
04: Flocking, typed signals and multi-species ecosystems.
05: Automated browser acceptance and visual regression.
06: PC wrapper after web evaluation; keep core unchanged.
