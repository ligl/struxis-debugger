#!/usr/bin/env bash
set -Eeuo pipefail

BASELINE_SHA="171254d0bbdad139f51ba1550e8379899d8f6ca6"
REGRESSION_REL="crates/struxis-debugger/frontend/css-migration-regression"
FRONTEND_REL="crates/struxis-debugger/frontend"

fail() {
  printf '\n[CSS regression] ERROR: %s\n' "$*" >&2
  exit 1
}

ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || fail "Run this command from inside the Capitus Git repository."
cd "$ROOT"

BRANCH="$(git branch --show-current)"
[[ "$BRANCH" == "develop" ]] || fail "Expected branch 'develop', found '$BRANCH'. Switch to develop and rerun."

if [[ -n "$(git status --porcelain)" ]]; then
  git status --short
  fail "Working tree must be clean before the run. Commit the candidate code first so the report identifies an exact commit."
fi

REGRESSION_DIR="$ROOT/$REGRESSION_REL"
FRONTEND_DIR="$ROOT/$FRONTEND_REL"
RESULTS_DIR="$REGRESSION_DIR/results/latest"
BASELINE_DIR="$REGRESSION_DIR/baseline"

[[ -f "$REGRESSION_DIR/playwright.config.ts" ]] || fail "Missing temporary Playwright config: $REGRESSION_DIR/playwright.config.ts"
[[ -f "$REGRESSION_DIR/css-visual-regression.spec.ts" ]] || fail "Missing CSS regression spec."
command -v bun >/dev/null 2>&1 || fail "Bun is required. Install the repository-pinned Bun version and rerun."
command -v git >/dev/null 2>&1 || fail "Git is required."
command -v python3 >/dev/null 2>&1 || fail "Python 3 is required to write the result manifest."

if ! git cat-file -e "$BASELINE_SHA^{commit}" 2>/dev/null; then
  printf '[CSS regression] Fetching pinned baseline commit %s\n' "$BASELINE_SHA"
  git fetch --no-tags origin "$BASELINE_SHA" || fail "Cannot fetch pinned baseline commit $BASELINE_SHA from origin."
fi
git cat-file -e "$BASELINE_SHA^{commit}" 2>/dev/null || fail "Pinned baseline commit is unavailable locally."

TMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/capitus-css-regression.XXXXXX")"
# Select an unused loopback port so an ordinary frontend dev server on 1421
# cannot block the isolated baseline/candidate webServer.
CSS_REGRESSION_PORT="$(python3 -c 'import socket; s=socket.socket(); s.bind(("127.0.0.1", 0)); print(s.getsockname()[1]); s.close()')"
export CSS_REGRESSION_PORT
printf '[CSS regression] Isolated Playwright server port: %s\\n' "$CSS_REGRESSION_PORT"
BASELINE_WORKTREE="$TMP_ROOT/baseline-worktree"
WORKTREE_ADDED=0
publish_and_cleanup() {
  local original_exit=$?
  set +e

  if [[ "$WORKTREE_ADDED" == "1" ]]; then
    git worktree remove --force "$BASELINE_WORKTREE" >/dev/null 2>&1
  fi
  rm -rf "$TMP_ROOT"

  if [[ -d "${RESULTS_DIR:-}" ]]; then
    if [[ ! -f "$RESULTS_DIR/manifest.json" ]]; then
      mkdir -p "$RESULTS_DIR/logs"
      printf '%s\n' '# CSS migration regression result' '' '- Result: INFRASTRUCTURE FAILURE' "- Candidate commit: ${CANDIDATE_SHA:-unknown}" "- Pinned baseline: $BASELINE_SHA" '' 'The run stopped before a complete report was generated. Inspect available logs.' > "$RESULTS_DIR/summary.md"
      python3 - "$RESULTS_DIR/manifest.json" "${CANDIDATE_SHA:-unknown}" "$BASELINE_SHA" "$original_exit" <<'PY'
import json, pathlib, sys
path, candidate, baseline, code = sys.argv[1:]
pathlib.Path(path).write_text(json.dumps({
  "schemaVersion": 1,
  "repository": "ligl/capitus",
  "branch": "develop",
  "candidateCommit": candidate,
  "baselineCommit": baseline,
  "result": "infrastructure_failure",
  "exitCode": int(code),
  "note": "Run stopped before a complete report was generated; inspect available logs."
}, indent=2) + "\n")
PY
    fi

    git add -f -- "$RESULTS_DIR"
    if [[ -d "$BASELINE_DIR" ]]; then git add -f -- "$BASELINE_DIR"; fi
    if ! git diff --cached --quiet; then
      git commit -m "test(struxis-debugger): publish CSS regression results for ${CANDIDATE_SHA:-unknown}"
      if [[ $? -ne 0 ]]; then
        printf '\n[CSS regression] ERROR: Could not commit result package. Results remain in %s\n' "$RESULTS_DIR" >&2
        exit 1
      fi
    fi
    if ! git push origin develop; then
      printf '\n[CSS regression] ERROR: Results are committed locally but could not be pushed. Run: git push origin develop\n' >&2
      exit 1
    fi
    printf '\n[CSS regression] Published baseline/results to origin/develop.\n'
  fi

  return "$original_exit"
}
trap publish_and_cleanup EXIT

