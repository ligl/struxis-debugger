import assert from "node:assert/strict";

describe("Struxis Debugger native desktop", () => {
  before(async () => {
    // This smoke suite uses only standard WebDriver DOM operations and deliberately
    // does not register @wdio/tauri-plugin in the app. Mark the single existing
    // window as explicitly selected so tauri-service does not call its plugin-only
    // window-state IPC before every findElement command.
    const handle = await browser.getWindowHandle();
    await browser.switchToWindow(handle);
  });

  it("opens the real Tauri window and completes Catalog discovery over IPC", async () => {
    const shell = await $('[data-testid="debugger-shell"]');
    await shell.waitForDisplayed({ timeout: 30_000 });

    assert.equal(await $("h1").getText(), "Struxis Debugger");

    const catalog = await $(".catalog-panel");
    await catalog.waitForDisplayed();

    await browser.waitUntil(
      async () => {
        const hasError = await $(".catalog-panel .error-message").isExisting();
        const hasRows = (await $$('[data-testid="catalog-dataset-row"]')).length > 0;
        const isEmpty = await $(".catalog-panel .empty-state").isExisting();
        return hasError || hasRows || isEmpty;
      },
      {
        timeout: 30_000,
        interval: 250,
        timeoutMsg: "Catalog discovery did not publish a result or diagnostic.",
      },
    );

    assert.equal(
      await $(".catalog-panel .error-message").isExisting(),
      false,
      "The real list_catalog_datasets IPC command returned an error.",
    );

    const hasRows = (await $$('[data-testid="catalog-dataset-row"]')).length > 0;
    const isEmpty = await $(".catalog-panel .empty-state").isExisting();
    assert.ok(
      hasRows || isEmpty,
      "Catalog IPC completed without rendering either discovered datasets or the empty state.",
    );
  });

  it("switches workflows in the real desktop window", async () => {
    const workspaceNavigation = $('nav[aria-label="Debugger workspace"]');
    await workspaceNavigation.waitForDisplayed();

    await workspaceNavigation.$(".workspace-tab:nth-child(2)").click();
    await browser.waitUntil(
      async () => (await $(".workflow-toolbar h2").getText()) === "Test Dataset & Replay",
      {
        timeout: 10_000,
        timeoutMsg: "The Test & Replay workspace did not become visible.",
      },
    );

    await workspaceNavigation.$(".workspace-tab:nth-child(3)").click();
    await browser.waitUntil(
      async () => (await $(".workflow-toolbar h2").getText()) === "Snapshot Inventory",
      {
        timeout: 10_000,
        timeoutMsg: "The Snapshot Inventory workspace did not become visible.",
      },
    );
  });
});
