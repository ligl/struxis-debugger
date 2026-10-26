import { expect, test, type Page } from "@playwright/test";


test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "isTauri", { configurable: true, value: true });
    Object.defineProperty(window, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {
        invoke: async (command: string) => {
          const origin = (window as typeof window & { __CSS_REGRESSION_ORIGIN__?: unknown }).__CSS_REGRESSION_ORIGIN__ ?? null;
          switch (command) {
            case "list_catalog_datasets": return [];
            case "get_current_origin": return origin;
            case "get_current_test_dataset": return (window as typeof window & { __CSS_REGRESSION_TEST_DATASET__?: unknown }).__CSS_REGRESSION_TEST_DATASET__ ?? null;
            case "list_snapshots": return (window as typeof window & { __CSS_REGRESSION_SNAPSHOTS__?: unknown[] }).__CSS_REGRESSION_SNAPSHOTS__ ?? [];
            case "get_snapshot_reference": {
              const reference = (window as typeof window & { __CSS_REGRESSION_SNAPSHOT_REFERENCE__?: unknown }).__CSS_REGRESSION_SNAPSHOT_REFERENCE__;
              if (!reference) throw new Error("Unexpected CSS regression IPC command: get_snapshot_reference");
              return reference;
            }
            case "get_run_state": return (window as typeof window & { __CSS_REGRESSION_RUN_STATE__?: unknown }).__CSS_REGRESSION_RUN_STATE__ ?? null;
            case "step_run": {
              const target = window as typeof window & {
                __CSS_REGRESSION_ORIGIN__?: { bars?: Array<{ sbarId: string }> };
                __CSS_REGRESSION_RUN_STATE__?: {
                  runId: string;
                  testDatasetId: string;
                  inputFingerprint: string;
                  inputCount: number;
                  status: string;
                  processedCount: number;
                  cursorSbarId: string | null;
                  failureDiagnostic: string | null;
                };
              };
              const current = target.__CSS_REGRESSION_RUN_STATE__;
              if (!current) throw new Error("step_run requires a deterministic Replay fixture");
              const processedCount = Math.min(current.inputCount, current.processedCount + 1);
              const bars = target.__CSS_REGRESSION_ORIGIN__?.bars ?? [];
              const next = {
                ...current,
                status: processedCount >= current.inputCount ? "completed" : "paused",
                processedCount,
                cursorSbarId: processedCount > 0 ? bars[processedCount - 1]?.sbarId ?? null : null,
              };
              target.__CSS_REGRESSION_RUN_STATE__ = next;
              return { runState: next, inspector: null };
            }
            case "get_replay_inspector": return null;
            default: throw new Error(`Unexpected CSS regression IPC command: ${command}`);
          }
        },
      },
    });
  });
});


