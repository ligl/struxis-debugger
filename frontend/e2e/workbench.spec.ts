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

test("default Inspector and Diagnostics preserve prototype optical gaps", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  // This geometry assertion covers the expanded layout; the default collapsed state is tested separately.
  await page.getByTestId("diagnostics-collapse-toggle").click();

  const shell = await page.getByTestId("debugger-shell").boundingBox();
  const inspector = await page.getByTestId("inspector-panel").boundingBox();
  const diagnostics = await page.getByTestId("diagnostics-dock").boundingBox();

  expect(shell).toBeTruthy();
  expect(inspector).toBeTruthy();
  expect(diagnostics).toBeTruthy();

  // The prototype overlays the toolbar edge, with 5px gaps below the 44px Topbar and at the Diagnostics boundary.
  expect(Math.abs(inspector!.width - 300)).toBeLessThanOrEqual(1);
  expect(Math.abs(diagnostics!.height - 164)).toBeLessThanOrEqual(1);
  expect(Math.abs(inspector!.y - (shell!.y + 44 + 5))).toBeLessThanOrEqual(1);
  expect(Math.abs(inspector!.y + inspector!.height + 5 - diagnostics!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(inspector!.x + inspector!.width - (shell!.x + shell!.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(diagnostics!.y + diagnostics!.height - (shell!.y + shell!.height))).toBeLessThanOrEqual(1);
});

test("App Shell matches the approved ownership hierarchy", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const hierarchy = await page.evaluate(() => {
    const directTestIds = (element: Element | null) =>
      element ? Array.from(element.children, (child) => child.getAttribute("data-testid")) : [];
    const shell = document.querySelector("[data-testid='debugger-shell']");
    const chartWorkspace = document.querySelector("[data-testid='chart-workspace']");
    const chartPanels = document.querySelector("[data-testid='chart-panels']");
    return {
      shell: directTestIds(shell),
      chartWorkspace: directTestIds(chartWorkspace),
      chartPanels: directTestIds(chartPanels),
      hasToastHostOutsideShell: Boolean(
        document.querySelector("main[data-testid='debugger-shell']") &&
        document.querySelector("main[data-testid='debugger-shell']")?.previousElementSibling?.tagName !== "APP-TOAST-HOST" &&
        document.querySelector("main[data-testid='debugger-shell']")?.parentElement?.firstElementChild?.tagName === "APP-TOAST-HOST"
      ),
      hasLegacyFooter: Boolean(document.querySelector(".footer-bar")),
      hasLegacyPrimaryWorkspace: Boolean(document.querySelector("[data-testid='primary-workspace']")),
    };
  });

  const topbar = page.getByTestId("topbar");
  await expect(topbar.locator(".brand-name")).toHaveText("STRUXIS DEBUGGER");
  await expect(page.getByTestId("workspace-dataset")).toHaveText("01  Dataset");
  await expect(page.getByTestId("workspace-replay")).toHaveText("02  Replay");
  await expect(page.getByTestId("workspace-compare")).toHaveText("03  Compare");
  await expect(topbar.locator(".keycap")).toHaveText("CAPITUS");
  await expect(topbar).toHaveCSS("height", "44px");

  expect(hierarchy.shell).toEqual(["topbar", "chart-workspace", "inspector-panel", "diagnostics-dock"]);
  expect(hierarchy.chartWorkspace).toEqual(["chart-toolbar", "chart-panels"]);
  expect(hierarchy.chartPanels).toEqual(["workspace-content"]);
  expect(hierarchy.hasToastHostOutsideShell).toBe(true);
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
  await expect(page.getByTestId("workspace-toolbar-title")).toHaveText("REPLAY");
  await expect(page.locator(".replay-controls")).toBeVisible();

  await page.getByTestId("workspace-compare").click();
  await expect(page.getByTestId("workspace-compare")).toHaveClass(/active/);
  await expect(page.getByTestId("workspace-toolbar-title")).toHaveText("COMPARE");
  await expect(page.locator(".compare-workspace")).toBeVisible();

  await page.getByTestId("workspace-dataset").click();
  await expect(page.getByTestId("workspace-dataset")).toHaveClass(/active/);
  await expect(page.getByTestId("workspace-toolbar-title")).toHaveText("DATASET");
  await expect(page.getByTestId("catalog-controls")).toBeVisible();
  await expect(page.locator(".dataset-controls-host")).toBeVisible();
});

test("Dataset catalog controls remain available and Inspector can collapse and restore", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  await expect(page.getByTestId("catalog-controls")).toBeVisible();

  await page.getByRole("button", { name: "Collapse Inspector" }).click();
  await expect(page.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
  await page.getByRole("button", { name: "Expand Inspector" }).click();
  await expect(page.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
});

test("collapsed Inspector expands when its title bar is clicked", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const inspector = page.getByTestId("inspector-panel");
  await inspector.getByRole("button", { name: "Collapse Inspector" }).click();
  await expect(inspector).toHaveClass(/collapsed/);
  await expect(inspector.getByTestId("inspector-heading")).toBeVisible();

  await inspector.getByTestId("inspector-heading").click();
  await expect(inspector).not.toHaveClass(/collapsed/);
  await expect(inspector.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
});

test("Diagnostics is collapsed by default and can expand and collapse", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");

  const diagnostics = page.getByTestId("diagnostics-dock");
  await expect(diagnostics).toBeVisible();
  await expect(diagnostics).toHaveClass(/collapsed/);
  expect(Math.abs((await diagnostics.boundingBox())!.height - 36)).toBeLessThanOrEqual(1);

  await page.getByTestId("diagnostics-collapse-toggle").click();
  await expect(diagnostics).not.toHaveClass(/collapsed/);
  await page.getByTestId("diagnostics-collapse-toggle").click();
  await expect(diagnostics).toHaveClass(/collapsed/);
});

for (const direction of ["left", "right"] as const) {
  test(`collapsed Diagnostics controls align with Inspector when docked ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);

    const inspector = page.getByTestId("inspector-panel");
    const diagnostics = page.getByTestId("diagnostics-dock");
    await inspector.getByRole("button", { name: "Collapse Inspector" }).click();

    const inspectorBox = await inspector.boundingBox();
    const diagnosticsBox = await diagnostics.boundingBox();
    await expect(inspector.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
    await expect(diagnostics.getByTestId("diagnostics-dock-menu")).toBeHidden();
    await expect(diagnostics.getByTestId("diagnostics-collapse-toggle")).toBeVisible();
    await expect(diagnostics.getByTestId("diagnostics-collapse-toggle")).toHaveAttribute("aria-label", "Expand Diagnostics");
    expect(Math.abs(inspectorBox!.width - 36)).toBeLessThanOrEqual(1);
    expect(Math.abs(diagnosticsBox!.width - 36)).toBeLessThanOrEqual(1);
  });
}

for (const direction of ["left", "right"] as const) {
  test(`collapsed Diagnostics rail shows the full vertical title when docked ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);

    const dock = page.getByTestId("diagnostics-dock");
    const collapseToggle = dock.getByTestId("diagnostics-collapse-toggle");
    await expect(dock).toHaveClass(/collapsed/);
    await expect(collapseToggle).toBeVisible();
    await expect(dock).toHaveClass(/collapsed/);

    const title = dock.getByTestId("diagnostics-dock-drag-handle");
    await expect(title).toBeVisible();
    await expect(title).toHaveText("Diagnostics");
    await expect(title).toHaveCSS("writing-mode", "vertical-rl");
    await expect(dock.getByTestId("diagnostics-dock-menu")).toBeHidden();
    await expect(collapseToggle).toBeVisible();
    await expect(collapseToggle).toHaveAttribute("aria-label", "Expand Diagnostics");
    const railBox = await dock.boundingBox();
    const titleBox = await title.boundingBox();
    expect(railBox).not.toBeNull();
    expect(titleBox).not.toBeNull();
    expect(Math.abs(
      titleBox!.x + titleBox!.width / 2 - (railBox!.x + railBox!.width / 2),
    )).toBeLessThanOrEqual(1);
    await expect(dock.locator(".diagnostics-heading")).not.toHaveCSS("content", '"DIAG"');
    await expect(dock.getByTestId("diagnostics-category-tabs")).toBeHidden();
    await expect(dock.getByTestId("diagnostics-dock-menu")).toBeHidden();
    await expect(dock.getByTestId("diagnostics-collapse-toggle")).toBeVisible();
    await title.click();
    await expect(dock).not.toHaveClass(/collapsed/);
  });
}

