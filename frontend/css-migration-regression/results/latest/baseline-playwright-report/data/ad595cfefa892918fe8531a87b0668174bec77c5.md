# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Compare placeholder panel, heading, status and empty-state geometry
- Location: css-migration-regression/css-visual-regression.spec.ts:1495:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

@@ -1,8 +1,8 @@
  Object {
    "empty": Object {
-     "backgroundSize": "32px 32px",
+     "backgroundSize": "32px 32px, 32px 32px, 32px 32px",
      "display": "flex",
      "flex": "1 1 auto",
      "padding": "22px 24px",
    },
    "heading": Object {
@@ -18,11 +18,11 @@
      "flexDirection": "column",
      "overflow": "hidden",
    },
    "state": Object {
      "borderRadius": "2px",
-     "display": "inline-flex",
+     "display": "flex",
      "fontSize": "8px",
      "padding": "4px 6px",
    },
    "title": Object {
      "color": "rgb(227, 232, 235)",
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
        - button "03 Compare" [active] [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: COMPARE
        - generic [ref=e19]: STRICT · ORDERED · BAR-BY-BAR
        - generic [ref=e20]: STRICT MODE
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: BASELINE
            - combobox "Baseline Snapshot" [ref=e24]:
              - option "Select baseline" [disabled] [selected]
          - generic [ref=e25]:
            - generic [ref=e26]: CANDIDATE
            - combobox "Candidate Snapshot" [ref=e27]:
              - option "Select candidate" [disabled] [selected]
          - button "RUN COMPARISON" [disabled] [ref=e28]
      - generic [ref=e31]:
        - generic [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: SBAR SEQUENCE
            - generic [ref=e35]: —
          - generic [ref=e36]:
            - generic [ref=e37]: FIRST DIVERGENCE
            - generic [ref=e38]: NOT RUN
          - generic [ref=e39]:
            - generic [ref=e40]: OBJECT DIFFERENCES
            - generic [ref=e41]: —
          - generic [ref=e42]:
            - generic [ref=e43]: IDENTITY
            - generic [ref=e44]: —
          - generic [ref=e45]: SAME COMPLETE ORDERED SBAR SEQUENCE REQUIRED
        - generic [ref=e46]:
          - region "Candidate chart" [ref=e48]:
            - generic [ref=e49]:
              - heading "Candidate" [level=3] [ref=e50]
              - generic [ref=e51]: NO RESULT
            - generic [ref=e52]:
              - generic [aria-hidden] [ref=e53]: —
              - strong [ref=e54]: Historical chart data unavailable
              - paragraph [ref=e55]: Choose two completed Snapshots and run a comparison. Candles will appear only when an authoritative historical SBar sequence is available.
              - generic [ref=e56]: AUTHORITATIVE DATA ONLY · NO SYNTHETIC CANDLES
          - separator "Resize Candidate and Baseline chart panels" [ref=e57]
          - region "Baseline chart" [ref=e59]:
            - generic [ref=e60]:
              - heading "Baseline" [level=3] [ref=e61]
              - generic [ref=e62]: NO RESULT
            - generic [ref=e63]:
              - generic [aria-hidden] [ref=e64]: —
              - strong [ref=e65]: Historical chart data unavailable
              - paragraph [ref=e66]: Choose two completed Snapshots and run a comparison. Candles will appear only when an authoritative historical SBar sequence is available.
              - generic [ref=e67]: AUTHORITATIVE DATA ONLY · NO SYNTHETIC CANDLES
        - group [ref=e68]:
          - generic "SNAPSHOT STORE / DIFFERENCES 0 ARTIFACTS · 0 DIFFERENCES" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]:
              - text: SNAPSHOT STORE
              - generic [ref=e71]: /
              - text: DIFFERENCES
            - generic [ref=e72]: 0 ARTIFACTS · 0 DIFFERENCES
    - complementary [ref=e73]:
      - separator "Resize Inspector" [ref=e74]
      - generic [ref=e75]:
        - generic "Drag to any workbench edge to dock" [ref=e76]: Inspector
        - generic [ref=e77]: OBJECT
        - group [ref=e78]:
          - generic "Move Inspector" [ref=e79] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e80] [cursor=pointer]: −
      - generic [ref=e82]:
        - generic [ref=e83]: Δ/
        - heading "Compare Inspector" [level=3] [ref=e84]
        - paragraph [ref=e85]: Select an object difference in the Compare results to inspect its domain identity, checkpoint and exact property deltas.
        - generic [ref=e86]: Validated Compare result only
    - generic [ref=e88]:
      - navigation "Diagnostic categories" [ref=e89]:
        - button "ALL" [pressed] [ref=e90] [cursor=pointer]
        - button "ERRORS" [ref=e91] [cursor=pointer]
        - button "WARNINGS" [ref=e92] [cursor=pointer]
        - button "REPLAY" [ref=e93] [cursor=pointer]
        - button "STRUCTURE" [ref=e94] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e95] [cursor=pointer]
        - button "VALIDATION" [ref=e96] [cursor=pointer]
        - button "DIFFERENCES" [ref=e97] [cursor=pointer]
      - generic [ref=e98]:
        - group [ref=e99]:
          - generic "Move Diagnostics" [ref=e100] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e101] [cursor=pointer]: +