async function installDeterministicOrigin(page: Page, replayProcessedCount?: number) {
  await page.addInitScript((replayProcessedCount?: number) => {
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
    (window as typeof window & { __CSS_REGRESSION_ORIGIN__?: typeof origin }).__CSS_REGRESSION_ORIGIN__ = origin;

    if (typeof replayProcessedCount === "number") {
      const testDataset = {
        testDatasetId: "css-regression-fixture-test",
        originDatasetId: origin.originDatasetId,
        instrumentId: origin.instrumentId,
        barType: origin.barType,
        timeframe: origin.timeframe,
        startSbarId: bars[0].sbarId,
        endSbarId: bars[bars.length - 1].sbarId,
        sbarCount: bars.length,
        sbarSequenceFingerprint: origin.sbarSequenceFingerprint,
      };
      const runState = {
        runId: "css-regression-fixture-run",
        testDatasetId: testDataset.testDatasetId,
        inputFingerprint: testDataset.sbarSequenceFingerprint,
        inputCount: bars.length,
        status: "paused",
        processedCount: Math.max(0, Math.min(bars.length, replayProcessedCount)),
        cursorSbarId: replayProcessedCount > 0 ? bars[Math.min(bars.length, replayProcessedCount) - 1]?.sbarId ?? null : null,
        failureDiagnostic: null,
      };
      const snapshotId = "css-regression-fixture-snapshot";
      const snapshot = {
        fileName: "css-regression-fixture.snapshot",
        path: "/tmp/css-regression-fixture.snapshot",
        kind: "complete",
        snapshotId,
        runId: "css-regression-fixture-run",
        stateKey: "css-regression-fixture-state",
        instrumentId: origin.instrumentId,
        barType: origin.barType,
        inputStartTsEvent: bars[0].tsEvent,
        inputEndTsEvent: bars[bars.length - 1].tsEvent,
        generatedAt: "2026-10-26T00:00:00Z",
        checkpointCount: bars.length,
        diagnostic: null,
      };
      const snapshotReference = {
        snapshotId,
        runId: "css-regression-fixture-run",
        instrumentId: origin.instrumentId,
        barType: origin.barType,
        timeframe: origin.timeframe,
        snapshotGeneratedAt: "1790000000000000000",
        sbarSequenceFingerprint: origin.sbarSequenceFingerprint,
        bars,
        structure,
        structureTimeline: bars.map((bar, index) => ({
          sbarId: bar.sbarId,
          structure: index === 8 || index === 19 || index === 31 ? structure : null,
        })),
      };
      const target = window as typeof window & {
        __CSS_REGRESSION_TEST_DATASET__?: typeof testDataset;
        __CSS_REGRESSION_RUN_STATE__?: typeof runState;
        __CSS_REGRESSION_SNAPSHOTS__?: typeof snapshot[];
        __CSS_REGRESSION_SNAPSHOT_REFERENCE__?: typeof snapshotReference;
      };
      target.__CSS_REGRESSION_TEST_DATASET__ = testDataset;
      target.__CSS_REGRESSION_RUN_STATE__ = runState;
      target.__CSS_REGRESSION_SNAPSHOTS__ = [snapshot];
      target.__CSS_REGRESSION_SNAPSHOT_REFERENCE__ = snapshotReference;
    }
  }, replayProcessedCount);
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
  const datasetHost = await page.getByTestId("dataset-workspace").evaluate((element) => {
    const style = getComputedStyle(element);
    return { flex: style.flex, minWidth: style.minWidth, overflow: style.overflow };
  });
  expect(datasetHost).toEqual({ flex: "0 0 auto", minWidth: "0px", overflow: "visible" });
  const datasetControls = await page.locator(".dataset-controls").evaluate((element) => {
    const style = getComputedStyle(element);
    return { position: style.position, zIndex: style.zIndex };
  });
  expect(datasetControls).toEqual({ position: "relative", zIndex: "2" });
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



for (const processedCount of [0, 12, 35] as const) {
  test(`advances Replay progress from ${processedCount} to ${processedCount + 1} processed SBars`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installDeterministicOrigin(page, processedCount);
    await page.goto("/");
    await page.getByTestId("workspace-replay").click();

    const progress = page.getByRole("progressbar", { name: "Replay progress" });
    await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount));
    await expect(progress).toHaveAttribute("aria-valuemax", "36");

    const snapshotSelect = page.getByTestId("replay-reference-select");
    await snapshotSelect.selectOption("css-regression-fixture-snapshot");
    const snapshotChart = page.getByTestId("snapshot-reference-chart");
    await expect(snapshotChart).toHaveAttribute("data-progress-active", "true");

    await page.getByTestId("run-step").click();
    await expect(progress).toHaveAttribute("aria-valuenow", String(processedCount + 1));
    await expect(page.getByTestId("run-toolbar-status")).toContainText(`${processedCount + 1} / 36`);
    // Playback styling is active only while unprocessed Live SBars remain.
    // The final step reaches the completed state and must disable progress styling.
    await expect(snapshotChart).toHaveAttribute("data-progress-active", String(processedCount + 1 < 36));
    if (processedCount === 35) {
      await expect(page.getByTestId("run-toolbar-status")).toContainText("COMPLETED");
      await expect(page.getByTestId("run-step")).toBeDisabled();
    }
  });
}

async function expectChartPixelsToChangeAfter(
  page: Page,
  follower: ReturnType<Page["getByTestId"]>,
  before: Buffer,
) {
  await expect.poll(async () => !(await follower.screenshot()).equals(before), {
    message: "the synchronized follower chart should visibly respond to the source chart interaction",
    timeout: 3000,
  }).toBe(true);
}

