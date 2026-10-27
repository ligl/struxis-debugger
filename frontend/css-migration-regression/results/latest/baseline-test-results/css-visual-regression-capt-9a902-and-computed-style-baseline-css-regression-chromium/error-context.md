# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> captures workbench visual and computed-style baseline
- Location: css-migration-regression/css-visual-regression.spec.ts:278:1

# Error details

```
Error: page.evaluate: ReferenceError: rect is not defined
    at eval (eval at evaluate (:370:30), <anonymous>:14:20)
    at Array.map (<anonymous>)
    at eval (eval at evaluate (:370:30), <anonymous>:3:32)
    at UtilityScript.evaluate (<anonymous>:372:16)
    at UtilityScript.<anonymous> (<anonymous>:1:44)
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T":
    - list
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [aria-hidden] [ref=e6]: Sx
        - generic [ref=e7]: STRUXIS DEBUGGER
      - navigation "Debugger workspace" [ref=e8]:
        - button "01 Dataset" [ref=e9]
        - button "02 Replay" [ref=e10]
        - button "03 Compare" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: DATASET
        - generic [ref=e19]: CATALOG / ORIGIN / INCLUSIVE INTERVAL
        - generic [ref=e20]: ORIGIN LOAD
      - generic [ref=e22]:
        - generic [ref=e25]:
          - region "Catalog source controls" [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e28]: DATASET
              - combobox "DATASET" [disabled] [ref=e29]:
                - option "NO STREAMS" [selected]
            - button "Refresh Catalog" [ref=e30] [cursor=pointer]: ↻
            - generic [ref=e31] [cursor=pointer]:
              - checkbox "STRUCTURE" [checked] [ref=e32]
              - generic [ref=e33]: STRUCTURE
            - button "LOAD ORIGIN" [disabled] [ref=e34]
            - group [ref=e35]:
              - generic "Catalog and Origin status" [ref=e36] [cursor=pointer]: i
          - generic [ref=e37]:
            - generic [ref=e38]: Load Origin to select interval
            - generic [ref=e39]: Click anywhere in the chart plot to select the start time of your Test interval.
          - link "SELECT ALL SBARS" [disabled]:
            - /url: "#"
          - button "CREATE TEST DATASET" [disabled] [ref=e40]
          - button "TEST DETAILS" [disabled] [ref=e41]
        - region "Origin chart empty state" [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e48]: DATASET / ORIGIN
            - heading "ORIGIN DATA NOT LOADED" [level=2] [ref=e49]
            - paragraph [ref=e50]:
              - text: Select a dataset in Catalog, then click
              - strong [ref=e51]: LOAD
              - text: to populate the chart.
            - generic "Load workflow" [ref=e52]:
              - generic [ref=e53]: SELECT DATASET
              - generic [ref=e54]: →
              - generic [ref=e55]: LOAD
              - generic [ref=e56]: →
              - generic [ref=e57]: INSPECT SBARS
    - complementary [ref=e58]:
      - separator "Resize Inspector" [ref=e59]
      - generic [ref=e60]:
        - generic "Drag to any workbench edge to dock" [ref=e61]: Inspector
        - generic [ref=e62]: OBJECT
        - group [ref=e63]:
          - generic "Move Inspector" [ref=e64] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e65] [cursor=pointer]: −
      - generic [ref=e67]:
        - generic [ref=e68]: S/
        - heading "Object Inspector" [level=3] [ref=e69]
        - paragraph [ref=e70]: Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.
        - generic [ref=e71]: Authoritative Origin data only
    - generic [ref=e73]:
      - navigation "Diagnostic categories" [ref=e74]:
        - button "ALL" [pressed] [ref=e75] [cursor=pointer]
        - button "ERRORS" [ref=e76] [cursor=pointer]
        - button "WARNINGS" [ref=e77] [cursor=pointer]
        - button "REPLAY" [ref=e78] [cursor=pointer]
        - button "STRUCTURE" [ref=e79] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e80] [cursor=pointer]
        - button "VALIDATION" [ref=e81] [cursor=pointer]
        - button "DIFFERENCES" [ref=e82] [cursor=pointer]
      - generic [ref=e83]:
        - group [ref=e84]:
          - generic "Move Diagnostics" [ref=e85] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e86] [cursor=pointer]: +
```