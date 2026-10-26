# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves development context menu positioning, stacking, button geometry and hover styling
- Location: css-migration-regression/css-visual-regression.spec.ts:982:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByTestId('devtools-context-menu')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByTestId('devtools-context-menu') with timeout 5000ms
  - waiting for getByTestId('devtools-context-menu')

```

```yaml
- region "Notifications alt+T":
  - list
- main:
  - text: STRUXIS DEBUGGER
  - navigation "Debugger workspace":
    - button "01 Dataset"
    - button "02 Replay"
    - button "03 Compare"
  - text: NO ORIGIN LOADED CAPITUS DATASET CATALOG / ORIGIN / INCLUSIVE INTERVAL ORIGIN LOAD
  - region "Catalog source controls":
    - text: DATASET
    - combobox "DATASET" [disabled]:
      - option "NO STREAMS" [selected]
    - button "Refresh Catalog": ↻
    - checkbox "STRUCTURE" [checked]
    - text: STRUCTURE
    - button "LOAD ORIGIN" [disabled]
    - group: i
  - text: Load Origin to select interval Click anywhere in the chart plot to select the start time of your Test interval.
  - link "SELECT ALL SBARS" [disabled]:
    - /url: "#"
  - button "CREATE TEST DATASET" [disabled]
  - button "TEST DETAILS" [disabled]
  - region "Origin chart empty state":
    - text: DATASET / ORIGIN
    - heading "ORIGIN DATA NOT LOADED" [level=2]
    - paragraph:
      - text: Select a dataset in Catalog, then click
      - strong: LOAD
      - text: to populate the chart.
    - text: SELECT DATASET → LOAD → INSPECT SBARS
  - complementary:
    - separator "Resize Inspector"
    - text: Inspector OBJECT
    - group: ⋯
    - button "Collapse Inspector": −
    - text: S/
    - heading "Object Inspector" [level=3]
    - paragraph: Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.
    - text: Authoritative Origin data only
  - navigation "Diagnostic categories":
    - button "ALL" [pressed]
    - button "ERRORS"
    - button "WARNINGS"
    - button "REPLAY"
    - button "STRUCTURE"
    - button "SNAPSHOTS"
    - button "VALIDATION"
    - button "DIFFERENCES"
  - group: ⋯
  - button "Expand Diagnostics": +
