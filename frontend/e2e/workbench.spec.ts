import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "standard desktop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide desktop", width: 1920, height: 1080 },
];

async function layoutDiagnostics(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "[data-testid='debugger-shell']",
      "[data-testid='workbench-body']",
      "[data-testid='workbench-main']",
      "[data-testid='primary-workspace']",
      "[data-testid='workspace-content']",
      "[data-testid='catalog-rail']",
      "[data-testid='inspector-rail']",
      "[data-testid='diagnostics-dock']",
    ];

    const elements = selectors.map((selector) => {
      const element = document.querySelector<HTMLElement>(selector);
      if (!element) return { selector, missing: true };

      const rect = element.getBoundingClientRect();
      return {
        selector,
        x: Math.round(rect.x * 100) / 100,
        y: Math.round(rect.y * 100) / 100,
        width: Math.round(rect.width * 100) / 100,
        height: Math.round(rect.height * 100) / 100,
        right: Math.round(rect.right * 100) / 100,
        bottom: Math.round(rect.bottom * 100) / 100,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth,
        scrollHeight: element.scrollHeight,
        clientHeight: element.clientHeight,
        scrollTop: element.scrollTop,
        overflowX: getComputedStyle(element).overflowX,
        overflowY: getComputedStyle(element).overflowY,
      };
    });

    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      document: {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        scrollHeight: document.documentElement.scrollHeight,
        clientHeight: document.documentElement.clientHeight,
      },
      elements,
    };
  });
}

