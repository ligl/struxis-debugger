# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> projects every Snapshot Reference candle from the independent SBar fixture oracle
- Location: css-migration-regression/css-visual-regression.spec.ts:567:1

# Error details

```
Error: every fixture SBar should have a distinct rendered candle color column

expect(received).toHaveLength(expected)

Expected length: 36
Received length: 1
Received array:  [{"color": "#2e4239", "end": 949, "start": 13}]
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
            - generic [ref=e83]:
              - heading "SNAPSHOT REFERENCE" [level=3] [ref=e84]
              - img "Viewport synchronization available" [ref=e85]: ↕
            - generic [ref=e86]:
              - generic [ref=e87]: BTCUSDT.SIM
              - generic [ref=e88] [cursor=pointer]:
                - generic [aria-hidden]: 1m · 2026-09-21 14:13 → 2026-09-21 14:48
                - combobox "Snapshot Reference for BTCUSDT.SIM" [ref=e89]:
                  - option "Choose completed Snapshot…"
                  - option "1m · 2026-09-21 14:13 → 2026-09-21 14:48 · 2026-10-26T00:00:00Z" [selected]
          - region "Snapshot Reference chart" [ref=e92]:
            - generic [ref=e93]:
              - generic "Candlestick and volume chart for Snapshot css-regression-fixture-snapshot" [ref=e94]:
                - table [ref=e96]:
                  - row [ref=e97]:
                    - cell
                    - cell [ref=e98]
                    - cell [ref=e102]
                  - row [ref=e106]:
                    - cell
                    - cell [ref=e107]
                    - cell [ref=e111]
              - group "Chart layer visibility" [ref=e114]:
                - button "SBar" [pressed] [ref=e115] [cursor=pointer]
                - button "CBar" [disabled] [pressed] [ref=e117]
                - button "Swing" [disabled] [pressed] [ref=e119]
                - button "Volume" [pressed] [ref=e121] [cursor=pointer]
          - generic [ref=e123]:
            - generic [ref=e124]: RUN css-regression-fixture-run
            - generic [ref=e125]: SBARS 36
            - generic [ref=e126]: GENERATED 2026-09-21 14:13:20
            - generic [ref=e127]: FINGERPRINT css-regressi
    - complementary [ref=e128]:
      - separator "Resize Inspector" [ref=e129]
      - generic [ref=e130]:
        - generic "Drag to any workbench edge to dock" [ref=e131]: Inspector
        - generic [ref=e132]: OBJECT
        - group [ref=e133]:
          - generic "Move Inspector" [ref=e134] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e135] [cursor=pointer]: −
      - generic [ref=e137]:
        - generic [ref=e138]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e139]
        - paragraph [ref=e140]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e141]: No inferred or fabricated domain state is displayed.
    - generic [ref=e143]:
      - navigation "Diagnostic categories" [ref=e144]:
        - button "ALL" [pressed] [ref=e145] [cursor=pointer]
        - button "ERRORS" [ref=e146] [cursor=pointer]
        - button "WARNINGS" [ref=e147] [cursor=pointer]
        - button "REPLAY" [ref=e148] [cursor=pointer]
        - button "STRUCTURE" [ref=e149] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e150] [cursor=pointer]
        - button "VALIDATION" [ref=e151] [cursor=pointer]
        - button "DIFFERENCES" [ref=e152] [cursor=pointer]
      - generic [ref=e153]:
        - group [ref=e154]:
          - generic "Move Diagnostics" [ref=e155] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e156] [cursor=pointer]: +
```

# Test source

