# AI-native Change loop

This project adapts the **principles** of [Orven](https://github.com/Civitasv/orven): changes as durable units, clear criteria, evidence, gates and small verifiable increments. It is not a fork or a runtime integration.

1. **BEGIN CHANGE**: Write a PR with player-visible outcome, in/out scope, risks, and acceptance criteria. Link an issue for larger features.
2. **PLAN**: Locate contracts using `Code.md`. Decide whether this changes core semantics, UI, or packaging. Define the smallest possible test.
3. **IMPLEMENT**: Modify the relevant layer; pure model first, adapters second. Keep tests alongside rule changes.
4. **EXECUTE**: Run `npm run check`. For game-feel changes, play manually in browser at desktop and a narrow viewport, including at least one edited cross-spell program.
5. **RECORD EVIDENCE**: Copy exact command result to PR and describe actual observed gameplay. For unrun manual checks, explicitly mark `PENDING`, never falsely mark them green.
6. **REVIEW**: Inspect diff against criteria, architecture boundaries, safety limits, likely regressions and player comprehension. Distinguish self-review from independent review. Mark any review finding that must block merging explicitly.
7. **AUTO-MERGE GATE**: For an owner-authored same-repo PR targeting `master`, passing required CI, no conflicting or requested-changes review, and a non-draft mergeable head automatically triggers squash-merge; do not ask for approval again. CI is the default gate; manual playtests marked nonblocking can be follow-ups. Explicit blocking acceptance criteria remain blocking. If GitHub permissions, branch policies or a stale SHA prevent merge, leave PR open and report the blocker.

The automatic gate lives in `.github/workflows/ci.yml`, in a separate post-validation job with write permission but **without checkout**. External/fork PRs do not auto-merge. When adding new CI validation jobs, also expand the `auto-merge.needs` list.

Recommended change slices: F01 platform skeleton + interactive vertical slice; F02 debuggability; F03 replay/seed sharing; F04 combat & content depth; F05 browser playtests; F06 desktop shell.

## Optional website acceptance

CI always builds a downloadable site artifact. Once Pages is enabled on the repository, `Deploy Web Preview` can be triggered manually from Actions on `master`. Do not state that the website is live until the deployment run succeeds. Run keyboard, touch controls, edit-two-program, XP-upgrade, agent-inspector, death, and retry checks in a real browser.
