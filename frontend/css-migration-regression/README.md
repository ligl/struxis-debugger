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

The baseline is **not established by committing these test files**. The temporary directory does not exist at the historical baseline commit, so copy this directory into a separate worktree at that exact commit before generating snapshots. Do not generate baseline screenshots from a CSS-migrated working tree.

## Commands

From the repository root of a clean checkout containing the temporary suite on `develop`, create a separate worktree at the pinned baseline and copy only the temporary directory into it:

```bash
git worktree add /tmp/capitus-css-baseline 171254d0bbdad139f51ba1550e8379899d8f6ca6
cp -a crates/struxis-debugger/frontend/css-migration-regression \\
  /tmp/capitus-css-baseline/crates/struxis-debugger/frontend/
cd /tmp/capitus-css-baseline/crates/struxis-debugger/frontend
bun install --frozen-lockfile
bunx playwright test --config css-migration-regression/playwright.config.ts --update-snapshots
bunx playwright test --config css-migration-regression/playwright.config.ts
```

Review the generated screenshots and computed-style attachments, then copy the reviewed `baseline/` directory into the temporary suite on the migration working tree. Run comparisons from `crates/struxis-debugger/frontend` on that working tree:

```bash
bunx playwright test --config css-migration-regression/playwright.config.ts
```

The `--update-snapshots` command is for initial baseline creation only. Do not routinely pass it to make a comparison green. Keep both the baseline worktree and candidate worktree on the same dependency lockfile/browser installation where feasible; if the historical lockfile or rendering environment differs, document that as a comparability risk.

Test artifacts, HTML reports, traces, and result output are written below this temporary directory and must not be committed as permanent product assets. Preserve the reviewed baseline files locally while running each migration batch.

## What this first version checks

- Default workbench screenshot at 1440 × 900.
- Dataset, Replay, and Compare default-workspace screenshots.
- Expanded Diagnostics screenshots in all four dock directions.
- Stable shell/layout test IDs and selected computed CSS properties/tokens.
- Horizontal document overflow and non-negative geometry at five desktop viewports.
- JSON layout/style contracts attached to each Playwright test report.

## Known coverage gap — do not treat as full visual acceptance

This initial suite still does not construct deterministic market/chart data or exercise the full interaction matrix listed in `docs/architecture/struxis/debugger/css-layered-architecture.md` §10. The workspace screenshots use the current default data state; the Diagnostics captures cover expanded docks in four directions, but do not yet cover Inspector's four docking directions, resizing, or the complete collapse/restore matrix. In particular, an empty/default application view cannot prove that chart legend layers, Replay processed/unprocessed candles, Snapshot Reference, or Compare Candidate/Baseline remain visually equivalent.

Before CSS migration begins, extend this temporary suite with reproducible state setup and screenshots for those scenarios, or record why a scenario cannot be deterministically constructed. Reuse existing stable selectors and interaction contracts; do not add production-only hooks or weaken the formal E2E suite to support this temporary suite.

## Acceptance and cleanup

For every migration batch:

1. Run this suite against the unchanged baseline first and confirm the baseline is valid.
2. Run the same suite against the candidate with the same browser, viewport, fonts, and fixture state.
3. Review screenshot diffs and attached computed-style contracts; investigate all unexpected changes.
4. Keep baseline updates explicit and reviewable. Never update snapshots merely to make a failing comparison green.
5. Separately run `bun run check` and `bun run test:e2e`; this suite does not replace them.

After all CSS batches have passed review, remove this entire directory (including baselines and generated artifacts), check that no production or formal-test files reference it, and rerun the formal checks. Do not claim visual equivalence until the state-coverage gap above has been closed and the tests have actually run.