test("synchronizes the Snapshot crosshair when the Live chart owns interaction", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDeterministicOrigin(page, 12);
  await page.goto("/");
  await page.getByTestId("workspace-replay").click();
  await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");

  const liveChart = page.getByTestId("run-chart-canvas");
  const snapshotChart = page.getByTestId("snapshot-reference-chart").getByTestId("origin-chart-canvas");
  await expect(snapshotChart).toBeVisible();
  const bounds = await liveChart.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Live chart canvas host has no bounding box");
  const before = await snapshotChart.screenshot();

  await page.mouse.move(bounds.x + bounds.width * 0.63, bounds.y + bounds.height * 0.43);
  await expectChartPixelsToChangeAfter(page, snapshotChart, before);
});

test("synchronizes Snapshot viewport when the Live chart is zoomed", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDeterministicOrigin(page, 12);
  await page.goto("/");
  await page.getByTestId("workspace-replay").click();
  await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");

  const liveChart = page.getByTestId("run-chart-canvas");
  const snapshotChart = page.getByTestId("snapshot-reference-chart").getByTestId("origin-chart-canvas");
  const bounds = await liveChart.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Live chart canvas host has no bounding box");
  const initial = await snapshotChart.screenshot();

  await page.mouse.move(bounds.x + bounds.width * 0.63, bounds.y + bounds.height * 0.43);
  await expectChartPixelsToChangeAfter(page, snapshotChart, initial);
  // Establish the synchronized crosshair first; the second comparison must
  // detect an additional visual change caused by the viewport zoom itself.
  const beforeZoom = await snapshotChart.screenshot();
  await page.mouse.wheel(0, -240);
  await expectChartPixelsToChangeAfter(page, snapshotChart, beforeZoom);
});

for (const processedCount of [12, 24] as const) {
  test(`captures Replay with ${processedCount} processed SBars and unprocessed candle styling`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await installDeterministicOrigin(page, processedCount);
    await page.goto("/");
    await page.getByTestId("workspace-replay").click();
    await expect(page.getByTestId("run-chart-panel")).toBeVisible();
    const snapshotSelect = page.getByTestId("replay-reference-select");
    await expect(snapshotSelect.locator("option[value='css-regression-fixture-snapshot']")).toHaveCount(1);
    await snapshotSelect.selectOption("css-regression-fixture-snapshot");
    await expect(snapshotSelect).toHaveValue("css-regression-fixture-snapshot");
    await expect(page.getByTestId("snapshot-reference-loading")).toHaveCount(0);
    await expect(page.getByTestId("snapshot-reference-error")).toHaveCount(0);
    const snapshotChart = page.getByTestId("snapshot-reference-chart");
    await expect(snapshotChart).toBeVisible();
    // Do not accept a screenshot of an empty/unsynchronized reference as a Replay fixture.
    await expect(snapshotChart).toHaveAttribute("data-sync-eligible", "true");
    await expect(snapshotChart).toHaveAttribute("data-progress-active", "true");
    const snapshotCanvasHost = snapshotChart.getByTestId("origin-chart-canvas");
    await expect(snapshotCanvasHost).toBeVisible();
    await expect(page.getByTestId("run-chart-panel")).toBeVisible();

    // Assert rendered pixels, not only the full-page screenshot. Processed candles
    // retain their native direction colors; unprocessed candles use the dim palette.
    const renderedColors = await snapshotCanvasHost.evaluate((host) => {
      const targets = ["#557e65", "#8d555b", "#2e4239", "#463035"];
      const counts = Object.fromEntries(targets.map((color) => [color, 0])) as Record<string, number>;
      for (const canvas of host.querySelectorAll("canvas")) {
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context || canvas.width === 0 || canvas.height === 0) continue;
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 0; index < pixels.length; index += 4) {
          if (pixels[index + 3] !== 255) continue;
          const color = `#${pixels[index]!.toString(16).padStart(2, "0")}${pixels[index + 1]!.toString(16).padStart(2, "0")}${pixels[index + 2]!.toString(16).padStart(2, "0")}`;
          if (color in counts) counts[color] += 1;
        }
      }
      return counts;
    });
    expect(renderedColors["#557e65"], "native up-candle pixels").toBeGreaterThan(0);
    expect(renderedColors["#8d555b"], "native down-candle pixels").toBeGreaterThan(0);
    expect(renderedColors["#2e4239"], "dimmed up-candle pixels").toBeGreaterThan(0);
    expect(renderedColors["#463035"], "dimmed down-candle pixels").toBeGreaterThan(0);

    await expect(page).toHaveScreenshot(`replay-processed-${processedCount}-of-36.png`, {
      fullPage: true,
      animations: "disabled",
      caret: "hide",
    });
  });
}


