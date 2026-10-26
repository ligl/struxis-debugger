# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Compare Snapshot Store disclosure geometry and styling
- Location: css-migration-regression/css-visual-regression.spec.ts:780:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "inline-flex"
Received: "flex"
```

# Page snapshot

```yaml
- generic [ref=e2]:
  - region "Notifications alt+T":
    - list
  - main [ref=e3]:
    - generic [ref=e4]:
      - generic [ref=e5]:
        - generic [aria-hidden] [ref=e6]: Sx
        - generic [ref=e7]: STRUXIS DEBUGGER
      - navigation "Debugger workspace" [ref=e8]:
        - button "01 Dataset" [ref=e9]
        - button "02 Replay" [ref=e10]
        - button "03 Compare" [active] [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: COMPARE
        - generic [ref=e19]: STRICT · ORDERED · BAR-BY-BAR
        - generic [ref=e20]: STRICT MODE
        - generic [ref=e21]:
          - generic [ref=e22]:
            - generic [ref=e23]: BASELINE
            - combobox "Baseline Snapshot" [ref=e24]:
              - option "Select baseline" [disabled] [selected]
          - generic [ref=e25]:
            - generic [ref=e26]: CANDIDATE
            - combobox "Candidate Snapshot" [ref=e27]:
              - option "Select candidate" [disabled] [selected]
          - button "RUN COMPARISON" [disabled] [ref=e28]
      - generic [ref=e31]:
        - generic [ref=e32]:
          - generic [ref=e33]:
            - generic [ref=e34]: SBAR SEQUENCE
            - generic [ref=e35]: —
          - generic [ref=e36]:
            - generic [ref=e37]: FIRST DIVERGENCE
            - generic [ref=e38]: NOT RUN
          - generic [ref=e39]:
            - generic [ref=e40]: OBJECT DIFFERENCES
            - generic [ref=e41]: —
          - generic [ref=e42]:
            - generic [ref=e43]: IDENTITY
            - generic [ref=e44]: —
          - generic [ref=e45]: SAME COMPLETE ORDERED SBAR SEQUENCE REQUIRED
        - generic [ref=e46]:
          - region "Candidate chart" [ref=e48]:
            - generic [ref=e49]:
              - heading "Candidate" [level=3] [ref=e50]
              - generic [ref=e51]: NO RESULT
            - generic [ref=e52]:
              - generic [aria-hidden] [ref=e53]: —
              - strong [ref=e54]: Historical chart data unavailable
              - paragraph [ref=e55]: Choose two completed Snapshots and run a comparison. Candles will appear only when an authoritative historical SBar sequence is available.
              - generic [ref=e56]: AUTHORITATIVE DATA ONLY · NO SYNTHETIC CANDLES
          - separator "Resize Candidate and Baseline chart panels" [ref=e57]
          - region "Baseline chart" [ref=e59]:
            - generic [ref=e60]:
              - heading "Baseline" [level=3] [ref=e61]
              - generic [ref=e62]: NO RESULT
            - generic [ref=e63]:
              - generic [aria-hidden] [ref=e64]: —
              - strong [ref=e65]: Historical chart data unavailable
              - paragraph [ref=e66]: Choose two completed Snapshots and run a comparison. Candles will appear only when an authoritative historical SBar sequence is available.
              - generic [ref=e67]: AUTHORITATIVE DATA ONLY · NO SYNTHETIC CANDLES
        - group [ref=e68]:
          - generic "SNAPSHOT STORE / DIFFERENCES 0 ARTIFACTS · 0 DIFFERENCES" [ref=e69] [cursor=pointer]:
            - generic [ref=e70]:
              - text: SNAPSHOT STORE
              - generic [ref=e71]: /
              - text: DIFFERENCES
            - generic [ref=e72]: 0 ARTIFACTS · 0 DIFFERENCES
    - complementary [ref=e73]:
      - separator "Resize Inspector" [ref=e74]
      - generic [ref=e75]:
        - generic "Drag to any workbench edge to dock" [ref=e76]: Inspector
        - generic [ref=e77]: OBJECT
        - group [ref=e78]:
          - generic "Move Inspector" [ref=e79] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e80] [cursor=pointer]: −
      - generic [ref=e82]:
        - generic [ref=e83]: Δ/
        - heading "Compare Inspector" [level=3] [ref=e84]
        - paragraph [ref=e85]: Select an object difference in the Compare results to inspect its domain identity, checkpoint and exact property deltas.
        - generic [ref=e86]: Validated Compare result only
    - generic [ref=e88]:
      - navigation "Diagnostic categories" [ref=e89]:
        - button "ALL" [pressed] [ref=e90] [cursor=pointer]
        - button "ERRORS" [ref=e91] [cursor=pointer]
        - button "WARNINGS" [ref=e92] [cursor=pointer]
        - button "REPLAY" [ref=e93] [cursor=pointer]
        - button "STRUCTURE" [ref=e94] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e95] [cursor=pointer]
        - button "VALIDATION" [ref=e96] [cursor=pointer]
        - button "DIFFERENCES" [ref=e97] [cursor=pointer]
      - generic [ref=e98]:
        - group [ref=e99]:
          - generic "Move Diagnostics" [ref=e100] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e101] [cursor=pointer]: +
