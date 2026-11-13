import { expect, test } from "@playwright/test";
import { keyzoneBars, keyzoneFixture } from "../tests/unit/keyzone-fixture";

test("Replay Inspector creates an independent FixedPriceRange before a separate observation", async ({ page }) => {
  const bars = keyzoneBars();
  const registry = keyzoneFixture();
  registry.zones = [];
  registry.observations = [];
  registry.interactions = [];
  const structure = { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] };
  const origin = { originDatasetId: "origin-fixed", sourceCatalog: "fixture", enableStructure: false,
    instrumentId: registry.instrumentId, barType: bars[0]!.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
    sbarCount: 4, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[3]!.sbarId,
    firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[3]!.tsEvent, bars, structure, keyzones: registry };
  const dataset = { testDatasetId: "test-fixed", originDatasetId: origin.originDatasetId, instrumentId: registry.instrumentId,
    barType: origin.barType, timeframe: "1m", startSbarId: bars[0]!.sbarId, endSbarId: bars[3]!.sbarId, sbarCount: 4, sbarSequenceFingerprint: "fixture" };
  const run = { runId: "run-fixed", testDatasetId: dataset.testDatasetId, inputFingerprint: "fixture", inputCount: 4,
    status: "paused", processedCount: 3, cursorSbarId: bars[2]!.sbarId, failureDiagnostic: null };
  const inspector = { stateKey: "state-fixed", checkpointIndex: 2, sbarId: bars[2]!.sbarId,
    sbar: { ...bars[2]!, body: "1", upperShadow: "2", lowerShadow: "2", totalRange: "5", bodyRatio: 0.2, shadowRatio: 0.8, direction: "Up" },
    structure, keyzones: registry };
  await page.addInitScript((data) => {
    const runtime = window as unknown as { fixedCalls: Array<{ command: string; request: Record<string, unknown> }>; fixedLine?: { x: number; y: number } };
    runtime.fixedCalls = [];
    const paths = new WeakMap<CanvasRenderingContext2D, number[][]>();
    const { beginPath, moveTo, lineTo, stroke } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.beginPath = function () { paths.set(this, []); beginPath.call(this); };
    CanvasRenderingContext2D.prototype.moveTo = function (x, y) { paths.get(this)?.push([x, y]); moveTo.call(this, x, y); };
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) { paths.get(this)?.push([x, y]); lineTo.call(this, x, y); };
    CanvasRenderingContext2D.prototype.stroke = function (...args: [] | [Path2D]) {
      const path = paths.get(this);
      if (path?.length === 4 && this.strokeStyle === "#756650" && this.getLineDash()[0] === 5) {
        const bounds = this.canvas.getBoundingClientRect();
        runtime.fixedLine = { x: bounds.x + path[0]![0]! + 12, y: bounds.y + path[0]![1]! };
      }
      Reflect.apply(stroke, this, args);
    };
    const responses: Record<string, unknown> = { list_catalog_datasets: [], get_current_origin: data.origin,
      get_current_test_dataset: data.dataset, list_snapshots: [], get_run_state: data.run, get_replay_inspector: data.inspector };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args?: { request: Record<string, unknown> }) => {
      if (command === "create_fixed_price_range") {
        const request = args!.request;
        runtime.fixedCalls.push({ command, request });
        // System creation time lies beyond the historical chart, as in production.
        const createdAt = "1800000000000000000";
        data.inspector.keyzones.zones.push({ keyzoneId: "42", originKind: "FixedPriceRange", originId: null,
          timeframe: "1m", lower: String(request.lower), upper: String(request.upper), state: "Finalized",
          formedAt: createdAt, createdAt, finalizedAt: createdAt, finalizedDetectedAt: createdAt,
          invalidatedAt: null, invalidatedDetectedAt: null });
        return structuredClone({ keyzoneId: "42", inspector: data.inspector });
      }
      if (command === "create_keyzone_observation") {
        const request = args!.request;
        runtime.fixedCalls.push({ command, request });
        data.inspector.keyzones.observations.push({ observationId: "7", consumerId: "struxis-debugger", requestId: String(request.requestId),
          keyzoneId: "42", observer: { instrumentId: data.origin.instrumentId, timeframe: "1m" }, startMode: "AfterCurrentCursor",
          startAt: data.run.cursorSbarId, startExclusive: true, deadline: String(request.deadline), completion: "AfterOneInteraction",
          configN: "3", configX: 0.5, createdAt: "1800000000000000000", state: "Observing", reason: null,
          lastProcessedAt: null, terminalAt: null, terminalDetectedAt: null });
        return structuredClone({ observationId: "7", operation: "created", inspector: data.inspector });
      }
      if (command in responses) return structuredClone(responses[command]);
      throw new Error(`Unexpected command ${command}`);
    } } });
  }, { origin, dataset, run, inspector });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "New FixedPriceRange keyzone", exact: true })).toHaveCount(0);
  await page.getByTestId("workspace-replay").click();
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  await page.getByRole("button", { name: "New FixedPriceRange keyzone", exact: true }).click();
  const form = page.getByRole("form", { name: "Create FixedPriceRange KeyZone" });
  await expect(form.getByRole("textbox", { name: "FixedPriceRange Lower" })).toHaveValue("");
  await expect(form.getByRole("textbox", { name: "FixedPriceRange Upper" })).toHaveValue("");
  await expect(form.getByRole("button", { name: "Create FixedPriceRange keyzone", exact: true })).toBeDisabled();
  await form.getByRole("textbox", { name: "FixedPriceRange Lower" }).fill("9.00001");
  await form.getByRole("textbox", { name: "FixedPriceRange Upper" }).fill("12.00002");
  await form.getByRole("button", { name: "Create FixedPriceRange keyzone", exact: true }).click();
  const details = page.getByTestId("keyzone-details");
  await expect(details).toHaveCount(0);
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { fixedLine?: unknown }).fixedLine))).toBe(true);
  const line = await page.evaluate(() => (window as unknown as { fixedLine: { x: number; y: number } }).fixedLine);
  await page.mouse.click(line.x, line.y);
  await expect(details).toContainText("FixedPriceRange");
  await expect(details.getByTestId("keyzone-observations-empty")).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { fixedCalls: unknown[] }).fixedCalls)).toEqual([
    { command: "create_fixed_price_range", request: { context: { runId: "run-fixed", expectedSbarId: "1700000120000000000" }, lower: "9.00001", upper: "12.00002" } },
  ]);
  await details.getByRole("button", { name: "New observation", exact: true }).click();
  await details.getByRole("button", { name: "Create observation", exact: true }).click();
  await expect(details.getByTestId("keyzone-observation")).toContainText("Observation 7");
  await page.getByTestId("workspace-replay").click();
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  await expect(details).toHaveCount(0);
});

