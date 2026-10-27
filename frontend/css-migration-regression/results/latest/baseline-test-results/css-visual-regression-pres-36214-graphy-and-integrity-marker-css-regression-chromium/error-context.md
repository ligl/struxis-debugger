# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: css-visual-regression.spec.ts >> preserves Compare placeholder internal typography and integrity marker
- Location: css-migration-regression/css-visual-regression.spec.ts:1292:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 2
+ Received  + 2

@@ -1,12 +1,12 @@
  Object {
    "borderRadius": "3px",
    "color": "rgb(137, 148, 157)",
    "display": "grid",
-   "fontSize": "18px",
+   "fontSize": "8px",
    "height": "28px",
-   "lineHeight": "18px",
+   "lineHeight": "normal",
    "rect": Object {
      "height": 28,
      "width": 28,
    },
    "width": "28px",
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
  1292 | test("preserves Compare placeholder internal typography and integrity marker", async ({ page }) => {
  1293 |   await page.setViewportSize({ width: 1440, height: 900 });
  1294 |   await page.goto("/");
  1295 |   await page.getByTestId("workspace-compare").click();
  1296 | 
  1297 |   const chart = page.getByTestId("compare-candidate-chart");
  1298 |   await expect(chart).toBeVisible();
  1299 |   const styles = await chart.evaluate((element) => {
  1300 |     const mark = element.querySelector<HTMLElement>(".comparison-chart-empty-mark");
  1301 |     const heading = element.querySelector<HTMLElement>(".comparison-chart-empty strong");
  1302 |     const description = element.querySelector<HTMLElement>(".comparison-chart-empty p");
  1303 |     const integrity = element.querySelector<HTMLElement>(".comparison-chart-integrity");
  1304 |     const separator = integrity?.querySelector<HTMLElement>("i");
  1305 |     if (!mark || !heading || !description || !integrity || !separator) {
  1306 |       throw new Error("Compare placeholder internal elements are missing");
  1307 |     }
  1308 |     const markStyle = getComputedStyle(mark);
  1309 |     const headingStyle = getComputedStyle(heading);
  1310 |     const descriptionStyle = getComputedStyle(description);
  1311 |     const integrityStyle = getComputedStyle(integrity);
  1312 |     const separatorStyle = getComputedStyle(separator);
  1313 |     const rect = mark.getBoundingClientRect();
  1314 |     return {
  1315 |       mark: {
  1316 |         display: markStyle.display,
  1317 |         width: markStyle.width,
  1318 |         height: markStyle.height,
  1319 |         borderRadius: markStyle.borderRadius,
  1320 |         color: markStyle.color,
  1321 |         fontSize: markStyle.fontSize,
  1322 |         lineHeight: markStyle.lineHeight,
  1323 |         rect: { width: rect.width, height: rect.height },
  1324 |       },
  1325 |       heading: {
  1326 |         marginTop: headingStyle.marginTop,
  1327 |         fontSize: headingStyle.fontSize,
  1328 |         letterSpacing: headingStyle.letterSpacing,
  1329 |       },
  1330 |       description: {
  1331 |         maxWidth: descriptionStyle.maxWidth,
  1332 |         fontSize: descriptionStyle.fontSize,
  1333 |         lineHeight: descriptionStyle.lineHeight,
  1334 |       },
  1335 |       integrity: {
  1336 |         marginTop: integrityStyle.marginTop,
  1337 |         color: integrityStyle.color,
  1338 |         fontSize: integrityStyle.fontSize,
  1339 |         letterSpacing: integrityStyle.letterSpacing,
  1340 |       },
  1341 |       separator: {
  1342 |         paddingInline: separatorStyle.paddingInline,
  1343 |         color: separatorStyle.color,
  1344 |         fontStyle: separatorStyle.fontStyle,
  1345 |       },
  1346 |     };
  1347 |   });
  1348 | 
> 1349 |   expect(styles.mark).toEqual({
       |                       ^ Error: expect(received).toEqual(expected) // deep equality
  1350 |     display: "grid",
  1351 |     width: "28px",
  1352 |     height: "28px",
  1353 |     borderRadius: "3px",
  1354 |     color: "rgb(137, 148, 157)",
  1355 |     fontSize: "18px",
  1356 |     lineHeight: "18px",
  1357 |     rect: { width: 28, height: 28 },
  1358 |   });
  1359 |   expect(styles.heading).toEqual({
  1360 |     marginTop: "3px",
  1361 |     fontSize: "12px",
  1362 |     letterSpacing: "0.12px",
  1363 |   });
  1364 |   expect(styles.description).toEqual({
  1365 |     maxWidth: "560px",
  1366 |     fontSize: "10px",
  1367 |     lineHeight: "16.5px",
  1368 |   });
  1369 |   expect(styles.integrity).toEqual({
  1370 |     marginTop: "4px",
  1371 |     color: "rgb(127, 137, 143)",
  1372 |     fontSize: "8px",
  1373 |     letterSpacing: "0.56px",
  1374 |   });
  1375 |   expect(styles.separator).toEqual({
  1376 |     paddingInline: "3px",
  1377 |     color: "rgb(179, 138, 80)",
  1378 |     fontStyle: "normal",
  1379 |   });
  1380 | });
  1381 | 
```