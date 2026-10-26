# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves development context menu positioning, stacking, button geometry and hover styling
- Location: css-migration-regression/css-visual-regression.spec.ts:983:1

# Error details

```
Error: expect(received).toMatchObject(expected)

- Expected  - 1
+ Received  + 1

@@ -1,7 +1,7 @@
  Object {
-   "backgroundColor": "rgb(27, 32, 37)",
+   "backgroundColor": "rgb(21, 25, 29)",
    "borderRadius": "4px",
    "button": Object {
      "borderRadius": "2px",
      "display": "block",
      "fontSize": "11px",
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
        - button "03 Compare" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: DATASET
        - generic [ref=e19]: CATALOG / ORIGIN / INCLUSIVE INTERVAL
        - generic [ref=e20]: ORIGIN LOAD
      - generic [ref=e22]:
        - generic [ref=e25]:
          - region "Catalog source controls" [ref=e26]:
            - generic [ref=e27]:
              - generic [ref=e28]: DATASET
              - combobox "DATASET" [disabled] [ref=e29]:
                - option "NO STREAMS" [selected]
            - button "Refresh Catalog" [ref=e30] [cursor=pointer]: ↻
            - generic [ref=e31] [cursor=pointer]:
              - checkbox "STRUCTURE" [checked] [ref=e32]
              - generic [ref=e33]: STRUCTURE
            - button "LOAD ORIGIN" [disabled] [ref=e34]
            - group [ref=e35]:
              - generic "Catalog and Origin status" [ref=e36] [cursor=pointer]: i
          - generic [ref=e37]:
            - generic [ref=e38]: Load Origin to select interval
            - generic [ref=e39]: Click anywhere in the chart plot to select the start time of your Test interval.
          - link "SELECT ALL SBARS" [disabled]:
            - /url: "#"
          - button "CREATE TEST DATASET" [disabled] [ref=e40]
          - button "TEST DETAILS" [disabled] [ref=e41]
        - region "Origin chart empty state" [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e48]: DATASET / ORIGIN
            - heading "ORIGIN DATA NOT LOADED" [level=2] [ref=e49]
            - paragraph [ref=e50]:
              - text: Select a dataset in Catalog, then click
              - strong [ref=e51]: LOAD
              - text: to populate the chart.
            - generic "Load workflow" [ref=e52]:
              - generic [ref=e53]: SELECT DATASET
              - generic [ref=e54]: →
              - generic [ref=e55]: LOAD
              - generic [ref=e56]: →
              - generic [ref=e57]: INSPECT SBARS
    - complementary [ref=e58]:
      - separator "Resize Inspector" [ref=e59]
      - generic [ref=e60]:
        - generic "Drag to any workbench edge to dock" [ref=e61]: Inspector
        - generic [ref=e62]: OBJECT
        - group [ref=e63]:
          - generic "Move Inspector" [ref=e64] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e65] [cursor=pointer]: −
      - generic [ref=e67]:
        - generic [ref=e68]: S/
        - heading "Object Inspector" [level=3] [ref=e69]
        - paragraph [ref=e70]: Click an SBar, CBar range, or Swing segment on the Origin chart to inspect its exact domain fields.
        - generic [ref=e71]: Authoritative Origin data only
    - generic [ref=e73]:
      - navigation "Diagnostic categories" [ref=e74]:
        - button "ALL" [pressed] [ref=e75] [cursor=pointer]
        - button "ERRORS" [ref=e76] [cursor=pointer]
        - button "WARNINGS" [ref=e77] [cursor=pointer]
        - button "REPLAY" [ref=e78] [cursor=pointer]
        - button "STRUCTURE" [ref=e79] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e80] [cursor=pointer]
        - button "VALIDATION" [ref=e81] [cursor=pointer]
        - button "DIFFERENCES" [ref=e82] [cursor=pointer]
      - generic [ref=e83]:
        - group [ref=e84]:
          - generic "Move Diagnostics" [ref=e85] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e86] [cursor=pointer]: +
    - generic [ref=e87]:
      - button "Open DevTools" [ref=e88] [cursor=pointer]
      - button "Refresh Page" [ref=e89] [cursor=pointer]
```

# Test source