```

# Test source

```ts
  888  |     const separator = getComputedStyle(nextMetric, "::before");
  889  |     return {
  890  |       root: {
  891  |         display: root.display,
  892  |         flex: root.flex,
  893  |         minHeight: root.minHeight,
  894  |         gap: root.gap,
  895  |         padding: root.padding,
  896  |         backgroundColor: root.backgroundColor,
  897  |       },
  898  |       metric: {
  899  |         display: getComputedStyle(metric).display,
  900  |         position: getComputedStyle(metric).position,
  901  |         gap: getComputedStyle(metric).gap,
  902  |         whiteSpace: getComputedStyle(metric).whiteSpace,
  903  |       },
  904  |       label: {
  905  |         fontSize: getComputedStyle(label).fontSize,
  906  |         letterSpacing: getComputedStyle(label).letterSpacing,
  907  |       },
  908  |       value: {
  909  |         fontFamily: getComputedStyle(value).fontFamily,
  910  |         fontSize: getComputedStyle(value).fontSize,
  911  |         maxWidth: getComputedStyle(value).maxWidth,
  912  |         overflow: getComputedStyle(value).overflow,
  913  |         textOverflow: getComputedStyle(value).textOverflow,
  914  |       },
  915  |       separator: {
  916  |         content: separator.content,
  917  |         width: separator.width,
  918  |         top: separator.top,
  919  |         bottom: separator.bottom,
  920  |         backgroundColor: separator.backgroundColor,
  921  |       },
  922  |     };
  923  |   });
  924  |   expect(desktop.root).toEqual({
  925  |     display: "flex",
  926  |     flex: "0 0 56px",
  927  |     minHeight: "38px",
  928  |     gap: "14px",
  929  |     padding: "0px 12px",
  930  |     backgroundColor: "rgb(20, 25, 29)",
  931  |   });
  932  |   expect(desktop.metric).toEqual({
  933  |     display: "flex",
  934  |     position: "relative",
  935  |     gap: "7px",
  936  |     whiteSpace: "nowrap",
  937  |   });
  938  |   expect(desktop.label).toEqual({ fontSize: "8px", letterSpacing: "0.24px" });
  939  |   expect(desktop.value).toMatchObject({
  940  |     fontSize: "10px",
  941  |     maxWidth: "240px",
  942  |     overflow: "hidden",
  943  |     textOverflow: "ellipsis",
  944  |   });
  945  |   expect(desktop.separator).toEqual({
  946  |     content: '""',
  947  |     width: "1px",
  948  |     top: "7px",
  949  |     bottom: "7px",
  950  |     backgroundColor: "rgb(42, 49, 54)",
  951  |   });
  952  | 
  953  |   await page.setViewportSize({ width: 1000, height: 900 });
  954  |   const compact = await summary.evaluate((element) => {
  955  |     const root = getComputedStyle(element);
  956  |     const metric = element.querySelector<HTMLElement>(".metric")!;
  957  |     const nextMetric = element.querySelector<HTMLElement>(".metric + .metric")!;
  958  |     const footnote = element.querySelector<HTMLElement>(".footnote")!;
  959  |     const separator = getComputedStyle(nextMetric, "::before");
  960  |     return {
  961  |       rootGap: root.gap,
  962  |       paddingInline: root.paddingInline,
  963  |       metricGap: getComputedStyle(metric).gap,
  964  |       nextMetricPaddingLeft: getComputedStyle(nextMetric).paddingLeft,
  965  |       separatorTop: separator.top,
  966  |       separatorBottom: separator.bottom,
  967  |       footnoteDisplay: getComputedStyle(footnote).display,
  968  |     };
  969  |   });
  970  |   expect(compact).toEqual({
  971  |     rootGap: "8px",
  972  |     paddingInline: "8px",
  973  |     metricGap: "4px",
  974  |     nextMetricPaddingLeft: "6px",
  975  |     separatorTop: "8px",
  976  |     separatorBottom: "8px",
  977  |     footnoteDisplay: "none",
  978  |   });
  979  | });
  980  | 
  981  | 
  982  | test("preserves development context menu positioning, stacking, button geometry and hover styling", async ({ page }) => {
  983  |   await page.setViewportSize({ width: 1440, height: 900 });
  984  |   await page.goto("/");
  985  |   await page.mouse.click(120, 140, { button: "right" });
  986  | 
  987  |   const menu = page.getByTestId("devtools-context-menu");
> 988  |   await expect(menu).toBeVisible();
       |                      ^ Error: expect(locator).toBeVisible() failed
  989  |   const menuStyle = await menu.evaluate((element) => {
  990  |     const style = getComputedStyle(element);
  991  |     const button = element.querySelector<HTMLElement>('[data-testid="open-devtools"]')!;
  992  |     const buttonStyle = getComputedStyle(button);
  993  |     return {
  994  |       left: style.left,
  995  |       top: style.top,
  996  |       position: style.position,
  997  |       zIndex: style.zIndex,
  998  |       minWidth: style.minWidth,
  999  |       padding: style.padding,
  1000 |       borderRadius: style.borderRadius,
  1001 |       backgroundColor: style.backgroundColor,
  1002 |       boxShadow: style.boxShadow,
  1003 |       button: {
  1004 |         display: buttonStyle.display,
  1005 |         width: buttonStyle.width,
  1006 |         minHeight: buttonStyle.minHeight,
  1007 |         padding: buttonStyle.padding,
  1008 |         borderRadius: buttonStyle.borderRadius,
  1009 |         backgroundColor: buttonStyle.backgroundColor,
  1010 |         color: buttonStyle.color,
  1011 |         textAlign: buttonStyle.textAlign,
  1012 |         fontSize: buttonStyle.fontSize,
  1013 |       },
  1014 |     };
  1015 |   });
  1016 |   expect(menuStyle).toMatchObject({
  1017 |     left: "120px",
  1018 |     top: "140px",
  1019 |     position: "fixed",
  1020 |     zIndex: "10000",
  1021 |     minWidth: "176px",
  1022 |     padding: "4px",
  1023 |     borderRadius: "4px",
  1024 |     backgroundColor: "rgb(27, 32, 37)",
  1025 |     button: {
  1026 |       display: "block",
  1027 |       minHeight: "30px",
  1028 |       padding: "0px 9px",
  1029 |       borderRadius: "2px",
  1030 |       textAlign: "left",
  1031 |       fontSize: "11px",
  1032 |     },
  1033 |   });
  1034 | 
  1035 |   const firstButton = page.getByTestId("open-devtools");
  1036 |   await firstButton.hover();
  1037 |   const hoverBackground = await firstButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  1038 |   expect(hoverBackground).toBe("rgb(48, 56, 63)");
  1039 | });
  1040 | 
```