test.skip("MANUAL REVIEW REQUIRED: Snapshot Reference per-candle colors (pixel oracle unreliable)", async ({ page }, testInfo) => {
  const processedCount = 12;
  await page.setViewportSize({ width: 1440, height: 900 });
  await installDeterministicOrigin(page, processedCount);
  await page.goto("/");
  await page.getByTestId("workspace-replay").click();
  await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");

  const snapshot = page.getByTestId("snapshot-reference-chart");
  const canvasHost = snapshot.getByTestId("origin-chart-canvas");
  await expect(snapshot).toHaveAttribute("data-sync-eligible", "true");
  await expect(snapshot).toHaveAttribute("data-progress-active", "true");
  await expect(canvasHost).toBeVisible();

  // This oracle is derived from the fixture's domain formula, not from the
  // production mapSBarsToChart/projectSnapshotPlaybackSeries functions.
  const expected = Array.from({ length: 36 }, (_, index) => {
    const direction = Math.sin(index * 1.13);
    if (index < processedCount) {
      return direction > 0 ? "#557e65" : direction < 0 ? "#8d555b" : "#858d97";
    }
    if (direction > 0) return "#2e4239";
    if (direction < 0) return "#463035";
    return "#42484e";
  });

  const actual = await canvasHost.evaluate((host) => {
    const colors = [
      "#557e65", "#8d555b", "#858d97",
      "#2e4239", "#463035", "#42484e",
    ];
    const results: Array<{
      canvasIndex: number;
      width: number;
      height: number;
      groups: Array<{ start: number; end: number; color: string | null }>;
    }> = [];

    // Lightweight Charts layers canvases (price series, volume pane, primitives)
    // separately. Never merge their pixels: a full-width overlay can otherwise
    // make unrelated color columns appear to be one continuous candle.
    [...host.querySelectorAll("canvas")].forEach((canvas, canvasIndex) => {
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context || canvas.width === 0 || canvas.height === 0) return;
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const byX = new Map<number, Map<string, number>>();
      for (let y = 0; y < canvas.height; y += 1) {
        for (let x = 0; x < canvas.width; x += 1) {
          const offset = (y * canvas.width + x) * 4;
          if (pixels[offset + 3] !== 255) continue;
          const color = `#${pixels[offset]!.toString(16).padStart(2, "0")}${pixels[offset + 1]!.toString(16).padStart(2, "0")}${pixels[offset + 2]!.toString(16).padStart(2, "0")}`;
          if (!colors.includes(color)) continue;
          const counts = byX.get(x) ?? new Map<string, number>();
          counts.set(color, (counts.get(color) ?? 0) + 1);
          byX.set(x, counts);
        }
      }

      // Ignore sparse exact-color hits from overlays and antialiased edges.
      // A candle body contributes multiple fully opaque pixels at its x coordinate.
      const coloredColumns = [...byX.entries()]
        .map(([x, counts]) => ({
          x,
          counts,
          total: [...counts.values()].reduce((sum, count) => sum + count, 0),
          dominant: [...counts.entries()].sort((a, b) => b[1] - a[1])[0],
        }))
        .filter((column) => column.total >= 4 && (column.dominant?.[1] ?? 0) >= 3)
        .sort((a, b) => a.x - b.x);
      const groups: Array<{ start: number; end: number; counts: Map<string, number> }> = [];
      for (const { x, counts } of coloredColumns) {
        const previous = groups[groups.length - 1];
        if (!previous || x - previous.end > 4) {
          groups.push({ start: x, end: x, counts: new Map(counts) });
        } else {
          previous.end = x;
          for (const [color, count] of counts) {
            previous.counts.set(color, (previous.counts.get(color) ?? 0) + count);
          }
        }
      }

      results.push({
        canvasIndex,
        width: canvas.width,
        height: canvas.height,
        groups: groups.map((group) => ({
          start: group.start,
          end: group.end,
          color: [...group.counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
        })),
      });
    });

    // Select the individual canvas layer that contains the most separate
    // expected candle-color columns. Return all candidates for diagnostics.
    const selected = [...results].sort((a, b) => b.groups.length - a.groups.length)[0];
    return { selected: selected ?? null, canvases: results };
  });

  await testInfo.attach("snapshot-candle-projection-oracle.json", {
    body: JSON.stringify({ expected, actual }, null, 2),
    contentType: "application/json",
  });
  expect(actual.selected, "a dedicated chart canvas layer should expose candle color columns").not.toBeNull();
  expect(actual.selected?.groups, "every fixture SBar should have a distinct rendered candle color column").toHaveLength(36);
  expect(actual.selected?.groups.map((item) => item.color), "rendered candle colors must follow the independent SBar direction/progress oracle").toEqual(expected);
});

