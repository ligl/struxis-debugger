import { test, expect } from "@playwright/test";
import { keyzoneFixture, keyzoneBars } from "../tests/unit/keyzone-fixture";

test("Origin receives the KeyZone recording and renders its controllable chart layer", async ({ page }) => {
  const template = keyzoneBars()[0]!;
  const bars = Array.from({ length: 40 }, (_, index) => {
    const time = (1700000000000000000n + BigInt(index) * 60000000000n).toString();
    return { ...template, sbarId: time, tsEvent: time, tsInit: time };
  });
  const registry = keyzoneFixture();
  Object.assign(registry.zones[0]!, {
    formedAt: bars[12]!.sbarId, createdAt: bars[14]!.sbarId,
    finalizedAt: bars[14]!.sbarId, finalizedDetectedAt: bars[14]!.sbarId,
  });
  Object.assign(registry.interactions[0]!, {
    startedAt: bars[12]!.sbarId, startedDetectedAt: bars[14]!.sbarId,
    lastProcessedAt: bars[39]!.sbarId, outsideCount: "0",
  });
  Object.assign(registry.observations[0]!, { startAt: bars[12]!.tsEvent,
    deadline: (BigInt(bars[39]!.tsEvent) + 60000000000n).toString(), lastProcessedAt: bars[39]!.tsEvent });
  const origin = { originDatasetId: "origin-keyzone", sourceCatalog: "fixture", enableStructure: true,
    instrumentId: "AUD/USD.SIM", barType: bars[0]!.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
    sbarCount: bars.length, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[39]!.sbarId,
    firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[39]!.tsEvent, bars,
    structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] }, keyzones: registry };
  await page.addInitScript((data) => {
    // Locate the rendered canvas border in CSS coordinates. Domain assertions
    // below still use the independent fixture, not values calculated by the UI.
    const originalStroke = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function (x, y, width, height) {
      if (this.strokeStyle === "#b49a75" && width > 0 && height > 0) {
        const pane = this.canvas.getBoundingClientRect();
        (window as unknown as { keyzoneBorder: { x: number; y: number; width: number; paneWidth: number; dash: number[] } }).keyzoneBorder = { x: pane.x + x + width / 2, y: pane.y + y, width, paneWidth: pane.width, dash: this.getLineDash() };
      }
      originalStroke.call(this, x, y, width, height);
    };
    const responses: Record<string, unknown> = {
      list_catalog_datasets: [{ id: "fixture", barType: data.barType, instrumentId: data.instrumentId, timeframe: "1m", available: true, diagnostic: null }],
      get_current_origin: data, get_current_test_dataset: null, list_snapshots: [], get_run_state: null,
    };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: (command: string) =>
      command in responses ? Promise.resolve(responses[command]) : Promise.reject(new Error(`Unexpected fixture command ${command}`)) } });
  }, origin);
  await page.goto("/");
  const toggle = page.getByTestId("layer-toggle-keyzone");
  await expect(toggle).toBeEnabled();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("inspector-keyzone-summary")).toHaveText("KeyZone · 1");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("origin-chart-error")).toHaveCount(0);
  await page.waitForFunction(() => Boolean((window as unknown as { keyzoneBorder?: unknown }).keyzoneBorder));
  const border = await page.evaluate(() => (window as unknown as { keyzoneBorder: { x: number; y: number; width: number; paneWidth: number; dash: number[] } }).keyzoneBorder);
  expect(border.width).toBeGreaterThan(0);
  expect(border.width).toBeLessThan(border.paneWidth * 0.3);
  expect(border.dash).toEqual([5, 3]);
  await page.mouse.click(border.x, border.y);
  const details = page.getByTestId("keyzone-details");
  await expect(details).toBeVisible();
  await expect(details).toContainText("9007199254740993");
  await expect(details).toContainText("9.00001");
  await expect(details).toContainText("12.00002");
  await expect(details.getByTestId("keyzone-interaction")).toContainText("AUD/USD.SIM · 1m");

});

