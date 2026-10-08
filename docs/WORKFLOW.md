# AI-native Change loop

This project adapts the **principles** of [Orven](https://github.com/Civitasv/orven): changes as durable units, clear criteria, evidence, gates and small verifiable increments. It is not a fork or a runtime integration.

1. **BEGIN CHANGE**: Write a PR with player-visible outcome, in/out scope, risks, and acceptance criteria. Link an issue for larger features.
2. **PLAN**: Locate contracts using `Code.md`. Decide whether this changes core semantics, UI, or packaging. Define the smallest possible test.
3. **IMPLEMENT**: Modify the relevant layer; pure model first, adapters second. Keep tests alongside rule changes.
4. **EXECUTE**: Run `npm run check`. For game-feel changes, play manually in browser at desktop and a narrow viewport, including at least one edited cross-spell program.
5. **RECORD EVIDENCE**: Copy exact command result to PR and describe actual observed gameplay (or mark `PENDING`). A simulation unit test cannot prove fun.
6. **REVIEW**: Inspect diff against criteria, architecture boundaries, safety limits, likely regressions and player comprehension. Distinguish self-review from independent review.
7. **GATE**: Merge only with passing required checks and no blockers. If tests could not be run, say so rather than asserting green.

Recommended change slices: F01 platform skeleton + interactive vertical slice; F02 debuggability; F03 replay/seed sharing; F04 combat & content depth; F05 browser playtests; F06 desktop shell.

## Optional website acceptance

CI always builds a downloadable site artifact. Once Pages is enabled on the repository, `Deploy Web Preview` can be triggered manually from Actions on `master`. Do not state that the website is live until the deployment run succeeds. Run keyboard, touch controls, edit-two-program, XP-upgrade, agent-inspector, death, and retry checks in a real browser.
