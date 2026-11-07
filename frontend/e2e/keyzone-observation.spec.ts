import { expect, test } from "@playwright/test";
import { keyzoneBars, keyzoneFixture } from "../tests/unit/keyzone-fixture";

test("Live Replay creates, advances and cancels an observation without losing the selected zone", async ({ page }) => {
  const base = keyzoneBars()[0]!;
  const bars = Array.from({ length: 40 }, (_, index) => {
    const time = (1700000000000000000n + BigInt(index) * 60000000000n).toString();
    return { ...base, sbarId: time, tsEvent: time, tsInit: time };
  });
  const registry = keyzoneFixture();
  registry.observations = [];
  registry.interactions = [];
  const zone = registry.zones[0]!;
  Object.assign(zone, { formedAt: bars[12]!.sbarId, createdAt: bars[14]!.sbarId,
    finalizedAt: bars[14]!.sbarId, finalizedDetectedAt: bars[14]!.sbarId });
  const origin = { originDatasetId: "origin-observation", sourceCatalog: "fixture", enableStructure: true,
    instrumentId: registry.instrumentId, barType: base.barType, timeframe: "1m", sbarSequenceFingerprint: "fixture",
    sbarCount: bars.length, firstSbarId: bars[0]!.sbarId, lastSbarId: bars[39]!.sbarId,
    firstTsEvent: bars[0]!.tsEvent, lastTsEvent: bars[39]!.tsEvent, bars,
    structure: { cbarCount: 0, cbars: [], swingCount: 0, swings: [], trendCount: 0, trends: [] }, keyzones: registry };
  const dataset = { testDatasetId: "test-observation", originDatasetId: origin.originDatasetId,
    instrumentId: registry.instrumentId, barType: base.barType, timeframe: "1m", startSbarId: bars[0]!.sbarId,
    endSbarId: bars[39]!.sbarId, sbarCount: 40, sbarSequenceFingerprint: "fixture" };
  const run = { runId: "run-observation", testDatasetId: dataset.testDatasetId, inputFingerprint: "fixture", inputCount: 40,
    status: "paused", processedCount: 21, cursorSbarId: bars[20]!.sbarId, failureDiagnostic: null };
  const inspector = { stateKey: "state-observation", checkpointIndex: 20, sbarId: bars[20]!.sbarId,
    sbar: { ...bars[20]!, body: "1", upperShadow: "2", lowerShadow: "2", totalRange: "5", bodyRatio: 0.2, shadowRatio: 0.8, direction: "Up" },
    structure: origin.structure, keyzones: registry };
  await page.addInitScript((data) => {
    const runtime = window as unknown as {
      observationBorder?: { x: number; y: number };
      observationCalls: Array<{ command: string; request: unknown }>;
      finishObservation?: () => void;
    };
    runtime.observationCalls = [];
    const stroke = CanvasRenderingContext2D.prototype.strokeRect;
    CanvasRenderingContext2D.prototype.strokeRect = function (x, y, width, height) {
      if (this.canvas.closest('[data-sequence-id="test-observation"]') &&
        ["#b49a75", "#e3bd80", "#f0cb87"].includes(String(this.strokeStyle)) && width > 0 && height > 0) {
        const bounds = this.canvas.getBoundingClientRect();
        runtime.observationBorder = { x: bounds.x + x + width, y: bounds.y + y + height / 2 };
      }
      stroke.call(this, x, y, width, height);
    };
    const registry = data.inspector.keyzones;
    const responses: Record<string, unknown> = {
      list_catalog_datasets: [{ id: "fixture", barType: data.origin.barType, instrumentId: data.origin.instrumentId, timeframe: "1m", available: true, diagnostic: null }],
      get_current_origin: data.origin, get_current_test_dataset: data.dataset, list_snapshots: [],
      get_run_state: data.run, get_replay_inspector: data.inspector,
    };
    Object.defineProperty(window, "__TAURI_INTERNALS__", { value: { invoke: async (command: string, args?: { request?: Record<string, unknown> }) => {
      if (command === "create_keyzone_observation") {
        const request = args!.request!;
        runtime.observationCalls.push({ command, request });
        await new Promise<void>((resolve) => { runtime.finishObservation = resolve; });
        registry.observations.push({ observationId: "1", consumerId: "struxis-debugger", requestId: String(request.requestId),
          keyzoneId: String(request.keyzoneId), observer: { instrumentId: registry.instrumentId, timeframe: "1m" },
          startMode: "AfterCurrentCursor", startAt: data.run.cursorSbarId, startExclusive: true,
          deadline: String(request.deadline), completion: "UntilDeadline", configN: "3", configX: 0.5,
          createdAt: data.run.cursorSbarId, state: "Observing", reason: null, lastProcessedAt: null, terminalAt: null, terminalDetectedAt: null });
        return structuredClone({ observationId: "1", operation: "created", inspector: data.inspector });
      }
      if (command === "step_run") {
        data.run.processedCount = 22;
        data.run.cursorSbarId = data.bars[21]!.sbarId;
        data.inspector.checkpointIndex = 21;
        data.inspector.sbarId = data.run.cursorSbarId;
        data.inspector.sbar = { ...data.inspector.sbar, ...data.bars[21]! };
        registry.observations[0]!.lastProcessedAt = data.run.cursorSbarId;
        registry.interactions.push({ interactionId: "1", keyzoneId: registry.zones[0]!.keyzoneId, observationId: "1",
          observer: { instrumentId: registry.instrumentId, timeframe: "1m" }, observerTimeframe: "1m", state: "Active", configN: "3", configX: 0.5,
          outsideCount: "0", lastProcessedAt: data.run.cursorSbarId, startedAt: data.run.cursorSbarId, startedDetectedAt: data.run.cursorSbarId,
          endedAt: null, endedDetectedAt: null, invalidatedAt: null, invalidatedDetectedAt: null });
        return structuredClone({ runState: data.run, inspector: data.inspector });
      }
      if (command === "cancel_keyzone_observation") {
        runtime.observationCalls.push({ command, request: args!.request });
        Object.assign(registry.observations[0]!, { state: "Cancelled", reason: "Cancelled", terminalAt: data.run.cursorSbarId, terminalDetectedAt: data.run.cursorSbarId });
        Object.assign(registry.interactions[0]!, { state: "Interrupted", interruptedAt: data.run.cursorSbarId,
          interruptedDetectedAt: data.run.cursorSbarId, interruptionReason: "Cancelled" });
        return structuredClone({ observationId: "1", operation: "cancelled", inspector: data.inspector });
      }
      if (command in responses) return structuredClone(responses[command]);
      throw new Error(`Unexpected command ${command}`);
    } } });
  }, { origin, dataset, run, inspector, bars });
  await page.goto("/");
  await page.getByTestId("workspace-replay").click();
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as { observationBorder?: unknown }).observationBorder))).toBe(true);
  const border = await page.evaluate(() => (window as unknown as { observationBorder: { x: number; y: number } }).observationBorder);
  await page.mouse.click(border.x, border.y);
  const controls = page.getByTestId("keyzone-observation-controls");
  await expect(controls).toBeVisible();
  await controls.getByRole("button", { name: "New observation", exact: true }).click();
  await controls.getByRole("combobox", { name: "Observation completion" }).selectOption("UntilDeadline");
  await page.screenshot({ path: test.info().outputPath("observation-form.png") });
  await controls.getByRole("button", { name: "Create observation", exact: true }).click();
  await expect(controls.getByRole("button", { name: "Creating…", exact: true })).toBeDisabled();
  await expect(page.getByTestId("run-step")).toBeDisabled();
  await page.evaluate(() => (window as unknown as { finishObservation: () => void }).finishObservation());
  await expect(controls.getByRole("status")).toHaveText("Observation 1 created.");
  await expect(page.getByTestId("keyzone-observation")).toHaveAttribute("data-observation-id", "1");
  await expect(page.getByTestId("run-toolbar-status")).toContainText("21");
  await page.getByTestId("run-step").click();
  await expect(page.getByTestId("keyzone-details")).toBeVisible();
  await expect(page.getByTestId("keyzone-interaction")).toContainText("Active");
  await controls.getByRole("button", { name: "Cancel observation 1", exact: true }).click();
  await expect(controls.getByRole("status")).toHaveText("Observation 1 cancelled.");
  await expect(controls.getByRole("button", { name: "Cancel observation 1", exact: true })).toHaveCount(0);
  await expect(page.getByTestId("keyzone-interaction")).toContainText("Interrupted");
  const calls = await page.evaluate(() => (window as unknown as { observationCalls: Array<{ command: string; request: unknown }> }).observationCalls);
  expect(calls).toEqual([
    { command: "create_keyzone_observation", request: expect.objectContaining({ context: { runId: "run-observation", expectedSbarId: bars[20]!.sbarId }, keyzoneId: "9007199254740993", n: "3", x: 0.5, completion: "UntilDeadline", deadline: "1700002340000000001" }) },
    { command: "cancel_keyzone_observation", request: { context: { runId: "run-observation", expectedSbarId: bars[21]!.sbarId }, observationId: "1" } },
  ]);
});
