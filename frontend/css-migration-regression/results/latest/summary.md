# CSS migration regression result

- **Result:** PASSED
- **Candidate commit:** `5bf61a51675c88bfaac9f26d316d54c24d823e52`
- **Pinned visual baseline:** `171254d0bbdad139f51ba1550e8379899d8f6ca6`
- **Generated (UTC):** 2026-10-26T19:30:51.206992+00:00
- **Environment:** Linux 7.0.0-38-generic x86_64; Bun 1.4.3; Node v22.22.2
- **Baseline screenshots:** 22
- **Candidate test exit code:** 0

## How to review

1. Read `manifest.json` and `logs/candidate-test.log`.
2. Open `playwright-report/index.html` locally if the report was generated.
3. Inspect `test-results/` for screenshot diffs, traces, and failure attachments.
4. Compare the candidate commit against the pinned baseline commit; the suite's pass/fail result is not a substitute for reviewing intentional visual changes.

## Known coverage gaps

- Replay progress transitions and Live/Snapshot viewport-crosshair synchronization interactions
- Real Snapshot Reference chart projection parity has not been independently established
- Compare uses ComparisonChartPlaceholder.vue, not real Candidate/Baseline market charts
