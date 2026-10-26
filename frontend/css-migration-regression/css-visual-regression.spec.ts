import { expect, test, type Page } from "@playwright/test";

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
