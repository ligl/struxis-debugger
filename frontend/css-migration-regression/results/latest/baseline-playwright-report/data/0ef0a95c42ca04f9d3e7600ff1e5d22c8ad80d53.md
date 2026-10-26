# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Replay playback speed menu geometry, options and hover styling
- Location: css-migration-regression/css-visual-regression.spec.ts:1070:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

  Array [
-   "0.5x✓",
-   "1x",
+   "0.5x",
+   "1x✓",
    "2x",
    "3x",
    "MAX",
  ]
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
        - button "02 Replay" [active] [ref=e10]
        - button "03 Compare" [ref=e11]
      - generic [ref=e12]:
        - generic [ref=e13]: NO ORIGIN LOADED
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: REPLAY
        - generic [ref=e19]: TEST DATASET
        - generic [ref=e20]: NO TEST DATASET · CREATE AN INCLUSIVE INTERVAL
        - generic [ref=e21]:
          - group "Replay transport controls" [ref=e22]:
            - button "START" [disabled] [ref=e23]
            - button "STEP ▶|" [disabled] [ref=e24]
            - button "▶ PLAY" [disabled] [ref=e25]
            - generic [ref=e26]:
              - button "倍速" [expanded] [ref=e27] [cursor=pointer]
              - menu "Playback speed options" [ref=e28]:
                - menuitemradio "0.5x" [ref=e29] [cursor=pointer]
                - menuitemradio "1x ✓" [checked] [ref=e30] [cursor=pointer]:
                  - text: 1x
                  - generic [ref=e31]: ✓
                - menuitemradio "2x" [ref=e32] [cursor=pointer]
                - menuitemradio "3x" [ref=e33] [cursor=pointer]
                - menuitemradio "MAX" [ref=e34] [cursor=pointer]
          - generic [ref=e35]:
            - generic [ref=e36]: NO RUN
            - generic [ref=e37]: —
          - progressbar "Replay progress" [ref=e38]
          - button "SAVE SNAPSHOT" [disabled] [ref=e39]
      - generic [ref=e43]:
        - region "Live Replay SBar chart" [ref=e45]:
          - generic [ref=e46]:
            - generic [ref=e48]:
              - generic [ref=e49]: LIVE REPLAY · NO TEST
              - generic [ref=e50]: LIVE
            - generic [ref=e51]:
              - generic [ref=e52]: 0 SBARS
              - button "FIT" [disabled] [ref=e53]
          - generic [ref=e54]:
            - generic:
              - generic:
                - generic: REPLAY INPUT
                - strong: LIVE REPLAY DATA NOT LOADED
                - paragraph: Create a Test Dataset to view its fixed input sequence.
                - generic "Replay data workflow":
                  - generic: LOAD ORIGIN
                  - generic: →
                  - generic: CREATE TEST DATASET
                  - generic: →
                  - generic: LIVE REPLAY
            - region "Live Replay SBar chart" [ref=e55]:
              - generic "Candlestick and volume chart for Test Dataset not selected" [ref=e57]:
                - table [ref=e59]:
                  - row [ref=e60]:
                    - cell
                    - cell [ref=e61]
                    - cell [ref=e65]
                  - row [ref=e69]:
                    - cell
                    - cell [ref=e70]
                    - cell [ref=e74]
        - separator "Resize Live Replay and Snapshot Reference chart panels" [ref=e77]
        - generic [ref=e79]:
          - generic [ref=e80]:
            - heading "SNAPSHOT REFERENCE" [level=3] [ref=e82]
            - generic [ref=e83]:
              - generic [ref=e84]: INSTRUMENT
              - generic [ref=e85] [cursor=pointer]:
                - generic [aria-hidden]: Choose completed Snapshot…
                - combobox "Snapshot Reference for INSTRUMENT" [disabled] [ref=e86]:
                  - option "Choose completed Snapshot…" [selected]
          - generic [ref=e88]:
            - strong [ref=e89]: NO COMPLETED SNAPSHOT AVAILABLE
            - paragraph [ref=e90]: A completed Run Snapshot will appear here after it is published and discovered.
    - complementary [ref=e91]:
      - separator "Resize Inspector" [ref=e92]
      - generic [ref=e93]:
        - generic "Drag to any workbench edge to dock" [ref=e94]: Inspector
        - generic [ref=e95]: OBJECT
        - group [ref=e96]:
          - generic "Move Inspector" [ref=e97] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e98] [cursor=pointer]: −
      - generic [ref=e100]:
        - generic [ref=e101]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e102]
        - paragraph [ref=e103]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e104]: No inferred or fabricated domain state is displayed.
    - generic [ref=e106]:
      - navigation "Diagnostic categories" [ref=e107]:
        - button "ALL" [pressed] [ref=e108] [cursor=pointer]
        - button "ERRORS" [ref=e109] [cursor=pointer]
        - button "WARNINGS" [ref=e110] [cursor=pointer]
        - button "REPLAY" [ref=e111] [cursor=pointer]
        - button "STRUCTURE" [ref=e112] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e113] [cursor=pointer]
        - button "VALIDATION" [ref=e114] [cursor=pointer]
        - button "DIFFERENCES" [ref=e115] [cursor=pointer]
      - generic [ref=e116]:
        - group [ref=e117]:
          - generic "Move Diagnostics" [ref=e118] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e119] [cursor=pointer]: +
