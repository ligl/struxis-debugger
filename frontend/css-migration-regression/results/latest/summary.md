# CSS migration regression result

- **Result:** PASSED
- **Candidate commit:** `2585fb552eefada7c0cee74cbf5d6a99045abad3`
- **Pinned visual baseline:** `171254d0bbdad139f51ba1550e8379899d8f6ca6`
- **Generated (UTC):** 2026-10-27T07:51:36.858741+00:00
- **Environment:** Linux 7.0.0-38-generic x86_64; Bun 1.4.3; Node v22.22.2
- **Baseline screenshots:** 22
- **Candidate test exit code:** 0

## How to review

1. Read `manifest.json` and `logs/candidate-test.log`.
2. Open `playwright-report/index.html` locally if the report was generated.
3. Inspect `test-results/` for screenshot diffs, traces, and failure attachments.
4. Compare the candidate commit against the pinned baseline commit; the suite's pass/fail result is not a substitute for reviewing intentional visual changes.

## Known coverage gaps

- Snapshot Reference per-SBar projection oracle is added but has not yet passed a reviewed baseline/candidate run
- Compare uses ComparisonChartPlaceholder.vue because SnapshotCompareResultDto does not expose a complete historical SBar OHLCV sequence
