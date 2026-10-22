import assert from "node:assert/strict";

describe("Struxis Debugger native desktop", () => {
  const domClick = async (selector) => browser.execute((cssSelector) => {
    const element = document.querySelector(cssSelector);
    if (!(element instanceof HTMLElement)) {
      throw new Error(`DOM click target not found: ${cssSelector}`);
    }
    if (element instanceof HTMLButtonElement && element.disabled) {
      throw new Error(`DOM click target is disabled: ${cssSelector}`);
    }
    element.click();
    return true;
  }, selector);

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

    assert.equal(await $('[data-testid="product-wordmark"]').getText(), "STRUXIS DEBUGGER");
    await $('[data-testid="catalog-controls"]').waitForDisplayed();

    await browser.waitUntil(
      async () => {
        const state = await browser.execute(() => {
          const refresh = document.querySelector('[data-testid="catalog-refresh"]');
          const select = document.querySelector('[data-testid="catalog-dataset-select"]');
          const error = document.querySelector('[data-testid="catalog-controls"] .error-message');
          return {
            refreshing: refresh instanceof HTMLButtonElement && refresh.disabled,
            hasSelect: select instanceof HTMLSelectElement,
            optionCount: select instanceof HTMLSelectElement ? select.options.length : 0,
            hasError: Boolean(error),
          };
        });
        return state.hasSelect && !state.refreshing && (state.optionCount > 1 || state.hasError);
      },
      {
        timeout: 30_000,
        interval: 250,
        timeoutMsg: "Catalog discovery did not publish selectable streams or a diagnostic.",
      },
    );

    assert.equal(
      await $('[data-testid="catalog-controls"] .error-message').isExisting(),
      false,
      "The real list_catalog_datasets IPC command returned an error.",
    );

    const catalogState = await browser.execute(() => {
      const select = document.querySelector('[data-testid="catalog-dataset-select"]');
      if (!(select instanceof HTMLSelectElement)) throw new Error("Catalog dataset selector is missing.");
      return {
        options: Array.from(select.options).map((option) => option.textContent?.trim() ?? ""),
        enabledCount: Array.from(select.options).filter(
          (option) => option.value && !/UNAVAILABLE/i.test(option.textContent ?? ""),
        ).length,
      };
    });
    assert.ok(
      catalogState.options.length > 1 || catalogState.options[0] === "NO STREAMS",
      `Catalog IPC completed without options or the explicit empty state: ${JSON.stringify(catalogState)}`,
    );
    if (catalogState.options[0] !== "NO STREAMS") {
      assert.ok(catalogState.enabledCount > 0,
        `Catalog discovered entries but none are available: ${JSON.stringify(catalogState)}`);
    }
  });

  it("switches workflows in the real desktop window", async () => {
    const workspaceNavigation = $('[data-testid="workspace-navigation"]');
    await workspaceNavigation.waitForDisplayed();

    await domClick('[data-testid="workspace-replay"]');
    await browser.waitUntil(
      async () => (await $('[data-testid="workspace-toolbar-title"]').getText()) === "REPLAY",
      {
        timeout: 10_000,
        timeoutMsg: "The Replay workspace did not become visible.",
      },
    );
    await $('[data-testid="dual-chart-stack-replay"]').waitForDisplayed();
    await $('[data-testid="replay-upper-chart-track"]').waitForDisplayed();
    await $('[data-testid="replay-lower-chart-track"]').waitForDisplayed();
    await $('[data-testid="replay-chart-splitter"]').waitForDisplayed();

    await domClick('[data-testid="workspace-compare"]');
    await browser.waitUntil(
      async () => (await $('[data-testid="workspace-toolbar-title"]').getText()) === "COMPARE",
      {
        timeout: 10_000,
        timeoutMsg: "The Compare workspace did not become visible.",
      },
    );
    await $('[data-testid="compare-toolbar-controls"]').waitForDisplayed();
    await $('[data-testid="compare-summary"]').waitForDisplayed();
    await $('[data-testid="dual-chart-stack-compare"]').waitForDisplayed();
    await $('[data-testid="compare-candidate-chart"]').waitForDisplayed();
    await $('[data-testid="compare-baseline-chart"]').waitForDisplayed();
    await $('[data-testid="compare-chart-splitter"]').waitForDisplayed();
  });
  it("collapses and restores Catalog, Inspector, and Diagnostics without breaking the workbench layout", async () => {
    const shell = await $('[data-testid="debugger-shell"]');
    await shell.waitForDisplayed();

    // Each native E2E test shares the same app instance. The preceding workflow
    // test leaves the app in Compare, where the Dataset-only Catalog is absent.
    await $('[data-testid="workspace-dataset"]').click();
    await $('[aria-label="Collapse Catalog"]').waitForDisplayed();

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

    await $('[data-testid="diagnostics-collapse-toggle"]').click();
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
    await browser.execute(() => {
      const element = document.querySelector('[data-testid="desktop-space-input-fixture"]');
      if (!(element instanceof HTMLInputElement)) {
        throw new Error("Space-key input fixture was not created.");
      }
      element.focus();
    });
    assert.equal(
      await browser.execute(() => document.activeElement?.getAttribute("data-testid") ?? ""),
      "desktop-space-input-fixture",
      "The input must own keyboard focus before testing native Space editing.",
    );
    // Send the key to the actual input element. browser.keys() targets the
    // current top-level browsing context in WebKit and can lose the intended
    // element focus, making this assertion test WebDriver focus routing rather
    // than the app's Space shortcut guard.
    await input.addValue(" ");
    assert.equal(await input.getValue(), " ",
      "Space in an input must retain its native text-editing behavior.");

    await browser.execute(() => {
      document.querySelector('[data-testid="desktop-space-input-fixture"]').remove();
    });

    const workspaceNavigation = $('[data-testid="workspace-navigation"]');
    const replayTab = $('[data-testid="workspace-replay"]');
    await browser.execute(() => {
      const tab = document.querySelector('[data-testid="workspace-replay"]');
      tab.dataset.spaceClickCount = "0";
      tab.addEventListener("click", () => {
        tab.dataset.spaceClickCount = String(Number(tab.dataset.spaceClickCount) + 1);
      });
    });
    await replayTab.click();
    await browser.execute(() => {
      document.querySelector('[data-testid="workspace-replay"]').dataset.spaceClickCount = "0";
    });
    await browser.keys(" ");
    await browser.waitUntil(
      async () => (await browser.execute(() =>
        document.querySelector('[data-testid="workspace-replay"]').dataset.spaceClickCount,
      )) === "1",
      {
        timeout: 5_000,
        timeoutMsg: "Space on the focused workspace button did not retain native button behavior.",
      },
    );
    assert.equal(await $('[data-testid="workspace-toolbar-title"]').getText(), "REPLAY");
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


  it("loads the complete BTCUSDT Origin with structure enabled, then runs a two-SBar Test Dataset through Snapshot Compare", async () => {
    await domClick('[data-testid="workspace-dataset"]');

    await $('[data-testid="catalog-dataset-select"]').waitForDisplayed();
    await browser.waitUntil(
      async () => {
        const state = await browser.execute(() => {
          const refresh = document.querySelector('[data-testid="catalog-refresh"]');
          const select = document.querySelector('[data-testid="catalog-dataset-select"]');
          return {
            refreshing: refresh instanceof HTMLButtonElement && refresh.disabled,
            optionCount: select instanceof HTMLSelectElement ? select.options.length : 0,
          };
        });
        return !state.refreshing && state.optionCount > 1;
      },
      {
        timeout: 30_000,
        interval: 250,
        timeoutMsg: "Catalog has no discovered streams for the real Origin Load scenario.",
      },
    );

    const selectedDataset = await browser.execute(() => {
      const select = document.querySelector('[data-testid="catalog-dataset-select"]');
      if (!(select instanceof HTMLSelectElement)) throw new Error("Catalog dataset selector is missing.");
      const option = Array.from(select.options).find((candidate) =>
        /BTCUSDT/i.test(candidate.textContent ?? "") &&
        !/UNAVAILABLE/i.test(candidate.textContent ?? "") &&
        candidate.value.length > 0
      );
      if (!option) {
        throw new Error(`No available BTCUSDT Catalog stream was discovered. Options: ${JSON.stringify(
          Array.from(select.options).map((candidate) => ({
            value: candidate.value,
            label: candidate.textContent?.trim() ?? "",
          })),
        )}`);
      }
      select.value = option.value;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return { value: option.value, label: option.textContent?.trim() ?? "" };
    });
    assert.match(selectedDataset.label, /BTCUSDT/i);

    const structureEnabled = await browser.execute(() => {
      const checkbox = document.querySelector('[data-testid="catalog-enable-structure"]');
      if (!(checkbox instanceof HTMLInputElement)) throw new Error("STRUCTURE toggle is missing.");
      if (!checkbox.checked) checkbox.click();
      return checkbox.checked;
    });
    assert.equal(structureEnabled, true, "Origin Load acceptance must enable derived Structure calculation.");

    await domClick('[data-testid="catalog-load"]');
    await domClick('[data-testid="catalog-origin-details-toggle"]');

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

    await $('[data-testid="test-dataset-controls"]').waitForDisplayed();
    const originChart = await $('[data-testid="origin-chart-panel"]');
    await originChart.waitForDisplayed();
    const sbarCount = Number(await originChart.getAttribute("data-sbar-count"));
    assert.ok(sbarCount >= 2, "Origin chart must contain at least two validated SBars for a bounded Run.");
    assert.equal(
      Number(await $('[data-testid="origin-sbar-count"]').getText().then((value) => value.replace(/,/g, ""))),
      sbarCount,
      "Origin summary count must match the complete Struxis-derived chart sequence.",
    );
    assert.equal(
      await $('[data-testid="origin-structure-status"]').getText(),
      "ENABLED",
      "The successful Origin must record STRUCTURE enabled as Load provenance.",
    );
    const firstSbarId = await originChart.getAttribute("data-first-sbar-id");
    const secondSbarId = await originChart.getAttribute("data-second-sbar-id");
    const lastSbarId = await originChart.getAttribute("data-last-sbar-id");
    assert.ok(firstSbarId && secondSbarId && firstSbarId !== secondSbarId,
      "Origin chart must expose distinct ordered SBar identities from its validated sequence.");
    assert.equal(await $('[data-testid="origin-first-sbar-id"]').getText(), firstSbarId);
    assert.equal(await $('[data-testid="origin-last-sbar-id"]').getText(), lastSbarId);
    const structureCounts = await $('[data-testid="origin-structure-overlay"]').getAttribute("data-structure-counts");
    assert.ok(structureCounts, "Origin chart must expose the counts from its authoritative Structure projection.");
    const parsedStructureCounts = JSON.parse(structureCounts);
    assert.ok(
      parsedStructureCounts.cbars + parsedStructureCounts.swings > 0,
      `BTCUSDT full-stream Structure projection should contain CBar or Swing objects: ${structureCounts}`,
    );

    // Drive the component's ID-based selection command. This enters the
    // same OriginChart selection method and emits the same sbarClick event as
    // pointer input, while keeping this end-to-end test independent of pixels.
    const selectOriginSbarById = async (sbarId) => {
      await browser.execute((id) => {
        const panel = document.querySelector('[data-testid="origin-chart-panel"]');
        if (!panel) throw new Error("Origin chart component is not mounted.");
        panel.dispatchEvent(new CustomEvent("struxis-select-sbar", {
          bubbles: true,
          detail: { sbarId: id },
        }));
      }, sbarId);
    };

    await selectOriginSbarById(firstSbarId);
    await $('[data-testid="origin-selection-start-line"]').waitForDisplayed({ timeout: 5_000 });
    // Pending range selection belongs to Dataset. Switching to Replay must not
    // destroy it, but its Dataset-only status panel should be asserted after
    // returning to the workspace that owns Test Dataset preparation.
    await domClick('[data-testid="workspace-replay"]');
    await $('[data-testid="run-chart-panel"]').waitForDisplayed();
    await domClick('[data-testid="workspace-dataset"]');
    // OriginChart is Dataset-scoped and remounts when returning from Replay.
    await $('[data-testid="origin-chart-canvas"]').waitForDisplayed();
    await $('[data-testid="test-range-awaiting-end"]').waitForDisplayed();
    await selectOriginSbarById(secondSbarId);
    await $('[data-testid="origin-selection-end-line"]').waitForDisplayed();
    await $('[data-testid="origin-selection-completed"]').waitForDisplayed();

    // Confirm the component selection command reached the application state
    // machine before creating the Test Dataset.
    const rangeStatus = await $('[data-testid="origin-range-selection-status"]');
    try {
      await browser.waitUntil(
        async () => (await rangeStatus.getText()).includes(
          `Selected 2 SBars: ${firstSbarId} → ${secondSbarId}`,
        ),
        {
          timeout: 5_000,
          interval: 100,
          timeoutMsg: "The second component selection command did not complete the expected two-SBar range.",
        },
      );
    } catch (error) {
      const observedStatus = await rangeStatus.getText();
      throw new Error(
        `Origin range selection failed after the second component selection command. Expected first=${firstSbarId}, second=${secondSbarId}; observed status=${JSON.stringify(observedStatus)}. ${String(error)}`,
      );
    }

    const selectedRange = await $('[data-testid="selected-test-range"]');
    await selectedRange.waitForDisplayed();
    const selectedStart = await selectedRange.$('[data-testid="selected-test-range-start"]');
    const selectedEnd = await selectedRange.$('[data-testid="selected-test-range-end"]');
    const actualStart = await selectedStart.getText();
    const actualEnd = await selectedEnd.getText();
    if (actualStart !== firstSbarId || actualEnd !== secondSbarId) {
      console.error("Origin range ID mismatch:", JSON.stringify({
        expectedStart: firstSbarId,
        expectedEnd: secondSbarId,
        actualStart,
        actualEnd,
        rangeStatus: await $('[data-testid="origin-range-selection-status"]').getText(),
      }, null, 2));
    }
    assert.equal(actualStart, firstSbarId,
      "The first component selection command must select the first Origin SBar as the range start.");
    assert.equal(actualEnd, secondSbarId,
      "The second component selection command must select the second Origin SBar as the inclusive range end.");
    assert.equal(
      (await selectedRange.$("[data-testid='selected-test-range-count']").getText()).replace(/\s/g, ""),
      "2",
      "Selecting the first two Origin candles must produce an inclusive two-SBar Test Dataset.",
    );
    await domClick('[data-testid="test-dataset-create"]');
    await domClick('[data-testid="workspace-replay"]');

    await browser.waitUntil(
      async () => await $('[data-testid="run-start"]').isEnabled(),
      {
        timeout: 15_000,
        interval: 200,
        timeoutMsg: "Test Dataset creation did not enable Run Start.",
      },
    );

    await domClick('[data-testid="run-start"]');
    const runStatus = $("[data-testid='run-toolbar-status'] b");
    await browser.waitUntil(
      async () => (await runStatus.getText()).trim() === "READY",
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Backend did not confirm the Run Ready state.",
      },
    );

    await browser.waitUntil(
      async () => await $('[data-testid="run-step"]').isEnabled(),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Run did not become eligible for the first Step after Start settled.",
      },
    );
    await domClick('[data-testid="run-step"]');
    await browser.waitUntil(
      async () => ["PAUSED", "COMPLETED"].includes((await runStatus.getText()).trim()),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "First Step did not publish a stable Run state.",
      },
    );
    await browser.waitUntil(
      async () => await $('[data-testid="inspector-replay-checkpoint"]').isDisplayed(),
      {
        timeout: 15_000,
        interval: 200,
        timeoutMsg: "The Inspector did not receive the backend-confirmed first Struxis checkpoint.",
      },
    );
    assert.equal(await $('[data-testid="inspector-replay-checkpoint"]').getText(), "0");
    assert.equal(await $('[data-testid="inspector-replay-sbar-id"]').getText(), firstSbarId);

    if ((await runStatus.getText()).trim() !== "COMPLETED") {
      await domClick('[data-testid="run-step"]');
      await browser.waitUntil(
        async () => (await runStatus.getText()).trim() === "COMPLETED",
        {
          timeout: 30_000,
          interval: 200,
          timeoutMsg: "Second Step did not complete the two-SBar Run.",
        },
      );
    }

    const progress = await $("[data-testid='run-toolbar-status'] span").getText();
    assert.equal(progress.replace(/\s/g, ""), "2/2",
      "Completed Run must confirm both selected SBars.");

    await domClick('[data-testid="workspace-compare"]');
    await domClick('[data-testid="snapshot-store-toggle"]');
    await browser.waitUntil(
      async () => await browser.execute(() => document.querySelectorAll('[data-testid="snapshot-row"][data-snapshot-kind="complete"]').length) >= 1,
      {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: "The completed Run did not publish a verified Snapshot visible in the UI.",
      },
    );

    // Repeat the exact same Test Dataset so Compare exercises two independent
    // SQLite Snapshots with an identical complete SBar sequence fingerprint.
    await domClick('[data-testid="workspace-replay"]');
    await domClick('[data-testid="run-restart"]');
    const secondRunStatus = $("[data-testid='run-toolbar-status'] b");
    await browser.waitUntil(
      async () => (await secondRunStatus.getText()).trim() === "READY",
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Restart did not prepare a second Run for Snapshot Compare.",
      },
    );

    await browser.waitUntil(
      async () => await $('[data-testid="run-step"]').isEnabled(),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "Restarted Run did not become eligible for the first Step after Restart settled.",
      },
    );
    await domClick('[data-testid="run-step"]');
    await browser.waitUntil(
      async () => ["PAUSED", "COMPLETED"].includes((await secondRunStatus.getText()).trim()),
      {
        timeout: 30_000,
        interval: 200,
        timeoutMsg: "First checkpoint of the second Run did not settle.",
      },
    );
    if ((await secondRunStatus.getText()).trim() !== "COMPLETED") {
      await domClick('[data-testid="run-step"]');
      await browser.waitUntil(
        async () => (await secondRunStatus.getText()).trim() === "COMPLETED",
        {
          timeout: 30_000,
          interval: 200,
          timeoutMsg: "Second Run did not complete its two-SBar input.",
        },
      );
    }

    await domClick('[data-testid="workspace-compare"]');
    await browser.waitUntil(
      async () => await browser.execute(() => document.querySelectorAll('[data-testid="snapshot-row"][data-snapshot-kind="complete"]').length) >= 2,
      {
        timeout: 15_000,
        interval: 250,
        timeoutMsg: "Two verified Complete Snapshots were not visible after the repeated Run.",
      },
    );

    const compareButton = $('[data-testid="compare-run"]');
    await browser.waitUntil(
      async () => compareButton.isEnabled(),
      {
        timeout: 10_000,
        interval: 200,
        timeoutMsg: "Two Complete Snapshots did not enable strict Compare.",
      },
    );
    await domClick('[data-testid="compare-run"]');
    await browser.waitUntil(
      async () => $(".compare-results").isDisplayed(),
      {
        timeout: 15_000,
        interval: 200,
        timeoutMsg: "The Compare IPC result was not rendered.",
      },
    );
    assert.equal(
      await $('[data-testid="compare-summary-first-divergence"]').getText(),
      "NONE",
      "Repeated deterministic Runs over the same input should have identical structure.",
    );
    assert.equal(
      await $('[data-testid="compare-summary-sequence"]').getText(),
      "2 / 2",
      "Compare should include the full two-checkpoint input trajectory.",
    );
    assert.equal(
      await $('[data-testid="compare-summary-difference-count"]').getText(),
      "00",
      "Repeated deterministic Runs should not produce structural object differences.",
    );
  });


});
