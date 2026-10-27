# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Replay toolbar error message truncation and typography
- Location: css-migration-regression/css-visual-regression.spec.ts:1260:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByTestId('workspace-replay')

```

# Test source

```ts
  1161 |   await page.goto("/");
  1162 |   await page.getByTestId("workspace-replay").click();
  1163 | 
  1164 |   const state = page.locator("[data-testid='replay-toolbar-controls'] .run-state");
  1165 |   const status = state.locator("b");
  1166 |   await expect(state).toBeVisible();
  1167 |   await expect(status).toHaveClass(/run-status-paused/);
  1168 | 
  1169 |   const styles = await state.evaluate((element) => {
  1170 |     const root = getComputedStyle(element);
  1171 |     const label = getComputedStyle(element.querySelector("b")!);
  1172 |     return {
  1173 |       root: {
  1174 |         display: root.display,
  1175 |         flex: root.flex,
  1176 |         alignItems: root.alignItems,
  1177 |         gap: root.gap,
  1178 |         color: root.color,
  1179 |         whiteSpace: root.whiteSpace,
  1180 |       },
  1181 |       label: {
  1182 |         color: label.color,
  1183 |         fontWeight: label.fontWeight,
  1184 |       },
  1185 |     };
  1186 |   });
  1187 | 
  1188 |   expect(styles.root).toEqual({
  1189 |     display: "flex",
  1190 |     flex: "0 0 auto",
  1191 |     alignItems: "center",
  1192 |     gap: "7px",
  1193 |     color: "rgb(137, 148, 157)",
  1194 |     whiteSpace: "nowrap",
  1195 |   });
  1196 |   expect(styles.label).toEqual({
  1197 |     color: "rgb(117, 198, 161)",
  1198 |     fontWeight: "650",
  1199 |   });
  1200 | });
  1201 | 
  1202 | test("preserves Replay progress bar geometry, colors and fill transition", async ({ page }) => {
  1203 |   await page.setViewportSize({ width: 1440, height: 900 });
  1204 |   await page.goto("/");
  1205 |   await page.getByTestId("workspace-replay").click();
  1206 | 
  1207 |   const progress = page.locator("[data-testid='replay-toolbar-controls'] .replay-progress");
  1208 |   await expect(progress).toBeVisible();
  1209 |   const styles = await progress.evaluate((element) => {
  1210 |     const root = getComputedStyle(element);
  1211 |     const fill = element.querySelector<HTMLElement>("i");
  1212 |     if (!fill) throw new Error("Replay progress fill element is missing");
  1213 |     const fillStyle = getComputedStyle(fill);
  1214 |     const rect = element.getBoundingClientRect();
  1215 |     return {
  1216 |       root: {
  1217 |         width: root.width,
  1218 |         height: root.height,
  1219 |         flex: root.flex,
  1220 |         overflow: root.overflow,
  1221 |         borderRadius: root.borderRadius,
  1222 |         backgroundColor: root.backgroundColor,
  1223 |       },
  1224 |       fill: {
  1225 |         display: fillStyle.display,
  1226 |         height: fillStyle.height,
  1227 |         borderRadius: fillStyle.borderRadius,
  1228 |         backgroundColor: fillStyle.backgroundColor,
  1229 |         transitionProperty: fillStyle.transitionProperty,
  1230 |         transitionDuration: fillStyle.transitionDuration,
  1231 |         transitionTimingFunction: fillStyle.transitionTimingFunction,
  1232 |       },
  1233 |       rect: {
  1234 |         width: Math.round(rect.width * 100) / 100,
  1235 |         height: Math.round(rect.height * 100) / 100,
  1236 |       },
  1237 |     };
  1238 |   });
  1239 | 
  1240 |   expect(styles.root).toEqual({
  1241 |     width: "92px",
  1242 |     height: "4px",
  1243 |     flex: "0 0 92px",
  1244 |     overflow: "hidden",
  1245 |     borderRadius: "5px",
  1246 |     backgroundColor: "rgb(52, 60, 66)",
  1247 |   });
  1248 |   expect(styles.fill).toEqual({
  1249 |     display: "block",
  1250 |     height: "4px",
  1251 |     borderRadius: "5px",
  1252 |     backgroundColor: "rgb(117, 198, 161)",
  1253 |     transitionProperty: "width",
  1254 |     transitionDuration: "0.12s",
  1255 |     transitionTimingFunction: "linear",
  1256 |   });
  1257 |   expect(styles.rect).toEqual({ width: 92, height: 4 });
  1258 | });
  1259 | 
  1260 | test("preserves Replay toolbar error message truncation and typography", async ({ page }) => {
> 1261 |   await page.getByTestId("workspace-replay").click();
       |                                              ^ Error: locator.click: Test timeout of 30000ms exceeded.
  1262 |   await page.evaluate(() => {
  1263 |     (window as typeof window & { __CSS_REGRESSION_FAIL_NEXT_STEP__?: boolean }).__CSS_REGRESSION_FAIL_NEXT_STEP__ = true;
  1264 |   });
  1265 |   await page.getByTestId("run-step").click();
  1266 | 
  1267 |   const error = page.locator("[data-testid='replay-toolbar-controls'] .toolbar-error");
  1268 |   await expect(error).toBeVisible();
  1269 |   await expect(error).toHaveText("CSS regression fixture forced step failure");
  1270 |   const style = await error.evaluate((element) => {
  1271 |     const computed = getComputedStyle(element);
  1272 |     return {
  1273 |       maxWidth: computed.maxWidth,
  1274 |       overflow: computed.overflow,
  1275 |       fontSize: computed.fontSize,
  1276 |       textOverflow: computed.textOverflow,
  1277 |       whiteSpace: computed.whiteSpace,
  1278 |     };
  1279 |   });
  1280 |   expect(style).toEqual({
  1281 |     maxWidth: "160px",
  1282 |     overflow: "hidden",
  1283 |     fontSize: "9px",
  1284 |     textOverflow: "ellipsis",
  1285 |     whiteSpace: "nowrap",
  1286 |   });
  1287 | });
  1288 | 
```