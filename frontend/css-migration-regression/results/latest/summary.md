# CSS migration regression result

- **Result:** FAILED
- **Candidate commit:** `a181631b4651f4166c9afcaabae5deb674620dc0`
- **Pinned visual baseline:** `171254d0bbdad139f51ba1550e8379899d8f6ca6`
- **Generated (UTC):** 2026-10-27T10:48:04.799422+00:00
- **Environment:** Linux 7.0.0-38-generic x86_64; Bun 1.4.3; Node v22.22.2
- **Baseline screenshots:** 22
- **Candidate test exit code:** 1

## How to review

1. Read `manifest.json` and `logs/candidate-test.log`.
2. Open `playwright-report/index.html` locally if the report was generated.
3. Inspect `test-results/` for screenshot diffs, traces, and failure attachments.
4. Compare the candidate commit against the pinned baseline commit; the suite's pass/fail result is not a substitute for reviewing intentional visual changes.

## Known coverage gaps

- Snapshot Reference per-SBar projection oracle is added but has not yet passed a reviewed baseline/candidate run
- Compare uses ComparisonChartPlaceholder.vue because SnapshotCompareResultDto does not expose a complete historical SBar OHLCV sequence