for (const viewport of viewports) {
  test(`workbench fits horizontally at ${viewport.name} (${viewport.width}×${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Struxis Debugger" })).toBeVisible();

    const diagnostics = await layoutDiagnostics(page);
    expect(
      diagnostics.document.scrollWidth,
      `Horizontal document overflow at ${viewport.width}×${viewport.height}. Layout diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`,
    ).toBeLessThanOrEqual(diagnostics.document.clientWidth);

    const shell = diagnostics.elements.find(
      (element) => "selector" in element && element.selector === "[data-testid='debugger-shell']",
    );
    expect(shell, `Missing workbench shell. Layout diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`).toBeTruthy();
    if (shell && "width" in shell && typeof shell.width === "number") {
      expect(
        Math.abs(shell.width - diagnostics.document.clientWidth),
        `Workbench shell should fill the available viewport width. Layout diagnostics:\n${JSON.stringify(diagnostics, null, 2)}`,
      ).toBeLessThanOrEqual(1);
    }
  });
}

test("workspace navigation updates the visible workflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "02 / Test & Replay" }).click();
  await expect(page.getByRole("heading", { name: "Test Dataset & Replay" })).toBeVisible();

  await page.getByRole("button", { name: "03 / Snapshots" }).click();
  await expect(page.getByRole("heading", { name: "Snapshot Inventory" })).toBeVisible();

  await page.getByRole("button", { name: "01 / Origin" }).click();
  await expect(page.getByRole("heading", { name: "Origin Load" })).toBeVisible();
});

test("catalog and inspector can collapse and restore", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await page.getByRole("button", { name: "Collapse Catalog" }).click();
  await expect(page.getByRole("button", { name: "Expand Catalog" })).toBeVisible();
  await page.getByRole("button", { name: "Expand Catalog" }).click();
  await expect(page.getByRole("button", { name: "Collapse Catalog" })).toBeVisible();

  await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await expect(page.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Expand Inspector" }).click();
  await expect(page.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
});

test("diagnostics dock can collapse and restore", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("diagnostics-dock")).toBeVisible();
  await page.getByRole("button", { name: "Hide Diagnostics" }).click();
  await expect(page.getByTestId("diagnostics-dock")).toHaveCount(0);
  await page.getByRole("button", { name: "Show Diagnostics" }).click();
  await expect(page.getByTestId("diagnostics-dock")).toBeVisible();
});

test("Space preserves native control behavior and is inert without an eligible Run", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Struxis Debugger" })).toBeVisible();

  await page.evaluate(() => {
    document.body.tabIndex = -1;
    document.body.focus();
    document.body.dataset.spaceDefaultPrevented = "unset";
    document.addEventListener("keydown", (event) => {
      if (event.code === "Space" && event.target === document.body) {
        document.body.dataset.spaceDefaultPrevented = String(event.defaultPrevented);
      }
    });
  });
  await page.keyboard.press("Space");
  expect(await page.locator("body").getAttribute("data-space-default-prevented")).toBe("false");

  await page.evaluate(() => {
    const input = document.createElement("input");
    input.dataset.testid = "space-input-fixture";
    document.body.appendChild(input);
    const button = document.createElement("button");
    button.dataset.testid = "space-button-fixture";
    button.textContent = "Fixture";
    button.addEventListener("click", () => { button.dataset.activated = "true"; });
    document.body.appendChild(button);
  });

  const input = page.getByTestId("space-input-fixture");
  await input.focus();
  await page.keyboard.press("Space");
  await expect(input).toHaveValue(" ");

  const button = page.getByTestId("space-button-fixture");
  await button.focus();
  await page.keyboard.press("Space");
  await expect(button).toHaveAttribute("data-activated", "true");
});

test("overflowing workspace content scrolls inside its own panel", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const content = page.getByTestId("workspace-content");
  await content.evaluate((element) => {
    const fixture = document.createElement("div");
    fixture.dataset.testid = "scroll-fixture";
    fixture.setAttribute("aria-hidden", "true");
    fixture.style.flex = "0 0 1200px";
    element.appendChild(fixture);
  });

  const before = await content.evaluate((element) => ({
    scrollHeight: element.scrollHeight,
    clientHeight: element.clientHeight,
    scrollTop: element.scrollTop,
  }));
  expect(
    before.scrollHeight,
    `Workspace content should overflow its own scroll container. Before scroll: ${JSON.stringify(before)}`,
  ).toBeGreaterThan(before.clientHeight);

  await content.evaluate((element) => element.scrollTo({ top: 100 }));
  await expect.poll(() => content.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
});


test("dock splitters stay on the workspace-facing panel edge", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
  await expect(page.getByTestId("diagnostics-dock")).toBeVisible();

  const inspectorGeometry = () => page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid='inspector-rail']")!;
    const splitter = document.querySelector<HTMLElement>("[data-testid='inspector-resize-edge']")!;
    const panelRect = panel.getBoundingClientRect();
    const splitterRect = splitter.getBoundingClientRect();
    return {
      panelLeft: panelRect.left,
      panelRight: panelRect.right,
      splitterLeft: splitterRect.left,
      splitterRight: splitterRect.right,
      splitterWidth: splitterRect.width,
    };
  });

  const diagnosticsGeometry = () => page.evaluate(() => {
    const panel = document.querySelector<HTMLElement>("[data-testid='diagnostics-dock']")!;
    const splitter = document.querySelector<HTMLElement>("[data-testid='diagnostics-resize-edge']")!;
    const panelRect = panel.getBoundingClientRect();
    const splitterRect = splitter.getBoundingClientRect();
    return {
      panelTop: panelRect.top,
      panelBottom: panelRect.bottom,
      splitterTop: splitterRect.top,
      splitterBottom: splitterRect.bottom,
      splitterHeight: splitterRect.height,
    };
  });

  // Right-docked Inspector: its splitter belongs on the panel's left edge.
  let inspector = await inspectorGeometry();
  expect(Math.abs(inspector.splitterLeft - inspector.panelLeft)).toBeLessThanOrEqual(4);
  expect(inspector.splitterWidth).toBeGreaterThan(0);

  await page.locator("[data-testid='inspector-dock-menu'] summary").click();
  await page.getByTestId("inspector-dock-left").click();
  await expect(page.getByTestId("primary-workspace")).toHaveClass(/inspector-dock-left/);

  // Left-docked Inspector: its splitter moves to the panel's right edge.
  inspector = await inspectorGeometry();
  expect(Math.abs(inspector.splitterRight - inspector.panelRight)).toBeLessThanOrEqual(4);

  // Bottom-docked Diagnostics: splitter belongs on the panel's top edge.
  let diagnostics = await diagnosticsGeometry();
  expect(Math.abs(diagnostics.splitterTop - diagnostics.panelTop)).toBeLessThanOrEqual(4);
  expect(diagnostics.splitterHeight).toBeGreaterThan(0);

  await page.locator("[data-testid='diagnostics-dock-menu'] summary").click();
  await page.getByTestId("diagnostics-dock-top").click();
  await expect(page.getByTestId("debugger-shell")).toHaveClass(/diagnostics-dock-top/);

  // Top-docked Diagnostics: splitter must move to the panel's bottom edge.
  diagnostics = await diagnosticsGeometry();
  expect(Math.abs(diagnostics.splitterBottom - diagnostics.panelBottom)).toBeLessThanOrEqual(4);
});