```

# Test source

```ts
  1451 |         letterSpacing: integrityStyle.letterSpacing,
  1452 |       },
  1453 |       separator: {
  1454 |         paddingInline: separatorStyle.paddingInline,
  1455 |         color: separatorStyle.color,
  1456 |         fontStyle: separatorStyle.fontStyle,
  1457 |       },
  1458 |     };
  1459 |   });
  1460 | 
  1461 |   expect(styles.mark).toEqual({
  1462 |     display: "grid",
  1463 |     width: "28px",
  1464 |     height: "28px",
  1465 |     borderRadius: "3px",
  1466 |     color: "rgb(137, 148, 157)",
  1467 |     fontSize: "8px",
  1468 |     lineHeight: "normal",
  1469 |     rect: { width: 28, height: 28 },
  1470 |   });
  1471 |   expect(styles.heading).toEqual({
  1472 |     marginTop: "3px",
  1473 |     fontSize: "12px",
  1474 |     letterSpacing: "0.12px",
  1475 |   });
  1476 |   expect(styles.description).toEqual({
  1477 |     maxWidth: "560px",
  1478 |     fontSize: "10px",
  1479 |     lineHeight: "16.5px",
  1480 |   });
  1481 |   expect(styles.integrity).toEqual({
  1482 |     marginTop: "4px",
  1483 |     color: "rgb(137, 148, 157)",
  1484 |     fontSize: "8px",
  1485 |     letterSpacing: "0.8px",
  1486 |   });
  1487 |   expect(styles.separator).toEqual({
  1488 |     paddingInline: "3px",
  1489 |     color: "rgb(179, 138, 80)",
  1490 |     fontStyle: "normal",
  1491 |   });
  1492 | });
  1493 | 
  1494 | 
  1495 | test("preserves Compare placeholder panel, heading, status and empty-state geometry", async ({ page }) => {
  1496 |   await page.setViewportSize({ width: 1440, height: 900 });
  1497 |   await page.goto("/");
  1498 |   await page.getByTestId("workspace-compare").click();
  1499 | 
  1500 |   const chart = page.getByTestId("compare-candidate-chart");
  1501 |   await expect(chart).toBeVisible();
  1502 |   const geometry = await chart.evaluate((element) => {
  1503 |     const heading = element.querySelector<HTMLElement>(".comparison-chart-heading");
  1504 |     const title = heading?.querySelector<HTMLElement>("h3");
  1505 |     const state = heading?.querySelector<HTMLElement>(".comparison-chart-state");
  1506 |     const empty = element.querySelector<HTMLElement>(".comparison-chart-empty");
  1507 |     if (!heading || !title || !state || !empty) {
  1508 |       throw new Error("Compare placeholder surface elements are missing");
  1509 |     }
  1510 |     const panelStyle = getComputedStyle(element);
  1511 |     const headingStyle = getComputedStyle(heading);
  1512 |     const titleStyle = getComputedStyle(title);
  1513 |     const stateStyle = getComputedStyle(state);
  1514 |     const emptyStyle = getComputedStyle(empty);
  1515 |     return {
  1516 |       panel: {
  1517 |         display: panelStyle.display,
  1518 |         backgroundColor: panelStyle.backgroundColor,
  1519 |         borderTopWidth: panelStyle.borderTopWidth,
  1520 |         flexDirection: panelStyle.flexDirection,
  1521 |         overflow: panelStyle.overflow,
  1522 |       },
  1523 |       heading: {
  1524 |         display: headingStyle.display,
  1525 |         minHeight: headingStyle.minHeight,
  1526 |         padding: headingStyle.padding,
  1527 |         backgroundColor: headingStyle.backgroundColor,
  1528 |       },
  1529 |       title: {
  1530 |         margin: titleStyle.margin,
  1531 |         color: titleStyle.color,
  1532 |         fontSize: titleStyle.fontSize,
  1533 |         lineHeight: titleStyle.lineHeight,
  1534 |         letterSpacing: titleStyle.letterSpacing,
  1535 |       },
  1536 |       state: {
  1537 |         display: stateStyle.display,
  1538 |         padding: stateStyle.padding,
  1539 |         borderRadius: stateStyle.borderRadius,
  1540 |         fontSize: stateStyle.fontSize,
  1541 |       },
  1542 |       empty: {
  1543 |         display: emptyStyle.display,
  1544 |         flex: emptyStyle.flex,
  1545 |         padding: emptyStyle.padding,
  1546 |         backgroundSize: emptyStyle.backgroundSize,
  1547 |       },
  1548 |     };
  1549 |   });
  1550 | 
> 1551 |   expect(geometry).toEqual({
       |                    ^ Error: expect(received).toEqual(expected) // deep equality
  1552 |     panel: {
  1553 |       display: "flex",
  1554 |       backgroundColor: "rgb(18, 22, 25)",
  1555 |       borderTopWidth: "1px",
  1556 |       flexDirection: "column",
  1557 |       overflow: "hidden",
  1558 |     },
  1559 |     heading: {
  1560 |       display: "flex",
  1561 |       minHeight: "30px",
  1562 |       padding: "2px 10px",
  1563 |       backgroundColor: "rgb(25, 30, 34)",
  1564 |     },
  1565 |     title: {
  1566 |       margin: "0px",
  1567 |       color: "rgb(227, 232, 235)",
  1568 |       fontSize: "11px",
  1569 |       lineHeight: "11px",
  1570 |       letterSpacing: "0.44px",
  1571 |     },
  1572 |     state: {
  1573 |       display: "inline-flex",
  1574 |       padding: "4px 6px",
  1575 |       borderRadius: "2px",
  1576 |       fontSize: "8px",
  1577 |     },
  1578 |     empty: {
  1579 |       display: "flex",
  1580 |       flex: "1 1 auto",
  1581 |       padding: "22px 24px",
  1582 |       backgroundSize: "32px 32px",
  1583 |     },
  1584 |   });
  1585 | });
  1586 | 
  1587 | test("preserves Snapshot Reference loading spinner geometry and reduced-motion behavior", async ({ page }) => {
  1588 |   await page.setViewportSize({ width: 1440, height: 900 });
  1589 |   await installDeterministicOrigin(page, 12);
  1590 |   await page.addInitScript(() => {
  1591 |     (window as typeof window & { __CSS_REGRESSION_HOLD_SNAPSHOT_REFERENCE__?: boolean })
  1592 |       .__CSS_REGRESSION_HOLD_SNAPSHOT_REFERENCE__ = true;
  1593 |   });
  1594 |   await page.goto("/");
  1595 |   await page.getByTestId("workspace-replay").click();
  1596 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  1597 | 
  1598 |   const spinner = page.locator('[data-testid="snapshot-reference-loading"] .snapshot-reference-loading-spinner');
  1599 |   await expect(spinner).toBeVisible();
  1600 |   const normal = await spinner.evaluate((element) => {
  1601 |     const style = getComputedStyle(element);
  1602 |     return {
  1603 |       width: style.width,
  1604 |       height: style.height,
  1605 |       borderTopWidth: style.borderTopWidth,
  1606 |       borderTopStyle: style.borderTopStyle,
  1607 |       borderTopColor: style.borderTopColor,
  1608 |       borderLeftColor: style.borderLeftColor,
  1609 |       borderRadius: style.borderRadius,
  1610 |       animationName: style.animationName,
  1611 |       animationDuration: style.animationDuration,
  1612 |       animationTimingFunction: style.animationTimingFunction,
  1613 |       animationIterationCount: style.animationIterationCount,
  1614 |     };
  1615 |   });
  1616 |   const { animationName, ...normalGeometry } = normal;
  1617 |   expect(normalGeometry).toEqual({
  1618 |     width: "26px",
  1619 |     height: "26px",
  1620 |     borderTopWidth: "2px",
  1621 |     borderTopStyle: "solid",
  1622 |     borderTopColor: "rgb(217, 154, 69)",
  1623 |     borderLeftColor: "rgb(52, 60, 66)",
  1624 |     borderRadius: "50%",
  1625 |     animationDuration: "0.8s",
  1626 |     animationTimingFunction: "linear",
  1627 |     animationIterationCount: "infinite",
  1628 |   });
  1629 |   // Vue scopes keyframe names in SFC styles, so the runtime name may carry a
  1630 |   // generated hash suffix. Assert the semantic name, not the compiler artifact.
  1631 |   expect(animationName).toMatch(/^snapshot-reference-spin(?:-[a-f0-9]+)?$/);
  1632 | 
  1633 |   await page.emulateMedia({ reducedMotion: "reduce" });
  1634 |   await expect.poll(() => spinner.evaluate((element) => getComputedStyle(element).animationDuration)).toBe("2.4s");
  1635 | });
  1636 | 
  1637 | 
  1638 | test("preserves Snapshot Reference title row internal layout", async ({ page }) => {
  1639 |   await page.setViewportSize({ width: 1440, height: 900 });
  1640 |   await page.goto("/");
  1641 |   await page.getByTestId("workspace-replay").click();
  1642 | 
  1643 |   const panel = page.getByTestId("snapshot-reference-panel");
  1644 |   const title = panel.locator(".snapshot-reference-title");
  1645 |   await expect(title).toBeVisible();
  1646 | 
  1647 |   const styles = await title.evaluate((element) => {
  1648 |     const computed = getComputedStyle(element);
  1649 |     const rect = element.getBoundingClientRect();
  1650 |     return {
  1651 |       display: computed.display,
```