for (const direction of ["left", "right", "top", "bottom"] as const) {
  test(`Diagnostics title visibility follows ${direction} docking`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    await page.getByTestId("diagnostics-collapse-toggle").click();

    const dock = page.getByTestId("diagnostics-dock");
    const titleBlock = dock.locator(".diagnostics-title-block");
    const categoryTabs = dock.getByTestId("diagnostics-category-tabs");
    const actions = dock.locator(".dock-actions");
    await expect(categoryTabs).toBeVisible();
    await expect(categoryTabs.getByRole("button")).toHaveCount(8);
    if (direction === "left" || direction === "right") {
      await expect(titleBlock).toBeVisible();
      await expect(dock.getByTestId("diagnostics-dock-drag-handle")).toHaveText("Diagnostics");
    } else {
      await expect(titleBlock).toBeHidden();
      await expect(actions).toBeVisible();
      const tabsBox = await categoryTabs.boundingBox();
      const actionsBox = await actions.boundingBox();
      expect(tabsBox).toBeTruthy();
      expect(actionsBox).toBeTruthy();
      expect(actionsBox!.x).toBeGreaterThanOrEqual(tabsBox!.x + tabsBox!.width - 1);
      expect(actionsBox!.y).toBeGreaterThanOrEqual(tabsBox!.y - 1);
      expect(actionsBox!.y + actionsBox!.height).toBeLessThanOrEqual(tabsBox!.y + tabsBox!.height + 1);
    }
  });
}