test("created FixedPriceRange supports 24px right-edge lines, hover and persistent expanded selection", async ({ page }) => {
  const bars = keyzoneBars();
  const registry = keyzoneFixture();
  registry.zones = [];
  registry.observations = [];
  registry.interactions = [];
  const structure = { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] };
  const origin = { originDatasetId: "origin-fixed-drawing", sourceCatalog: "fixture", enableStructure: false,
    instrumentId: registry.instrumentId, barType: bars[0]!.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
    sbarCount: 4, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[3]!.sbarId,
    firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[3]!.tsEvent, bars, structure, keyzones: registry };
  const dataset = { testDatasetId: "test-fixed-drawing", originDatasetId: origin.originDatasetId, instrumentId: registry.instrumentId,
    barType: origin.barType, timeframe: "1m", startSbarId: bars[0]!.sbarId, endSbarId: bars[3]!.sbarId,
    sbarCount: 4, sbarSequenceFingerprint: "fixture" };
  const run = { runId: "run-fixed-drawing", testDatasetId: dataset.testDatasetId, inputFingerprint: "fixture", inputCount: 4,
    status: "paused", processedCount: 3, cursorSbarId: bars[2]!.sbarId, failureDiagnostic: null };
  const inspector = { stateKey: "state-fixed-drawing", checkpointIndex: 2, sbarId: bars[2]!.sbarId,
    sbar: { ...bars[2]!, body: "1", upperShadow: "2", lowerShadow: "2", totalRange: "5", bodyRatio: 0.2, shadowRatio: 0.8, direction: "Up" },
    structure, keyzones: registry };
  type Drawing = { segments: number[][]; canvasX: number; canvasY: number; paneWidth: number; color: string };
  type Band = { x: number; y: number; width: number; height: number; color: string; alpha: number };
  await page.addInitScript((data) => {
    const runtime = window as unknown as { fixedDrawing?: Drawing; fixedBand?: Band | null; fixedCandle?: { x: number; y: number } };
    const paths = new WeakMap<CanvasRenderingContext2D, number[][]>();
    const { beginPath, moveTo, lineTo, stroke, fillRect } = CanvasRenderingContext2D.prototype;
    CanvasRenderingContext2D.prototype.beginPath = function () { paths.set(this, []); beginPath.call(this); };
    CanvasRenderingContext2D.prototype.moveTo = function (x, y) { paths.get(this)?.push([x, y]); moveTo.call(this, x, y); };
    CanvasRenderingContext2D.prototype.lineTo = function (x, y) { paths.get(this)?.push([x, y]); lineTo.call(this, x, y); };
    CanvasRenderingContext2D.prototype.stroke = function (...args: [] | [Path2D]) {
      const path = paths.get(this);
      const color = String(this.strokeStyle);
      const dash = this.getLineDash();
      if (path?.length === 4 && ["#756650", "#8c785b", "#9e8661"].includes(color) && dash[0] === 5 && dash[1] === 3) {
        const bounds = this.canvas.getBoundingClientRect();
        runtime.fixedDrawing = { segments: path.map((point) => [...point]), canvasX: bounds.x, canvasY: bounds.y,
          paneWidth: bounds.width, color };
        if (path[1]![0]! - path[0]![0]! <= 24) runtime.fixedBand = null;
      }
      Reflect.apply(stroke, this, args);
    };
    CanvasRenderingContext2D.prototype.fillRect = function (x, y, width, height) {
      const color = String(this.fillStyle);
      const bounds = this.canvas.getBoundingClientRect();
      // Candles use bitmap coordinates; locate a real candle body in the same
      // pane as the price lines instead of clicking an empty logical column.
      if (color.toLowerCase() === "#557e65" && width > 1 && height > 1
        && bounds.y === runtime.fixedDrawing?.canvasY) {
        const center = { x: bounds.x + (x + width / 2) * bounds.width / this.canvas.width,
          y: bounds.y + (y + height / 2) * bounds.height / this.canvas.height };
        // Volume shares this canvas and color; only a candle within the
        // selected price band is a valid target for this regression.
        const pair = runtime.fixedDrawing;
        if (center.y > pair.canvasY + pair.segments[0]![1]! + 4
          && center.y < pair.canvasY + pair.segments[2]![1]! - 4) runtime.fixedCandle = center;
      }
      if (["#8c785b", "#9e8661"].includes(color) && this.globalAlpha === 0.1) {
        runtime.fixedBand = { x, y, width, height, color, alpha: this.globalAlpha };
      }
      fillRect.call(this, x, y, width, height);
    };
    const responses: Record<string, unknown> = { list_catalog_datasets: [], get_current_origin: data.origin,
      get_current_test_dataset: data.dataset, list_snapshots: [], get_run_state: data.run, get_replay_inspector: data.inspector };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args?: { request: Record<string, unknown> }) => {
      if (command === "create_fixed_price_range") {
        const request = args!.request;
        const createdAt = "1800000000000000000";
        data.inspector.keyzones.zones.push({ keyzoneId: "42", originKind: "FixedPriceRange", originId: null,
          timeframe: "1m", lower: String(request.lower), upper: String(request.upper), state: "Finalized",
          formedAt: createdAt, createdAt, finalizedAt: createdAt, finalizedDetectedAt: createdAt,
          invalidatedAt: null, invalidatedDetectedAt: null });
        return structuredClone({ keyzoneId: "42", inspector: data.inspector });
      }
      if (command in responses) return structuredClone(responses[command]);
      throw new Error(`Unexpected command ${command}`);
    } } });
  }, { origin, dataset, run, inspector });
  await page.goto("/");
  const create = page.getByRole("button", { name: "New FixedPriceRange keyzone", exact: true });
  await expect(create).toHaveCount(0);
  await page.getByTestId("workspace-replay").click();
  await create.click();
  await page.getByRole("textbox", { name: "FixedPriceRange Lower" }).fill("9");
  await page.getByRole("textbox", { name: "FixedPriceRange Upper" }).fill("12");
  await page.getByRole("button", { name: "Create FixedPriceRange keyzone", exact: true }).click();
  // Creation refreshes the checkpoint but leaves the zone in its default state.
  await expect(page.getByTestId("keyzone-details")).toHaveCount(0);
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  await expect(create).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { fixedDrawing?: Drawing }).fixedDrawing))).toBe(true);
  const drawing = () => page.evaluate(() => (window as unknown as { fixedDrawing: Drawing }).fixedDrawing);
  await expect.poll(async () => { const value = await drawing(); return value.segments[1]![0]! - value.segments[0]![0]!; }).toBe(24);
  const short = await drawing();
  expect(short.segments).toHaveLength(4);
  expect(short.segments[1]![0]! - short.segments[0]![0]!).toBe(24);
  expect(short.segments[3]![0]! - short.segments[2]![0]!).toBe(24);
  expect(short.paneWidth - short.segments[1]![0]!).toBeCloseTo(0, 0);
  expect(short.segments[2]![1]!).toBeGreaterThan(short.segments[0]![1]!);
  expect(short.color).toBe("#756650");
  expect(await page.evaluate(() => (window as unknown as { fixedBand?: Band | null }).fixedBand)).toBeNull();
  await page.mouse.move(short.canvasX + short.segments[0]![0]! + 12, short.canvasY + short.segments[0]![1]!);
  await expect.poll(async () => (await drawing()).segments[0]![0]).toBe(0);
  const expanded = await drawing();
  await expect(page.getByTestId("keyzone-details")).toHaveCount(0);
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  expect(expanded.color).toBe("#8c785b");
  expect(expanded.segments[1]![0]).toBeCloseTo(expanded.paneWidth, 0);
  expect(expanded.segments[3]![0]).toBeCloseTo(expanded.paneWidth, 0);
  const band = await page.evaluate(() => (window as unknown as { fixedBand: Band }).fixedBand);
  expect(band).toEqual({ x: 0, y: expanded.segments[0]![1], width: expanded.segments[1]![0],
    height: expanded.segments[2]![1]! - expanded.segments[0]![1]!, color: "#8c785b", alpha: 0.1 });
  await page.mouse.move(expanded.canvasX + 30, expanded.canvasY + expanded.segments[2]![1]!);
  await expect.poll(async () => (await drawing()).segments[0]![0]).toBe(0);
  await page.getByTestId("workspace-replay").hover();
  await expect.poll(async () => { const value = await drawing(); return value.segments[1]![0]! - value.segments[0]![0]!; }).toBe(24);
  expect(await page.evaluate(() => (window as unknown as { fixedBand?: Band | null }).fixedBand)).toBeNull();
  await page.getByTestId("workspace-replay").click();
  await expect(page.getByTestId("inspector-replay-checkpoint")).toBeVisible();
  await expect(create).toBeVisible();
  const current = await drawing();
  await page.mouse.click(current.canvasX + current.segments[0]![0]! + 12, current.canvasY + current.segments[0]![1]!);
  await expect(page.getByTestId("keyzone-details")).toBeVisible();
  await expect(create).toHaveCount(0);
  await page.getByTestId("workspace-replay").hover();
  await expect.poll(async () => (await drawing()).segments[0]![0]).toBe(0);
  expect((await drawing()).color).toBe("#9e8661");
  expect(await page.evaluate(() => (window as unknown as { fixedBand?: Band | null }).fixedBand)).toMatchObject({ alpha: 0.1, color: "#9e8661" });
  // Clicking a candle inside the band still selects that candle, not the band.
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { fixedCandle?: unknown }).fixedCandle))).toBe(true);
  const candle = await page.evaluate(() => (window as unknown as { fixedCandle: { x: number; y: number } }).fixedCandle);
  // Lightweight Charts 5.2.1 consumes a second pane click inside its 500ms
  // double-click window, even at a different position. Use independent clicks.
  await page.waitForTimeout(550);
  await page.mouse.click(candle.x, candle.y);
  await expect(page.getByTestId("keyzone-details")).toHaveCount(0);
  await expect.poll(async () => { const value = await drawing(); return value.segments[1]![0]! - value.segments[0]![0]!; }).toBe(24);
  expect(await page.evaluate(() => (window as unknown as { fixedBand?: Band | null }).fixedBand)).toBeNull();
  await page.getByTestId("workspace-dataset").click();
  await expect(create).toHaveCount(0);
  await page.getByTestId("workspace-compare").click();
  await expect(create).toHaveCount(0);
});