rm -rf "$RESULTS_DIR" "$REGRESSION_DIR/artifacts"
mkdir -p "$RESULTS_DIR/logs"

CANDIDATE_SHA="$(git rev-parse HEAD)"
CANDIDATE_DATE="$(git show -s --format=%cI HEAD)"
BUN_VERSION="$(bun --version)"
printf '[CSS regression] Candidate: %s (%s)\n' "$CANDIDATE_SHA" "$CANDIDATE_DATE"
printf '[CSS regression] Baseline:  %s\n' "$BASELINE_SHA"
printf '[CSS regression] Installing candidate frontend dependencies...\n'
(
  cd "$FRONTEND_DIR"
  bun install --frozen-lockfile
) 2>&1 | tee "$RESULTS_DIR/logs/candidate-install.log"

printf '[CSS regression] Ensuring Chromium is installed...\n'
(
  cd "$FRONTEND_DIR"
  bunx playwright install chromium
) 2>&1 | tee "$RESULTS_DIR/logs/chromium-install.log"

snapshot_count() {
  if [[ -d "$BASELINE_DIR" ]]; then
    find "$BASELINE_DIR" -type f -name '*.png' | wc -l | tr -d ' '
  else
    printf '0'
  fi
}

if [[ "$(snapshot_count)" -eq 0 ]]; then
  printf '[CSS regression] No reviewed baseline screenshots found; building them from the pinned historical commit.\n'
  git worktree add --detach "$BASELINE_WORKTREE" "$BASELINE_SHA" 2>&1 | tee "$RESULTS_DIR/logs/worktree.log"
  WORKTREE_ADDED=1
  BASELINE_FRONTEND="$BASELINE_WORKTREE/$FRONTEND_REL"
  BASELINE_SUITE="$BASELINE_FRONTEND/css-migration-regression"
  mkdir -p "$BASELINE_SUITE"
  cp "$REGRESSION_DIR/playwright.config.ts" "$REGRESSION_DIR/css-visual-regression.spec.ts" "$REGRESSION_DIR/README.md" "$BASELINE_SUITE/"
  (
    cd "$BASELINE_FRONTEND"
    bun install --frozen-lockfile
  ) 2>&1 | tee "$RESULTS_DIR/logs/baseline-install.log"
  (
    cd "$BASELINE_FRONTEND"
    bunx playwright install chromium
  ) 2>&1 | tee "$RESULTS_DIR/logs/baseline-chromium-install.log"
  (
    cd "$BASELINE_FRONTEND"
    bunx playwright test --config css-migration-regression/playwright.config.ts --update-snapshots
  ) 2>&1 | tee "$RESULTS_DIR/logs/baseline-create.log"
  [[ -d "$BASELINE_SUITE/baseline" ]] || fail "Baseline run finished without creating a baseline directory."
  [[ "$(find "$BASELINE_SUITE/baseline" -type f -name '*.png' | wc -l | tr -d ' ')" -gt 0 ]] || fail "Baseline run did not produce screenshot snapshots."
  mkdir -p "$BASELINE_DIR"
  cp -a "$BASELINE_SUITE/baseline/." "$BASELINE_DIR/"
  printf '[CSS regression] Baseline screenshots generated. They will be included in the result commit for review.\n'
