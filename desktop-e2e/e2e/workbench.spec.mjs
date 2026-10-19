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


  it("runs Origin → two-SBar Test Dataset → real Run → verified Snapshot through the native UI and IPC", async () => {
    const workspaceNavigation = $('nav[aria-label="Debugger workspace"]');
    await workspaceNavigation.$(".workspace-tab:nth-child(1)").click();

    const datasetRows = await $$('[data-testid="catalog-dataset-row"]:not(.unavailable)');
    assert.ok(datasetRows.length > 0, "The configured test Catalog must contain an available Bar stream.");

    await datasetRows[0].click();
    await $('[data-testid="catalog-load"]').click();

    await browser.waitUntil(
      async () => {
        const identity = await $(".result-panel .origin-identity");
        return identity.isDisplayed();
      },
      {
        timeout: 120_000,
        interval: 250,
        timeoutMsg: "Origin Load did not publish a validated SBar projection.",
      },
    );

    const originChart = await $('[data-testid="origin-chart-panel"]');
    await originChart.waitForDisplayed();
    const sbarCount = Number(await originChart.getAttribute("data-sbar-count"));
    assert.ok(sbarCount >= 2, "Origin chart must contain at least two validated SBars for a bounded Run.");
    const firstSbarId = await originChart.getAttribute("data-first-sbar-id");
    const secondSbarId = await originChart.getAttribute("data-second-sbar-id");
    assert.ok(firstSbarId && secondSbarId && firstSbarId !== secondSbarId,
      "Origin chart must expose distinct ordered SBar identities from its validated sequence.");

    const originCanvas = await $('[data-testid="origin-chart-canvas"]');
    const clickOriginBar = async (index) => {
      const coordinateAttribute = index === 0
        ? "data-first-sbar-x"
        : index === 1
          ? "data-second-sbar-x"
          : null;
      assert.ok(coordinateAttribute, `Unsupported Origin SBar index: ${index}`);

      // v-show keeps the chart instance alive while its workspace is hidden.
      // A previously finite timeToCoordinate value is not proof that the chart
      // has recomputed its geometry after becoming visible again. Require the
      // visible host geometry and native SBar coordinate to settle across
      // multiple WebDriver polls before calculating a real pointer target.
      let previousSample = null;
      let stableSamples = 0;
      let target = null;
      await browser.waitUntil(
        async () => {
          const sample = await browser.execute((attribute) => {
            const host = document.querySelector('[data-testid="origin-chart-canvas"]');
            if (!host) return null;
            const rect = host.getBoundingClientRect();
            const rawCoordinate = host.getAttribute(attribute);
            if (rawCoordinate === null || rawCoordinate.trim() === "") return null;
            const coordinate = Number(rawCoordinate);
            const style = getComputedStyle(host);
            if (
              style.display === "none" ||
              style.visibility === "hidden" ||
              rect.width <= 0 ||
              rect.height <= 0 ||
              !Number.isFinite(coordinate)
            ) return null;
            return {
              coordinate,
              left: rect.left,
              top: rect.top,
              width: rect.width,
              height: rect.height,
              viewportWidth: document.documentElement.clientWidth,
              viewportHeight: document.documentElement.clientHeight,
            };
          }, coordinateAttribute);
          if (!sample) {
            previousSample = null;
            stableSamples = 0;
            return false;
          }

          const unchanged = previousSample !== null &&
            sample.coordinate === previousSample.coordinate &&
            sample.left === previousSample.left &&
            sample.top === previousSample.top &&
            sample.width === previousSample.width &&
            sample.height === previousSample.height &&
            sample.viewportWidth === previousSample.viewportWidth &&
            sample.viewportHeight === previousSample.viewportHeight;
          stableSamples = unchanged ? stableSamples + 1 : 0;
          previousSample = sample;
          target = sample;
          return stableSamples >= 2;
        },
        {
          timeout: 10_000,
          interval: 100,
          timeoutMsg: `Origin chart geometry and native coordinate did not settle for SBar index ${index}.`,
        },
      );

      assert.ok(target, `Origin chart did not provide a usable coordinate for SBar index ${index}.`);
      assert.ok(
        target.coordinate >= 0 && target.coordinate < target.width,
        `Origin SBar index ${index} is outside the chart plot: ${JSON.stringify(target)}`,
      );
      const pointerTarget = {
        x: Math.round(target.left + target.coordinate),
        y: Math.round(target.top + target.height * 0.25),
      };
      assert.ok(
        pointerTarget.x >= 0 &&
          pointerTarget.x < target.viewportWidth &&
          pointerTarget.y >= 0 &&
          pointerTarget.y < target.viewportHeight,
        `Origin SBar index ${index} resolved outside the WebView viewport: ${JSON.stringify({ target, pointerTarget })}`,
      );

      try {
        await browser.performActions([{
          type: "pointer",
          id: "origin-chart-pointer",
          parameters: { pointerType: "mouse" },
          actions: [
            { type: "pointerMove", duration: 0, x: pointerTarget.x, y: pointerTarget.y },
            { type: "pointerDown", button: 0 },
            { type: "pointerUp", button: 0 },
          ],
        }]);
      } finally {
        await browser.releaseActions();
      }
    };

    // The Test Dataset form intentionally has no editable SBar ID fields.
    // Select the exact first and second Origin candles through the real chart
    // event path, then verify the range projected by the workbench.
    await clickOriginBar(0);
    await workspaceNavigation.$(".workspace-tab:nth-child(2)").click();
    await originChart.waitForDisplayed();
    await $('[data-testid="test-range-awaiting-end"]').waitForDisplayed();
    await workspaceNavigation.$(".workspace-tab:nth-child(1)").click();
    await originCanvas.waitForDisplayed();
    await clickOriginBar(1);

    // Do not navigate away immediately after dispatching the native pointer
    // action. Confirm the chart event reached the application state machine
    // first, and preserve the visible status if the click was rejected.
    const rangeStatus = await $('[data-testid="origin-range-selection-status"]');
    try {
      await browser.waitUntil(
        async () => (await rangeStatus.getText()).includes(
          `Selected 2 SBars: ${firstSbarId} → ${secondSbarId}`,
        ),
        {
          timeout: 5_000,
          interval: 100,
          timeoutMsg: "The second native chart click did not complete the expected two-SBar range.",
        },
      );
    } catch (error) {
      const observedStatus = await rangeStatus.getText();
      throw new Error(
        `Origin range selection failed after the second chart click. Expected first=${firstSbarId}, second=${secondSbarId}; observed status=${JSON.stringify(observedStatus)}. ${String(error)}`,
      );
    }

    await workspaceNavigation.$(".workspace-tab:nth-child(2)").click();
    const selectedRange = await $('[data-testid="selected-test-range"]');
    await selectedRange.waitForDisplayed();
    const selectedStart = await selectedRange.$("div:nth-child(1) code");
    const selectedEnd = await selectedRange.$("div:nth-child(2) code");
    assert.equal(await selectedStart.getText(), firstSbarId,
      "The first chart click must select the first Origin SBar as the range start.");
    assert.equal(await selectedEnd.getText(), secondSbarId,
      "The second chart click must select the second Origin SBar as the inclusive range end.");
    assert.equal(
      (await selectedRange.$("div:nth-child(3) strong").getText()).replace(/\s/g, ""),
      "2",
      "Selecting the first two Origin candles must produce an inclusive two-SBar Test Dataset.",
    );
    await $('[data-testid="test-dataset-create"]').click();

    await browser.waitUntil(
      async () => await $('[data-testid="run-start"]').isEnabled(),
      {
        timeout: 15_000,
        interval: 200,
        timeoutMsg: "Test Dataset creation did not enable Run Start.",
      },
    );

    await $('[data-testid="run-start"]').click();
    const runStatus = $("//button[@data-testid='run-start']/ancestor::section[contains(@class,'operations-panel')]//span[contains(@class,'status-label')]");
    await browser.waitUntil(
      async () => (await runStatus.getText()).trim() === "READY",
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Backend did not confirm the Run Ready state.",
      },
    );

    await $('[data-testid="run-step"]').click();
    await browser.waitUntil(
      async () => ["PAUSED", "COMPLETED"].includes((await runStatus.getText()).trim()),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "First Step did not publish a stable Run state.",
      },
    );

    if ((await runStatus.getText()).trim() !== "COMPLETED") {
      await $('[data-testid="run-step"]').click();
      await browser.waitUntil(
        async () => (await runStatus.getText()).trim() === "COMPLETED",
        {
          timeout: 30_000,
          interval: 200,
          timeoutMsg: "Second Step did not complete the two-SBar Run.",
        },
      );
    }

    const progress = await $("//button[@data-testid='run-start']/ancestor::section[contains(@class,'operations-panel')]//div[contains(@class,'detail-list')]//div[span[normalize-space()='PROGRESS']]/strong").getText();
    assert.equal(progress.replace(/\s/g, ""), "2/2",
      "Completed Run must confirm both selected SBars.");

    await workspaceNavigation.$(".workspace-tab:nth-child(3)").click();
    await browser.waitUntil(
      async () => {
        const rows = await $$(".snapshot-table tbody tr");
        for (const row of rows) {
          if ((await row.getText()).includes("COMPLETE / VERIFIED")) return true;
        }
        return false;
      },
      {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: "The completed Run did not publish a verified Snapshot visible in the UI.",
      },
    );

    // Repeat the exact same Test Dataset so Compare exercises two independent
    // SQLite Snapshots with an identical complete SBar sequence fingerprint.
    await workspaceNavigation.$(".workspace-tab:nth-child(2)").click();
    await $('[data-testid="run-restart"]').click();
    const secondRunStatus = $("//button[@data-testid='run-start']/ancestor::section[contains(@class,'operations-panel')]//span[contains(@class,'status-label')]");
    await browser.waitUntil(
      async () => (await secondRunStatus.getText()).trim() === "READY",
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Restart did not prepare a second Run for Snapshot Compare.",
      },
    );

    await $('[data-testid="run-step"]').click();
    await browser.waitUntil(
      async () => ["PAUSED", "COMPLETED"].includes((await secondRunStatus.getText()).trim()),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "First checkpoint of the second Run did not settle.",
      },
    );
    if ((await secondRunStatus.getText()).trim() !== "COMPLETED") {
      await $('[data-testid="run-step"]').click();
      await browser.waitUntil(
        async () => (await secondRunStatus.getText()).trim() === "COMPLETED",
        {
          timeout: 30_000,
          interval: 200,
          timeoutMsg: "Second Run did not complete its two-SBar input.",
        },
      );
    }

    await workspaceNavigation.$(".workspace-tab:nth-child(3)").click();
    await browser.waitUntil(
      async () => {
        const rows = await $$(".snapshot-table tbody tr");
        let completeCount = 0;
        for (const row of rows) {
          if ((await row.getText()).includes("COMPLETE / VERIFIED")) completeCount += 1;
        }
        return completeCount >= 2;
      },
      {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: "Two verified Complete Snapshots were not visible after the repeated Run.",
      },
    );

    const compareButton = $(".compare-controls .primary-button");
    await browser.waitUntil(
      async () => compareButton.isEnabled(),
      {
        timeout: 10_000,
        interval: 200,
        timeoutMsg: "Two Complete Snapshots did not enable strict Compare.",
      },
    );
    await compareButton.click();
    await browser.waitUntil(
      async () => $(".compare-results").isDisplayed(),
      {
        timeout: 15_000,
        interval: 200,
        timeoutMsg: "The Compare IPC result was not rendered.",
      },
    );
    assert.equal(
      await $(".compare-summary > div:first-child strong").getText(),
      "No structural divergence",
      "Repeated deterministic Runs over the same input should have identical structure.",
    );
    assert.equal(
      await $(".compare-summary > div:nth-child(2) strong").getText(),
      "2",
      "Compare should include the full two-checkpoint input trajectory.",
    );
    assert.equal(
      await $(".compare-summary > div:nth-child(3) strong").getText(),
      "0",
      "Repeated deterministic Runs should not produce structural object differences.",
    );
  });


});