```

# Test source

```ts
  734 |       const increaseKey = direction === "left" ? "ArrowRight"
  735 |         : direction === "right" ? "ArrowLeft"
  736 |           : direction === "top" ? "ArrowDown" : "ArrowUp";
  737 | 
  738 |       await edge.focus();
  739 |       await page.keyboard.press(increaseKey);
  740 |       await expect.poll(async () => Number(await edge.getAttribute("aria-valuenow"))).toBe(before + 12);
  741 |     });
  742 |   }
  743 | }
  744 | 
  745 | for (const panel of ["inspector", "diagnostics"] as const) {
  746 |   for (const direction of dockDirections) {
  747 |     test(`drags ${panel} to the ${direction} workbench edge`, async ({ page }) => {
  748 |       await page.setViewportSize({ width: 1440, height: 900 });
  749 |       await page.goto("/");
  750 |       if (panel === "diagnostics") await expandDiagnosticsIfNeeded(page);
  751 | 
  752 |       // Start away from the requested destination so a stale aria-pressed value
  753 |       // cannot make this test pass without a successful drag/drop.
  754 |       const initialDirection = direction === "left" ? "right" : "left";
  755 |       await chooseDockDirection(page, `${panel}-dock-menu`, `${panel}-dock-${initialDirection}`);
  756 |       await expect(page.getByTestId(`${panel}-dock-${initialDirection}`)).toHaveAttribute("aria-pressed", "true");
  757 | 
  758 |       const source = page.getByTestId(`${panel}-dock-drag-handle`);
  759 |       // The drop handler computes edge ratios from the shell bounding box.
  760 |       const target = page.getByTestId("debugger-shell");
  761 |       const targetBounds = await target.boundingBox();
  762 |       expect(targetBounds, "debugger shell drop target should be rendered").not.toBeNull();
  763 |       if (!targetBounds) throw new Error("debugger shell drop target has no bounding box");
  764 | 
  765 |       const targetPosition = direction === "left"
  766 |         ? { x: 2, y: targetBounds.height / 2 }
  767 |         : direction === "right"
  768 |           ? { x: targetBounds.width - 2, y: targetBounds.height / 2 }
  769 |           : direction === "top"
  770 |             ? { x: targetBounds.width / 2, y: 2 }
  771 |             : { x: targetBounds.width / 2, y: targetBounds.height - 2 };
  772 | 
  773 |       await source.dragTo(target, { targetPosition });
  774 |       await expect(page.getByTestId(`${panel}-dock-${direction}`)).toHaveAttribute("aria-pressed", "true");
  775 |     });
  776 |   }
  777 | }
  778 | 
  779 | 
  780 | test("preserves Compare Snapshot Store disclosure geometry and styling", async ({ page }) => {
  781 |   await page.setViewportSize({ width: 1440, height: 900 });
  782 |   await page.goto("/");
  783 |   await page.getByTestId("workspace-compare").click();
  784 | 
  785 |   const disclosure = page.getByTestId("snapshot-store-disclosure");
  786 |   const summary = page.getByTestId("snapshot-store-toggle");
  787 |   await expect(disclosure).toBeVisible();
  788 |   await expect(summary).toBeVisible();
  789 | 
  790 |   const before = await page.evaluate(() => {
  791 |     const disclosure = document.querySelector<HTMLElement>("[data-testid='snapshot-store-disclosure']")!;
  792 |     const summary = document.querySelector<HTMLElement>("[data-testid='snapshot-store-toggle']")!;
  793 |     const title = document.querySelector<HTMLElement>(".snapshot-store-title")!;
  794 |     const counts = document.querySelector<HTMLElement>(".snapshot-store-counts")!;
  795 |     const disclosureStyle = getComputedStyle(disclosure);
  796 |     const summaryStyle = getComputedStyle(summary);
  797 |     const titleStyle = getComputedStyle(title);
  798 |     const countsStyle = getComputedStyle(counts);
  799 |     const rect = summary.getBoundingClientRect();
  800 |     return {
  801 |       disclosure: {
  802 |         display: disclosureStyle.display,
  803 |         flex: disclosureStyle.flex,
  804 |         marginTop: disclosureStyle.marginTop,
  805 |         borderTopWidth: disclosureStyle.borderTopWidth,
  806 |       },
  807 |       summary: {
  808 |         display: summaryStyle.display,
  809 |         minHeight: summaryStyle.minHeight,
  810 |         gap: summaryStyle.gap,
  811 |         padding: summaryStyle.padding,
  812 |         letterSpacing: summaryStyle.letterSpacing,
  813 |         listStyleType: summaryStyle.listStyleType,
  814 |         height: Math.round(rect.height * 100) / 100,
  815 |       },
  816 |       title: {
  817 |         display: titleStyle.display,
  818 |         gap: titleStyle.gap,
  819 |       },
  820 |       counts: {
  821 |         fontSize: countsStyle.fontSize,
  822 |         whiteSpace: countsStyle.whiteSpace,
  823 |       },
  824 |     };
  825 |   });
  826 |   expect(before.disclosure.display).toBe("block");
  827 |   expect(before.disclosure.flex).toContain("0 0 auto");
  828 |   expect(before.disclosure.marginTop).toBe("6px");
  829 |   expect(before.summary.display).toBe("flex");
  830 |   expect(before.summary.minHeight).toBe("30px");
  831 |   expect(before.summary.gap).toBe("12px");
  832 |   expect(before.summary.padding).toBe("0px 10px");
  833 |   expect(before.summary.letterSpacing).toBe("0.48px");
> 834 |   expect(before.title.display).toBe("inline-flex");
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  835 |   expect(before.counts.whiteSpace).toBe("nowrap");
  836 | 
  837 |   await summary.click();
  838 |   await expect(disclosure).toHaveAttribute("open", "");
  839 |   const expanded = await disclosure.evaluate((element) => {
  840 |     const style = getComputedStyle(element);
  841 |     const panel = element.querySelector<HTMLElement>(".snapshot-panel");
  842 |     if (!panel) throw new Error("Compare Snapshot Store panel root is missing");
  843 |     const panelStyle = getComputedStyle(panel);
  844 |     return {
  845 |       maxHeight: style.maxHeight,
  846 |       overflowY: style.overflowY,
  847 |       panel: {
  848 |         marginTop: panelStyle.marginTop,
  849 |         padding: panelStyle.padding,
  850 |         borderRadius: panelStyle.borderRadius,
  851 |         backgroundColor: panelStyle.backgroundColor,
  852 |       },
  853 |     };
  854 |   });
  855 |   expect(expanded.maxHeight).toBe("342px");
  856 |   expect(expanded.overflowY).toBe("auto");
  857 |   expect(expanded.panel.marginTop).toBe("4px");
  858 |   expect(expanded.panel.padding).toBe("8px");
  859 |   expect(expanded.panel.borderRadius).toBe("3px");
  860 |   expect(expanded.panel.backgroundColor).toBe("rgb(21, 25, 29)");
  861 | });
  862 | 
```