```

# Test source

```ts
  1037 |     const probe = document.createElement("div");
  1038 |     probe.style.backgroundColor = token;
  1039 |     document.body.append(probe);
  1040 |     const color = getComputedStyle(probe).backgroundColor;
  1041 |     probe.remove();
  1042 |     return color;
  1043 |   }, surface3);
  1044 |   expect(menuStyle).toMatchObject({
  1045 |     left: "120px",
  1046 |     top: "140px",
  1047 |     position: "fixed",
  1048 |     zIndex: "10000",
  1049 |     minWidth: "176px",
  1050 |     padding: "4px",
  1051 |     borderRadius: "4px",
  1052 |     backgroundColor: resolvedSurface1,
  1053 |     button: {
  1054 |       display: "block",
  1055 |       minHeight: "30px",
  1056 |       padding: "0px 9px",
  1057 |       borderRadius: "2px",
  1058 |       textAlign: "left",
  1059 |       fontSize: "11px",
  1060 |     },
  1061 |   });
  1062 | 
  1063 |   const firstButton = page.getByTestId("open-devtools");
  1064 |   await firstButton.hover();
  1065 |   const hoverBackground = await firstButton.evaluate((element) => getComputedStyle(element).backgroundColor);
  1066 |   expect(hoverBackground).toBe(resolvedSurface3);
  1067 | });
  1068 | 
  1069 | 
  1070 | test("preserves Replay playback speed menu geometry, options and hover styling", async ({ page }) => {
  1071 |   await page.setViewportSize({ width: 1440, height: 900 });
  1072 |   await page.goto("/");
  1073 |   await page.getByTestId("workspace-replay").click();
  1074 | 
  1075 |   const control = page.getByTestId("replay-speed-control");
  1076 |   await expect(control).toBeVisible();
  1077 |   await control.hover();
  1078 |   const menu = page.getByTestId("replay-speed-menu");
  1079 |   await expect(menu).toBeVisible();
  1080 | 
  1081 |   const styles = await menu.evaluate((element) => {
  1082 |     const root = getComputedStyle(element);
  1083 |     const option = element.querySelector<HTMLElement>(".replay-speed-option")!;
  1084 |     const optionStyle = getComputedStyle(option);
  1085 |     return {
  1086 |       root: {
  1087 |         position: root.position,
  1088 |         zIndex: root.zIndex,
  1089 |         top: root.top,
  1090 |         right: root.right,
  1091 |         display: root.display,
  1092 |         width: root.width,
  1093 |         flexDirection: root.flexDirection,
  1094 |         gap: root.gap,
  1095 |         padding: root.padding,
  1096 |         borderRadius: root.borderRadius,
  1097 |         boxShadow: root.boxShadow,
  1098 |       },
  1099 |       option: {
  1100 |         display: optionStyle.display,
  1101 |         minHeight: optionStyle.minHeight,
  1102 |         alignItems: optionStyle.alignItems,
  1103 |         justifyContent: optionStyle.justifyContent,
  1104 |         padding: optionStyle.padding,
  1105 |         borderRadius: optionStyle.borderRadius,
  1106 |         fontSize: optionStyle.fontSize,
  1107 |         textAlign: optionStyle.textAlign,
  1108 |       },
  1109 |       options: Array.from(element.querySelectorAll<HTMLElement>(".replay-speed-option"))
  1110 |         .map((item) => item.textContent?.trim()),
  1111 |     };
  1112 |   });
  1113 | 
  1114 |   expect(styles.root).toEqual({
  1115 |     position: "absolute",
  1116 |     zIndex: "1200",
  1117 |     top: "28px",
  1118 |     right: "0px",
  1119 |     display: "flex",
  1120 |     width: "86px",
  1121 |     flexDirection: "column",
  1122 |     gap: "1px",
  1123 |     padding: "4px",
  1124 |     borderRadius: "4px",
  1125 |     boxShadow: "rgba(0, 0, 0, 0.6) 0px 6px 20px 0px",
  1126 |   });
  1127 |   expect(styles.option).toMatchObject({
  1128 |     display: "flex",
  1129 |     minHeight: "27px",
  1130 |     alignItems: "center",
  1131 |     justifyContent: "space-between",
  1132 |     padding: "0px 7px",
  1133 |     borderRadius: "2px",
  1134 |     fontSize: "11px",
  1135 |     textAlign: "left",
  1136 |   });
> 1137 |   expect(styles.options).toEqual(["0.5x✓", "1x", "2x", "3x", "MAX"]);
       |                          ^ Error: expect(received).toEqual(expected) // deep equality
  1138 | 
  1139 |   const surface3 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--dbg-surface-3").trim());
  1140 |   const resolvedSurface3 = await page.evaluate((token) => {
  1141 |     const probe = document.createElement("div");
  1142 |     probe.style.backgroundColor = token;
  1143 |     document.body.append(probe);
  1144 |     const color = getComputedStyle(probe).backgroundColor;
  1145 |     probe.remove();
  1146 |     return color;
  1147 |   }, surface3);
  1148 |   const firstOption = menu.locator(".replay-speed-option").first();
  1149 |   await firstOption.hover();
  1150 |   await expect.poll(() => firstOption.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(resolvedSurface3);
  1151 | });
  1152 | 
```