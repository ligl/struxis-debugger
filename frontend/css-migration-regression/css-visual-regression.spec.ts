import { expect, test, type Page } from "@playwright/test";


async function installDeterministicOrigin(page: Page) {
  await page.addInitScript(() => {
    const bars = Array.from({ length: 36 }, (_, index) => {
      const timestamp = BigInt(1_790_000_000 + index * 60) * 1_000_000_000n;
      const open = 100 + index * 0.35 + Math.sin(index * 0.7) * 1.8;
      const close = open + Math.sin(index * 1.13) * 2.2;
      const high = Math.max(open, close) + 0.8 + (index % 3) * 0.15;
      const low = Math.min(open, close) - 0.7 - (index % 4) * 0.1;
      return {
        sbarId: timestamp.toString(),
        barType: "BTCUSDT-1-MINUTE-LAST-EXTERNAL",
        tsEvent: timestamp.toString(),
        tsInit: (timestamp + 1_000_000n).toString(),
        open: open.toFixed(4),
        high: high.toFixed(4),
        low: low.toFixed(4),
        close: close.toFixed(4),
        volume: (10 + index * 1.7 + (index % 5) * 2).toFixed(4),
      };
    });
    const structure = {
      cbarCount: 3,
      cbars: [
        { cbarId: "fixture-cbar-01", high: "108.5", low: "99.2", sbarStartId: bars[2].sbarId, sbarEndId: bars[8].sbarId, spanSbars: 7, fractalType: "Top", createdAt: "2026-10-01T00:00:00Z" },
        { cbarId: "fixture-cbar-02", high: "112.1", low: "103.4", sbarStartId: bars[12].sbarId, sbarEndId: bars[19].sbarId, spanSbars: 8, fractalType: "Bottom", createdAt: "2026-10-01T00:00:00Z" },
        { cbarId: "fixture-cbar-03", high: "119.4", low: "109.1", sbarStartId: bars[24].sbarId, sbarEndId: bars[31].sbarId, spanSbars: 8, fractalType: "Top", createdAt: "2026-10-01T00:00:00Z" },
      ],
      swingCount: 2,
      swings: [
        { swingId: "fixture-swing-01", direction: "Up", high: "112.1", low: "99.2", cbarStartId: "fixture-cbar-01", cbarEndId: "fixture-cbar-02", sbarStartId: bars[2].sbarId, sbarEndId: bars[19].sbarId, startOi: null, endOi: null, volume: "321.5", spanSbars: 18, state: "Confirmed", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
        { swingId: "fixture-swing-02", direction: "Up", high: "119.4", low: "103.4", cbarStartId: "fixture-cbar-02", cbarEndId: "fixture-cbar-03", sbarStartId: bars[12].sbarId, sbarEndId: bars[31].sbarId, startOi: null, endOi: null, volume: "488.2", spanSbars: 20, state: "Tentative", createdAt: "2026-10-01T00:00:00Z", updatedAt: "2026-10-01T00:00:00Z" },
      ],
    };
    const origin = {
      originDatasetId: "css-regression-fixture-origin",
      sourceCatalog: "css-regression-fixture",
      enableStructure: true,
      instrumentId: "BTCUSDT.SIM",
      barType: "BTCUSDT-1-MINUTE-LAST-EXTERNAL",
      timeframe: "1m",
      sbarSequenceFingerprint: "css-regression-fixture-fingerprint-v1",
      sbarCount: bars.length,
      firstSbarId: bars[0].sbarId,
      lastSbarId: bars[bars.length - 1].sbarId,
      firstTsEvent: bars[0].tsEvent,
      lastTsEvent: bars[bars.length - 1].tsEvent,
      bars,
      structure,
    };
    const internals = {
      invoke: async (command: string) => {
        switch (command) {
          case "list_catalog_datasets": return [];
          case "get_current_origin": return origin;
          case "get_current_test_dataset": return null;
          case "list_snapshots": return [];
          case "get_run_state": return null;
          case "get_replay_inspector": return null;
          default: throw new Error(`Unexpected CSS regression fixture IPC command: ${command}`);
        }
      },
    };
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: internals,
    });
  });
}

const viewports = [
  { name: "minimum", width: 920, height: 800 },
  { name: "compact", width: 1024, height: 800 },
  { name: "standard", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide", width: 1920, height: 1080 },
];

async function captureLayoutContract(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "[data-testid='debugger-shell']",
      "[data-testid='topbar']",
      "[data-testid='chart-workspace']",
      "[data-testid='chart-toolbar']",
      "[data-testid='chart-panels']",
      "[data-testid='workspace-content']",
      "[data-testid='catalog-rail']",
      "[data-testid='inspector-panel']",
      "[data-testid='diagnostics-dock']",
      "[data-testid='origin-chart-panel']",
      "[data-testid='origin-chart-viewport']",
    ];

    const elements = selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true as const };

      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return {
        selector,
        missing: false as const,
        rect: {
          x: round(rect.x),
          y: round(rect.y),
          width: round(rect.width),
          height: round(rect.height),
          right: round(rect.right),
          bottom: round(rect.bottom),
        },
        scroll: {
          width: element.scrollWidth,
          clientWidth: element.clientWidth,
          height: element.scrollHeight,
          clientHeight: element.clientHeight,
        },
        style: {
          display: style.display,
          position: style.position,
          boxSizing: style.boxSizing,
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          backgroundColor: style.backgroundColor,
          color: style.color,
          borderColor: style.borderColor,
          gap: style.gap,
          gridTemplateColumns: style.gridTemplateColumns,
          flexDirection: style.flexDirection,
        },
      };
    });

    const root = getComputedStyle(document.documentElement);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight, dpr: window.devicePixelRatio },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      tokens: {
        background: root.getPropertyValue("--dbg-bg").trim(),
        surface1: root.getPropertyValue("--dbg-surface-1").trim(),
        border: root.getPropertyValue("--dbg-border").trim(),
        textPrimary: root.getPropertyValue("--dbg-text-primary").trim(),
        accent: root.getPropertyValue("--dbg-accent").trim(),
        chartUp: root.getPropertyValue("--dbg-chart-up").trim(),
        chartDown: root.getPropertyValue("--dbg-chart-down").trim(),
        chartUnprocessed: root.getPropertyValue("--dbg-chart-unprocessed").trim(),
      },
      elements,
    };

    function round(value: number) {
      return Math.round(value * 100) / 100;
    }
  });
}

