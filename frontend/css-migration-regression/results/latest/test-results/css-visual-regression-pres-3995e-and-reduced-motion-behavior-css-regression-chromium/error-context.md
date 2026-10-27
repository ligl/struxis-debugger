# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Snapshot Reference loading spinner geometry and reduced-motion behavior
- Location: css-migration-regression/css-visual-regression.spec.ts:1472:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

@@ -1,9 +1,9 @@
  Object {
    "animationDuration": "0.8s",
    "animationIterationCount": "infinite",
-   "animationName": "snapshot-reference-spin",
+   "animationName": "snapshot-reference-spin-9e0fe81f",
    "animationTimingFunction": "linear",
    "borderLeftColor": "rgb(52, 60, 66)",
    "borderRadius": "50%",
    "borderTopColor": "rgb(217, 154, 69)",
    "borderTopStyle": "solid",
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
        - generic [ref=e13]: ORIGIN AVAILABLE
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: REPLAY
        - generic [ref=e19]: TEST DATASET
        - generic [ref=e20]: BTCUSDT.SIM · 1m · 36 SBARS · 2026-09-21 14:13 → 2026-09-21 14:48
        - generic [ref=e21]:
          - group "Replay transport controls" [ref=e22]:
            - button "STOP" [ref=e23] [cursor=pointer]
            - button "STEP ▶|" [ref=e24] [cursor=pointer]
            - button "▶ PLAY" [ref=e25] [cursor=pointer]
            - button "倍速" [ref=e27] [cursor=pointer]
          - generic [ref=e28]:
            - generic [ref=e29]: PAUSED
            - generic [ref=e30]: 12 / 36
          - progressbar "Replay progress" [ref=e31]
          - button "SAVE SNAPSHOT" [disabled] [ref=e33]
      - generic [ref=e37]:
        - region "Live Replay SBar chart" [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e42]:
              - generic [ref=e43]: LIVE REPLAY · BTCUSDT-1-MINUTE-LAST-EXTERNAL
              - generic [ref=e44]: LIVE
            - generic [ref=e45]:
              - generic [ref=e46]: 36 SBARS
              - button "FIT" [ref=e47] [cursor=pointer]
          - generic [ref=e48]:
            - region "Live Replay SBar chart" [ref=e49]:
              - generic "Candlestick and volume chart for Test Dataset css-regression-fixture-test" [ref=e51]:
                - table [ref=e53]:
                  - row [ref=e54]:
                    - cell
                    - cell [ref=e55]
                    - cell [ref=e59]
                  - row [ref=e63]:
                    - cell
                    - cell [ref=e64]
                    - cell [ref=e68]
            - group "Chart layer visibility":
              - button "SBar" [pressed] [ref=e71] [cursor=pointer]
              - button "CBar" [disabled] [pressed] [ref=e73]
              - button "Swing" [disabled] [pressed] [ref=e75]
              - button "Volume" [pressed] [ref=e77] [cursor=pointer]
        - separator "Resize Live Replay and Snapshot Reference chart panels" [ref=e79]
        - generic [ref=e81]:
          - generic [ref=e82]:
            - heading "SNAPSHOT REFERENCE" [level=3] [ref=e84]
            - generic [ref=e85]:
              - generic [ref=e86]: BTCUSDT.SIM
              - generic [ref=e87] [cursor=pointer]:
                - generic [aria-hidden]: 1m · 2026-09-21 14:13 → 2026-09-21 14:48
                - combobox "Snapshot Reference for BTCUSDT.SIM" [ref=e88]:
                  - option "Choose completed Snapshot…"
                  - option "1m · 2026-09-21 14:13 → 2026-09-21 14:48 · 2026-10-26T00:00:00Z" [selected]
          - status [ref=e90]:
            - strong [ref=e92]: LOADING SNAPSHOT
            - generic [ref=e93]: Validating historical SBar data…
    - complementary [ref=e94]:
      - separator "Resize Inspector" [ref=e95]
      - generic [ref=e96]:
        - generic "Drag to any workbench edge to dock" [ref=e97]: Inspector
        - generic [ref=e98]: OBJECT
        - group [ref=e99]:
          - generic "Move Inspector" [ref=e100] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e101] [cursor=pointer]: −
      - generic [ref=e103]:
        - generic [ref=e104]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e105]
        - paragraph [ref=e106]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e107]: No inferred or fabricated domain state is displayed.
    - generic [ref=e109]:
      - navigation "Diagnostic categories" [ref=e110]:
        - button "ALL" [pressed] [ref=e111] [cursor=pointer]
        - button "ERRORS" [ref=e112] [cursor=pointer]
        - button "WARNINGS" [ref=e113] [cursor=pointer]
        - button "REPLAY" [ref=e114] [cursor=pointer]
        - button "STRUCTURE" [ref=e115] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e116] [cursor=pointer]
        - button "VALIDATION" [ref=e117] [cursor=pointer]
        - button "DIFFERENCES" [ref=e118] [cursor=pointer]
      - generic [ref=e119]:
        - group [ref=e120]:
          - generic "Move Diagnostics" [ref=e121] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e122] [cursor=pointer]: +
