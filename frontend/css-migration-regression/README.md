# Temporary CSS Migration Regression

> **Lifecycle:** temporary migration-only tooling. Delete this entire directory after all CSS migration batches have been accepted and the final formal checks have run.

This suite is deliberately isolated from the maintained E2E suite. It does not modify `package.json`, the formal Playwright config, production components, or production styles.

## Baseline identity

- Repository: `ligl/capitus`
- Intended baseline commit: `171254d0bbdad139f51ba1550e8379899d8f6ca6`
- Formal E2E config remains `../playwright.config.ts`
- App URL: `http://127.0.0.1:1421`
- Browser project: Chromium / Desktop Chrome
- Viewport snapshots: 1440 × 900, device scale factor 1
- Responsive geometry checks: 920 × 800, 1024 × 800, 1280 × 800, 1440 × 900, 1920 × 1080

The baseline is **not established by committing these test files**. It must be generated locally by checking out the exact baseline commit and running the commands below. Do not generate baseline screenshots from a CSS-migrated working tree.

## Commands

Run from `crates/struxis-debugger/frontend`:

```bash
bunx playwright test --config css-migration-regression/playwright.config.ts --update-snapshots
bunx playwright test --config css-migration-regression/playwright.config.ts
```

The first command is for initial baseline creation only, and must be run while the production CSS is at the baseline commit. Review the generated screenshots and computed-style attachments before treating the baseline as valid. After the baseline has been generated, use the second command for comparisons; do not routinely pass `--update-snapshots`.

Test artifacts, HTML reports, traces, and result output are written below this temporary directory and must not be committed as permanent product assets. Preserve the reviewed baseline files locally while running each migration batch.

## What this first version checks

- Default workbench screenshot at 1440 × 900.
- Stable shell/layout test IDs and selected computed CSS properties/tokens.
- Horizontal document overflow and non-negative geometry at five desktop viewports.
- JSON layout/style contracts attached to each Playwright test report.

## Known coverage gap — do not treat as full visual acceptance

This initial suite does not yet construct deterministic market/chart data or drive Dataset, Replay, Compare, Inspector, and Diagnostics through every state listed in `docs/architecture/struxis/debugger/css-layered-architecture.md` §10. In particular, an empty/default application view cannot prove that chart legend layers, Replay processed/unprocessed candles, Snapshot Reference, or Compare Candidate/Baseline remain visually equivalent.

Before CSS migration begins, extend this temporary suite with reproducible state setup and screenshots for those scenarios, or record why a scenario cannot be deterministically constructed. Reuse existing stable selectors and interaction contracts; do not add production-only hooks or weaken the formal E2E suite to support this temporary suite.

## Acceptance and cleanup

For every migration batch:

1. Run this suite against the unchanged baseline first and confirm the baseline is valid.
2. Run the same suite against the candidate with the same browser, viewport, fonts, and fixture state.
3. Review screenshot diffs and attached computed-style contracts; investigate all unexpected changes.
4. Keep baseline updates explicit and reviewable. Never update snapshots merely to make a failing comparison green.
5. Separately run `bun run check` and `bun run test:e2e`; this suite does not replace them.

After all CSS batches have passed review, remove this entire directory (including baselines and generated artifacts), check that no production or formal-test files reference it, and rerun the formal checks. Do not claim visual equivalence until the state-coverage gap above has been closed and the tests have actually run.
