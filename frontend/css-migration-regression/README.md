# Temporary CSS Migration Regression

> **Lifecycle:** one-time tooling for the CSS migration only. Delete this entire directory after all CSS migration batches are accepted and final formal checks pass.

## One command

Run from the Capitus repository root on a clean `develop` worktree:

```bash
bash crates/struxis-debugger/frontend/css-migration-regression/run-css-regression.sh
```

That is the only command the operator needs to run. The script refuses to run on another branch or with a dirty worktree so the result can be tied to an exact candidate commit. Commit the candidate CSS/source changes first, then run the command. The script automatically commits and pushes the generated baseline (on the first run) and `css-migration-regression/results/latest/` to `develop`.

The script automatically:

1. Verifies the branch, clean worktree, pinned baseline commit, Bun, and suite files.
2. Installs locked frontend dependencies and Chromium.
3. If no baseline screenshots exist yet, creates a detached worktree at `171254d0bbdad139f51ba1550e8379899d8f6ca6`, copies only the temporary test suite into it, installs its locked dependencies, and generates baseline screenshots there.
4. Copies the initial baseline into `css-migration-regression/baseline/` and verifies the baseline suite against those snapshots.
5. Runs the same suite against the current `develop` candidate.
6. Writes logs, Playwright HTML report, failure screenshots/diffs/traces, and a machine-readable manifest into `css-migration-regression/results/latest/`.
7. Removes the temporary baseline worktree on exit.
8. Commits the generated baseline (on the first run) and the complete result package to the current local develop history, then pushes develop to origin automatically. This runs even when the candidate test fails or the run stops after result-directory initialization, so the remote repository retains failure evidence.

The first run can take longer because it builds the baseline and installs dependencies in both worktrees. It requires network access for fetching the pinned commit / installing packages, downloading Chromium if needed, and pushing to GitHub. The temporary Playwright config disables server reuse: each run must launch the dev server from the exact baseline or candidate worktree under test, rather than silently attaching to an already-running server from another checkout.

## Result package

The script publishes `results/latest/` automatically. Do not manually stage or commit the result package unless the automatic push failed. The key files are:

- `summary.md`: concise outcome and review instructions.
- `manifest.json`: exact baseline/candidate commit, environment, screenshot count, exit code, and known coverage gaps.
- `logs/baseline-create.log`: present only when the baseline was created during this run.
- `logs/baseline-verify.log`: verification of the historical baseline.
- `logs/candidate-test.log`: current candidate test output.
- `playwright-report/`: HTML report when Playwright generated it.
- `test-results/`: failure diffs, screenshots, traces, and attachments when present.

Open the HTML report locally by opening `results/latest/playwright-report/index.html`. The manifest and logs are plain text and can be reviewed directly from GitHub after the script's automatic result commit is pushed.

## Baseline integrity

- Baseline commit: `171254d0bbdad139f51ba1550e8379899d8f6ca6`.
- Baselines are generated only from a detached worktree at that exact commit, never from the candidate tree.
- Do not pass `--update-snapshots` manually to silence a candidate mismatch.
- The script requires a clean worktree at launch. This ensures the tested candidate commit is the same commit recorded in the manifest.
- A failed baseline verification aborts candidate comparison. Fix the test harness/environment before interpreting candidate results.
- The suite is temporary and does not replace `bun run check`, `bun run test:e2e`, or actual desktop-rendering checks.

## Current coverage and known gaps

The suite covers default workspace screenshots, Dataset's deterministic 36-SBar / 3-CBar / 2-Swing chart and four legend toggles, Replay fixtures at 12/36 and 24/36 processed SBars with a selected Snapshot Reference, explicit assertions that the selected reference finished loading without an error, its chart canvas is visible, synchronization is eligible, and playback styling is active, Inspector expanded/collapsed and four dock directions, Diagnostics collapsed and four expanded dock directions, selected computed styles/tokens, and shell geometry at five desktop viewports.

Remaining gaps include exhaustive Replay progress transitions and sync interactions, Inspector dock resizing, the full Inspector/Diagnostics drag-resize matrix, and actual Candidate/Baseline market charts (Compare currently renders `ComparisonChartPlaceholder.vue`). The generated manifest records these gaps. The Replay screenshots exercise the deterministic fixture but remain **unverified until the suite is actually run**. A passing run means only that the currently implemented checks passed; it does not establish complete visual equivalence.

## Cleanup requirement

After all CSS migration batches have been reviewed and accepted:

1. Delete this entire `css-migration-regression/` directory, including the script, snapshots, fixture, reports, logs, and result package.
2. Confirm no production/formal-test references remain.
3. Run `bun run check` and `bun run test:e2e` from the frontend directory, plus available desktop-rendering checks.
4. Record any unavailable checks and remaining limitations. Do not claim visual equivalence beyond the executed coverage.
