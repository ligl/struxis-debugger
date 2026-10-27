# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Replay run status layout and paused-state color
- Location: css-migration-regression/css-visual-regression.spec.ts:1153:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

  Object {
    "alignItems": "center",
-   "color": "rgb(133, 141, 151)",
+   "color": "rgb(137, 148, 157)",
    "display": "flex",
    "flex": "0 0 auto",
    "gap": "7px",
    "whiteSpace": "nowrap",
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
        - generic [ref=e13]: ORIGIN AVAILABLE
        - generic [ref=e15]: CAPITUS
    - generic [ref=e16]:
      - generic [ref=e17]:
        - generic [ref=e18]: REPLAY
        - generic [ref=e19]: TEST DATASET
        - generic [ref=e20]: BTCUSDT.SIM · 1m · 36 SBARS · 2026-09-21 14:13 → 2026-09-21 14:48
        - generic [ref=e21]:
          - group "Replay transport controls" [ref=e22]:
            - button "STOP" [ref=e23] [cursor=pointer]
            - button "STEP ▶|" [ref=e24] [cursor=pointer]
            - button "▶ PLAY" [ref=e25] [cursor=pointer]
            - button "倍速" [ref=e27] [cursor=pointer]
          - generic [ref=e28]:
            - generic [ref=e29]: PAUSED
            - generic [ref=e30]: 12 / 36
          - progressbar "Replay progress" [ref=e31]
          - button "SAVE SNAPSHOT" [disabled] [ref=e33]
      - generic [ref=e37]:
        - region "Live Replay SBar chart" [ref=e39]:
          - generic [ref=e40]:
            - generic [ref=e42]:
              - generic [ref=e43]: LIVE REPLAY · BTCUSDT-1-MINUTE-LAST-EXTERNAL
              - generic [ref=e44]: LIVE
            - generic [ref=e45]:
              - generic [ref=e46]: 36 SBARS
              - button "FIT" [ref=e47] [cursor=pointer]
          - generic [ref=e48]:
            - region "Live Replay SBar chart" [ref=e49]:
              - generic "Candlestick and volume chart for Test Dataset css-regression-fixture-test" [ref=e51]:
                - table [ref=e53]:
                  - row [ref=e54]:
                    - cell
                    - cell [ref=e55]
                    - cell [ref=e59]
                  - row [ref=e63]:
                    - cell
                    - cell [ref=e64]
                    - cell [ref=e68]
            - group "Chart layer visibility":
              - button "SBar" [pressed] [ref=e71] [cursor=pointer]
              - button "CBar" [disabled] [pressed] [ref=e73]
              - button "Swing" [disabled] [pressed] [ref=e75]
              - button "Volume" [pressed] [ref=e77] [cursor=pointer]
        - separator "Resize Live Replay and Snapshot Reference chart panels" [ref=e79]
        - generic [ref=e81]:
          - generic [ref=e82]:
            - heading "SNAPSHOT REFERENCE" [level=3] [ref=e84]
            - generic [ref=e85]:
              - generic [ref=e86]: BTCUSDT.SIM
              - generic [ref=e87] [cursor=pointer]:
                - generic [aria-hidden]: Choose completed Snapshot…
                - combobox "Snapshot Reference for BTCUSDT.SIM" [ref=e88]:
                  - option "Choose completed Snapshot…" [selected]
                  - option "1m · 2026-09-21 14:13 → 2026-09-21 14:48 · 2026-10-26T00:00:00Z"
          - generic [ref=e90]:
            - strong [ref=e91]: SELECT A COMPLETED SNAPSHOT
            - paragraph [ref=e92]: Choose an immutable reference from the control above.
    - complementary [ref=e93]:
      - separator "Resize Inspector" [ref=e94]
      - generic [ref=e95]:
        - generic "Drag to any workbench edge to dock" [ref=e96]: Inspector
        - generic [ref=e97]: OBJECT
        - group [ref=e98]:
          - generic "Move Inspector" [ref=e99] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e100] [cursor=pointer]: −
      - generic [ref=e102]:
        - generic [ref=e103]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e104]
        - paragraph [ref=e105]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e106]: No inferred or fabricated domain state is displayed.
    - generic [ref=e108]:
      - navigation "Diagnostic categories" [ref=e109]:
        - button "ALL" [pressed] [ref=e110] [cursor=pointer]
        - button "ERRORS" [ref=e111] [cursor=pointer]
        - button "WARNINGS" [ref=e112] [cursor=pointer]
        - button "REPLAY" [ref=e113] [cursor=pointer]
        - button "STRUCTURE" [ref=e114] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e115] [cursor=pointer]
        - button "VALIDATION" [ref=e116] [cursor=pointer]
        - button "DIFFERENCES" [ref=e117] [cursor=pointer]
      - generic [ref=e118]:
        - group [ref=e119]:
          - generic "Move Diagnostics" [ref=e120] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e121] [cursor=pointer]: +