```ts
  562 |     });
  563 |   });
  564 | }
  565 | 
  566 | 
  567 | test("projects every Snapshot Reference candle from the independent SBar fixture oracle", async ({ page }, testInfo) => {
  568 |   const processedCount = 12;
  569 |   await page.setViewportSize({ width: 1440, height: 900 });
  570 |   await installDeterministicOrigin(page, processedCount);
  571 |   await page.goto("/");
  572 |   await page.getByTestId("workspace-replay").click();
  573 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  574 | 
  575 |   const snapshot = page.getByTestId("snapshot-reference-chart");
  576 |   const canvasHost = snapshot.getByTestId("origin-chart-canvas");
  577 |   await expect(snapshot).toHaveAttribute("data-sync-eligible", "true");
  578 |   await expect(snapshot).toHaveAttribute("data-progress-active", "true");
  579 |   await expect(canvasHost).toBeVisible();
  580 | 
  581 |   // This oracle is derived from the fixture's domain formula, not from the
  582 |   // production mapSBarsToChart/projectSnapshotPlaybackSeries functions.
  583 |   const expected = Array.from({ length: 36 }, (_, index) => {
  584 |     const direction = Math.sin(index * 1.13);
  585 |     if (index < processedCount) {
  586 |       return direction > 0 ? "#557e65" : direction < 0 ? "#8d555b" : "#858d97";
  587 |     }
  588 |     if (direction > 0) return "#2e4239";
  589 |     if (direction < 0) return "#463035";
  590 |     return "#42484e";
  591 |   });
  592 | 
  593 |   const actual = await canvasHost.evaluate((host) => {
  594 |     const colors = [
  595 |       "#557e65", "#8d555b", "#858d97",
  596 |       "#2e4239", "#463035", "#42484e",
  597 |     ];
  598 |     const results: Array<{
  599 |       canvasIndex: number;
  600 |       width: number;
  601 |       height: number;
  602 |       groups: Array<{ start: number; end: number; color: string | null }>;
  603 |     }> = [];
  604 | 
  605 |     // Lightweight Charts layers canvases (price series, volume pane, primitives)
  606 |     // separately. Never merge their pixels: a full-width overlay can otherwise
  607 |     // make unrelated color columns appear to be one continuous candle.
  608 |     [...host.querySelectorAll("canvas")].forEach((canvas, canvasIndex) => {
  609 |       const context = canvas.getContext("2d", { willReadFrequently: true });
  610 |       if (!context || canvas.width === 0 || canvas.height === 0) return;
  611 |       const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  612 |       const byX = new Map<number, Map<string, number>>();
  613 |       for (let y = 0; y < canvas.height; y += 1) {
  614 |         for (let x = 0; x < canvas.width; x += 1) {
  615 |           const offset = (y * canvas.width + x) * 4;
  616 |           if (pixels[offset + 3] !== 255) continue;
  617 |           const color = `#${pixels[offset]!.toString(16).padStart(2, "0")}${pixels[offset + 1]!.toString(16).padStart(2, "0")}${pixels[offset + 2]!.toString(16).padStart(2, "0")}`;
  618 |           if (!colors.includes(color)) continue;
  619 |           const counts = byX.get(x) ?? new Map<string, number>();
  620 |           counts.set(color, (counts.get(color) ?? 0) + 1);
  621 |           byX.set(x, counts);
  622 |         }
  623 |       }
  624 | 
  625 |       const coloredColumns = [...byX.entries()].sort(([a], [b]) => a - b);
  626 |       const groups: Array<{ start: number; end: number; counts: Map<string, number> }> = [];
  627 |       for (const [x, counts] of coloredColumns) {
  628 |         const previous = groups[groups.length - 1];
  629 |         if (!previous || x - previous.end > 4) {
  630 |           groups.push({ start: x, end: x, counts: new Map(counts) });
  631 |         } else {
  632 |           previous.end = x;
  633 |           for (const [color, count] of counts) {
  634 |             previous.counts.set(color, (previous.counts.get(color) ?? 0) + count);
  635 |           }
  636 |         }
  637 |       }
  638 | 
  639 |       results.push({
  640 |         canvasIndex,
  641 |         width: canvas.width,
  642 |         height: canvas.height,
  643 |         groups: groups.map((group) => ({
  644 |           start: group.start,
  645 |           end: group.end,
  646 |           color: [...group.counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
  647 |         })),
  648 |       });
  649 |     });
  650 | 
  651 |     // Select the individual canvas layer that contains the most separate
  652 |     // expected candle-color columns. Return all candidates for diagnostics.
  653 |     const selected = [...results].sort((a, b) => b.groups.length - a.groups.length)[0];
  654 |     return { selected: selected ?? null, canvases: results };
  655 |   });
  656 | 
  657 |   await testInfo.attach("snapshot-candle-projection-oracle.json", {
  658 |     body: JSON.stringify({ expected, actual }, null, 2),
  659 |     contentType: "application/json",
  660 |   });
  661 |   expect(actual.selected, "a dedicated chart canvas layer should expose candle color columns").not.toBeNull();