async function expandDiagnosticsIfNeeded(page: Page) {
  const diagnostics = page.getByTestId("diagnostics-dock");
  if (await diagnostics.getAttribute("class").then((value) => value?.includes("collapsed") ?? false)) {
    await page.getByTestId("diagnostics-collapse-toggle").click();
  }
  await expect(diagnostics).not.toHaveClass(/collapsed/);
}

async function prepareDockForInteraction(page: Page, panel: "inspector" | "diagnostics", direction: typeof dockDirections[number]) {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
  await chooseDockDirection(page, `${panel}-dock-menu`, `${panel}-dock-${direction}`);
  await expect(page.getByTestId(`${panel}-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
  if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
}

async function resizePanelByPointer(page: Page, panel: "inspector" | "diagnostics", direction: typeof dockDirections[number]) {
  const edge = page.getByTestId(`${panel}-resize-edge`);
  await expect(edge).toBeVisible();
  const before = Number(await edge.getAttribute("aria-valuenow"));
  const bounds = await edge.boundingBox();
  expect(bounds, `${panel} resize edge should have a rendered box`).not.toBeNull();
  if (!bounds) throw new Error(`${panel} resize edge has no bounding box`);

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  const delta = 36;
  const dx = direction === "left" ? delta : direction === "right" ? -delta : 0;
  const dy = direction === "top" ? delta : direction === "bottom" ? -delta : 0;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dx, startY + dy, { steps: 4 });
  await page.mouse.up();

  await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBeGreaterThan(before);
}

for (const panel of ["inspector", "diagnostics"] as const) {
  for (const direction of dockDirections) {
    test(`resizes ${panel} by pointer when docked ${direction}`, async ({ page }) => {
      await prepareDockForInteraction(page, panel, direction);
      await resizePanelByPointer(page, panel, direction);

      const edge = page.getByTestId(`${panel}-resize-edge`);
      await expect(edge).toHaveAttribute("aria-orientation", direction === "left" || direction === "right" ? "vertical" : "horizontal");
      await expect(page.getByTestId(panel === "inspector" ? "inspector-panel" : "diagnostics-dock")).toBeVisible();
    });
  }
}

for (const panel of ["inspector", "diagnostics"] as const) {
  for (const direction of dockDirections) {
    test(`supports keyboard resize for ${panel} docked ${direction}`, async ({ page }) => {
      await prepareDockForInteraction(page, panel, direction);
      const edge = page.getByTestId(`${panel}-resize-edge`);
      const before = Number(await edge.getAttribute("aria-valuenow"));
      const increaseKey = direction === "left" ? "ArrowRight"
        : direction === "right" ? "ArrowLeft"
          : direction === "top" ? "ArrowDown" : "ArrowUp";

      await edge.focus();
      await page.keyboard.press(increaseKey);
      await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before + 12);
    });
  }
}

for (const panel of ["inspector", "diagnostics"] as const) {
  for (const direction of dockDirections) {
    test(`drags ${panel} to the ${direction} workbench edge`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);

      // Start away from the requested destination so a stale aria-pressed value
      // cannot make this test pass without a successful drag/drop.
      const initialDirection = direction === "left" ? "right" : "left";
      await chooseDockDirection(page, `${panel}-dock-menu`, `${panel}-dock-${initialDirection}`);
      await expect(page.getByTestId(`${panel}-dock-${initialDirection}`)).toHaveAttribute("aria-pressed", "true");

      const source = page.getByTestId(`${panel}-dock-drag-handle`);
      // The drop handler computes edge ratios from the shell bounding box.
      const target = page.getByTestId("debugger-shell");
      const targetBounds = await target.boundingBox();
      expect(targetBounds, "debugger shell drop target should be rendered").not.toBeNull();
      if (!targetBounds) throw new Error("debugger shell drop target has no bounding box");

      const targetPosition = direction === "left"
        ? { x: 2, y: targetBounds.height / 2 }
        : direction === "right"
          ? { x: targetBounds.width - 2, y: targetBounds.height / 2 }
          : direction === "top"
            ? { x: targetBounds.width / 2, y: 2 }
            : { x: targetBounds.width / 2, y: targetBounds.height - 2 };

      await source.dragTo(target, { targetPosition });
      await expect(page.getByTestId(`${panel}-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
    });
  }
}