for (const chartKind of ["Origin", "Live Replay", "Snapshot Reference"] as const) {
  test(`${chartKind} supports KeyZone hover, selection and its own Inspector facts`, async ({ page }) => {
    const template = keyzoneBars()[0]!;
    const bars = Array.from({ length: 40 }, (_, index) => {
      const time = (1700000000000000000n + BigInt(index) * 60000000000n).toString();
      return { ...template, sbarId: time, tsEvent: time, tsInit: time };
    });
    const registry = keyzoneFixture();
    Object.assign(registry.zones[0]!, { formedAt: bars[12]!.sbarId, createdAt: bars[14]!.sbarId,
      finalizedAt: bars[14]!.sbarId, finalizedDetectedAt: bars[14]!.sbarId });
    registry.observations = [];
    registry.interactions = [];
    const liveRegistry = structuredClone(registry), snapshotRegistry = structuredClone(registry);
    liveRegistry.zones[0]!.lower = "9.25001";
    snapshotRegistry.zones[0]!.lower = "8.50001";
    const structure = { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] };
    const origin = { originDatasetId: "origin-hover", sourceCatalog: "fixture", enableStructure: true,
      instrumentId: "AUD/USD.SIM", barType: template.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
      sbarCount: 40, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[39]!.sbarId,
      firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[39]!.tsEvent, bars, structure, keyzones: registry };
    const testDataset = { testDatasetId: "test-hover", originDatasetId: origin.originDatasetId,
      instrumentId: origin.instrumentId, barType: origin.barType, timeframe: "1m", startSbarId: bars[0]!.sbarId,
      endSbarId: bars[39]!.sbarId, sbarCount: 40, sbarSequenceFingerprint: "fixture" };
    const run = { runId: "run-hover", testDatasetId: testDataset.testDatasetId, inputFingerprint: "fixture", inputCount: 40,
      status: "completed", processedCount: 40, cursorSbarId: bars[39]!.sbarId, failureDiagnostic: null };
    const inspector = { stateKey: "state-hover", checkpointIndex: 39, sbarId: bars[39]!.sbarId,
      sbar: { ...bars[39]!, body: "1", upperShadow: "2", lowerShadow: "2", totalRange: "5", bodyRatio: 0.2, shadowRatio: 0.8, direction: "Up" },
      structure, keyzones: liveRegistry };
    const snapshots = [{ fileName: "snapshot-hover.snapshot", path: "fixture", kind: "complete", snapshotId: "snapshot-hover",
      runId: run.runId, stateKey: "state-hover", instrumentId: origin.instrumentId, barType: origin.barType,
      inputStartTsEvent: bars[0]!.sbarId, inputEndTsEvent: bars[39]!.sbarId,
      generatedAt: "1780000000000000000", checkpointCount: 40, diagnostic: null }];
    const reference = { snapshotId: "snapshot-hover", runId: run.runId, instrumentId: origin.instrumentId,
      barType: origin.barType, timeframe: "1m", snapshotGeneratedAt: "1780000000000000000",
      sbarSequenceFingerprint: "fixture", bars, structure, keyzones: snapshotRegistry,
      structureTimeline: bars.map((bar) => ({ sbarId: bar.sbarId, structure, keyzones: snapshotRegistry })) };
    await page.addInitScript((data) => {
      type Border = { x: number; y: number; color: string; width: number; dash: number[] };
      const state = window as unknown as { keyzoneFrames: Record<string, Border> };
      state.keyzoneFrames = {};
      const originalStroke = CanvasRenderingContext2D.prototype.strokeRect;
      CanvasRenderingContext2D.prototype.strokeRect = function (x, y, width, height) {
        const color = String(this.strokeStyle);
        const host = this.canvas.closest("[data-sequence-id]");
        const sequence = host?.getAttribute("data-sequence-id");
        if (sequence && ["#b49a75", "#e3bd80", "#f0cb87"].includes(color) && width > 0 && height > 0) {
          const pane = this.canvas.getBoundingClientRect();
          state.keyzoneFrames[sequence] = { x: pane.x + x + width, y: pane.y + y + height / 2,
            color, width: this.lineWidth, dash: this.getLineDash() };
        }
        originalStroke.call(this, x, y, width, height);
      };
      const responses: Record<string, unknown> = {
        list_catalog_datasets: [{ id: "fixture", barType: data.origin.barType, instrumentId: data.origin.instrumentId,
          timeframe: "1m", available: true, diagnostic: null }],
        get_current_origin: data.origin, get_current_test_dataset: data.testDataset,
        list_snapshots: data.snapshots, get_run_state: data.run, get_replay_inspector: data.inspector,
        get_snapshot_reference: data.reference,
      };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: (command: string) =>
        command in responses ? Promise.resolve(responses[command]) : Promise.reject(new Error(`Unexpected fixture command ${command}`)) } });
    }, { origin, testDataset, run, inspector, snapshots, reference });
    await page.goto("/");
    if (chartKind !== "Origin") await page.getByTestId("workspace-replay").click();
    if (chartKind === "Snapshot Reference") await page.getByTestId("replay-reference-select").selectOption("snapshot-hover");
    const sequence = chartKind === "Origin" ? "origin-hover" : chartKind === "Live Replay" ? "test-hover" : "snapshot-hover";
    const frame = () => page.evaluate((id) => (window as unknown as {
      keyzoneFrames: Record<string, { x: number; y: number; color: string; width: number; dash: number[] }>;
    }).keyzoneFrames[id], sequence);
    await expect.poll(async () => (await frame())?.color).toBe("#b49a75");
    const border = (await frame())!;
    await page.mouse.move(border.x, border.y);
    await expect.poll(async () => (await frame())?.color).toBe("#e3bd80");
    expect((await frame())?.dash).toEqual([5, 3]);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await frame())?.color).toBe("#b49a75");
    await page.mouse.click(border.x, border.y);
    await expect.poll(async () => (await frame())?.color).toBe("#f0cb87");
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await frame())?.color).toBe("#f0cb87");
    const details = page.getByTestId("keyzone-details");
    await expect(details).toBeVisible();
    await expect(details).toContainText("9007199254740993");
    await expect(details).toContainText(chartKind === "Origin" ? "9.00001" : chartKind === "Live Replay" ? "9.25001" : "8.50001");
    await expect(details).toContainText("12.00002");
  });
}

