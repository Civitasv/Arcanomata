# Arcanomata — AI-native collaboration contract

## Start here
1. Read `Code.md`, `docs/PRODUCT.md`, and `docs/ARCHITECTURE.md` before changes.
2. Declare the **Change** (player outcome), acceptance **Criteria**, risks, and planned **Evidence** in the PR.
3. Implement the smallest playable change. Keep pure game simulation independent of browser presentation.
4. Run `npm run check`, record actual outputs, and attach manual gameplay observations for UX changes.
5. Review for gameplay clarity, determinism, balance, edge cases, and cross-spell interactions. Never self-label an author's review as independent.
6. **Automatically squash-merge a completed, owner-authored, same-repository PR into `master` as soon as required CI checks pass**, provided it is not a draft, is mergeable, and has no active blocking review, branch-protection restriction, or other explicit blocker. **Do not stop to ask for merge confirmation.** CI green is the default merge gate.
7. For gameplay/UI work, record browser acceptance evidence. If a check was not performed, explicitly mark it **PENDING**, not passed. Missing nonblocking manual exploration or independent review may become follow-up work, but a specifically designated blocking acceptance criterion must be resolved before merge.
8. If CI fails, is pending, the PR head changed since validation, merge conflicts exist, or a blocking review is open, **do not merge**. Fix/resolve the issue and let CI run again. Never bypass branch protection or force merge.

## Automatic merge policy
- Applies **only** to non-draft PRs authored by the repository owner, with a head branch in this repository and base `master`. External/fork PRs require human approval.
- `.github/workflows/ci.yml` runs `validate` first. Its `auto-merge` job runs only if validation succeeds, and executes a squash merge using the validated head SHA; it performs no checkout of PR code with write credentials.
- Honor requested-changes reviews, conflicts, and GitHub branch protections. Do not merge when explicitly blocked, even if tests pass.
- When creating follow-up PRs, treat CI green and no blockers as authorization to merge. Do not ask again; verify the merge outcome, then report the resulting PR/commit.
- If the workflow could not auto-merge because of GitHub permissions or branch rules, report the actual blocker, not an assumed success.
- Any new required CI jobs must be included in the merge gate (`needs`) before this automation can consider them passing.

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
- [ ] `npm run check` / required GitHub Actions validations pass
- [ ] Manual Web gameplay evidence captured, or clearly marked PENDING and nonblocking
- [ ] Docs and code map updated
- [ ] Independent review performed when available; otherwise explicitly state its absence
- [ ] PR describes evidence, blockers and limitations
- [ ] Eligible green CI automatically squash-merged to `master`; merge outcome verified