```ts
  926  |     display: "flex",
  927  |     flex: "0 0 56px",
  928  |     minHeight: "38px",
  929  |     gap: "14px",
  930  |     padding: "0px 12px",
  931  |     backgroundColor: "rgb(20, 25, 29)",
  932  |   });
  933  |   expect(desktop.metric).toEqual({
  934  |     display: "flex",
  935  |     position: "relative",
  936  |     gap: "7px",
  937  |     whiteSpace: "nowrap",
  938  |   });
  939  |   expect(desktop.label).toEqual({ fontSize: "8px", letterSpacing: "0.24px" });
  940  |   expect(desktop.value).toMatchObject({
  941  |     fontSize: "10px",
  942  |     maxWidth: "240px",
  943  |     overflow: "hidden",
  944  |     textOverflow: "ellipsis",
  945  |   });
  946  |   expect(desktop.separator).toEqual({
  947  |     content: '""',
  948  |     width: "1px",
  949  |     top: "7px",
  950  |     bottom: "7px",
  951  |     backgroundColor: "rgb(42, 49, 54)",
  952  |   });
  953  | 
  954  |   await page.setViewportSize({ width: 1000, height: 900 });
  955  |   const compact = await summary.evaluate((element) => {
  956  |     const root = getComputedStyle(element);
  957  |     const metric = element.querySelector<HTMLElement>(".metric")!;
  958  |     const nextMetric = element.querySelector<HTMLElement>(".metric + .metric")!;
  959  |     const footnote = element.querySelector<HTMLElement>(".footnote")!;
  960  |     const separator = getComputedStyle(nextMetric, "::before");
  961  |     return {
  962  |       rootGap: root.gap,
  963  |       paddingInline: root.paddingInline,
  964  |       metricGap: getComputedStyle(metric).gap,
  965  |       nextMetricPaddingLeft: getComputedStyle(nextMetric).paddingLeft,
  966  |       separatorTop: separator.top,
  967  |       separatorBottom: separator.bottom,
  968  |       footnoteDisplay: getComputedStyle(footnote).display,
  969  |     };
  970  |   });
  971  |   expect(compact).toEqual({
  972  |     rootGap: "8px",
  973  |     paddingInline: "8px",
  974  |     metricGap: "4px",
  975  |     nextMetricPaddingLeft: "6px",
  976  |     separatorTop: "8px",
  977  |     separatorBottom: "8px",
  978  |     footnoteDisplay: "none",
  979  |   });
  980  | });
  981  | 
  982  | 
  983  | test("preserves development context menu positioning, stacking, button geometry and hover styling", async ({ page }) => {
  984  |   await page.setViewportSize({ width: 1440, height: 900 });
  985  |   await page.goto("/");
  986  |   await page.evaluate(() => {
  987  |     window.dispatchEvent(new MouseEvent("contextmenu", {
  988  |       bubbles: true,
  989  |       cancelable: true,
  990  |       clientX: 120,
  991  |       clientY: 140,
  992  |       button: 2,
  993  |       buttons: 2,
  994  |     }));
  995  |   });
  996  | 
  997  |   const menu = page.getByTestId("devtools-context-menu");
  998  |   await expect(menu).toBeVisible();
  999  |   const menuStyle = await menu.evaluate((element) => {
  1000 |     const style = getComputedStyle(element);
  1001 |     const button = element.querySelector<HTMLElement>('[data-testid="open-devtools"]')!;
  1002 |     const buttonStyle = getComputedStyle(button);
  1003 |     return {
  1004 |       left: style.left,
  1005 |       top: style.top,
  1006 |       position: style.position,
  1007 |       zIndex: style.zIndex,
  1008 |       minWidth: style.minWidth,
  1009 |       padding: style.padding,
  1010 |       borderRadius: style.borderRadius,
  1011 |       backgroundColor: style.backgroundColor,
  1012 |       boxShadow: style.boxShadow,
  1013 |       button: {
  1014 |         display: buttonStyle.display,
  1015 |         width: buttonStyle.width,
  1016 |         minHeight: buttonStyle.minHeight,
  1017 |         padding: buttonStyle.padding,
  1018 |         borderRadius: buttonStyle.borderRadius,
  1019 |         backgroundColor: buttonStyle.backgroundColor,
  1020 |         color: buttonStyle.color,
  1021 |         textAlign: buttonStyle.textAlign,
  1022 |         fontSize: buttonStyle.fontSize,
  1023 |       },
  1024 |     };
  1025 |   });
> 1026 |   expect(menuStyle).toMatchObject({
       |                     ^ Error: expect(received).toMatchObject(expected)
  1027 |     left: "120px",
  1028 |     top: "140px",
  1029 |     position: "fixed",
  1030 |     zIndex: "10000",
  1031 |     minWidth: "176px",
  1032 |     padding: "4px",
  1033 |     borderRadius: "4px",
  1034 |     backgroundColor: "rgb(27, 32, 37)",
  1035 |     button: {
  1036 |       display: "block",
  1037 |       minHeight: "30px",
  1038 |       padding: "0px 9px",
  1039 |       borderRadius: "2px",
  1040 |       textAlign: "left",
  1041 |       fontSize: "11px",
  1042 |     },
  1043 |   });
  1044 | 
  1045 |   const firstButton = page.getByTestId("open-devtools");
  1046 |   await firstButton.hover();
  1047 |   const hoverBackground = await firstButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  1048 |   expect(hoverBackground).toBe("rgb(48, 56, 63)");
  1049 | });
  1050 | 
```