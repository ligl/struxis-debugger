# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Snapshot Reference footer metadata geometry and typography
- Location: css-migration-regression/css-visual-regression.spec.ts:1294:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 1

@@ -1,9 +1,9 @@
  Object {
    "alignItems": "center",
    "backgroundColor": "rgb(25, 30, 34)",
-   "color": "rgb(133, 141, 151)",
+   "color": "rgb(137, 148, 157)",
    "display": "flex",
    "flex": "0 0 18px",
    "fontSize": "8px",
    "gap": "8px",
    "height": "18px",
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
            - generic [ref=e83]:
              - heading "SNAPSHOT REFERENCE" [level=3] [ref=e84]
              - img "Viewport synchronization available" [ref=e85]: ↕
            - generic [ref=e86]:
              - generic [ref=e87]: BTCUSDT.SIM
              - generic [ref=e88] [cursor=pointer]:
                - generic [aria-hidden]: 1m · 2026-09-21 14:13 → 2026-09-21 14:48
                - combobox "Snapshot Reference for BTCUSDT.SIM" [ref=e89]:
                  - option "Choose completed Snapshot…"
                  - option "1m · 2026-09-21 14:13 → 2026-09-21 14:48 · 2026-10-26T00:00:00Z" [selected]
          - region "Snapshot Reference chart" [ref=e92]:
            - generic [ref=e93]:
              - generic "Candlestick and volume chart for Snapshot css-regression-fixture-snapshot" [ref=e94]:
                - table [ref=e96]:
                  - row [ref=e97]:
                    - cell
                    - cell [ref=e98]
                    - cell [ref=e102]
                  - row [ref=e106]:
                    - cell
                    - cell [ref=e107]
                    - cell [ref=e111]
              - group "Chart layer visibility" [ref=e114]:
                - button "SBar" [pressed] [ref=e115] [cursor=pointer]
                - button "CBar" [disabled] [pressed] [ref=e117]
                - button "Swing" [disabled] [pressed] [ref=e119]
                - button "Volume" [pressed] [ref=e121] [cursor=pointer]
          - generic [ref=e123]:
            - generic [ref=e124]: RUN css-regression-fixture-run
            - generic [ref=e125]: SBARS 36
            - generic [ref=e126]: GENERATED 2026-09-21 14:13:20
            - generic [ref=e127]: FINGERPRINT css-regressi
    - complementary [ref=e128]:
      - separator "Resize Inspector" [ref=e129]
      - generic [ref=e130]:
        - generic "Drag to any workbench edge to dock" [ref=e131]: Inspector
        - generic [ref=e132]: OBJECT
        - group [ref=e133]:
          - generic "Move Inspector" [ref=e134] [cursor=pointer]: ⋯
        - button "Collapse Inspector" [ref=e135] [cursor=pointer]: −
      - generic [ref=e137]:
        - generic [ref=e138]: "[ ]"
        - heading "Object Inspector" [level=3] [ref=e139]
        - paragraph [ref=e140]: Step or Play a Run to inspect its first backend-confirmed Struxis checkpoint.
        - generic [ref=e141]: No inferred or fabricated domain state is displayed.
    - generic [ref=e143]:
      - navigation "Diagnostic categories" [ref=e144]:
        - button "ALL" [pressed] [ref=e145] [cursor=pointer]
        - button "ERRORS" [ref=e146] [cursor=pointer]
        - button "WARNINGS" [ref=e147] [cursor=pointer]
        - button "REPLAY" [ref=e148] [cursor=pointer]
        - button "STRUCTURE" [ref=e149] [cursor=pointer]
        - button "SNAPSHOTS" [ref=e150] [cursor=pointer]
        - button "VALIDATION" [ref=e151] [cursor=pointer]
        - button "DIFFERENCES" [ref=e152] [cursor=pointer]
      - generic [ref=e153]:
        - group [ref=e154]:
          - generic "Move Diagnostics" [ref=e155] [cursor=pointer]: ⋯
        - button "Expand Diagnostics" [ref=e156] [cursor=pointer]: +
```

# Test source

```ts
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
  1261 |   await page.setViewportSize({ width: 1440, height: 900 });
  1262 |   await installDeterministicOrigin(page, 12);
  1263 |   await page.goto("/");
  1264 |   await page.getByTestId("workspace-replay").click();
  1265 |   await page.evaluate(() => {
  1266 |     (window as typeof window & { __CSS_REGRESSION_FAIL_NEXT_STEP__?: boolean }).__CSS_REGRESSION_FAIL_NEXT_STEP__ = true;
  1267 |   });
  1268 |   await page.getByTestId("run-step").click();
  1269 | 
  1270 |   const error = page.locator("[data-testid='replay-toolbar-controls'] .toolbar-error");
  1271 |   await expect(error).toBeVisible();
  1272 |   await expect(error).toHaveText("CSS regression fixture forced step failure");
  1273 |   const style = await error.evaluate((element) => {
  1274 |     const computed = getComputedStyle(element);
  1275 |     return {
  1276 |       maxWidth: computed.maxWidth,
  1277 |       overflow: computed.overflow,
  1278 |       fontSize: computed.fontSize,
  1279 |       textOverflow: computed.textOverflow,
  1280 |       whiteSpace: computed.whiteSpace,
  1281 |     };
  1282 |   });
  1283 |   expect(style).toEqual({
  1284 |     maxWidth: "160px",
  1285 |     overflow: "hidden",
  1286 |     fontSize: "9px",
  1287 |     textOverflow: "ellipsis",
  1288 |     whiteSpace: "nowrap",
  1289 |   });
  1290 | });
  1291 | 
  1292 | 
  1293 | 
  1294 | test("preserves Snapshot Reference footer metadata geometry and typography", async ({ page }) => {
  1295 |   await page.setViewportSize({ width: 1440, height: 900 });
  1296 |   await installDeterministicOrigin(page, 12);
  1297 |   await page.goto("/");
  1298 |   await page.getByTestId("workspace-replay").click();
  1299 |   await page.getByTestId("replay-reference-select").selectOption("css-regression-fixture-snapshot");
  1300 | 
  1301 |   const footer = page.getByTestId("snapshot-reference-metadata");
  1302 |   await expect(footer).toBeVisible();
  1303 |   await expect(footer.locator("span")).toHaveCount(4);
  1304 |   await expect(footer).toContainText("RUN");
  1305 |   await expect(footer).toContainText("SBARS");
  1306 |   await expect(footer).toContainText("GENERATED");
  1307 |   await expect(footer).toContainText("FINGERPRINT");
  1308 | 
  1309 |   const styles = await footer.evaluate((element) => {
  1310 |     const root = getComputedStyle(element);
  1311 |     const spans = [...element.querySelectorAll<HTMLElement>(":scope > span")];
  1312 |     const first = getComputedStyle(spans[0]);
  1313 |     const label = getComputedStyle(spans[0].querySelector("b")!);
  1314 |     const fingerprint = getComputedStyle(spans[3]);
  1315 |     const rect = element.getBoundingClientRect();
  1316 |     return {
  1317 |       root: {
  1318 |         display: root.display,
  1319 |         height: root.height,
  1320 |         minHeight: root.minHeight,
  1321 |         flex: root.flex,
  1322 |         alignItems: root.alignItems,
  1323 |         gap: root.gap,
  1324 |         padding: root.padding,
  1325 |         overflow: root.overflow,
  1326 |         backgroundColor: root.backgroundColor,
  1327 |         color: root.color,
  1328 |         fontSize: root.fontSize,
  1329 |         letterSpacing: root.letterSpacing,
  1330 |         rectHeight: rect.height,
  1331 |       },
  1332 |       span: {
  1333 |         minWidth: first.minWidth,
  1334 |         overflow: first.overflow,
  1335 |         textOverflow: first.textOverflow,
  1336 |         whiteSpace: first.whiteSpace,
  1337 |       },
  1338 |       label: {
  1339 |         color: label.color,
  1340 |         fontWeight: label.fontWeight,
  1341 |         letterSpacing: label.letterSpacing,
  1342 |       },
  1343 |       fingerprintMarginLeft: fingerprint.marginLeft,
  1344 |     };
  1345 |   });
  1346 | 
> 1347 |   expect(styles.root).toEqual({
       |                       ^ Error: expect(received).toEqual(expected) // deep equality
  1348 |     display: "flex",
  1349 |     height: "18px",
  1350 |     minHeight: "18px",
  1351 |     flex: "0 0 18px",
  1352 |     alignItems: "center",
  1353 |     gap: "8px",
  1354 |     padding: "0px 8px",
  1355 |     overflow: "hidden",
  1356 |     backgroundColor: "rgb(25, 30, 34)",
  1357 |     color: "rgb(133, 141, 151)",
  1358 |     fontSize: "8px",
  1359 |     letterSpacing: "0.32px",
  1360 |     rectHeight: 18,
  1361 |   });
  1362 |   expect(styles.span).toEqual({
  1363 |     minWidth: "0px",
  1364 |     overflow: "hidden",
  1365 |     textOverflow: "ellipsis",
  1366 |     whiteSpace: "nowrap",
  1367 |   });
  1368 |   expect(styles.label).toEqual({
  1369 |     color: "rgb(160, 167, 176)",
  1370 |     fontWeight: "500",
  1371 |     letterSpacing: "normal",
  1372 |   });
  1373 |   expect(styles.fingerprintMarginLeft).toBe("auto");
  1374 | });
  1375 | 
  1376 | test("preserves Compare placeholder internal typography and integrity marker", async ({ page }) => {
  1377 |   await page.setViewportSize({ width: 1440, height: 900 });
  1378 |   await page.goto("/");
  1379 |   await page.getByTestId("workspace-compare").click();
  1380 | 
  1381 |   const chart = page.getByTestId("compare-candidate-chart");
  1382 |   await expect(chart).toBeVisible();
  1383 |   const styles = await chart.evaluate((element) => {
  1384 |     const mark = element.querySelector<HTMLElement>(".comparison-chart-empty-mark");
  1385 |     const heading = element.querySelector<HTMLElement>(".comparison-chart-empty strong");
  1386 |     const description = element.querySelector<HTMLElement>(".comparison-chart-empty p");
  1387 |     const integrity = element.querySelector<HTMLElement>(".comparison-chart-integrity");
  1388 |     const separator = integrity?.querySelector<HTMLElement>("i");
  1389 |     if (!mark || !heading || !description || !integrity || !separator) {
  1390 |       throw new Error("Compare placeholder internal elements are missing");
  1391 |     }
  1392 |     const markStyle = getComputedStyle(mark);
  1393 |     const headingStyle = getComputedStyle(heading);
  1394 |     const descriptionStyle = getComputedStyle(description);
  1395 |     const integrityStyle = getComputedStyle(integrity);
  1396 |     const separatorStyle = getComputedStyle(separator);
  1397 |     const rect = mark.getBoundingClientRect();
  1398 |     return {
  1399 |       mark: {
  1400 |         display: markStyle.display,
  1401 |         width: markStyle.width,
  1402 |         height: markStyle.height,
  1403 |         borderRadius: markStyle.borderRadius,
  1404 |         color: markStyle.color,
  1405 |         fontSize: markStyle.fontSize,
  1406 |         lineHeight: markStyle.lineHeight,
  1407 |         rect: { width: rect.width, height: rect.height },
  1408 |       },
  1409 |       heading: {
  1410 |         marginTop: headingStyle.marginTop,
  1411 |         fontSize: headingStyle.fontSize,
  1412 |         letterSpacing: headingStyle.letterSpacing,
  1413 |       },
  1414 |       description: {
  1415 |         maxWidth: descriptionStyle.maxWidth,
  1416 |         fontSize: descriptionStyle.fontSize,
  1417 |         lineHeight: descriptionStyle.lineHeight,
  1418 |       },
  1419 |       integrity: {
  1420 |         marginTop: integrityStyle.marginTop,
  1421 |         color: integrityStyle.color,
  1422 |         fontSize: integrityStyle.fontSize,
  1423 |         letterSpacing: integrityStyle.letterSpacing,
  1424 |       },
  1425 |       separator: {
  1426 |         paddingInline: separatorStyle.paddingInline,
  1427 |         color: separatorStyle.color,
  1428 |         fontStyle: separatorStyle.fontStyle,
  1429 |       },
  1430 |     };
  1431 |   });
  1432 | 
  1433 |   expect(styles.mark).toEqual({
  1434 |     display: "grid",
  1435 |     width: "28px",
  1436 |     height: "28px",
  1437 |     borderRadius: "3px",
  1438 |     color: "rgb(137, 148, 157)",
  1439 |     fontSize: "8px",
  1440 |     lineHeight: "normal",
  1441 |     rect: { width: 28, height: 28 },
  1442 |   });
  1443 |   expect(styles.heading).toEqual({
  1444 |     marginTop: "3px",
  1445 |     fontSize: "12px",
  1446 |     letterSpacing: "0.12px",
  1447 |   });
```