> 662 |   expect(actual.selected?.groups, "every fixture SBar should have a distinct rendered candle color column").toHaveLength(36);
      |                                                                                                             ^ Error: every fixture SBar should have a distinct rendered candle color column
  663 |   expect(actual.selected?.groups.map((item) => item.color), "rendered candle colors must follow the independent SBar direction/progress oracle").toEqual(expected);
  664 | });
  665 | 
  666 | async function expandDiagnosticsIfNeeded(page: Page) {
  667 |   const diagnostics = page.getByTestId("diagnostics-dock");
  668 |   if (await diagnostics.getAttribute("class").then((value) => value?.includes("collapsed") ?? false)) {
  669 |     await page.getByTestId("diagnostics-collapse-toggle").click();
  670 |   }
  671 |   await expect(diagnostics).not.toHaveClass(/collapsed/);
  672 | }
  673 | 
  674 | async function prepareDockForInteraction(page: Page, panel: "inspector" | "diagnostics", direction: typeof dockDirections[number]) {
  675 |   await page.setViewportSize({ width: 1440, height: 900 });
  676 |   await page.goto("/");
  677 |   if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
  678 |   await chooseDockDirection(page, `${panel}-dock-menu`, `${panel}-dock-${direction}`);
  679 |   await expect(page.getByTestId(`${panel}-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
  680 |   if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
  681 | }
  682 | 
  683 | async function resizePanelByPointer(page: Page, panel: "inspector" | "diagnostics", direction: typeof dockDirections[number]) {
  684 |   const edge = page.getByTestId(`${panel}-resize-edge`);
  685 |   await expect(edge).toBeVisible();
  686 |   const before = Number(await edge.getAttribute("aria-valuenow"));
  687 |   const bounds = await edge.boundingBox();
  688 |   expect(bounds, `${panel} resize edge should have a rendered box`).not.toBeNull();
  689 |   if (!bounds) throw new Error(`${panel} resize edge has no bounding box`);
  690 | 
  691 |   const startX = bounds.x + bounds.width / 2;
  692 |   const startY = bounds.y + bounds.height / 2;
  693 |   const delta = 36;
  694 |   const dx = direction === "left" ? delta : direction === "right" ? -delta : 0;
  695 |   const dy = direction === "top" ? delta : direction === "bottom" ? -delta : 0;
  696 | 
  697 |   await page.mouse.move(startX, startY);
  698 |   await page.mouse.down();
  699 |   await page.mouse.move(startX + dx, startY + dy, { steps: 4 });
  700 |   await page.mouse.up();
  701 | 
  702 |   await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
  703 | }
  704 | 
  705 | for (const panel of ["inspector", "diagnostics"] as const) {
  706 |   for (const direction of dockDirections) {
  707 |     test(`resizes ${panel} by pointer when docked ${direction}`, async ({ page }) => {
  708 |       await prepareDockForInteraction(page, panel, direction);
  709 |       await resizePanelByPointer(page, panel, direction);
  710 | 
  711 |       const edge = page.getByTestId(`${panel}-resize-edge`);
  712 |       await expect(edge).toHaveAttribute("aria-orientation", direction === "left" || direction === "right" ? "vertical" : "horizontal");
  713 |       await expect(page.getByTestId(panel === "inspector" ? "inspector-panel" : "diagnostics-dock")).toBeVisible();
  714 |     });
  715 |   }
  716 | }
  717 | 
  718 | for (const panel of ["inspector", "diagnostics"] as const) {
  719 |   for (const direction of dockDirections) {
  720 |     test(`supports keyboard resize for ${panel} docked ${direction}`, async ({ page }) => {
  721 |       await prepareDockForInteraction(page, panel, direction);
  722 |       const edge = page.getByTestId(`${panel}-resize-edge`);
  723 |       const before = Number(await edge.getAttribute("aria-valuenow"));
  724 |       const increaseKey = direction === "left" ? "ArrowRight"
  725 |         : direction === "right" ? "ArrowLeft"
  726 |           : direction === "top" ? "ArrowDown" : "ArrowUp";
  727 | 
  728 |       await edge.focus();
  729 |       await page.keyboard.press(increaseKey);
  730 |       await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before + 12);
  731 |     });
  732 |   }
  733 | }
  734 | 
  735 | for (const panel of ["inspector", "diagnostics"] as const) {
  736 |   for (const direction of dockDirections) {
  737 |     test(`drags ${panel} to the ${direction} workbench edge`, async ({ page }) => {
  738 |       await page.setViewportSize({ width: 1440, height: 900 });
  739 |       await page.goto("/");
  740 |       if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
  741 | 
  742 |       // Start away from the requested destination so a stale aria-pressed value
  743 |       // cannot make this test pass without a successful drag/drop.
  744 |       const initialDirection = direction === "left" ? "right" : "left";
  745 |       await chooseDockDirection(page, `${panel}-dock-menu`, `${panel}-dock-${initialDirection}`);
  746 |       await expect(page.getByTestId(`${panel}-dock-${initialDirection}`)).toHaveAttribute("aria-pressed", "true");
  747 | 
  748 |       const source = page.getByTestId(`${panel}-dock-drag-handle`);
  749 |       // The drop handler computes edge ratios from the shell bounding box.
  750 |       const target = page.getByTestId("debugger-shell");
  751 |       const targetBounds = await target.boundingBox();
  752 |       expect(targetBounds, "debugger shell drop target should be rendered").not.toBeNull();
  753 |       if (!targetBounds) throw new Error("debugger shell drop target has no bounding box");
  754 | 
  755 |       const targetPosition = direction === "left"
  756 |         ? { x: 2, y: targetBounds.height / 2 }
  757 |         : direction === "right"
  758 |           ? { x: targetBounds.width - 2, y: targetBounds.height / 2 }
  759 |           : direction === "top"
  760 |             ? { x: targetBounds.width / 2, y: 2 }
  761 |             : { x: targetBounds.width / 2, y: targetBounds.height - 2 };
  762 | 
```