else
  printf '[CSS regression] Reusing %s reviewed baseline screenshot(s).\n' "$(snapshot_count)"
fi

printf '[CSS regression] Verifying baseline screenshots against the pinned source...\n'
if [[ "$WORKTREE_ADDED" != "1" ]]; then
  git worktree add --detach "$BASELINE_WORKTREE" "$BASELINE_SHA" 2>&1 | tee "$RESULTS_DIR/logs/worktree.log"
  WORKTREE_ADDED=1
  BASELINE_FRONTEND="$BASELINE_WORKTREE/$FRONTEND_REL"
  BASELINE_SUITE="$BASELINE_FRONTEND/css-migration-regression"
  mkdir -p "$BASELINE_SUITE"
  cp "$REGRESSION_DIR/playwright.config.ts" "$REGRESSION_DIR/css-visual-regression.spec.ts" "$REGRESSION_DIR/README.md" "$BASELINE_SUITE/"
  (
    cd "$BASELINE_FRONTEND"
    bun install --frozen-lockfile
  ) 2>&1 | tee "$RESULTS_DIR/logs/baseline-install.log"
  (
    cd "$BASELINE_FRONTEND"
    bunx playwright install chromium
  ) 2>&1 | tee "$RESULTS_DIR/logs/baseline-chromium-install.log"
fi
mkdir -p "$BASELINE_SUITE/baseline"
cp -a "$BASELINE_DIR/." "$BASELINE_SUITE/baseline/"
set +e
(
  cd "$BASELINE_FRONTEND"
  bunx playwright test --config css-migration-regression/playwright.config.ts
) 2>&1 | tee "$RESULTS_DIR/logs/baseline-verify.log"
BASELINE_VERIFY_EXIT=${PIPESTATUS[0]}
set -e

# Preserve baseline failure attachments before the EXIT trap removes the
# temporary worktree. Without this copy, the oracle JSON, screenshot, and trace
# disappear with TMP_ROOT and cannot be inspected from the published result.
if [[ -d "$BASELINE_SUITE/artifacts/test-results" ]]; then
  cp -a "$BASELINE_SUITE/artifacts/test-results" "$RESULTS_DIR/baseline-test-results"
fi
if [[ -d "$BASELINE_SUITE/artifacts/report" ]]; then
  cp -a "$BASELINE_SUITE/artifacts/report" "$RESULTS_DIR/baseline-playwright-report"
fi
if [[ "$BASELINE_VERIFY_EXIT" -ne 0 ]]; then
  fail "Pinned baseline verification failed (exit $BASELINE_VERIFY_EXIT). Preserved its Playwright attachments under $RESULTS_DIR/baseline-test-results."
fi

printf '[CSS regression] Running candidate visual and layout regression suite...\n'
set +e
(
  cd "$FRONTEND_DIR"
  bunx playwright test --config css-migration-regression/playwright.config.ts
) 2>&1 | tee "$RESULTS_DIR/logs/candidate-test.log"
CANDIDATE_TEST_EXIT=${PIPESTATUS[0]}
set -e

[[ -d "$REGRESSION_DIR/artifacts/report" ]] && cp -a "$REGRESSION_DIR/artifacts/report" "$RESULTS_DIR/playwright-report"
[[ -d "$REGRESSION_DIR/artifacts/test-results" ]] && cp -a "$REGRESSION_DIR/artifacts/test-results" "$RESULTS_DIR/test-results"

