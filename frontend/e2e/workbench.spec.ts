import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "minimum supported desktop", width: 920, height: 800 },
  { name: "compact desktop", width: 1024, height: 800 },
  { name: "standard desktop", width: 1280, height: 800 },
  { name: "desktop", width: 1440, height: 900 },
  { name: "wide desktop", width: 1920, height: 1080 },
];

async function layoutDiagnostics(page: Page) {
  return page.evaluate(() => {
    const selectors = [
      "[data-testid='debugger-shell']",
      "[data-testid='topbar']",
      "[data-testid='workbench']",
      "[data-testid='chart-workspace']",
      "[data-testid='chart-toolbar']",
      "[data-testid='chart-panels']",
      "[data-testid='workspace-content']",
      "[data-testid='catalog-rail']",
      "[data-testid='inspector-panel']",
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

test("App Shell matches the approved ownership hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const hierarchy = await page.evaluate(() => {
    const directTestIds = (element: Element | null) =>
      element ? Array.from(element.children, (child) => child.getAttribute("data-testid")) : [];
    const shell = document.querySelector("[data-testid='debugger-shell']");
    const workbench = document.querySelector("[data-testid='workbench']");
    const chartWorkspace = document.querySelector("[data-testid='chart-workspace']");
    const chartPanels = document.querySelector("[data-testid='chart-panels']");
    return {
      shell: directTestIds(shell),
      workbench: directTestIds(workbench),
      chartWorkspace: directTestIds(chartWorkspace),
      chartPanels: directTestIds(chartPanels),
      hasLegacyFooter: Boolean(document.querySelector(".footer-bar")),
      hasLegacyPrimaryWorkspace: Boolean(document.querySelector("[data-testid='primary-workspace']")),
    };
  });

  const topbar = page.getByTestId("topbar");
  await expect(topbar.locator(".brand-name")).toHaveText("STRUXIS DEBUGGER");
  await expect(topbar.locator(".top-divider")).toBeVisible();
  await expect(page.getByTestId("workspace-dataset")).toHaveText("01  Dataset");
  await expect(page.getByTestId("workspace-replay")).toHaveText("02  Replay");
  await expect(page.getByTestId("workspace-compare")).toHaveText("03  Compare");
  await expect(topbar.locator(".keycap")).toHaveText("CAPITUS");
  await expect(topbar).toHaveCSS("height", "44px");

  expect(hierarchy.shell).toEqual(["topbar", "workbench"]);
  expect(hierarchy.workbench).toEqual(["chart-workspace", "inspector-panel", "diagnostics-dock"]);
  expect(hierarchy.chartWorkspace).toEqual(["chart-toolbar", "chart-panels"]);
  expect(hierarchy.chartPanels).toContain("catalog-rail");
  expect(hierarchy.chartPanels).toContain("workspace-content");
  expect(hierarchy.hasLegacyFooter).toBe(false);
  expect(hierarchy.hasLegacyPrimaryWorkspace).toBe(false);
});

for (const viewport of viewports) {
  test(`workbench fits horizontally at ${viewport.name} (${viewport.width}×${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/");
    const topbar = page.getByTestId("topbar");
    await expect(topbar.locator(".brand-name")).toBeVisible();
    await expect(topbar).toHaveCSS("flex-wrap", "nowrap");
    if (viewport.width === 920) {
      await expect(page.getByTestId("inspector-panel")).toBeVisible();
      await expect(page.getByTestId("diagnostics-dock")).toBeVisible();
    }

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

  await page.getByTestId("workspace-replay").click();
  await expect(page.getByTestId("workspace-replay")).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: "Run Replay" })).toBeVisible();
  await expect(page.locator(".replay-controls")).toBeVisible();

  await page.getByTestId("workspace-compare").click();
  await expect(page.getByTestId("workspace-compare")).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: "Snapshot Comparison" })).toBeVisible();
  await expect(page.locator(".compare-workspace")).toBeVisible();

  await page.getByTestId("workspace-dataset").click();
  await expect(page.getByTestId("workspace-dataset")).toHaveClass(/active/);
  await expect(page.getByRole("heading", { name: "Dataset Preparation" })).toBeVisible();
  await expect(page.locator(".dataset-preparation-panel")).toBeVisible();
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
  await expect(page.getByTestId("diagnostics-dock")).toBeHidden();
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



const dockDirections = ["left", "right", "top", "bottom"] as const;
async function chooseDockDirection(page: Page, menuTestId: string, optionTestId: string) {
  const menu = page.getByTestId(menuTestId);
  const option = page.getByTestId(optionTestId);
  if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
    await menu.locator("summary").click();
  }
  await expect(menu).toHaveJSProperty("open", true);
  await expect(option).toBeVisible();
  await expect(option).toBeInViewport();
  await option.click();
  await expect(option).toHaveAttribute("aria-pressed", "true");
  // A dock change moves the menu anchor. Close the native details popover
  // before ending this test so each direction starts from a clean page state.
  await menu.evaluate((element) => { (element as HTMLDetailsElement).open = false; });
  await expect(menu).toHaveJSProperty("open", false);
}

async function inspectPanel(page: Page, testId: string, splitterTestId: string) {
  return page.evaluate(({ testId, splitterTestId }) => {
    const panel = document.querySelector<HTMLElement>(`[data-testid='${testId}']`)!;
    const splitter = document.querySelector<HTMLElement>(`[data-testid='${splitterTestId}']`)!;
    const p = panel.getBoundingClientRect();
    const s = splitter.getBoundingClientRect();
    return {
      left: p.left, right: p.right, top: p.top, bottom: p.bottom,
      splitterLeft: s.left, splitterRight: s.right, splitterTop: s.top, splitterBottom: s.bottom,
      splitterWidth: s.width, splitterHeight: s.height,
    };
  }, { testId, splitterTestId });
}

// Keep each dock direction in its own test. The former four-direction loop
// could consume the shared 15s test budget, and a timeout did not identify
// which direction or interaction stalled.
for (const direction of dockDirections) {
  test(`Inspector docks ${direction} with an edge-aligned splitter`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("inspector-panel")).toBeVisible();
    await expect(page.getByTestId("diagnostics-dock")).toBeVisible();

    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    const inspector = await inspectPanel(page, "inspector-panel", "inspector-resize-edge");
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(chartWorkspace).toBeTruthy();

    if (direction === "left") {
      expect(Math.abs(inspector.splitterRight - inspector.right)).toBeLessThanOrEqual(4);
      expect(chartWorkspace!.x).toBeGreaterThanOrEqual(inspector.right - 1);
    }
    if (direction === "right") {
      expect(Math.abs(inspector.splitterLeft - inspector.left)).toBeLessThanOrEqual(4);
      expect(chartWorkspace!.x + chartWorkspace!.width).toBeLessThanOrEqual(inspector.left + 1);
    }
    if (direction === "top") {
      expect(Math.abs(inspector.splitterBottom - inspector.bottom)).toBeLessThanOrEqual(4);
      expect(chartWorkspace!.y).toBeGreaterThanOrEqual(inspector.bottom - 1);
    }
    if (direction === "bottom") {
      expect(Math.abs(inspector.splitterTop - inspector.top)).toBeLessThanOrEqual(4);
      expect(chartWorkspace!.y + chartWorkspace!.height).toBeLessThanOrEqual(inspector.top + 1);
    }
    if (direction === "left" || direction === "right") expect(inspector.splitterWidth).toBeGreaterThan(0);
    else expect(inspector.splitterHeight).toBeGreaterThan(0);
  });
}

for (const direction of dockDirections) {
  test(`Diagnostics docks ${direction} with an edge-aligned splitter and reserved workspace area`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await expect(page.getByTestId("diagnostics-dock")).toBeVisible();

    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    const diagnostics = await inspectPanel(page, "diagnostics-dock", "diagnostics-resize-edge");
    const workbench = await page.getByTestId("workbench").boundingBox();
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(workbench).toBeTruthy();
    expect(chartWorkspace).toBeTruthy();

    if (direction === "left") {
      expect(Math.abs(diagnostics.splitterRight - diagnostics.right)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.left - workbench!.x)).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.x).toBeGreaterThanOrEqual(diagnostics.right - 1);
    }
    if (direction === "right") {
      expect(Math.abs(diagnostics.splitterLeft - diagnostics.left)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.right - (workbench!.x + workbench!.width))).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.x + chartWorkspace!.width).toBeLessThanOrEqual(diagnostics.left + 1);
    }
    if (direction === "top") {
      expect(Math.abs(diagnostics.splitterBottom - diagnostics.bottom)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.top - workbench!.y)).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.y).toBeGreaterThanOrEqual(diagnostics.bottom - 1);
    }
    if (direction === "bottom") {
      expect(Math.abs(diagnostics.splitterTop - diagnostics.top)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.bottom - (workbench!.y + workbench!.height))).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.y + chartWorkspace!.height).toBeLessThanOrEqual(diagnostics.top + 1);
    }
    if (direction === "left" || direction === "right") expect(diagnostics.splitterWidth).toBeGreaterThan(0);
    else expect(diagnostics.splitterHeight).toBeGreaterThan(0);
  });
}

for (const direction of dockDirections) {
  test(`Inspector pointer resizing updates the active dock axis (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);

    const splitter = page.getByTestId("inspector-resize-edge");
    const before = Number(await splitter.getAttribute("aria-valuenow"));
    const bounds = await splitter.boundingBox();
    expect(bounds).toBeTruthy();
    const startX = bounds!.x + bounds!.width / 2;
    const startY = bounds!.y + bounds!.height / 2;
    const delta = 48;
    const endX = direction === "left" ? startX + delta
      : direction === "right" ? startX - delta : startX;
    const endY = direction === "top" ? startY + delta
      : direction === "bottom" ? startY - delta : startY;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 4 });
    await page.mouse.up();

    const after = Number(await splitter.getAttribute("aria-valuenow"));
    expect(after, `Inspector size should change when dragging the ${direction} splitter`).toBeGreaterThan(before + 20);
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(chartWorkspace).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(chartWorkspace!.width).toBeGreaterThan(0);
    } else {
      expect(chartWorkspace!.height).toBeGreaterThan(0);
    }
  });
}

