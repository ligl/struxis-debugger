# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves shell geometry at minimum viewport
- Location: css-migration-regression/css-visual-regression.spec.ts:391:3

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
            - checkbox [checked] [ref=e32] [cursor=pointer]
            - button "LOAD ORIGIN" [disabled] [ref=e33]
            - group [ref=e34]:
              - generic "Catalog and Origin status" [ref=e35] [cursor=pointer]: i
          - generic [ref=e36]: Load Origin to select interval
          - link "SELECT ALL SBARS" [disabled]:
            - /url: "#"
          - button "CREATE TEST DATASET" [disabled] [ref=e38]
          - button "TEST DETAILS" [disabled] [ref=e39]
        - region "Origin chart empty state" [ref=e40]:
          - generic [ref=e41]:
            - generic [ref=e46]: DATASET / ORIGIN
            - heading "ORIGIN DATA NOT LOADED" [level=2] [ref=e47]
            - paragraph [ref=e48]:
              - text: Select a dataset in Catalog, then click
              - strong [ref=e49]: LOAD
              - text: to populate the chart.
            - generic "Load workflow" [ref=e50]:
              - generic [ref=e51]: SELECT DATASET
              - generic [ref=e52]: →
              - generic [ref=e53]: LOAD
              - generic [ref=e54]: →
              - generic [ref=e55]: INSPECT SBARS
    - complementary [ref=e56]:
      - separator "Resize Inspector" [ref=e57]
      - generic [ref=e58]:
        - generic "Drag to any workbench edge to dock" [ref=e59]: Inspector
        - generic [ref=e60]: OBJECT
        - group [ref=e61]:
          - generic "Move Inspector" [ref=e62] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e63] [cursor=pointer]: −
      - generic [ref=e65]:
        - generic [ref=e66]: S/
        - heading "Object Inspector" [level=3] [ref=e67]
        - paragraph [ref=e68]: Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.
        - generic [ref=e69]: Authoritative Origin data only
    - generic [ref=e71]:
      - navigation "Diagnostic categories" [ref=e72]:
        - button "ALL" [pressed] [ref=e73] [cursor=pointer]
        - button "ERRORS" [ref=e74] [cursor=pointer]
        - button "WARNINGS" [ref=e75] [cursor=pointer]
        - button "REPLAY" [ref=e76] [cursor=pointer]
        - button "STRUCTURE" [ref=e77] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e78] [cursor=pointer]
        - button "VALIDATION" [ref=e79] [cursor=pointer]
        - button "DIFFERENCES" [ref=e80] [cursor=pointer]
      - generic [ref=e81]:
        - group [ref=e82]:
          - generic "Move Diagnostics" [ref=e83] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e84] [cursor=pointer]: +
```