```

# Test source

```ts
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
  1153 | test("preserves Replay run status layout and paused-state color", async ({ page }) => {
  1154 |   await page.setViewportSize({ width: 1440, height: 900 });
  1155 |   await installDeterministicOrigin(page, 12);
  1156 |   await page.goto("/");
  1157 |   await page.getByTestId("workspace-replay").click();
  1158 | 
  1159 |   const state = page.locator("[data-testid='replay-toolbar-controls'] .run-state");
  1160 |   const status = state.locator("b");
  1161 |   await expect(state).toBeVisible();
  1162 |   await expect(status).toHaveClass(/run-status-paused/);
  1163 | 
  1164 |   const styles = await state.evaluate((element) => {
  1165 |     const root = getComputedStyle(element);
  1166 |     const label = getComputedStyle(element.querySelector("b")!);
  1167 |     return {
  1168 |       root: {
  1169 |         display: root.display,
  1170 |         flex: root.flex,
  1171 |         alignItems: root.alignItems,
  1172 |         gap: root.gap,
  1173 |         color: root.color,
  1174 |         whiteSpace: root.whiteSpace,
  1175 |       },
  1176 |       label: {
  1177 |         color: label.color,
  1178 |         fontWeight: label.fontWeight,
  1179 |       },
  1180 |     };
  1181 |   });
  1182 | 
> 1183 |   expect(styles.root).toEqual({
       |                       ^ Error: expect(received).toEqual(expected) // deep equality
  1184 |     display: "flex",
  1185 |     flex: "0 0 auto",
  1186 |     alignItems: "center",
  1187 |     gap: "7px",
  1188 |     color: "rgb(133, 141, 151)",
  1189 |     whiteSpace: "nowrap",
  1190 |   });
  1191 |   expect(styles.label).toEqual({
  1192 |     color: "rgb(121, 181, 139)",
  1193 |     fontWeight: "650",
  1194 |   });
  1195 | });
  1196 | 
  1197 | test("preserves Replay progress bar geometry, colors and fill transition", async ({ page }) => {
  1198 |   await page.setViewportSize({ width: 1440, height: 900 });
  1199 |   await page.goto("/");
  1200 |   await page.getByTestId("workspace-replay").click();
  1201 | 
  1202 |   const progress = page.locator("[data-testid='replay-toolbar-controls'] .replay-progress");
  1203 |   await expect(progress).toBeVisible();
  1204 |   const styles = await progress.evaluate((element) => {
  1205 |     const root = getComputedStyle(element);
  1206 |     const fill = element.querySelector<HTMLElement>("i");
  1207 |     if (!fill) throw new Error("Replay progress fill element is missing");
  1208 |     const fillStyle = getComputedStyle(fill);
  1209 |     const rect = element.getBoundingClientRect();
  1210 |     return {
  1211 |       root: {
  1212 |         width: root.width,
  1213 |         height: root.height,
  1214 |         flex: root.flex,
  1215 |         overflow: root.overflow,
  1216 |         borderRadius: root.borderRadius,
  1217 |         backgroundColor: root.backgroundColor,
  1218 |       },
  1219 |       fill: {
  1220 |         display: fillStyle.display,
  1221 |         height: fillStyle.height,
  1222 |         borderRadius: fillStyle.borderRadius,
  1223 |         backgroundColor: fillStyle.backgroundColor,
  1224 |         transitionProperty: fillStyle.transitionProperty,
  1225 |         transitionDuration: fillStyle.transitionDuration,
  1226 |         transitionTimingFunction: fillStyle.transitionTimingFunction,
  1227 |       },
  1228 |       rect: {
  1229 |         width: Math.round(rect.width * 100) / 100,
  1230 |         height: Math.round(rect.height * 100) / 100,
  1231 |       },
  1232 |     };
  1233 |   });
  1234 | 
  1235 |   expect(styles.root).toEqual({
  1236 |     width: "92px",
  1237 |     height: "4px",
  1238 |     flex: "0 0 92px",
  1239 |     overflow: "hidden",
  1240 |     borderRadius: "5px",
  1241 |     backgroundColor: "rgb(52, 60, 66)",
  1242 |   });
  1243 |   expect(styles.fill).toEqual({
  1244 |     display: "block",
  1245 |     height: "4px",
  1246 |     borderRadius: "5px",
  1247 |     backgroundColor: "rgb(117, 198, 161)",
  1248 |     transitionProperty: "width",
  1249 |     transitionDuration: "0.12s",
  1250 |     transitionTimingFunction: "linear",
  1251 |   });
  1252 |   expect(styles.rect).toEqual({ width: 92, height: 4 });
  1253 | });
  1254 | 
```