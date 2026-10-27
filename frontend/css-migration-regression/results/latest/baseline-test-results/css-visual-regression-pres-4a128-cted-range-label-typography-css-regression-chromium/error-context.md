# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Dataset selected-range label typography
- Location: css-migration-regression/css-visual-regression.spec.ts:452:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('.dataset-range-selected > span:first-child')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" locator('.dataset-range-selected > span:first-child') with timeout 5000ms
  - waiting for locator('.dataset-range-selected > span:first-child')

```

```yaml
- region "Notifications alt+T":
  - list
- main:
  - text: STRUXIS DEBUGGER
  - navigation "Debugger workspace":
    - button "01 Dataset"
    - button "02 Replay"
    - button "03 Compare"
  - text: ORIGIN AVAILABLE CAPITUS DATASET CATALOG / ORIGIN / INCLUSIVE INTERVAL ORIGIN LOAD
  - region "Catalog source controls":
    - text: DATASET
    - combobox "DATASET" [disabled]:
      - option "NO STREAMS" [selected]
    - button "Refresh Catalog": ↻
    - checkbox "STRUCTURE" [checked]
    - text: STRUCTURE
    - button "LOAD ORIGIN" [disabled]
    - group: i
  - text: Select inclusive interval on chart Click anywhere in the chart plot to select the start time of your Test interval.
  - link "SELECT ALL SBARS":
    - /url: "#"
  - button "CREATE TEST DATASET" [disabled]
  - button "TEST DETAILS" [disabled]
  - region "Origin SBar chart":
    - heading "ORIGIN · BTCUSDT-1-MINUTE-LAST-EXTERNAL" [level=3]
    - text: CATALOG SOURCE K-line + Struxis structure + volume 36 SBARS
    - button "FIT"
    - table:
      - row:
        - cell
        - cell
        - cell
      - row:
        - cell
        - cell
        - cell
    - group "Chart layer visibility":
      - button "SBar" [pressed]
      - button "CBar" [pressed]
      - button "Swing" [pressed]
      - button "Volume" [pressed]
    - text: SBARS 36 VOL 69.5000 LAST ID
    - code: "1790002100000000000"
    - text: CLICK CHART TO SELECT START
  - complementary:
    - separator "Resize Inspector"
    - text: Inspector OBJECT
    - group: ⋯
    - button "Collapse Inspector": −
    - text: S/
    - heading "Object Inspector" [level=3]
    - paragraph: Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.
    - text: Authoritative Origin data only
  - navigation "Diagnostic categories":
    - button "ALL" [pressed]
    - button "ERRORS"
    - button "WARNINGS"
    - button "REPLAY"
    - button "STRUCTURE"
    - button "SNAPSHOTS"
    - button "VALIDATION"
    - button "DIFFERENCES"
  - group: ⋯
  - button "Expand Diagnostics": +