export CSS_REGRESSION_BASELINE_SHA="$BASELINE_SHA"
export CSS_REGRESSION_CANDIDATE_SHA="$CANDIDATE_SHA"
export CSS_REGRESSION_CANDIDATE_DATE="$CANDIDATE_DATE"
export CSS_REGRESSION_BUN_VERSION="$BUN_VERSION"
export CSS_REGRESSION_TEST_EXIT="$CANDIDATE_TEST_EXIT"
export CSS_REGRESSION_SNAPSHOT_COUNT="$(snapshot_count)"
export CSS_REGRESSION_BRANCH="$BRANCH"
export CSS_REGRESSION_PLATFORM="$(uname -srm)"
export CSS_REGRESSION_NODE="$(node --version 2>/dev/null || printf unavailable)"
export CSS_REGRESSION_GIT_STATUS="$(git status --short)"

python3 - "$RESULTS_DIR" <<'PY'
import json, os, pathlib, sys
from datetime import datetime, timezone

out = pathlib.Path(sys.argv[1])
manifest = {
    "schemaVersion": 1,
    "generatedAtUtc": datetime.now(timezone.utc).isoformat(),
    "repository": "ligl/capitus",
    "branch": os.environ["CSS_REGRESSION_BRANCH"],
    "baselineCommit": os.environ["CSS_REGRESSION_BASELINE_SHA"],
    "candidateCommit": os.environ["CSS_REGRESSION_CANDIDATE_SHA"],
    "candidateCommitDate": os.environ["CSS_REGRESSION_CANDIDATE_DATE"],
    "workingTreeWasCleanAtStart": True,
    "platform": os.environ["CSS_REGRESSION_PLATFORM"],
    "bunVersion": os.environ["CSS_REGRESSION_BUN_VERSION"],
    "nodeVersion": os.environ["CSS_REGRESSION_NODE"],
    "browser": "Playwright Chromium; Desktop Chrome emulation; 1440x900; DPR 1; dark; en-US; UTC",
    "baselineScreenshotCount": int(os.environ["CSS_REGRESSION_SNAPSHOT_COUNT"]),
    "candidateTestExitCode": int(os.environ["CSS_REGRESSION_TEST_EXIT"]),
    "result": "passed" if int(os.environ["CSS_REGRESSION_TEST_EXIT"]) == 0 else "failed",
    "knownCoverageGaps": [
        "Snapshot Reference per-SBar projection oracle is added but has not yet passed a reviewed baseline/candidate run",
        "Compare uses ComparisonChartPlaceholder.vue because SnapshotCompareResultDto does not expose a complete historical SBar OHLCV sequence"
    ]
}
(out / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
summary = f"""# CSS migration regression result

- **Result:** {manifest['result'].upper()}
- **Candidate commit:** `{manifest['candidateCommit']}`
- **Pinned visual baseline:** `{manifest['baselineCommit']}`
- **Generated (UTC):** {manifest['generatedAtUtc']}
- **Environment:** {manifest['platform']}; Bun {manifest['bunVersion']}; Node {manifest['nodeVersion']}
- **Baseline screenshots:** {manifest['baselineScreenshotCount']}
- **Candidate test exit code:** {manifest['candidateTestExitCode']}

## How to review

1. Read `manifest.json` and `logs/candidate-test.log`.
2. Open `playwright-report/index.html` locally if the report was generated.
3. Inspect `test-results/` for screenshot diffs, traces, and failure attachments.
4. Compare the candidate commit against the pinned baseline commit; the suite's pass/fail result is not a substitute for reviewing intentional visual changes.

## Known coverage gaps

""" + "".join(f"- {gap}\n" for gap in manifest["knownCoverageGaps"])
(out / "summary.md").write_text(summary)
PY

printf '\n[CSS regression] Result package: %s\n' "$RESULTS_DIR"
printf '[CSS regression] Candidate result: %s\n' "$([[ "$CANDIDATE_TEST_EXIT" -eq 0 ]] && printf PASS || printf FAIL)"
printf '[CSS regression] Baseline/results will be committed and pushed automatically by the exit handler.\n'
printf '[CSS regression] Keep the temporary css-migration-regression directory until all CSS migration batches are accepted.\n'

exit "$CANDIDATE_TEST_EXIT"
