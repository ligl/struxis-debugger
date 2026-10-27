# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves shell geometry at minimum viewport
- Location: css-migration-regression/css-visual-regression.spec.ts:392:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('debugger-shell')
Expected: visible
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('debugger-shell') with timeout 5000ms
  - waiting for getByTestId('debugger-shell')
  - Test ended.

```

```yaml
- text: "[plugin:vite:vue] Tags with side effect (<script> and <style>) are ignored in client component templates. /home/amose/workspace/capitus/crates/struxis-debugger/frontend/src/components/WorkspaceToolbar.vue:19:1 17 | </template> 18 | 19 | <style scoped> | ^ 20 | .workspace-title { 21 | flex: 0 0 auto; at <parse> (:0) at createCompilerError (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:1378:21) at ignoreSideEffectTags (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-dom/dist/compiler-dom.cjs.js:695:7) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3629:35) at traverseChildren (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3621:5) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3664:7) at traverseChildren (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3621:5) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3664:7) at transform (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3557:3) at baseCompile (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:6749:3) at doCompileTemplate (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js:4402:47 Click outside, press Esc key, or fix the code to dismiss. You can also disable this overlay by setting"
- code: server.hmr.overlay
- text: to
- code: "false"
- text: in
- code: vite.config.ts
- text: .
```

# Test source

```ts
  295 |   });
  296 | });
  297 | 
  298 | 
  299 | const dockDirections = ["left", "right", "top", "bottom"] as const;
  300 | 
  301 | async function chooseDockDirection(page: Page, menuTestId: string, optionTestId: string) {
  302 |   await page.getByTestId(menuTestId).locator("summary").click();
  303 |   await page.getByTestId(optionTestId).click();
  304 | }
  305 | 
  306 | for (const workspace of [
  307 |   { name: "dataset", testId: "workspace-dataset", title: "DATASET" },
  308 |   { name: "replay", testId: "workspace-replay", title: "REPLAY" },
  309 |   { name: "compare", testId: "workspace-compare", title: "COMPARE" },
  310 | ] as const) {
  311 |   test(`captures the ${workspace.name} workspace default state`, async ({ page }) => {
  312 |     await page.setViewportSize({ width: 1440, height: 900 });
  313 |     await page.goto("/");
  314 |     await page.getByTestId(workspace.testId).click();
  315 |     await expect(page.getByTestId("workspace-toolbar-title")).toHaveText(workspace.title);
  316 |     await expect(page.getByTestId(`${workspace.name}-workspace`)).toBeVisible();
  317 |     await expect(page).toHaveScreenshot(`workspace-${workspace.name}-default.png`, {
  318 |       fullPage: true,
  319 |       animations: "disabled",
  320 |       caret: "hide",
  321 |     });
  322 |   });
  323 | }
  324 | 
  325 | for (const direction of dockDirections) {
  326 |   test(`captures expanded Diagnostics docked ${direction}`, async ({ page }) => {
  327 |     await page.setViewportSize({ width: 1440, height: 900 });
  328 |     await page.goto("/");
  329 |     await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
  330 |     await page.getByTestId("diagnostics-collapse-toggle").click();
  331 |     await expect(page.getByTestId("diagnostics-dock")).not.toHaveClass(/collapsed/);
  332 |     await expect(page).toHaveScreenshot(`diagnostics-expanded-${direction}.png`, {
  333 |       fullPage: true,
  334 |       animations: "disabled",
  335 |       caret: "hide",
  336 |     });
  337 |   });
  338 | }
  339 | 
  340 | 
  341 | 
  342 | for (const direction of dockDirections) {
  343 |   test(`captures expanded Inspector docked ${direction}`, async ({ page }) => {
  344 |     await page.setViewportSize({ width: 1440, height: 900 });
  345 |     await page.goto("/");
  346 |     await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
  347 |     await expect(page.getByTestId(`inspector-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
  348 |     await expect(page.getByTestId("inspector-panel")).toBeVisible();
  349 |     await expect(page).toHaveScreenshot(`inspector-expanded-${direction}.png`, {
  350 |       fullPage: true,
  351 |       animations: "disabled",
  352 |       caret: "hide",
  353 |     });
  354 |   });
  355 | }
  356 | 
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
> 395 |     await expect(page.getByTestId("debugger-shell")).toBeVisible();
      |                                                      ^ Error: expect(locator).toBeVisible() failed
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
  452 | 
  453 | for (const processedCount of [0, 12, 35] as const) {
  454 |   test(`advances Replay progress from ${processedCount} to ${processedCount + 1} processed SBars`, async ({ page }) => {
  455 |     await page.setViewportSize({ width: 1440, height: 900 });
  456 |     await installDeterministicOrigin(page, processedCount);
  457 |     await page.goto("/");
  458 |     await page.getByTestId("workspace-replay").click();
  459 | 
  460 |     const progress = page.getByRole("progressbar", { name: "Replay progress" });
  461 |     await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount));
  462 |     await expect(progress).toHaveAttribute("aria-valuemax", "36");
  463 | 
  464 |     const snapshotSelect = page.getByTestId("replay-reference-select");
  465 |     await snapshotSelect.selectOption("css-regression-fixture-snapshot");
  466 |     const snapshotChart = page.getByTestId("snapshot-reference-chart");
  467 |     await expect(snapshotChart).toHaveAttribute("data-progress-active", "true");
  468 | 
  469 |     await page.getByTestId("run-step").click();
  470 |     await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount + 1));
  471 |     await expect(page.getByTestId("run-toolbar-status")).toContainText(`${processedCount + 1} / 36`);
  472 |     // Playback styling is active only while unprocessed Live SBars remain.
  473 |     // The final step reaches the completed state and must disable progress styling.
  474 |     await expect(snapshotChart).toHaveAttribute("data-progress-active", String(processedCount + 1 < 36));
  475 |     if (processedCount === 35) {
  476 |       await expect(page.getByTestId("run-toolbar-status")).toContainText("COMPLETED");
  477 |       await expect(page.getByTestId("run-step")).toBeDisabled();
  478 |     }
  479 |   });
  480 | }
  481 | 
  482 | async function expectChartPixelsToChangeAfter(
  483 |   page: Page,
  484 |   follower: ReturnType<Page["getByTestId"]>,
  485 |   before: Buffer,
  486 | ) {
  487 |   await expect.poll(async () => !(await follower.screenshot()).equals(before), {
  488 |     message: "the synchronized follower chart should visibly respond to the source chart interaction",
  489 |     timeout: 3000,
  490 |   }).toBe(true);
  491 | }
  492 | 
  493 | test("synchronizes the Snapshot crosshair when the Live chart owns interaction", async ({ page }) => {
  494 |   await page.setViewportSize({ width: 1440, height: 900 });
  495 |   await installDeterministicOrigin(page, 12);
```