```

# Test source

```ts
  357 | test("captures Inspector expanded and collapsed states", async ({ page }) => {
  358 |   await page.setViewportSize({ width: 1440, height: 900 });
  359 |   await page.goto("/");
  360 |   const inspector = page.getByTestId("inspector-panel");
  361 |   await expect(inspector).toBeVisible();
  362 |   await expect(page.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
  363 |   await expect(page).toHaveScreenshot("inspector-expanded.png", {
  364 |     fullPage: true,
  365 |     animations: "disabled",
  366 |     caret: "hide",
  367 |   });
  368 | 
  369 |   await page.getByRole("button", { name: "Collapse Inspector" }).click();
  370 |   await expect(page.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
  371 |   await expect(page).toHaveScreenshot("inspector-collapsed.png", {
  372 |     fullPage: true,
  373 |     animations: "disabled",
  374 |     caret: "hide",
  375 |   });
  376 | });
  377 | 
  378 | test("captures the default collapsed Diagnostics state", async ({ page }) => {
  379 |   await page.setViewportSize({ width: 1440, height: 900 });
  380 |   await page.goto("/");
  381 |   const diagnostics = page.getByTestId("diagnostics-dock");
  382 |   await expect(diagnostics).toBeVisible();
  383 |   await expect(diagnostics).toHaveClass(/collapsed/);
  384 |   await expect(page).toHaveScreenshot("diagnostics-collapsed-default.png", {
  385 |     fullPage: true,
  386 |     animations: "disabled",
  387 |     caret: "hide",
  388 |   });
  389 | });
  390 | 
  391 | for (const viewport of viewports) {
  392 |   test(`preserves shell geometry at ${viewport.name} viewport`, async ({ page }, testInfo) => {
  393 |     await page.setViewportSize({ width: viewport.width, height: viewport.height });
  394 |     await page.goto("/");
  395 |     await expect(page.getByTestId("debugger-shell")).toBeVisible();
  396 | 
  397 |     const contract = await captureLayoutContract(page);
  398 |     await testInfo.attach(`layout-contract-${viewport.name}.json`, {
  399 |       body: JSON.stringify(contract, null, 2),
  400 |       contentType: "application/json",
  401 |     });
  402 | 
  403 |     expect(contract.viewport.width).toBe(viewport.width);
  404 |     expect(contract.document.scrollWidth).toBeLessThanOrEqual(contract.document.clientWidth);
  405 |     for (const item of contract.elements.filter((entry) => !entry.missing)) {
  406 |       expect(item.rect.width, `${item.selector} width at ${viewport.name}`).toBeGreaterThanOrEqual(0);
  407 |       expect(item.rect.height, `${item.selector} height at ${viewport.name}`).toBeGreaterThanOrEqual(0);
  408 |     }
  409 |   });
  410 | }
  411 | 
  412 | 
  413 | test("captures deterministic Origin chart and each legend layer toggle", async ({ page }) => {
  414 |   await page.setViewportSize({ width: 1440, height: 900 });
  415 |   await installDeterministicOrigin(page);
  416 |   await page.goto("/");
  417 |   await expect(page.getByTestId("origin-chart-panel")).toHaveAttribute("data-sbar-count", "36");
  418 |   const datasetHost = await page.getByTestId("dataset-workspace").evaluate((element) => {
  419 |     const style = getComputedStyle(element);
  420 |     return { flex: style.flex, minWidth: style.minWidth, overflow: style.overflow };
  421 |   });
  422 |   expect(datasetHost).toEqual({ flex: "0 0 auto", minWidth: "0px", overflow: "visible" });
  423 |   const datasetControls = await page.locator(".dataset-controls").evaluate((element) => {
  424 |     const style = getComputedStyle(element);
  425 |     return { position: style.position, zIndex: style.zIndex };
  426 |   });
  427 |   expect(datasetControls).toEqual({ position: "relative", zIndex: "2" });
  428 |   await expect(page.getByTestId("layer-toggle-sbar")).toHaveAttribute("aria-pressed", "true");
  429 |   await expect(page.getByTestId("layer-toggle-cbar")).toBeEnabled();
  430 |   await expect(page.getByTestId("layer-toggle-swing")).toBeEnabled();
  431 |   await expect(page).toHaveScreenshot("dataset-deterministic-chart.png", {
  432 |     fullPage: true,
  433 |     animations: "disabled",
  434 |     caret: "hide",
  435 |   });
  436 | 
  437 |   for (const layer of ["sbar", "cbar", "swing", "volume"] as const) {
  438 |     const toggle = page.getByTestId(`layer-toggle-${layer}`);
  439 |     await toggle.click();
  440 |     await expect(toggle).toHaveAttribute("aria-pressed", "false");
  441 |     await expect(page).toHaveScreenshot(`dataset-deterministic-chart-without-${layer}.png`, {
  442 |       fullPage: true,
  443 |       animations: "disabled",
  444 |       caret: "hide",
  445 |     });
  446 |     await toggle.click();
  447 |     await expect(toggle).toHaveAttribute("aria-pressed", "true");
  448 |   }
  449 | });
  450 | 
  451 | 
  452 | test("preserves Dataset selected-range label typography", async ({ page }) => {
  453 |   await page.setViewportSize({ width: 1440, height: 900 });
  454 |   await installDeterministicOrigin(page);
  455 |   await page.goto("/");
  456 |   const label = page.locator(".dataset-range-selected > span:first-child");
> 457 |   await expect(label).toBeVisible();
      |                       ^ Error: expect(locator).toBeVisible() failed
  458 | 
  459 |   const style = await label.evaluate((element) => {
  460 |     const computed = getComputedStyle(element);
  461 |     return {
  462 |       color: computed.color,
  463 |       fontSize: computed.fontSize,
  464 |       letterSpacing: computed.letterSpacing,
  465 |     };
  466 |   });
  467 |   expect(style).toEqual({
  468 |     color: "rgb(137, 148, 157)",
  469 |     fontSize: "7px",
  470 |     letterSpacing: "0.28px",
  471 |   });
  472 | });
  473 | 
  474 | 
  475 | for (const processedCount of [0, 12, 35] as const) {
  476 |   test(`advances Replay progress from ${processedCount} to ${processedCount + 1} processed SBars`, async ({ page }) => {
  477 |     await page.setViewportSize({ width: 1440, height: 900 });
  478 |     await installDeterministicOrigin(page, processedCount);
  479 |     await page.goto("/");
  480 |     await page.getByTestId("workspace-replay").click();
  481 | 
  482 |     const progress = page.getByRole("progressbar", { name: "Replay progress" });
  483 |     await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount));
  484 |     await expect(progress).toHaveAttribute("aria-valuemax", "36");
  485 | 
  486 |     const snapshotSelect = page.getByTestId("replay-reference-select");
  487 |     await snapshotSelect.selectOption("css-regression-fixture-snapshot");
  488 |     const snapshotChart = page.getByTestId("snapshot-reference-chart");
  489 |     await expect(snapshotChart).toHaveAttribute("data-progress-active", "true");
  490 | 
  491 |     await page.getByTestId("run-step").click();
  492 |     await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount + 1));
  493 |     await expect(page.getByTestId("run-toolbar-status")).toContainText(`${processedCount + 1} / 36`);
  494 |     // Playback styling is active only while unprocessed Live SBars remain.
  495 |     // The final step reaches the completed state and must disable progress styling.
  496 |     await expect(snapshotChart).toHaveAttribute("data-progress-active", String(processedCount + 1 < 36));
  497 |     if (processedCount === 35) {
  498 |       await expect(page.getByTestId("run-toolbar-status")).toContainText("COMPLETED");
  499 |       await expect(page.getByTestId("run-step")).toBeDisabled();
  500 |     }
  501 |   });
  502 | }
  503 | 
  504 | async function expectChartPixelsToChangeAfter(
  505 |   page: Page,
  506 |   follower: ReturnType<Page["getByTestId"]>,
  507 |   before: Buffer,
  508 | ) {
  509 |   await expect.poll(async () => !(await follower.screenshot()).equals(before), {
  510 |     message: "the synchronized follower chart should visibly respond to the source chart interaction",
  511 |     timeout: 3000,
  512 |   }).toBe(true);
  513 | }
  514 | 
  515 | test("synchronizes the Snapshot crosshair when the Live chart owns interaction", async ({ page }) => {
  516 |   await page.setViewportSize({ width: 1440, height: 900 });
  517 |   await installDeterministicOrigin(page, 12);
  518 |   await page.goto("/");
  519 |   await page.getByTestId("workspace-replay").click();
  520 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  521 | 
  522 |   const liveChart = page.getByTestId("run-chart-canvas");
  523 |   const snapshotChart = page.getByTestId("snapshot-reference-chart").getByTestId("origin-chart-canvas");
  524 |   await expect(snapshotChart).toBeVisible();
  525 |   const bounds = await liveChart.boundingBox();
  526 |   expect(bounds).not.toBeNull();
  527 |   if (!bounds) throw new Error("Live chart canvas host has no bounding box");
  528 |   const before = await snapshotChart.screenshot();
  529 | 
  530 |   await page.mouse.move(bounds.x + bounds.width * 0.63, bounds.y + bounds.height * 0.43);
  531 |   await expectChartPixelsToChangeAfter(page, snapshotChart, before);
  532 | });
  533 | 
  534 | test("synchronizes Snapshot viewport when the Live chart is zoomed", async ({ page }) => {
  535 |   await page.setViewportSize({ width: 1440, height: 900 });
  536 |   await installDeterministicOrigin(page, 12);
  537 |   await page.goto("/");
  538 |   await page.getByTestId("workspace-replay").click();
  539 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  540 | 
  541 |   const liveChart = page.getByTestId("run-chart-canvas");
  542 |   const snapshotChart = page.getByTestId("snapshot-reference-chart").getByTestId("origin-chart-canvas");
  543 |   const bounds = await liveChart.boundingBox();
  544 |   expect(bounds).not.toBeNull();
  545 |   if (!bounds) throw new Error("Live chart canvas host has no bounding box");
  546 |   const initial = await snapshotChart.screenshot();
  547 | 
  548 |   await page.mouse.move(bounds.x + bounds.width * 0.63, bounds.y + bounds.height * 0.43);
  549 |   await expectChartPixelsToChangeAfter(page, snapshotChart, initial);
  550 |   // Establish the synchronized crosshair first; the second comparison must
  551 |   // detect an additional visual change caused by the viewport zoom itself.
  552 |   const beforeZoom = await snapshotChart.screenshot();
  553 |   await page.mouse.wheel(0, -240);
  554 |   await expectChartPixelsToChangeAfter(page, snapshotChart, beforeZoom);
  555 | });
  556 | 
  557 | for (const processedCount of [12, 24] as const) {
```