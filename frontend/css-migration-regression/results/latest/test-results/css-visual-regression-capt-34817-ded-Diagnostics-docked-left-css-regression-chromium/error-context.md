# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> captures expanded Diagnostics docked left
- Location: css-migration-regression/css-visual-regression.spec.ts:326:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('diagnostics-dock-menu').locator('summary')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - generic [ref=e4]: "[plugin:vite:vue] Tags with side effect (<script> and <style>) are ignored in client component templates."
  - generic [ref=e5]: /home/amose/workspace/capitus/crates/struxis-debugger/frontend/src/components/WorkspaceToolbar.vue:19:1
  - generic [ref=e6]: "17 | </template> 18 | 19 | <style scoped> | ^ 20 | .workspace-title { 21 | flex: 0 0 auto;"
  - generic [ref=e7]: at <parse> (:0) at createCompilerError (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:1378:21) at ignoreSideEffectTags (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-dom/dist/compiler-dom.cjs.js:695:7) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3629:35) at traverseChildren (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3621:5) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3664:7) at traverseChildren (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3621:5) at traverseNode (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3664:7) at transform (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:3557:3) at baseCompile (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-core/dist/compiler-core.cjs.js:6749:3) at doCompileTemplate (/home/amose/workspace/capitus/crates/struxis-debugger/frontend/node_modules/@vue/compiler-sfc/dist/compiler-sfc.cjs.js:4402:47
  - generic [ref=e8]:
    - text: Click outside, press Esc key, or fix the code to dismiss.You can also disable this overlay by setting
    - code [ref=e9]: server.hmr.overlay
    - text: to
    - code [ref=e10]: "false"
    - text: in
    - code [ref=e11]: vite.config.ts
    - text: .
```

# Test source

```ts
  202 |       "[data-testid='chart-toolbar']",
  203 |       "[data-testid='chart-panels']",
  204 |       "[data-testid='workspace-content']",
  205 |       "[data-testid='catalog-rail']",
  206 |       "[data-testid='inspector-panel']",
  207 |       "[data-testid='diagnostics-dock']",
  208 |       "[data-testid='origin-chart-panel']",
  209 |       "[data-testid='origin-chart-viewport']",
  210 |     ];
  211 | 
  212 |     const elements = selectors.map((selector) => {
  213 |       const element = document.querySelector<HTMLElement>(selector);
  214 |       if (!element) return { selector, missing: true as const };
  215 | 
  216 |       const rect = element.getBoundingClientRect();
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
> 302 |   await page.getByTestId(menuTestId).locator("summary").click();
      |                                                         ^ Error: locator.click: Test timeout of 30000ms exceeded.
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
  395 |     await expect(page.getByTestId("debugger-shell")).toBeVisible();
  396 | 
  397 |     const contract = await captureLayoutContract(page);
  398 |     await testInfo.attach(`layout-contract-${viewport.name}.json`, {
  399 |       body: JSON.stringify(contract, null, 2),
  400 |       contentType: "application/json",
  401 |     });
  402 | 
```