for (const direction of ["top", "bottom"] as const) {
  test(`collapsed Inspector matches the compact Diagnostics rail when docked ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    const inspector = page.getByTestId("inspector-panel");
    await inspector.getByRole("button", { name: "Collapse Inspector" }).click();
    await expect(inspector).toHaveClass(/collapsed/);
    await expect(inspector.getByTestId("inspector-dock-drag-handle")).toBeHidden();
    await expect(inspector.getByTestId("inspector-dock-menu")).toBeHidden();
    const heading = inspector.locator(".rail-heading");
    await expect(heading).toHaveCSS("flex-direction", "row");
    await expect(heading).toHaveCSS("align-items", "center");
    await expect(heading).toHaveCSS("height", "36px");
    const box = await inspector.boundingBox();
    expect(box).toBeTruthy();
    expect(Math.abs(box!.height - 36)).toBeLessThanOrEqual(1);
    await expect(inspector.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
  });
}

test("Diagnostics dock menu accessible label matches Inspector wording", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("inspector-dock-menu").locator("summary")).toHaveAttribute("aria-label", "Move Inspector");
  await expect(page.getByTestId("diagnostics-dock-menu").locator("summary")).toHaveAttribute("aria-label", "Move Diagnostics");
});

test("dock menus match prototype labels and dismiss after selection or outside click", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const inspectorMenu = page.getByTestId("inspector-dock-menu");
  await inspectorMenu.locator("summary").click();
  await expect(inspectorMenu).toHaveJSProperty("open", true);
  await expect(inspectorMenu.getByTestId("inspector-dock-left")).toHaveText("Dock Left");
  await expect(inspectorMenu.getByTestId("inspector-dock-right")).toHaveText("Dock Right");
  await expect(inspectorMenu.getByTestId("inspector-dock-top")).toHaveText("Dock Top");
  await expect(inspectorMenu.getByTestId("inspector-dock-bottom")).toHaveText("Dock Bottom");
  await inspectorMenu.getByTestId("inspector-dock-left").click();
  await expect(inspectorMenu).toHaveJSProperty("open", false);

  await inspectorMenu.locator("summary").click();
  await expect(inspectorMenu).toHaveJSProperty("open", true);
  await page.getByTestId("chart-toolbar").click({ position: { x: 10, y: 10 } });
  await expect(inspectorMenu).toHaveJSProperty("open", false);

  const diagnosticsMenu = page.getByTestId("diagnostics-dock-menu");
  await diagnosticsMenu.locator("summary").click();
  await expect(diagnosticsMenu).toHaveJSProperty("open", true);
  await expect(diagnosticsMenu.getByTestId("diagnostics-dock-bottom")).toHaveText("Dock Bottom");
  await diagnosticsMenu.getByTestId("diagnostics-dock-bottom").click();
  await expect(diagnosticsMenu).toHaveJSProperty("open", false);

  const inspectorHeading = page.getByTestId("inspector-panel").locator(".rail-heading");
  const diagnosticsActions = page.getByTestId("diagnostics-dock").locator(".dock-actions");
  const headerIconButtons = [
    inspectorHeading.locator('[data-testid="inspector-dock-menu"] > summary'),
    inspectorHeading.locator(':scope > .rail-toggle'),
    page.getByTestId("diagnostics-dock-menu").locator(":scope > summary"),
    diagnosticsActions.getByTestId("diagnostics-collapse-toggle"),
  ];
  for (const button of headerIconButtons) {
    await expect(button).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
    await button.hover();
    await expect(button).not.toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
    await expect(button).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
  await expect(inspectorHeading.locator(".panel-title")).toHaveText("Inspector");
  await expect(inspectorHeading.locator(".inspector-object-tag")).toHaveText("OBJECT");
  await expect(page.getByTestId("diagnostics-dock").getByTestId("diagnostics-dock-drag-handle")).toHaveText("Diagnostics");
  await expect(page.getByTestId("diagnostics-dock")).not.toContainText("Workflow events & errors");
});

test("Space preserves native control behavior and is inert without an eligible Run", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await expect(page.getByText("STRUXIS DEBUGGER", { exact: true })).toBeVisible();

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
      width: p.width, height: p.height,
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
    if (direction === "left" || direction === "right") {
      expect(Math.abs(inspector.width - 300)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(inspector.height - 145)).toBeLessThanOrEqual(1);
    }
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
    await page.getByTestId("diagnostics-collapse-toggle").click();
    const diagnostics = await inspectPanel(page, "diagnostics-dock", "diagnostics-resize-edge");
    if (direction === "left" || direction === "right") {
      expect(Math.abs(diagnostics.width - 330)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(diagnostics.height - 164)).toBeLessThanOrEqual(1);
    }
    const shell = await page.getByTestId("debugger-shell").boundingBox();
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(shell).toBeTruthy();
    expect(chartWorkspace).toBeTruthy();

    if (direction === "left") {
      expect(Math.abs(diagnostics.splitterRight - diagnostics.right)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.left - shell!.x)).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.x).toBeGreaterThanOrEqual(diagnostics.right - 1);
    }
    if (direction === "right") {
      const inspector = await page.getByTestId("inspector-panel").boundingBox();
      expect(inspector).toBeTruthy();
      expect(Math.abs(diagnostics.splitterLeft - diagnostics.left)).toBeLessThanOrEqual(4);
      // Inspector is first in prototype panel order; Diagnostics stacks immediately inside it.
      expect(Math.abs(diagnostics.right - inspector!.x)).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.x + chartWorkspace!.width).toBeLessThanOrEqual(diagnostics.left + 1);
    }
    if (direction === "top") {
      expect(Math.abs(diagnostics.splitterBottom - diagnostics.bottom)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.top - (shell!.y + 44))).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.y).toBeGreaterThanOrEqual(diagnostics.bottom - 1);
    }
    if (direction === "bottom") {
      expect(Math.abs(diagnostics.splitterTop - diagnostics.top)).toBeLessThanOrEqual(4);
      expect(Math.abs(diagnostics.bottom - (shell!.y + shell!.height))).toBeLessThanOrEqual(1);
      expect(chartWorkspace!.y + chartWorkspace!.height).toBeLessThanOrEqual(diagnostics.top + 1);
    }
    if (direction === "left" || direction === "right") expect(diagnostics.splitterWidth).toBeGreaterThan(0);
    else expect(diagnostics.splitterHeight).toBeGreaterThan(0);
  });
}

for (const direction of dockDirections) {
  test(`Inspector and Diagnostics stack in prototype order when both dock ${direction}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);

    const shell = await page.getByTestId("debugger-shell").boundingBox();
    const inspector = await page.getByTestId("inspector-panel").boundingBox();
    const diagnostics = await page.getByTestId("diagnostics-dock").boundingBox();
    const chartWorkspace = await page.getByTestId("chart-workspace").boundingBox();
    expect(shell).toBeTruthy();
    expect(inspector).toBeTruthy();
    expect(diagnostics).toBeTruthy();
    expect(chartWorkspace).toBeTruthy();

    if (direction === "left") {
      expect(Math.abs(inspector!.x - shell!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs(diagnostics!.x - (inspector!.x + inspector!.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(chartWorkspace!.x - (diagnostics!.x + diagnostics!.width) - 5)).toBeLessThanOrEqual(1);
    } else if (direction === "right") {
      expect(Math.abs(inspector!.x + inspector!.width - (shell!.x + shell!.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(inspector!.x - (diagnostics!.x + diagnostics!.width))).toBeLessThanOrEqual(1);
      expect(Math.abs(diagnostics!.x - (chartWorkspace!.x + chartWorkspace!.width))).toBeLessThanOrEqual(1);
    } else if (direction === "top") {
      expect(Math.abs(inspector!.y - (shell!.y + 44))).toBeLessThanOrEqual(1);
      expect(Math.abs(diagnostics!.y - (inspector!.y + inspector!.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(chartWorkspace!.y - (diagnostics!.y + diagnostics!.height))).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(inspector!.y + inspector!.height - (shell!.y + shell!.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(inspector!.y - (diagnostics!.y + diagnostics!.height))).toBeLessThanOrEqual(1);
      expect(Math.abs(diagnostics!.y - (chartWorkspace!.y + chartWorkspace!.height) - 5)).toBeLessThanOrEqual(1);
    }
  });
}

for (const direction of dockDirections) {
  test(`Inspector pointer resizing updates the active dock axis (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);

    const splitter = page.getByTestId("inspector-resize-edge");
    const before = Number(await splitter.getAttribute("aria-valuenow"));
    const workspaceBefore = await page.getByTestId("chart-workspace").boundingBox();
    expect(workspaceBefore).toBeTruthy();
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

    await expect.poll(() => splitter.getAttribute("aria-valuenow").then(Number))
      .toBeGreaterThan(before + 20);
    const workspaceAfter = await page.getByTestId("chart-workspace").boundingBox();
    expect(workspaceAfter).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(workspaceAfter!.width).toBeLessThan(workspaceBefore!.width - 20);
    } else {
      expect(workspaceAfter!.height).toBeLessThan(workspaceBefore!.height - 20);
    }
  });
}

for (const direction of dockDirections) {
  test(`Diagnostics pointer resizing updates the active dock axis (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    await page.getByTestId("diagnostics-collapse-toggle").click();

    const splitter = page.getByTestId("diagnostics-resize-edge");
    const before = Number(await splitter.getAttribute("aria-valuenow"));
    const workspaceBefore = await page.getByTestId("chart-workspace").boundingBox();
    expect(workspaceBefore).toBeTruthy();
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

    await expect.poll(() => splitter.getAttribute("aria-valuenow").then(Number))
      .toBeGreaterThan(before + 20);
    const workspaceAfter = await page.getByTestId("chart-workspace").boundingBox();
    expect(workspaceAfter).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(workspaceAfter!.width).toBeLessThan(workspaceBefore!.width - 20);
    } else {
      expect(workspaceAfter!.height).toBeLessThan(workspaceBefore!.height - 20);
    }
  });
}

for (const direction of dockDirections) {
  test(`Inspector collapse and restore preserves dock geometry (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${direction}`);
    const workspace = page.getByTestId("chart-workspace");
    const before = await workspace.boundingBox();
    expect(before).toBeTruthy();

    await page.getByRole("button", { name: "Collapse Inspector" }).click();
    await expect(page.getByRole("button", { name: "Expand Inspector" })).toBeVisible();
    const collapsed = await workspace.boundingBox();
    expect(collapsed).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(collapsed!.width).toBeGreaterThan(before!.width + 100);
    } else {
      expect(collapsed!.height).toBeGreaterThan(before!.height + 50);
    }

    await page.getByRole("button", { name: "Expand Inspector" }).click();
    await expect(page.getByRole("button", { name: "Collapse Inspector" })).toBeVisible();
    const restored = await workspace.boundingBox();
    expect(restored).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(Math.abs(restored!.width - before!.width)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(restored!.height - before!.height)).toBeLessThanOrEqual(1);
    }
  });
}

for (const direction of dockDirections) {
  test(`Diagnostics collapse and restore preserves dock geometry (${direction})`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${direction}`);
    await page.getByTestId("diagnostics-collapse-toggle").click();
    const workspace = page.getByTestId("chart-workspace");
    const before = await workspace.boundingBox();
    expect(before).toBeTruthy();

    const dock = page.getByTestId("diagnostics-dock");
    await page.getByTestId("diagnostics-collapse-toggle").click();
    await expect(dock).toBeVisible();
    if (direction === "left" || direction === "right") {
      await expect(page.getByTestId("diagnostics-collapse-toggle")).toBeVisible();
    } else {
      await expect(page.getByTestId("diagnostics-collapse-toggle")).toHaveAttribute("aria-label", "Expand Diagnostics");
    }
    const collapsedPanel = await dock.boundingBox();
    expect(collapsedPanel).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(Math.abs(collapsedPanel!.width - 36)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(collapsedPanel!.height - 36)).toBeLessThanOrEqual(1);
    }
    const collapsed = await workspace.boundingBox();
    expect(collapsed).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(collapsed!.width).toBeGreaterThan(before!.width + 100);
    } else {
      expect(collapsed!.height).toBeGreaterThan(before!.height + 50);
    }

    if (direction === "left" || direction === "right") {
      await dock.getByTestId("diagnostics-dock-drag-handle").click();
    } else {
      await page.getByTestId("diagnostics-collapse-toggle").click();
    }
    await expect(dock).not.toHaveClass(/collapsed/);
    if (direction === "top" || direction === "bottom") {
      await expect(page.getByTestId("diagnostics-collapse-toggle")).toHaveAttribute("aria-label", "Collapse Diagnostics");
    }
    const restored = await workspace.boundingBox();
    expect(restored).toBeTruthy();
    if (direction === "left" || direction === "right") {
      expect(Math.abs(restored!.width - before!.width)).toBeLessThanOrEqual(1);
    } else {
      expect(Math.abs(restored!.height - before!.height)).toBeLessThanOrEqual(1);
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

for (const inspectorDirection of ["top", "bottom"] as const) {
  for (const diagnosticsDirection of ["left", "right"] as const) {
    test(`Inspector ${inspectorDirection.toUpperCase()} spans the workbench with Diagnostics ${diagnosticsDirection.toUpperCase()}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.goto("/");
      await chooseDockDirection(page, "inspector-dock-menu", `inspector-dock-${inspectorDirection}`);
      await chooseDockDirection(page, "diagnostics-dock-menu", `diagnostics-dock-${diagnosticsDirection}`);

      const shell = await page.getByTestId("debugger-shell").boundingBox();
      const inspector = await page.getByTestId("inspector-panel").boundingBox();
      const diagnostics = await page.getByTestId("diagnostics-dock").boundingBox();
      expect(shell).toBeTruthy();
      expect(inspector).toBeTruthy();
      expect(diagnostics).toBeTruthy();

      // Inspector's horizontal docks span the full workbench, not only the
      // region remaining beside a left/right Diagnostics dock.
      expect(Math.abs(inspector!.x - shell!.x)).toBeLessThanOrEqual(1);
      expect(Math.abs((inspector!.x + inspector!.width) - (shell!.x + shell!.width))).toBeLessThanOrEqual(1);

      // The side Diagnostics dock remains below a top Inspector or above a
      // bottom Inspector, preserving the existing vertical reservation.
      if (inspectorDirection === "top") {
        expect(diagnostics!.y).toBeGreaterThanOrEqual(inspector!.y + inspector!.height - 1);
      } else {
        expect(diagnostics!.y + diagnostics!.height).toBeLessThanOrEqual(inspector!.y + 1);
      }
    });
  }
}