test("preserves Compare Snapshot Store disclosure geometry and styling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("workspace-compare").click();

  const disclosure = page.getByTestId("snapshot-store-disclosure");
  const summary = page.getByTestId("snapshot-store-toggle");
  await expect(disclosure).toBeVisible();
  await expect(summary).toBeVisible();

  const before = await page.evaluate(() => {
    const disclosure = document.querySelector<HTMLElement>("[data-testid='snapshot-store-disclosure']")!;
    const summary = document.querySelector<HTMLElement>("[data-testid='snapshot-store-toggle']")!;
    const title = document.querySelector<HTMLElement>(".snapshot-store-title")!;
    const counts = document.querySelector<HTMLElement>(".snapshot-store-counts")!;
    const disclosureStyle = getComputedStyle(disclosure);
    const summaryStyle = getComputedStyle(summary);
    const titleStyle = getComputedStyle(title);
    const countsStyle = getComputedStyle(counts);
    const rect = summary.getBoundingClientRect();
    return {
      disclosure: {
        display: disclosureStyle.display,
        flex: disclosureStyle.flex,
        marginTop: disclosureStyle.marginTop,
        borderTopWidth: disclosureStyle.borderTopWidth,
      },
      summary: {
        display: summaryStyle.display,
        minHeight: summaryStyle.minHeight,
        gap: summaryStyle.gap,
        padding: summaryStyle.padding,
        letterSpacing: summaryStyle.letterSpacing,
        listStyleType: summaryStyle.listStyleType,
        height: Math.round(rect.height * 100) / 100,
      },
      title: {
        display: titleStyle.display,
        gap: titleStyle.gap,
      },
      counts: {
        fontSize: countsStyle.fontSize,
        whiteSpace: countsStyle.whiteSpace,
      },
    };
  });
  expect(before.disclosure.display).toBe("block");
  expect(before.disclosure.flex).toContain("0 0 auto");
  expect(before.disclosure.marginTop).toBe("6px");
  expect(before.summary.display).toBe("flex");
  expect(before.summary.minHeight).toBe("30px");
  expect(before.summary.gap).toBe("12px");
  expect(before.summary.padding).toBe("0px 10px");
  expect(before.summary.letterSpacing).toBe("0.48px");
  // A flex item blockifies inline-flex to flex in computed style.
  expect(before.title.display).toBe("flex");
  expect(before.counts.whiteSpace).toBe("nowrap");

  await summary.click();
  await expect(disclosure).toHaveAttribute("open", "");
  const expanded = await disclosure.evaluate((element) => {
    const style = getComputedStyle(element);
    const panel = element.querySelector<HTMLElement>(".snapshot-panel");
    if (!panel) throw new Error("Compare Snapshot Store panel root is missing");
    const panelStyle = getComputedStyle(panel);
    return {
      maxHeight: style.maxHeight,
      overflowY: style.overflowY,
      panel: {
        marginTop: panelStyle.marginTop,
        padding: panelStyle.padding,
        borderRadius: panelStyle.borderRadius,
        backgroundColor: panelStyle.backgroundColor,
      },
    };
  });
  expect(expanded.maxHeight).toBe("342px");
  expect(expanded.overflowY).toBe("auto");
  expect(expanded.panel.marginTop).toBe("4px");
  expect(expanded.panel.padding).toBe("8px");
  expect(expanded.panel.borderRadius).toBe("3px");
  expect(expanded.panel.backgroundColor).toBe("rgb(21, 25, 29)");
});