for (const direction of dockDirections) {
  test(`Diagnostics pointer resizing updates the active dock axis (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);

    const splitter = page.getByTestId("diagnostics-resize-edge");
    const before = Number(await splitter.getAttribute("aria-valuenow"));
    const bounds = await splitter.boundingBox();
    expect(bounds).toBeTruthy();
    const startX = bounds!.x + bounds!.width / 2;
    const startY = bounds!.y + bounds!.height / 2;
    const delta = 48;
    const endX = direction === "left" ? startX + delta
      : direction === "right" ? startX - delta : startX;
    const endY = direction === "top" ? startY + delta
      : direction === "bottom" ? startY - delta : startY;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 4 });
    await page.mouse.up();

    const after = Number(await splitter.getAttribute("aria-valuenow"));
    expect(after, `Diagnostics size should change when dragging the ${direction} splitter`).toBeGreaterThan(before + 20);
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(chartWorkspace).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(chartWorkspace!.width).toBeGreaterThan(0);
    } else {
      expect(chartWorkspace!.height).toBeGreaterThan(0);
    }
  });
}

test("opposite horizontal docks preserve a usable Chart Workspace at maximum panel sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await chooseDockDirection(page, "diagnostics-dock-menu", "diagnostics-dock-left");
  await chooseDockDirection(page, "inspector-dock-menu", "inspector-dock-right");

  const inspectorSplitter = page.getByTestId("inspector-resize-edge");
  await inspectorSplitter.focus();
  await inspectorSplitter.press("End");
  const diagnosticsSplitter = page.getByTestId("diagnostics-resize-edge");
  await diagnosticsSplitter.focus();
  await diagnosticsSplitter.press("End");

  const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
  const diagnostics = await page.getByTestId("diagnostics-dock").boundingBox();
  const inspector = await page.getByTestId("inspector-panel").boundingBox();
  expect(chartWorkspace).toBeTruthy();
  expect(diagnostics).toBeTruthy();
  expect(inspector).toBeTruthy();
  expect(chartWorkspace!.width).toBeGreaterThanOrEqual(319);
  expect(chartWorkspace!.x).toBeGreaterThanOrEqual(diagnostics!.x + diagnostics!.width - 1);
  expect(chartWorkspace!.x + chartWorkspace!.width).toBeLessThanOrEqual(inspector!.x + 1);
});

test("opposite vertical docks preserve a usable Chart Workspace at maximum panel sizes", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await chooseDockDirection(page, "inspector-dock-menu", "inspector-dock-top");
  await chooseDockDirection(page, "diagnostics-dock-menu", "diagnostics-dock-bottom");

  const inspectorSplitter = page.getByTestId("inspector-resize-edge");
  await inspectorSplitter.focus();
  await inspectorSplitter.press("End");
  const diagnosticsSplitter = page.getByTestId("diagnostics-resize-edge");
  await diagnosticsSplitter.focus();
  await diagnosticsSplitter.press("End");

  const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
  const inspector = await page.getByTestId("inspector-panel").boundingBox();
  const diagnostics = await page.getByTestId("diagnostics-dock").boundingBox();
  expect(chartWorkspace).toBeTruthy();
  expect(inspector).toBeTruthy();
  expect(diagnostics).toBeTruthy();
  expect(chartWorkspace!.height).toBeGreaterThanOrEqual(179);
  expect(chartWorkspace!.y).toBeGreaterThanOrEqual(inspector!.y + inspector!.height - 1);
  expect(chartWorkspace!.y + chartWorkspace!.height).toBeLessThanOrEqual(diagnostics!.y + 1);
});

