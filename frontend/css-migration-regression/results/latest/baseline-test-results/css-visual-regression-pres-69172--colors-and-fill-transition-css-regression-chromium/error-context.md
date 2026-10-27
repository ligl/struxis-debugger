# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Replay progress bar geometry, colors and fill transition
- Location: css-migration-regression/css-visual-regression.spec.ts:1206:1

# Error details

```
Error: locator.evaluate: ReferenceError: rect is not defined
    at eval (eval at evaluate (:370:30), <anonymous>:25:27)
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
        - button "02 Replay" [active] [ref=e10]
        - button "03 Compare" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: REPLAY
        - generic [ref=e19]: TEST DATASET
        - generic [ref=e20]: NO TEST DATASET · CREATE AN INCLUSIVE INTERVAL
        - generic [ref=e21]:
          - group "Replay transport controls" [ref=e22]:
            - button "START" [disabled] [ref=e23]
            - button "STEP ▶|" [disabled] [ref=e24]
            - button "▶ PLAY" [disabled] [ref=e25]
            - button "倍速" [ref=e27] [cursor=pointer]
          - generic [ref=e28]:
            - generic [ref=e29]: NO RUN
            - generic [ref=e30]: —
          - progressbar "Replay progress" [ref=e31]
          - button "SAVE SNAPSHOT" [disabled] [ref=e32]
      - generic [ref=e36]:
        - region "Live Replay SBar chart" [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e41]:
              - generic [ref=e42]: LIVE REPLAY · NO TEST
              - generic [ref=e43]: LIVE
            - generic [ref=e44]:
              - generic [ref=e45]: 0 SBARS
              - button "FIT" [disabled] [ref=e46]
          - generic [ref=e47]:
            - generic:
              - generic:
                - generic: REPLAY INPUT
                - strong: LIVE REPLAY DATA NOT LOADED
                - paragraph: Create a Test Dataset to view its fixed input sequence.
                - generic "Replay data workflow":
                  - generic: LOAD ORIGIN
                  - generic: →
                  - generic: CREATE TEST DATASET
                  - generic: →
                  - generic: LIVE REPLAY
            - region "Live Replay SBar chart" [ref=e48]:
              - generic "Candlestick and volume chart for Test Dataset not selected" [ref=e50]:
                - table [ref=e52]:
                  - row [ref=e53]:
                    - cell
                    - cell [ref=e54]
                    - cell [ref=e58]
                  - row [ref=e62]:
                    - cell
                    - cell [ref=e63]
                    - cell [ref=e67]
        - separator "Resize Live Replay and Snapshot Reference chart panels" [ref=e70]
        - generic [ref=e72]:
          - generic [ref=e73]:
            - heading "SNAPSHOT REFERENCE" [level=3] [ref=e75]
            - generic [ref=e76]:
              - generic [ref=e77]: INSTRUMENT
              - generic [ref=e78] [cursor=pointer]:
                - generic [aria-hidden]: Choose completed Snapshot…
                - combobox "Snapshot Reference for INSTRUMENT" [disabled] [ref=e79]:
                  - option "Choose completed Snapshot…" [selected]
          - generic [ref=e81]:
            - strong [ref=e82]: NO COMPLETED SNAPSHOT AVAILABLE
            - paragraph [ref=e83]: A completed Run Snapshot will appear here after it is published and discovered.
    - complementary [ref=e84]:
      - separator "Resize Inspector" [ref=e85]
      - generic [ref=e86]:
        - generic "Drag to any workbench edge to dock" [ref=e87]: Inspector
        - generic [ref=e88]: OBJECT
        - group [ref=e89]:
          - generic "Move Inspector" [ref=e90] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e91] [cursor=pointer]: −
      - generic [ref=e93]:
        - generic [ref=e94]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e95]
        - paragraph [ref=e96]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e97]: No inferred or fabricated domain state is displayed.
    - generic [ref=e99]:
      - navigation "Diagnostic categories" [ref=e100]:
        - button "ALL" [pressed] [ref=e101] [cursor=pointer]
        - button "ERRORS" [ref=e102] [cursor=pointer]
        - button "WARNINGS" [ref=e103] [cursor=pointer]
        - button "REPLAY" [ref=e104] [cursor=pointer]
        - button "STRUCTURE" [ref=e105] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e106] [cursor=pointer]
        - button "VALIDATION" [ref=e107] [cursor=pointer]
        - button "DIFFERENCES" [ref=e108] [cursor=pointer]
      - generic [ref=e109]:
        - group [ref=e110]:
          - generic "Move Diagnostics" [ref=e111] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e112] [cursor=pointer]: +
```