test("preserves Compare summary metric geometry and responsive separators", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("workspace-compare").click();

  const summary = page.getByTestId("compare-summary");
  await expect(summary).toBeVisible();
  const desktop = await summary.evaluate((element) => {
    const root = getComputedStyle(element);
    const metric = element.querySelector<HTMLElement>(".metric")!;
    const nextMetric = element.querySelector<HTMLElement>(".metric + .metric")!;
    const label = element.querySelector<HTMLElement>(".metric .label")!;
    const value = element.querySelector<HTMLElement>(".metric .value")!;
    const separator = getComputedStyle(nextMetric, "::before");
    return {
      root: {
        display: root.display,
        flex: root.flex,
        minHeight: root.minHeight,
        gap: root.gap,
        padding: root.padding,
        backgroundColor: root.backgroundColor,
      },
      metric: {
        display: getComputedStyle(metric).display,
        position: getComputedStyle(metric).position,
        gap: getComputedStyle(metric).gap,
        whiteSpace: getComputedStyle(metric).whiteSpace,
      },
      label: {
        fontSize: getComputedStyle(label).fontSize,
        letterSpacing: getComputedStyle(label).letterSpacing,
      },
      value: {
        fontFamily: getComputedStyle(value).fontFamily,
        fontSize: getComputedStyle(value).fontSize,
        maxWidth: getComputedStyle(value).maxWidth,
        overflow: getComputedStyle(value).overflow,
        textOverflow: getComputedStyle(value).textOverflow,
      },
      separator: {
        content: separator.content,
        width: separator.width,
        top: separator.top,
        bottom: separator.bottom,
        backgroundColor: separator.backgroundColor,
      },
    };
  });
  expect(desktop.root).toEqual({
    display: "flex",
    flex: "0 0 56px",
    minHeight: "38px",
    gap: "14px",
    padding: "0px 12px",
    backgroundColor: "rgb(20, 25, 29)",
  });
  expect(desktop.metric).toEqual({
    display: "flex",
    position: "relative",
    gap: "7px",
    whiteSpace: "nowrap",
  });
  expect(desktop.label).toEqual({ fontSize: "8px", letterSpacing: "0.24px" });
  expect(desktop.value).toMatchObject({
    fontSize: "10px",
    maxWidth: "240px",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });
  expect(desktop.separator).toEqual({
    content: '""',
    width: "1px",
    top: "7px",
    bottom: "7px",
    backgroundColor: "rgb(42, 49, 54)",
  });

  await page.setViewportSize({ width: 1000, height: 900 });
  const compact = await summary.evaluate((element) => {
    const root = getComputedStyle(element);
    const metric = element.querySelector<HTMLElement>(".metric")!;
    const nextMetric = element.querySelector<HTMLElement>(".metric + .metric")!;
    const footnote = element.querySelector<HTMLElement>(".footnote")!;
    const separator = getComputedStyle(nextMetric, "::before");
    return {
      rootGap: root.gap,
      paddingInline: root.paddingInline,
      metricGap: getComputedStyle(metric).gap,
      nextMetricPaddingLeft: getComputedStyle(nextMetric).paddingLeft,
      separatorTop: separator.top,
      separatorBottom: separator.bottom,
      footnoteDisplay: getComputedStyle(footnote).display,
    };
  });
  expect(compact).toEqual({
    rootGap: "8px",
    paddingInline: "8px",
    metricGap: "4px",
    nextMetricPaddingLeft: "6px",
    separatorTop: "8px",
    separatorBottom: "8px",
    footnoteDisplay: "none",
  });
});


