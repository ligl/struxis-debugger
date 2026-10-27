# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Replay progress bar geometry, colors and fill transition
- Location: css-migration-regression/css-visual-regression.spec.ts:1153:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "backgroundColor": "rgb(117, 198, 161)",
    "borderRadius": "5px",
    "display": "block",
    "height": "4px",
-   "transitionDuration": "120ms",
+   "transitionDuration": "0.12s",
    "transitionProperty": "width",
    "transitionTimingFunction": "linear",
  }
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
            - button "倍速" [ref=e27] [cursor=pointer]
          - generic [ref=e28]:
            - generic [ref=e29]: NO RUN
            - generic [ref=e30]: —
          - progressbar "Replay progress" [ref=e31]
          - button "SAVE SNAPSHOT" [disabled] [ref=e32]
      - generic [ref=e36]:
        - region "Live Replay SBar chart" [ref=e38]:
          - generic [ref=e39]:
            - generic [ref=e41]:
              - generic [ref=e42]: LIVE REPLAY · NO TEST
              - generic [ref=e43]: LIVE
            - generic [ref=e44]:
              - generic [ref=e45]: 0 SBARS
              - button "FIT" [disabled] [ref=e46]
          - generic [ref=e47]:
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
            - region "Live Replay SBar chart" [ref=e48]:
              - generic "Candlestick and volume chart for Test Dataset not selected" [ref=e50]:
                - table [ref=e52]:
                  - row [ref=e53]:
                    - cell
                    - cell [ref=e54]
                    - cell [ref=e58]
                  - row [ref=e62]:
                    - cell
                    - cell [ref=e63]
                    - cell [ref=e67]
        - separator "Resize Live Replay and Snapshot Reference chart panels" [ref=e70]
        - generic [ref=e72]:
          - generic [ref=e73]:
            - heading "SNAPSHOT REFERENCE" [level=3] [ref=e75]
            - generic [ref=e76]:
              - generic [ref=e77]: INSTRUMENT
              - generic [ref=e78] [cursor=pointer]:
                - generic [aria-hidden]: Choose completed Snapshot…
                - combobox "Snapshot Reference for INSTRUMENT" [disabled] [ref=e79]:
                  - option "Choose completed Snapshot…" [selected]
          - generic [ref=e81]:
            - strong [ref=e82]: NO COMPLETED SNAPSHOT AVAILABLE
            - paragraph [ref=e83]: A completed Run Snapshot will appear here after it is published and discovered.
    - complementary [ref=e84]:
      - separator "Resize Inspector" [ref=e85]
      - generic [ref=e86]:
        - generic "Drag to any workbench edge to dock" [ref=e87]: Inspector
        - generic [ref=e88]: OBJECT
        - group [ref=e89]:
          - generic "Move Inspector" [ref=e90] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e91] [cursor=pointer]: −
      - generic [ref=e93]:
        - generic [ref=e94]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e95]
        - paragraph [ref=e96]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e97]: No inferred or fabricated domain state is displayed.
    - generic [ref=e99]:
      - navigation "Diagnostic categories" [ref=e100]:
        - button "ALL" [pressed] [ref=e101] [cursor=pointer]
        - button "ERRORS" [ref=e102] [cursor=pointer]
        - button "WARNINGS" [ref=e103] [cursor=pointer]
        - button "REPLAY" [ref=e104] [cursor=pointer]
        - button "STRUCTURE" [ref=e105] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e106] [cursor=pointer]
        - button "VALIDATION" [ref=e107] [cursor=pointer]
        - button "DIFFERENCES" [ref=e108] [cursor=pointer]
      - generic [ref=e109]:
        - group [ref=e110]:
          - generic "Move Diagnostics" [ref=e111] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e112] [cursor=pointer]: +
```

# Test source

```ts
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
  1137 |   expect(styles.options).toEqual(["0.5x", "1x✓", "2x", "3x", "MAX"]);
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
  1153 | test("preserves Replay progress bar geometry, colors and fill transition", async ({ page }) => {
  1154 |   await page.setViewportSize({ width: 1440, height: 900 });
  1155 |   await page.goto("/");
  1156 |   await page.getByTestId("workspace-replay").click();
  1157 | 
  1158 |   const progress = page.locator("[data-testid='replay-toolbar-controls'] .replay-progress");
  1159 |   await expect(progress).toBeVisible();
  1160 |   const styles = await progress.evaluate((element) => {
  1161 |     const root = getComputedStyle(element);
  1162 |     const fill = element.querySelector<HTMLElement>("i");
  1163 |     if (!fill) throw new Error("Replay progress fill element is missing");
  1164 |     const fillStyle = getComputedStyle(fill);
  1165 |     const rect = element.getBoundingClientRect();
  1166 |     return {
  1167 |       root: {
  1168 |         width: root.width,
  1169 |         height: root.height,
  1170 |         flex: root.flex,
  1171 |         overflow: root.overflow,
  1172 |         borderRadius: root.borderRadius,
  1173 |         backgroundColor: root.backgroundColor,
  1174 |       },
  1175 |       fill: {
  1176 |         display: fillStyle.display,
  1177 |         height: fillStyle.height,
  1178 |         borderRadius: fillStyle.borderRadius,
  1179 |         backgroundColor: fillStyle.backgroundColor,
  1180 |         transitionProperty: fillStyle.transitionProperty,
  1181 |         transitionDuration: fillStyle.transitionDuration,
  1182 |         transitionTimingFunction: fillStyle.transitionTimingFunction,
  1183 |       },
  1184 |       rect: {
  1185 |         width: Math.round(rect.width * 100) / 100,
  1186 |         height: Math.round(rect.height * 100) / 100,
  1187 |       },
  1188 |     };
  1189 |   });
  1190 | 
  1191 |   expect(styles.root).toEqual({
  1192 |     width: "92px",
  1193 |     height: "4px",
  1194 |     flex: "0 0 92px",
  1195 |     overflow: "hidden",
  1196 |     borderRadius: "5px",
  1197 |     backgroundColor: "rgb(52, 60, 66)",
  1198 |   });
> 1199 |   expect(styles.fill).toEqual({
       |                       ^ Error: expect(received).toEqual(expected) // deep equality
  1200 |     display: "block",
  1201 |     height: "4px",
  1202 |     borderRadius: "5px",
  1203 |     backgroundColor: "rgb(117, 198, 161)",
  1204 |     transitionProperty: "width",
  1205 |     transitionDuration: "120ms",
  1206 |     transitionTimingFunction: "linear",
  1207 |   });
  1208 |   expect(styles.rect).toEqual({ width: 92, height: 4 });
  1209 | });
  1210 | 
```