test("captures workbench visual and computed-style baseline", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByTestId("debugger-shell")).toBeVisible();

  const contract = await captureLayoutContract(page);
  await testInfo.attach("computed-style-contract.json", {
    body: JSON.stringify(contract, null, 2),
    contentType: "application/json",
  });

  expect(contract.document.scrollWidth).toBeLessThanOrEqual(contract.document.clientWidth);
  expect(contract.elements.filter((item) => !item.missing).length).toBeGreaterThanOrEqual(6);
  await expect(page).toHaveScreenshot("workbench-default.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});


const dockDirections = ["left", "right", "top", "bottom"] as const;

async function chooseDockDirection(page: Page, menuTestId: string, optionTestId: string) {
  await page.getByTestId(menuTestId).locator("summary").click();
  await page.getByTestId(optionTestId).click();
}

for (const workspace of [
  { name: "dataset", testId: "workspace-dataset", title: "DATASET" },
  { name: "replay", testId: "workspace-replay", title: "REPLAY" },
  { name: "compare", testId: "workspace-compare", title: "COMPARE" },
] as const) {
  test(`captures the ${workspace.name} workspace default state`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.getByTestId(workspace.testId).click();
    await expect(page.getByTestId("workspace-toolbar-title")).toHaveText(workspace.title);
    await expect(page.getByTestId(`${workspace.name}-workspace`)).toBeVisible();
    await expect(page).toHaveScreenshot(`workspace-${workspace.name}-default.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}

for (const direction of dockDirections) {
  test(`captures expanded Diagnostics docked ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    await page.getByTestId("diagnostics-collapse-toggle").click();
    await expect(page.getByTestId("diagnostics-dock")).not.toHaveClass(/collapsed/);
    await expect(page).toHaveScreenshot(`diagnostics-expanded-${direction}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}



for (const direction of dockDirections) {
  test(`captures expanded Inspector docked ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    await expect(page.getByTestId(`inspector-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("inspector-panel")).toBeVisible();
    await expect(page).toHaveScreenshot(`inspector-expanded-${direction}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}

test("captures Inspector expanded and collapsed states", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const inspector = page.getByTestId("inspector-panel");
  await expect(inspector).toBeVisible();
  await expect(page.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
  await expect(page).toHaveScreenshot("inspector-expanded.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });

  await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await expect(page.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
  await expect(page).toHaveScreenshot("inspector-collapsed.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});

test("captures the default collapsed Diagnostics state", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const diagnostics = page.getByTestId("diagnostics-dock");
  await expect(diagnostics).toBeVisible();
  await expect(diagnostics).toHaveClass(/collapsed/);
  await expect(page).toHaveScreenshot("diagnostics-collapsed-default.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});

for (const viewport of viewports) {
  test(`preserves shell geometry at ${viewport.name} viewport`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByTestId("debugger-shell")).toBeVisible();

    const contract = await captureLayoutContract(page);
    await testInfo.attach(`layout-contract-${viewport.name}.json`, {
      body: JSON.stringify(contract, null, 2),
      contentType: "application/json",
    });

    expect(contract.viewport.width).toBe(viewport.width);
    expect(contract.document.scrollWidth).toBeLessThanOrEqual(contract.document.clientWidth);
    for (const item of contract.elements.filter((entry) => !entry.missing)) {
      expect(item.rect.width, `${item.selector} width at ${viewport.name}`).toBeGreaterThanOrEqual(0);
      expect(item.rect.height, `${item.selector} height at ${viewport.name}`).toBeGreaterThanOrEqual(0);
    }
  });
}


test("captures deterministic Origin chart and each legend layer toggle", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDeterministicOrigin(page);
  await page.goto("/");
  await expect(page.getByTestId("origin-chart-panel")).toHaveAttribute("data-sbar-count", "36");
  await expect(page.getByTestId("layer-toggle-sbar")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("layer-toggle-cbar")).toBeEnabled();
  await expect(page.getByTestId("layer-toggle-swing")).toBeEnabled();
  await expect(page).toHaveScreenshot("dataset-deterministic-chart.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });

  for (const layer of ["sbar", "cbar", "swing", "volume"] as const) {
    const toggle = page.getByTestId(`layer-toggle-${layer}`);
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "false");
    await expect(page).toHaveScreenshot(`dataset-deterministic-chart-without-${layer}.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-pressed", "true");
  }
});
