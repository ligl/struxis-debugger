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
  it("collapses and restores Catalog, Inspector, and Diagnostics without breaking the workbench layout", async () => {
    const shell = await $('[data-testid="debugger-shell"]');
    await shell.waitForDisplayed();

    const assertNoHorizontalOverflow = async (stage) => {
      const layout = await browser.execute(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        shell: (() => {
          const rect = document.querySelector('[data-testid="debugger-shell"]').getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width };
        })(),
      }));
      assert.ok(
        layout.documentScrollWidth <= layout.viewportWidth,
        `${stage}: unexpected horizontal overflow: ${JSON.stringify(layout)}`,
      );
      assert.ok(
        layout.shell.left >= -1 && layout.shell.right <= layout.viewportWidth + 1,
        `${stage}: workbench shell escaped the viewport: ${JSON.stringify(layout)}`,
      );
    };

    await $('[aria-label="Collapse Catalog"]').click();
    await $('[aria-label="Expand Catalog"]').waitForDisplayed();
    await assertNoHorizontalOverflow("Catalog collapsed");
    await $('[aria-label="Expand Catalog"]').click();
    await $('[aria-label="Collapse Catalog"]').waitForDisplayed();

    await $('[aria-label="Collapse Inspector"]').click();
    await $('[aria-label="Expand Inspector"]').waitForDisplayed();
    await assertNoHorizontalOverflow("Inspector collapsed");
    await $('[aria-label="Expand Inspector"]').click();
    await $('[aria-label="Collapse Inspector"]').waitForDisplayed();

    await $('[data-testid="diagnostics-dock"] button').click();
    await $('[data-testid="diagnostics-dock"]').waitForExist({ reverse: true });
    await $('[data-testid="debugger-shell"] .diagnostics-reopen').waitForDisplayed();
    await assertNoHorizontalOverflow("Diagnostics collapsed");
    await $('[data-testid="debugger-shell"] .diagnostics-reopen').click();
    await $('[data-testid="diagnostics-dock"]').waitForDisplayed();
    await assertNoHorizontalOverflow("all panels restored");
  });

  it("preserves native Space behavior on controls and does not replay without an eligible Run", async () => {
    const shell = await $('[data-testid="debugger-shell"]');
    await shell.waitForDisplayed();

    await browser.execute(() => {
      document.body.tabIndex = -1;
      document.body.focus();
      document.body.dataset.spaceDefaultPrevented = "unset";
      document.addEventListener("keydown", (event) => {
        if (event.code === "Space" && event.target === document.body) {
          document.body.dataset.spaceDefaultPrevented = String(event.defaultPrevented);
        }
      });
    });
    await browser.keys(" ");
    const bodyDefaultPrevented = await browser.execute(
      () => document.body.dataset.spaceDefaultPrevented,
    );
    assert.equal(bodyDefaultPrevented, "false",
      "Space without an eligible Run should not be intercepted.");

    await browser.execute(() => {
      const input = document.createElement("input");
      input.dataset.testid = "desktop-space-input-fixture";
      document.body.appendChild(input);
    });
    const input = await $('[data-testid="desktop-space-input-fixture"]');
    await input.click();
    await browser.keys(" ");
    assert.equal(await input.getValue(), " ",
      "Space in an input must retain its native text-editing behavior.");

    await browser.execute(() => {
      document.querySelector('[data-testid="desktop-space-input-fixture"]').remove();
    });

    const workspaceNavigation = $('nav[aria-label="Debugger workspace"]');
    const replayTab = workspaceNavigation.$(".workspace-tab:nth-child(2)");
    await browser.execute(() => {
      const tab = document.querySelector('nav[aria-label="Debugger workspace"] .workspace-tab:nth-child(2)');
      tab.dataset.spaceClickCount = "0";
      tab.addEventListener("click", () => {
        tab.dataset.spaceClickCount = String(Number(tab.dataset.spaceClickCount) + 1);
      });
    });
    await replayTab.click();
    await browser.execute(() => {
      document.querySelector('nav[aria-label="Debugger workspace"] .workspace-tab:nth-child(2)').dataset.spaceClickCount = "0";
    });
    await browser.keys(" ");
    await browser.waitUntil(
      async () => (await browser.execute(() =>
        document.querySelector('nav[aria-label="Debugger workspace"] .workspace-tab:nth-child(2)').dataset.spaceClickCount,
      )) === "1",
      {
        timeout: 5_000,
        timeoutMsg: "Space on the focused workspace button did not retain native button behavior.",
      },
    );
    assert.equal(await $(".workflow-toolbar h2").getText(), "Test Dataset & Replay");
  });

  it("keeps overflowing workspace content scrollable inside the workspace panel", async () => {
    const content = await $('[data-testid="workspace-content"]');
    await content.waitForDisplayed();

    await browser.execute(() => {
      const container = document.querySelector('[data-testid="workspace-content"]');
      const fixture = document.createElement("div");
      fixture.dataset.testid = "desktop-scroll-fixture";
      fixture.setAttribute("aria-hidden", "true");
      fixture.style.flex = "0 0 1200px";
      container.appendChild(fixture);
    });

    try {
      const before = await browser.execute(() => {
        const element = document.querySelector('[data-testid="workspace-content"]');
        return {
          scrollHeight: element.scrollHeight,
          clientHeight: element.clientHeight,
          scrollTop: element.scrollTop,
          overflowY: getComputedStyle(element).overflowY,
        };
      });
      assert.ok(
        before.scrollHeight > before.clientHeight,
        `Workspace content did not overflow its own scroll container: ${JSON.stringify(before)}`,
      );
      assert.ok(
        before.overflowY === "auto" || before.overflowY === "scroll",
        `Workspace content does not expose vertical scrolling: ${JSON.stringify(before)}`,
      );

      await browser.execute(() => {
        document.querySelector('[data-testid="workspace-content"]').scrollTo({ top: 100 });
      });
      await browser.waitUntil(
        async () => (await browser.execute(
          () => document.querySelector('[data-testid="workspace-content"]').scrollTop,
        )) > 0,
        {
          timeout: 5_000,
          interval: 100,
          timeoutMsg: "Workspace scrollTop did not advance after scrolling its content.",
        },
      );
    } finally {
      await browser.execute(() => {
        document.querySelector('[data-testid="desktop-scroll-fixture"]')?.remove();
      });
    }
  });

  it("resizes the native window across desktop widths without introducing horizontal overflow", async () => {
    const originalSize = await browser.getWindowSize();
    const assertLayout = async (stage) => {
      const layout = await browser.execute(() => ({
        viewportWidth: document.documentElement.clientWidth,
        documentScrollWidth: document.documentElement.scrollWidth,
        viewportHeight: document.documentElement.clientHeight,
        shell: (() => {
          const rect = document.querySelector('[data-testid="debugger-shell"]').getBoundingClientRect();
          return { left: rect.left, right: rect.right, width: rect.width, height: rect.height };
        })(),
      }));
      assert.ok(layout.viewportWidth > 0 && layout.viewportHeight > 0,
        `${stage}: invalid WebView viewport: ${JSON.stringify(layout)}`);
      assert.ok(layout.documentScrollWidth <= layout.viewportWidth,
        `${stage}: unexpected horizontal overflow: ${JSON.stringify(layout)}`);
      assert.ok(layout.shell.left >= -1 && layout.shell.right <= layout.viewportWidth + 1,
        `${stage}: workbench shell escaped the viewport: ${JSON.stringify(layout)}`);
      return layout;
    };

    try {
      await browser.setWindowSize(1280, 800);
      await browser.waitUntil(async () => {
        const size = await browser.getWindowSize();
        return size.width >= 1280 && size.height >= 800;
      }, {
        timeout: 5_000,
        interval: 100,
        timeoutMsg: "Native window did not reach the requested 1280×800 size.",
      });
      const standard = await assertLayout("1280×800 native window");

      await browser.setWindowSize(1920, 1080);
      await browser.waitUntil(async () => {
        const size = await browser.getWindowSize();
        return size.width >= 1920 && size.height >= 1080;
      }, {
        timeout: 5_000,
        interval: 100,
        timeoutMsg: "Native window did not reach the requested 1920×1080 size.",
      });
      const wide = await assertLayout("1920×1080 native window");
      assert.ok(wide.viewportWidth > standard.viewportWidth,
        `Native resize did not enlarge the WebView viewport: standard=${JSON.stringify(standard)}, wide=${JSON.stringify(wide)}`);
    } finally {
      await browser.setWindowSize(originalSize.width, originalSize.height);
    }
  });


});