```

# Test source

```ts
  1401 |     const separatorStyle = getComputedStyle(separator);
  1402 |     const rect = mark.getBoundingClientRect();
  1403 |     return {
  1404 |       mark: {
  1405 |         display: markStyle.display,
  1406 |         width: markStyle.width,
  1407 |         height: markStyle.height,
  1408 |         borderRadius: markStyle.borderRadius,
  1409 |         color: markStyle.color,
  1410 |         fontSize: markStyle.fontSize,
  1411 |         lineHeight: markStyle.lineHeight,
  1412 |         rect: { width: rect.width, height: rect.height },
  1413 |       },
  1414 |       heading: {
  1415 |         marginTop: headingStyle.marginTop,
  1416 |         fontSize: headingStyle.fontSize,
  1417 |         letterSpacing: headingStyle.letterSpacing,
  1418 |       },
  1419 |       description: {
  1420 |         maxWidth: descriptionStyle.maxWidth,
  1421 |         fontSize: descriptionStyle.fontSize,
  1422 |         lineHeight: descriptionStyle.lineHeight,
  1423 |       },
  1424 |       integrity: {
  1425 |         marginTop: integrityStyle.marginTop,
  1426 |         color: integrityStyle.color,
  1427 |         fontSize: integrityStyle.fontSize,
  1428 |         letterSpacing: integrityStyle.letterSpacing,
  1429 |       },
  1430 |       separator: {
  1431 |         paddingInline: separatorStyle.paddingInline,
  1432 |         color: separatorStyle.color,
  1433 |         fontStyle: separatorStyle.fontStyle,
  1434 |       },
  1435 |     };
  1436 |   });
  1437 | 
  1438 |   expect(styles.mark).toEqual({
  1439 |     display: "grid",
  1440 |     width: "28px",
  1441 |     height: "28px",
  1442 |     borderRadius: "3px",
  1443 |     color: "rgb(137, 148, 157)",
  1444 |     fontSize: "8px",
  1445 |     lineHeight: "normal",
  1446 |     rect: { width: 28, height: 28 },
  1447 |   });
  1448 |   expect(styles.heading).toEqual({
  1449 |     marginTop: "3px",
  1450 |     fontSize: "12px",
  1451 |     letterSpacing: "0.12px",
  1452 |   });
  1453 |   expect(styles.description).toEqual({
  1454 |     maxWidth: "560px",
  1455 |     fontSize: "10px",
  1456 |     lineHeight: "16.5px",
  1457 |   });
  1458 |   expect(styles.integrity).toEqual({
  1459 |     marginTop: "4px",
  1460 |     color: "rgb(137, 148, 157)",
  1461 |     fontSize: "8px",
  1462 |     letterSpacing: "0.8px",
  1463 |   });
  1464 |   expect(styles.separator).toEqual({
  1465 |     paddingInline: "3px",
  1466 |     color: "rgb(179, 138, 80)",
  1467 |     fontStyle: "normal",
  1468 |   });
  1469 | });
  1470 | 
  1471 | 
  1472 | test("preserves Snapshot Reference loading spinner geometry and reduced-motion behavior", async ({ page }) => {
  1473 |   await page.setViewportSize({ width: 1440, height: 900 });
  1474 |   await installDeterministicOrigin(page, 12);
  1475 |   await page.addInitScript(() => {
  1476 |     (window as typeof window & { __CSS_REGRESSION_HOLD_SNAPSHOT_REFERENCE__?: boolean })
  1477 |       .__CSS_REGRESSION_HOLD_SNAPSHOT_REFERENCE__ = true;
  1478 |   });
  1479 |   await page.goto("/");
  1480 |   await page.getByTestId("workspace-replay").click();
  1481 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  1482 | 
  1483 |   const spinner = page.locator('[data-testid="snapshot-reference-loading"] .snapshot-reference-loading-spinner');
  1484 |   await expect(spinner).toBeVisible();
  1485 |   const normal = await spinner.evaluate((element) => {
  1486 |     const style = getComputedStyle(element);
  1487 |     return {
  1488 |       width: style.width,
  1489 |       height: style.height,
  1490 |       borderTopWidth: style.borderTopWidth,
  1491 |       borderTopStyle: style.borderTopStyle,
  1492 |       borderTopColor: style.borderTopColor,
  1493 |       borderLeftColor: style.borderLeftColor,
  1494 |       borderRadius: style.borderRadius,
  1495 |       animationName: style.animationName,
  1496 |       animationDuration: style.animationDuration,
  1497 |       animationTimingFunction: style.animationTimingFunction,
  1498 |       animationIterationCount: style.animationIterationCount,
  1499 |     };
  1500 |   });
> 1501 |   expect(normal).toEqual({
       |                  ^ Error: expect(received).toEqual(expected) // deep equality
  1502 |     width: "26px",
  1503 |     height: "26px",
  1504 |     borderTopWidth: "2px",
  1505 |     borderTopStyle: "solid",
  1506 |     borderTopColor: "rgb(217, 154, 69)",
  1507 |     borderLeftColor: "rgb(52, 60, 66)",
  1508 |     borderRadius: "50%",
  1509 |     animationName: "snapshot-reference-spin",
  1510 |     animationDuration: "0.8s",
  1511 |     animationTimingFunction: "linear",
  1512 |     animationIterationCount: "infinite",
  1513 |   });
  1514 | 
  1515 |   await page.emulateMedia({ reducedMotion: "reduce" });
  1516 |   await expect.poll(() => spinner.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("2.4s");
  1517 | });
  1518 | 
```