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


test("Inspector supports four-way docking with an edge-aligned splitter", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("inspector-rail")).toBeVisible();
  await expect(page.getByTestId("diagnostics-dock")).toBeVisible();

  const directions = ["left", "right", "top", "bottom"] as const;
  const openDockMenu = async (testId: string) => {
    const menu = page.getByTestId(testId);
    if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await menu.locator("summary").click();
    }
    await expect(menu).toHaveJSProperty("open", true);
  };
  const chooseDockDirection = async (menuTestId: string, optionTestId: string) => {
    const menu = page.getByTestId(menuTestId);
    const option = page.getByTestId(optionTestId);
    await openDockMenu(menuTestId);
    await expect(option).toBeVisible();
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    // Docking moves the panel and therefore its menu anchor. Close the native
    // details popover after each choice so the next iteration measures/clicks
    // against the newly laid out panel instead of a stale open overlay.
    await menu.evaluate((element) => { (element as HTMLDetailsElement).open = false; });
    await expect(menu).toHaveJSProperty("open", false);
  };
  const inspectPanel = (testId: string, splitterTestId: string) => page.evaluate(({ testId, splitterTestId }) => {
    const panel = document.querySelector<HTMLElement>(`[data-testid='${testId}']`)!;
    const splitter = document.querySelector<HTMLElement>(`[data-testid='${splitterTestId}']`)!;
    const p = panel.getBoundingClientRect();
    const s = splitter.getBoundingClientRect();
    return { left: p.left, right: p.right, top: p.top, bottom: p.bottom,
      splitterLeft: s.left, splitterRight: s.right, splitterTop: s.top, splitterBottom: s.bottom,
      splitterWidth: s.width, splitterHeight: s.height };
  }, { testId, splitterTestId });

  for (const direction of directions) {
    await test.step(`Inspector docks ${direction}`, async () => {
    await chooseDockDirection("inspector-dock-menu", `inspector-dock-${direction}`);
    const inspector = await inspectPanel("inspector-rail", "inspector-resize-edge");
    if (direction === "left") expect(Math.abs(inspector.splitterRight - inspector.right)).toBeLessThanOrEqual(4);
    if (direction === "right") expect(Math.abs(inspector.splitterLeft - inspector.left)).toBeLessThanOrEqual(4);
    if (direction === "top") expect(Math.abs(inspector.splitterBottom - inspector.bottom)).toBeLessThanOrEqual(4);
    if (direction === "bottom") expect(Math.abs(inspector.splitterTop - inspector.top)).toBeLessThanOrEqual(4);
    if (direction === "left" || direction === "right") expect(inspector.splitterWidth).toBeGreaterThan(0);
    else expect(inspector.splitterHeight).toBeGreaterThan(0);
    });
  }
});


test("Diagnostics supports four-way docking with an edge-aligned splitter", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("diagnostics-dock")).toBeVisible();

  const directions = ["left", "right", "top", "bottom"] as const;
  const openDockMenu = async (testId: string) => {
    const menu = page.getByTestId(testId);
    if (!(await menu.evaluate((element) => (element as HTMLDetailsElement).open))) {
      await menu.locator("summary").click();
    }
    await expect(menu).toHaveJSProperty("open", true);
  };
  const chooseDockDirection = async (menuTestId: string, optionTestId: string) => {
    const menu = page.getByTestId(menuTestId);
    const option = page.getByTestId(optionTestId);
    await openDockMenu(menuTestId);
    await expect(option).toBeVisible();
    await option.click();
    await expect(option).toHaveAttribute("aria-pressed", "true");
    // Docking moves the panel and therefore its menu anchor. Close the native
    // details popover after each choice so the next iteration measures/clicks
    // against the newly laid out panel instead of a stale open overlay.
    await menu.evaluate((element) => { (element as HTMLDetailsElement).open = false; });
    await expect(menu).toHaveJSProperty("open", false);
  };
  const inspectPanel = (testId: string, splitterTestId: string) => page.evaluate(({ testId, splitterTestId }) => {
    const panel = document.querySelector<HTMLElement>(`[data-testid='${testId}']`)!;
    const splitter = document.querySelector<HTMLElement>(`[data-testid='${splitterTestId}']`)!;
    const p = panel.getBoundingClientRect();
    const s = splitter.getBoundingClientRect();
    return { left: p.left, right: p.right, top: p.top, bottom: p.bottom,
      splitterLeft: s.left, splitterRight: s.right, splitterTop: s.top, splitterBottom: s.bottom,
      splitterWidth: s.width, splitterHeight: s.height };
  }, { testId, splitterTestId });

  for (const direction of directions) {
    await test.step(`Diagnostics docks ${direction}`, async () => {
    await chooseDockDirection("diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    const diagnostics = await inspectPanel("diagnostics-dock", "diagnostics-resize-edge");
    const main = await page.getByTestId("workbench-main").boundingBox();
    expect(main).toBeTruthy();
    if (direction === "left") {
      expect(Math.abs(diagnostics.splitterRight - diagnostics.right)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.right - main!.x)).toBeLessThanOrEqual(1);
    }
    if (direction === "right") {
      expect(Math.abs(diagnostics.splitterLeft - diagnostics.left)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.left - (main!.x + main!.width))).toBeLessThanOrEqual(1);
    }
    if (direction === "top") {
      expect(Math.abs(diagnostics.splitterBottom - diagnostics.bottom)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.bottom - main!.y)).toBeLessThanOrEqual(1);
    }
    if (direction === "bottom") {
      expect(Math.abs(diagnostics.splitterTop - diagnostics.top)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.top - (main!.y + main!.height))).toBeLessThanOrEqual(1);
    }
    if (direction === "left" || direction === "right") expect(diagnostics.splitterWidth).toBeGreaterThan(0);
    else expect(diagnostics.splitterHeight).toBeGreaterThan(0);
    });
  }
});
