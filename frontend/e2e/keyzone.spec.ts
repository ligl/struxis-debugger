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
  await expect(details.getByTestId("keyzone-interaction")).toContainText("AUD/USD.SIM-1-MINUTE-LAST-EXTERNAL");

});
