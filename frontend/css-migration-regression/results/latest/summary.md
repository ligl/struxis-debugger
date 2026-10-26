# CSS migration regression result

- **Result:** PASSED
- **Candidate commit:** `ad13d5129343ac2f895c744a8c99bcc5177b0b4f`
- **Pinned visual baseline:** `171254d0bbdad139f51ba1550e8379899d8f6ca6`
- **Generated (UTC):** 2026-10-26T19:21:22.786728+00:00
- **Environment:** Linux 7.0.0-38-generic x86_64; Bun 1.4.3; Node v22.22.2
- **Baseline screenshots:** 22
- **Candidate test exit code:** 0

## How to review

1. Read `manifest.json` and `logs/candidate-test.log`.
2. Open `playwright-report/index.html` locally if the report was generated.
3. Inspect `test-results/` for screenshot diffs, traces, and failure attachments.
4. Compare the candidate commit against the pinned baseline commit; the suite's pass/fail result is not a substitute for reviewing intentional visual changes.

## Known coverage gaps

- Real Snapshot Reference chart projection
- Inspector dock resize interaction
- Full Inspector/Diagnostics drag-resize interaction matrix
- Compare uses ComparisonChartPlaceholder.vue, not real Candidate/Baseline market charts