for (const chartKind of ["Origin", "Live Replay", "Snapshot Reference"] as const) {
  test(`${chartKind} draws all selected KeyZone episodes and clears them on SBar selection`, async ({ page }) => {
    const template = keyzoneBars()[0]!;
    const bars = Array.from({ length: 40 }, (_, index) => {
      const time = (1700000000000000000n + BigInt(index) * 60000000000n).toString();
      const exiting = [14, 15, 16, 24, 25, 26].includes(index);
      return { ...template, sbarId: time, tsEvent: time, tsInit: time,
        open: exiting ? "13" : "10", close: exiting ? "14" : "11",
        high: exiting ? "16" : index === 32 ? "18" : "13",
        low: exiting ? "12.5" : index === 13 ? "7" : index === 23 ? "6" : index === 32 ? "5" : "8" };
    });
    const registry = keyzoneFixture();
    Object.assign(registry.zones[0]!, { formedAt: bars[12]!.sbarId, createdAt: bars[14]!.sbarId,
      finalizedAt: bars[14]!.sbarId, finalizedDetectedAt: bars[14]!.sbarId });
    const base = registry.interactions[0]!;
    registry.interactions = [
      { ...base, interactionId: "1001", state: "Ended", startedAt: bars[13]!.tsEvent,
        lastProcessedAt: bars[16]!.tsEvent, endedAt: bars[16]!.tsEvent, endedDetectedAt: bars[16]!.tsEvent },
      { ...base, interactionId: "1002", state: "Ended", startedAt: bars[23]!.tsEvent,
        lastProcessedAt: bars[26]!.tsEvent, endedAt: bars[26]!.tsEvent, endedDetectedAt: bars[26]!.tsEvent },
      { ...base, interactionId: "1003", state: "Active", startedAt: bars[32]!.tsEvent,
        lastProcessedAt: bars[39]!.tsEvent },
      { ...base, interactionId: "1004", observationId: "2", observer: { instrumentId: registry.instrumentId, timeframe: "5m" }, observerTimeframe: "5m" },
    ];
    {
      const task = registry.observations[0]!;
      Object.assign(task, { startAt: bars[12]!.tsEvent, deadline: (BigInt(bars[39]!.tsEvent) + 60000000000n).toString(), lastProcessedAt: bars[39]!.tsEvent });
      registry.observations.push({ ...task, observationId: "2", consumerId: "other-period", requestId: "other-period", observer: { instrumentId: registry.instrumentId, timeframe: "5m" } });
      registry.interactions.forEach((episode, index) => {
        episode.outsideCount = index < 2 ? "3" : "0";
        if (index === 3) { episode.observationId = "2"; episode.observer = registry.observations[1]!.observer; episode.startedAt = bars[12]!.tsEvent; episode.lastProcessedAt = bars[39]!.tsEvent; }
      });
    }
    const liveRegistry = structuredClone(registry), snapshotRegistry = structuredClone(registry);
    liveRegistry.zones[0]!.lower = "9.25001";
    snapshotRegistry.zones[0]!.lower = "8.50001";
    const structure = { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] };
    const origin = { originDatasetId: "origin-hover", sourceCatalog: "fixture", enableStructure: true,
      instrumentId: "AUD/USD.SIM", barType: template.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
      sbarCount: 40, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[39]!.sbarId,
      firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[39]!.tsEvent, bars, structure, keyzones: registry };
    const testDataset = { testDatasetId: "test-hover", originDatasetId: origin.originDatasetId,
      instrumentId: origin.instrumentId, barType: origin.barType, timeframe: "1m", startSbarId: bars[0]!.sbarId,
      endSbarId: bars[39]!.sbarId, sbarCount: 40, sbarSequenceFingerprint: "fixture" };
    const run = { runId: "run-hover", testDatasetId: testDataset.testDatasetId, inputFingerprint: "fixture", inputCount: 40,
      status: "completed", processedCount: 40, cursorSbarId: bars[39]!.sbarId, failureDiagnostic: null };
    const inspector = { stateKey: "state-hover", checkpointIndex: 39, sbarId: bars[39]!.sbarId,
      sbar: { ...bars[39]!, body: "1", upperShadow: "2", lowerShadow: "2", totalRange: "5", bodyRatio: 0.2, shadowRatio: 0.8, direction: "Up" },
      structure, keyzones: liveRegistry };
    const snapshots = [{ fileName: "snapshot-hover.snapshot", path: "fixture", kind: "complete", snapshotId: "snapshot-hover",
      runId: run.runId, stateKey: "state-hover", instrumentId: origin.instrumentId, barType: origin.barType,
      inputStartTsEvent: bars[0]!.sbarId, inputEndTsEvent: bars[39]!.sbarId,
      generatedAt: "1780000000000000000", checkpointCount: 40, diagnostic: null }];
    const reference = { snapshotId: "snapshot-hover", runId: run.runId, instrumentId: origin.instrumentId,
      barType: origin.barType, timeframe: "1m", snapshotGeneratedAt: "1780000000000000000",
      sbarSequenceFingerprint: "fixture", bars, structure, keyzones: snapshotRegistry,
      structureTimeline: bars.map((bar) => ({ sbarId: bar.sbarId, structure, keyzones: snapshotRegistry })) };
    await page.addInitScript((data) => {
      type Border = { x: number; y: number; color: string; width: number; dash: number[]; top: number; height: number; labels: string[] };
      const state = window as unknown as { keyzoneFrames: Record<string, Border> };
      state.keyzoneFrames = {};
      const pending = new WeakMap<HTMLCanvasElement, string[]>();
      const originalText = CanvasRenderingContext2D.prototype.fillText;
      CanvasRenderingContext2D.prototype.fillText = function (text, x, y, maxWidth) {
        if (/^O\d+ · I\d+ (Active|Ended|Invalidated|Interrupted)$/.test(text)) {
          const labels = pending.get(this.canvas) ?? [];
          labels.push(text); pending.set(this.canvas, labels);
        }
        if (maxWidth === undefined) originalText.call(this, text, x, y);
        else originalText.call(this, text, x, y, maxWidth);
      };
      const originalStroke = CanvasRenderingContext2D.prototype.strokeRect;
      CanvasRenderingContext2D.prototype.strokeRect = function (x, y, width, height) {
        const color = String(this.strokeStyle);
        const host = this.canvas.closest("[data-sequence-id]");
        const sequence = host?.getAttribute("data-sequence-id");
        if (sequence && ["#b49a75", "#e3bd80", "#f0cb87"].includes(color) && width > 0 && height > 0) {
          const pane = this.canvas.getBoundingClientRect();
          state.keyzoneFrames[sequence] = { x: pane.x + x + width, y: pane.y + y + height / 2,
            color, width: this.lineWidth, dash: this.getLineDash(), top: pane.y + y, height, labels: pending.get(this.canvas) ?? [] };
          pending.set(this.canvas, []);
        }
        originalStroke.call(this, x, y, width, height);
      };
      const responses: Record<string, unknown> = {
        list_catalog_datasets: [{ id: "fixture", barType: data.origin.barType, instrumentId: data.origin.instrumentId,
          timeframe: "1m", available: true, diagnostic: null }],
        get_current_origin: data.origin, get_current_test_dataset: data.testDataset,
        list_snapshots: data.snapshots, get_run_state: data.run, get_replay_inspector: data.inspector,
        get_snapshot_reference: data.reference,
      };
      Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: (command: string) =>
        command in responses ? Promise.resolve(responses[command]) : Promise.reject(new Error(`Unexpected fixture command ${command}`)) } });
    }, { origin, testDataset, run, inspector, snapshots, reference });
    await page.goto("/");
    if (chartKind !== "Origin") await page.getByTestId("workspace-replay").click();
    if (chartKind === "Snapshot Reference") await page.getByTestId("replay-reference-select").selectOption("snapshot-hover");
    const sequence = chartKind === "Origin" ? "origin-hover" : chartKind === "Live Replay" ? "test-hover" : "snapshot-hover";
    const frame = () => page.evaluate((id) => (window as unknown as {
      keyzoneFrames: Record<string, { x: number; y: number; color: string; width: number; dash: number[]; top: number; height: number; labels: string[] }>;
    }).keyzoneFrames[id], sequence);
    await expect.poll(async () => (await frame())?.color).toBe("#b49a75");
    const border = (await frame())!;
    expect(border.labels).toEqual([]);
    await page.mouse.move(border.x, border.y);
    await expect.poll(async () => (await frame())?.color).toBe("#e3bd80");
    expect((await frame())?.dash).toEqual([5, 3]);
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await frame())?.color).toBe("#b49a75");
    await page.mouse.click(border.x, border.y);
    await expect.poll(async () => (await frame())?.color).toBe("#f0cb87");
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await frame())?.color).toBe("#f0cb87");
    const details = page.getByTestId("keyzone-details");
    await expect(details).toBeVisible();
    await expect(details).toContainText("9007199254740993");
    await expect(details).toContainText(chartKind === "Origin" ? "9.00001" : chartKind === "Live Replay" ? "9.25001" : "8.50001");
    await expect(details).toContainText("12.00002");
    {
      await expect.poll(async () => (await frame())?.labels).toEqual(["O1 · I1 Ended", "O1 · I2 Ended", "O1 · I3 Active"]);
      await expect(details.getByTestId("keyzone-observation")).toHaveCount(2);
      await expect(details).toContainText("strategy-a");
    }
    const selected = (await frame())!;
    const host = page.locator(`[data-sequence-id="${sequence}"]`);
    const first = Number(await host.getAttribute("data-first-sbar-x"));
    const second = Number(await host.getAttribute("data-second-sbar-x"));
    const bounds = await host.boundingBox();
    const lower = chartKind === "Origin" ? 9.00001 : chartKind === "Live Replay" ? 9.25001 : 8.50001;
    // Select the ordinary candle between episodes; episode boxes do not own candle hit-testing.
    const targetPoint = { x: bounds!.x + first + (second - first) * 20,
      y: selected.top + (12.00002 - 10.5) / (12.00002 - lower) * selected.height };
    // Lightweight Charts 5.2.1 groups mouse-up events within 500 ms as a
    // multi-click gesture. Complete this independent candle click after that window.
    await page.mouse.click(targetPoint.x, targetPoint.y, { delay: 550 });
    await expect(page.getByTestId("keyzone-details")).toHaveCount(0);
    await expect.poll(async () => (await frame())?.labels).toEqual([]);

  });
}