test("preserves development context menu positioning, stacking, button geometry and hover styling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.evaluate(() => {
    window.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 120,
      clientY: 140,
      button: 2,
      buttons: 2,
    }));
  });

  const menu = page.getByTestId("devtools-context-menu");
  await expect(menu).toBeVisible();
  const menuStyle = await menu.evaluate((element) => {
    const style = getComputedStyle(element);
    const button = element.querySelector<HTMLElement>('[data-testid="open-devtools"]')!;
    const buttonStyle = getComputedStyle(button);
    return {
      left: style.left,
      top: style.top,
      position: style.position,
      zIndex: style.zIndex,
      minWidth: style.minWidth,
      padding: style.padding,
      borderRadius: style.borderRadius,
      backgroundColor: style.backgroundColor,
      boxShadow: style.boxShadow,
      button: {
        display: buttonStyle.display,
        width: buttonStyle.width,
        minHeight: buttonStyle.minHeight,
        padding: buttonStyle.padding,
        borderRadius: buttonStyle.borderRadius,
        backgroundColor: buttonStyle.backgroundColor,
        color: buttonStyle.color,
        textAlign: buttonStyle.textAlign,
        fontSize: buttonStyle.fontSize,
      },
    };
  });
  const surface1 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dbg-surface-1").trim());
  const surface3 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dbg-surface-3").trim());
  const resolvedSurface1 = await page.evaluate((token) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = token;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, surface1);
  const resolvedSurface3 = await page.evaluate((token) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = token;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, surface3);
  expect(menuStyle).toMatchObject({
    left: "120px",
    top: "140px",
    position: "fixed",
    zIndex: "10000",
    minWidth: "176px",
    padding: "4px",
    borderRadius: "4px",
    backgroundColor: resolvedSurface1,
    button: {
      display: "block",
      minHeight: "30px",
      padding: "0px 9px",
      borderRadius: "2px",
      textAlign: "left",
      fontSize: "11px",
    },
  });

  const firstButton = page.getByTestId("open-devtools");
  await firstButton.hover();
  const hoverBackground = await firstButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(hoverBackground).toBe(resolvedSurface3);
});


test("preserves Replay playback speed menu geometry, options and hover styling", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByTestId("workspace-replay").click();

  const control = page.getByTestId("replay-speed-control");
  await expect(control).toBeVisible();
  await control.hover();
  const menu = page.getByTestId("replay-speed-menu");
  await expect(menu).toBeVisible();

  const styles = await menu.evaluate((element) => {
    const root = getComputedStyle(element);
    const option = element.querySelector<HTMLElement>(".replay-speed-option")!;
    const optionStyle = getComputedStyle(option);
    return {
      root: {
        position: root.position,
        zIndex: root.zIndex,
        top: root.top,
        right: root.right,
        display: root.display,
        width: root.width,
        flexDirection: root.flexDirection,
        gap: root.gap,
        padding: root.padding,
        borderRadius: root.borderRadius,
        boxShadow: root.boxShadow,
      },
      option: {
        display: optionStyle.display,
        minHeight: optionStyle.minHeight,
        alignItems: optionStyle.alignItems,
        justifyContent: optionStyle.justifyContent,
        padding: optionStyle.padding,
        borderRadius: optionStyle.borderRadius,
        fontSize: optionStyle.fontSize,
        textAlign: optionStyle.textAlign,
      },
      options: Array.from(element.querySelectorAll<HTMLElement>(".replay-speed-option"))
        .map((item) => item.textContent?.trim()),
    };
  });

  expect(styles.root).toEqual({
    position: "absolute",
    zIndex: "1200",
    top: "28px",
    right: "0px",
    display: "flex",
    width: "86px",
    flexDirection: "column",
    gap: "1px",
    padding: "4px",
    borderRadius: "4px",
    boxShadow: "rgba(0, 0, 0, 0.6) 0px 6px 20px 0px",
  });
  expect(styles.option).toMatchObject({
    display: "flex",
    minHeight: "27px",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0px 7px",
    borderRadius: "2px",
    fontSize: "11px",
    textAlign: "left",
  });
  expect(styles.options).toEqual(["0.5x✓", "1x", "2x", "3x", "MAX"]);

  const surface3 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dbg-surface-3").trim());
  const resolvedSurface3 = await page.evaluate((token) => {
    const probe = document.createElement("div");
    probe.style.backgroundColor = token;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, surface3);
  const firstOption = menu.locator(".replay-speed-option").first();
  await firstOption.hover();
  await expect.poll(() => firstOption.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(resolvedSurface3);
});
