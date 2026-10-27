# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> captures the compare workspace default state
- Location: css-migration-regression/css-visual-regression.spec.ts:311:3

# Error details

```
Error: expect(page).toHaveScreenshot(expected) failed

  842 pixels (ratio 0.01 of all image pixels) are different.

  Snapshot: workspace-compare-default.png

Call log:
  - Expect "toHaveScreenshot(workspace-compare-default.png)" with timeout 5000ms
    - verifying given screenshot expectation
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - 842 pixels (ratio 0.01 of all image pixels) are different.
  - waiting 100ms before taking screenshot
  - taking page screenshot
    - disabled all CSS animations
  - waiting for fonts to load...
  - fonts loaded
  - captured a stable screenshot
  - 842 pixels (ratio 0.01 of all image pixels) are different.

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
  217 |       const style = getComputedStyle(element);
  218 |       return {
  219 |         selector,
  220 |         missing: false as const,
  221 |         rect: {
  222 |           x: round(rect.x),
  223 |           y: round(rect.y),
  224 |           width: round(rect.width),
  225 |           height: round(rect.height),
  226 |           right: round(rect.right),
  227 |           bottom: round(rect.bottom),
  228 |         },
  229 |         scroll: {
  230 |           width: element.scrollWidth,
  231 |           clientWidth: element.clientWidth,
  232 |           height: element.scrollHeight,
  233 |           clientHeight: element.clientHeight,
  234 |         },
  235 |         style: {
  236 |           display: style.display,
  237 |           position: style.position,
  238 |           boxSizing: style.boxSizing,
  239 |           overflowX: style.overflowX,
  240 |           overflowY: style.overflowY,
  241 |           backgroundColor: style.backgroundColor,
  242 |           color: style.color,
  243 |           borderColor: style.borderColor,
  244 |           gap: style.gap,
  245 |           gridTemplateColumns: style.gridTemplateColumns,
  246 |           flexDirection: style.flexDirection,
  247 |         },
  248 |       };
  249 |     });
  250 | 
  251 |     const root = getComputedStyle(document.documentElement);
  252 |     return {
  253 |       viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
  254 |       document: {
  255 |         scrollWidth: document.documentElement.scrollWidth,
  256 |         clientWidth: document.documentElement.clientWidth,
  257 |         scrollHeight: document.documentElement.scrollHeight,
  258 |         clientHeight: document.documentElement.clientHeight,
  259 |       },
  260 |       tokens: {
  261 |         background: root.getPropertyValue("--dbg-bg").trim(),
  262 |         surface1: root.getPropertyValue("--dbg-surface-1").trim(),
  263 |         border: root.getPropertyValue("--dbg-border").trim(),
  264 |         textPrimary: root.getPropertyValue("--dbg-text-primary").trim(),
  265 |         accent: root.getPropertyValue("--dbg-accent").trim(),
  266 |         chartUp: root.getPropertyValue("--dbg-chart-up").trim(),
  267 |         chartDown: root.getPropertyValue("--dbg-chart-down").trim(),
  268 |         chartUnprocessed: root.getPropertyValue("--dbg-chart-unprocessed").trim(),
  269 |       },
  270 |       elements,
  271 |     };
  272 | 
  273 |     function round(value: number) {
  274 |       return Math.round(value * 100) / 100;
  275 |     }
  276 |   });
  277 | }
  278 | 
  279 | test("captures workbench visual and computed-style baseline", async ({ page }, testInfo) => {
  280 |   await page.goto("/");
  281 |   await expect(page.getByTestId("debugger-shell")).toBeVisible();
  282 | 
  283 |   const contract = await captureLayoutContract(page);
  284 |   await testInfo.attach("computed-style-contract.json", {
  285 |     body: JSON.stringify(contract, null, 2),
  286 |     contentType: "application/json",
  287 |   });
  288 | 
  289 |   expect(contract.document.scrollWidth).toBeLessThanOrEqual(contract.document.clientWidth);
  290 |   expect(contract.elements.filter((item) => !item.missing).length).toBeGreaterThanOrEqual(6);
  291 |   await expect(page).toHaveScreenshot("workbench-default.png", {
  292 |     fullPage: true,
  293 |     animations: "disabled",
  294 |     caret: "hide",
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
> 317 |     await expect(page).toHaveScreenshot(`workspace-${workspace.name}-default.png`, {
      |                        ^ Error: expect(page).toHaveScreenshot(expected) failed
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
```