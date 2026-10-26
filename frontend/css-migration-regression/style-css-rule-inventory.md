# Temporary global CSS rule inventory

- Source: `crates/struxis-debugger/frontend/src/style.css`
- Source blob at generation: `55e3face2e241ff035dbdcc350faa2e962cf43d4`
- Source lines: 4865; rule occurrences recorded: 774
- Status: temporary migration aid; regenerate when source CSS changes; remove with the temporary CSS migration regression suite after migration and visual acceptance.
- Method: lexical scan that skips comments/quoted strings and tracks at-rule nesting. Not a standards-compliant CSS AST; property names are extracted heuristically. Do not use this report alone to change cascade behavior.
- Ordering: source order preserved. Repeated selectors are intentionally not deduplicated.

| # | Source line | Selector | At-rule context | Declared properties (heuristic) | Owner review |
|---:|---:|---|---|---|---|
| 1 | 1 | `:root` | global | --dbg-surface-1, --dbg-surface-2, --dbg-surface-3, --dbg-border, --dbg-border-strong, --dbg-text-primary, --dbg-text-secondary, --dbg-text-muted, --dbg-text-disabled, --dbg-accent, --dbg-accent-hover, --dbg-accent-subtle, --dbg-success, --dbg-warning, --dbg-error, --dbg-info, --dbg-error-surface, --dbg-selection-border, --dbg-selection-surface, --dbg-chart-up, --dbg-chart-down, --dbg-chart-neutral, --dbg-chart-unprocessed, --dbg-chart-volume-up, --dbg-chart-volume-down, --dbg-chart-cbar, --dbg-chart-swing, --dbg-chart-trend, --dbg-chart-keyzone, --dbg-chart-crosshair, font-family, color, background, font-synthesis, text-rendering, -webkit-font-smoothing, font-optical-sizing, font-size, color-scheme | TODO |
| 2 | 44 | `*` | global | box-sizing | TODO |
| 3 | 48 | `body` | global | margin, min-width, min-height, background | TODO |
| 4 | 55 | `button, input` | global | font | TODO |
| 5 | 60 | `button` | global | color | TODO |
| 6 | 64 | `button:focus-visible, input:focus-visible` | global | outline, outline-offset | TODO |
| 7 | 70 | `.debugger-shell` | global | height, min-height, margin, padding, display, flex-direction, gap, overflow | TODO |
| 8 | 83 | `.topbar, .panel-heading, .footer-bar, .table-heading` | global | display, align-items, justify-content, gap | TODO |
| 9 | 93 | `.topbar` | global | padding, border-bottom | TODO |
| 10 | 98 | `.eyebrow, .section-index, .field-label` | global | margin, color, font, letter-spacing | TODO |
| 11 | 107 | `h1, h2, h3, p` | global | margin-top | TODO |
| 12 | 114 | `h1` | global | margin, font-size, font-weight, letter-spacing | TODO |
| 13 | 121 | `h2` | global | margin, font-size, font-weight | TODO |
| 14 | 127 | `h3` | global | margin, font-size, font-weight | TODO |
| 15 | 133 | `.subtitle` | global | margin, color, font | TODO |
| 16 | 139 | `.runtime-mark` | global | display, align-items, gap, color, font, letter-spacing | TODO |
| 17 | 148 | `.runtime-dot, .dataset-status` | global | display, flex, width, height, border, border-radius, background | TODO |
| 18 | 159 | `.runtime-dot.active, .dataset-status.ready` | global | border-color, background, box-shadow | TODO |
| 19 | 166 | `.workspace` | global | display, grid-template-columns, gap, flex, align-items | TODO |
| 20 | 174 | `.panel` | global | min-width, border, background | TODO |
| 21 | 180 | `.catalog-panel, .result-panel` | global | padding | TODO |
| 22 | 185 | `.panel-heading` | global | min-height, margin-bottom | TODO |
| 23 | 190 | `.subtle-button` | global | padding, border, background, color, cursor | TODO |
| 24 | 198 | `.subtle-button:hover:not(:disabled)` | global | border-color, color | TODO |
| 25 | 203 | `button:disabled` | global | cursor, opacity | TODO |
| 26 | 208 | `.instrument-list` | global | display, flex-direction, gap | TODO |
| 27 | 214 | `.instrument-group` | global | min-width, border, background | TODO |
| 28 | 220 | `.instrument-group.unresolved` | global | border-color | TODO |
| 29 | 224 | `.instrument-group-row` | global | display, width, min-width, align-items, gap, padding, border, background, text-align, cursor | TODO |
| 30 | 237 | `.instrument-group-row:hover` | global | background | TODO |
| 31 | 241 | `.group-chevron` | global | flex, color, font | TODO |
| 32 | 247 | `.instrument-group-name` | global | min-width, flex, color, font, overflow-wrap | TODO |
| 33 | 255 | `.instrument-group.unresolved .instrument-group-name` | global | color | TODO |
| 34 | 259 | `.group-count, .group-ready` | global | flex, color, font, white-space | TODO |
| 35 | 267 | `.group-ready` | global | color | TODO |
| 36 | 271 | `.instrument-group .dataset-list` | global | display, flex-direction, gap, padding | TODO |
| 37 | 278 | `.instrument-group .dataset-row` | global | border-width, border-color, background | TODO |
| 38 | 284 | `.instrument-group .dataset-row:last-child` | global | border-bottom | TODO |
| 39 | 288 | `.instrument-group .dataset-row:hover:not(:disabled)` | global | background | TODO |
| 40 | 292 | `.instrument-group .dataset-row.selected` | global | border-color, background, box-shadow | TODO |
| 41 | 298 | `.dataset-row` | global | display, width, align-items, gap, padding, text-align, border, background, cursor | TODO |
| 42 | 310 | `.dataset-row:hover:not(:disabled)` | global | border-color, background | TODO |
| 43 | 315 | `.dataset-row.selected` | global | border-color, background, box-shadow | TODO |
| 44 | 321 | `.dataset-row.unavailable` | global | color | TODO |
| 45 | 325 | `.dataset-status` | global | margin-top | TODO |
| 46 | 329 | `.dataset-status:not(.ready)` | global | border-radius | TODO |
| 47 | 333 | `.dataset-details` | global | display, min-width, flex, flex-direction, gap | TODO |
| 48 | 341 | `.dataset-details strong` | global | overflow-wrap, color, font-size, font-weight | TODO |
| 49 | 348 | `.dataset-details small, .microcopy, .source-note` | global | color, font-size, line-height, overflow-wrap | TODO |
| 50 | 357 | `.dataset-state` | global | flex, color, font, white-space | TODO |
| 51 | 364 | `.unavailable .dataset-state` | global | color | TODO |
| 52 | 368 | `.diagnostic` | global | color | TODO |
| 53 | 372 | `.load-options` | global | margin-top, padding-top, border-top | TODO |
| 54 | 378 | `.toggle-row` | global | display, align-items, gap, margin-bottom, cursor | TODO |
| 55 | 386 | `.toggle-row input` | global | margin, accent-color | TODO |
| 56 | 391 | `.toggle-row span` | global | display, flex-direction, gap | TODO |
| 57 | 397 | `.toggle-row strong` | global | font-size, font-weight | TODO |
| 58 | 402 | `.toggle-row small` | global | color, font-size | TODO |
| 59 | 407 | `.primary-button` | global | display, width, align-items, justify-content, gap, padding, border, background, color, font, letter-spacing, cursor | TODO |
| 60 | 422 | `.primary-button:hover:not(:disabled)` | global | border-color, background | TODO |
| 61 | 427 | `.microcopy` | global | margin | TODO |
| 62 | 431 | `.status-label` | global | padding, border, color, font, letter-spacing, white-space | TODO |
| 63 | 440 | `.status-label.loaded` | global | border-color, color | TODO |
| 64 | 445 | `.status-label.loading` | global | border-color, color | TODO |
| 65 | 450 | `.status-label.failed` | global | border-color, color | TODO |
| 66 | 455 | `.origin-identity` | global | display, gap, padding, border, background | TODO |
| 67 | 463 | `.origin-identity code` | global | margin-bottom, color, font, overflow-wrap | TODO |
| 68 | 470 | `.origin-identity code.fingerprint` | global | margin-bottom, color | TODO |
| 69 | 475 | `.metric-grid` | global | display, grid-template-columns, margin, border-top, border-left | TODO |
| 70 | 483 | `.metric` | global | display, min-width, flex-direction, gap, padding, border-right, border-bottom | TODO |
| 71 | 493 | `.metric span` | global | color, font, letter-spacing | TODO |
| 72 | 499 | `.metric strong` | global | color, font-size, font-weight, overflow-wrap | TODO |
| 73 | 506 | `.range-summary` | global | display, grid-template-columns, gap, margin | TODO |
| 74 | 513 | `.range-summary > div` | global | display, min-width, flex-direction, gap, padding, border | TODO |
| 75 | 522 | `.range-summary strong` | global | color, font, overflow-wrap | TODO |
| 76 | 528 | `.range-summary small` | global | color, font, overflow-wrap | TODO |
| 77 | 534 | `.table-heading` | global | align-items, margin-bottom | TODO |
| 78 | 539 | `.table-heading > span` | global | color, font | TODO |
| 79 | 544 | `.table-scroll` | global | width, overflow-x, border | TODO |
| 80 | 550 | `table` | global | width, border-collapse, font, white-space | TODO |
| 81 | 557 | `thead` | global | background, color | TODO |
| 82 | 562 | `th, td` | global | padding, border-bottom, text-align | TODO |
| 83 | 569 | `th:first-child, td:first-child` | global | text-align | TODO |
| 84 | 574 | `th` | global | font-weight | TODO |
| 85 | 578 | `tbody tr:last-child td` | global | border-bottom | TODO |
| 86 | 582 | `tbody tr:hover` | global | background | TODO |
| 87 | 586 | `td` | global | color | TODO |
| 88 | 590 | `.timestamp-cell` | global | color | TODO |
| 89 | 594 | `.source-note` | global | margin | TODO |
| 90 | 598 | `.error-message` | global | display, flex-direction, gap, margin-bottom, padding, border, background, color, font-size, line-height, overflow-wrap | TODO |
| 91 | 612 | `.error-message small` | global | color | TODO |
| 92 | 616 | `.empty-state` | global | padding, border, color, font-size, line-height | TODO |
| 93 | 624 | `.no-origin` | global | display, min-height, align-content, justify-items, padding, text-align | TODO |
| 94 | 633 | `.no-origin-glyph` | global | color, font | TODO |
| 95 | 638 | `.no-origin h3` | global | margin, font-size | TODO |
| 96 | 643 | `.no-origin p` | global | max-width, margin, color, font-size, line-height | TODO |
| 97 | 651 | `.footer-bar` | global | padding-top, border-top, color, font, letter-spacing | TODO |
| 98 | 661 | `.workspace` | @media (max-width: 980px) | grid-template-columns | TODO |
| 99 | 667 | `.debugger-shell` | @media (max-width: 600px) | padding | TODO |
| 100 | 670 | `.topbar` | @media (max-width: 600px) | align-items | TODO |
| 101 | 674 | `.runtime-mark` | @media (max-width: 600px) | max-width, text-align, line-height | TODO |
| 102 | 680 | `.catalog-panel, .result-panel` | @media (max-width: 600px) | padding | TODO |
| 103 | 685 | `.range-summary` | @media (max-width: 600px) | grid-template-columns | TODO |
| 104 | 689 | `.footer-bar` | @media (max-width: 600px) | align-items, flex-direction, gap | TODO |
| 105 | 696 | `.operations-grid` | global | display, grid-template-columns, gap, align-items | TODO |
| 106 | 704 | `.operations-panel, .snapshot-panel` | global | padding | TODO |
| 107 | 709 | `.form-grid` | global | display, grid-template-columns, gap, margin | TODO |
| 108 | 716 | `.form-field` | global | display, min-width, flex-direction, gap, color, font, letter-spacing | TODO |
| 109 | 726 | `.form-field input` | global | width, min-width, padding, border, border-radius, background, color, font, letter-spacing | TODO |
| 110 | 738 | `.action-grid` | global | display, grid-template-columns, gap, margin | TODO |
| 111 | 745 | `.action-button` | global | min-width, padding, border, background, color, font, letter-spacing, cursor | TODO |
| 112 | 756 | `.action-button:hover:not(:disabled)` | global | border-color, color | TODO |
| 113 | 761 | `.action-button.action-primary` | global | border-color, background, color | TODO |
| 114 | 767 | `.action-button.action-primary:hover:not(:disabled)` | global | border-color | TODO |
| 115 | 771 | `.detail-list` | global | display, gap, margin-top, border-top | TODO |
| 116 | 778 | `.detail-list > div` | global | display, grid-template-columns, gap, padding, border-bottom, align-items | TODO |
| 117 | 787 | `.detail-list > div > span` | global | color, font | TODO |
| 118 | 792 | `.detail-list code, .detail-list strong` | global | min-width, color, font, overflow-wrap | TODO |
| 119 | 800 | `.success-message` | global | margin, padding, border, color, font-size, line-height | TODO |
| 120 | 809 | `.snapshot-panel` | global | min-width | TODO |
| 121 | 813 | `.snapshot-table` | global | min-width | TODO |
| 122 | 817 | `.snapshot-table td` | global | vertical-align | TODO |
| 123 | 821 | `.snapshot-table td:first-child, .snapshot-table td:last-child` | global | text-align | TODO |
| 124 | 826 | `.snapshot-table td > strong, .snapshot-table td > small` | global | display, max-width, overflow-wrap | TODO |
| 125 | 833 | `.snapshot-table td > strong` | global | color, font-weight | TODO |
| 126 | 838 | `.snapshot-table td > small` | global | margin-top, color, font-size, line-height | TODO |
| 127 | 845 | `.artifact-kind` | global | display, padding, border, color, font-size, white-space | TODO |
| 128 | 854 | `.artifact-kind.published` | global | border-color, color | TODO |
| 129 | 859 | `.artifact-kind.invalid` | global | border-color, color | TODO |
| 130 | 866 | `.operations-grid` | @media (max-width: 980px) | grid-template-columns | TODO |
| 131 | 872 | `.operations-panel, .snapshot-panel` | @media (max-width: 600px) | padding | TODO |
| 132 | 876 | `.form-grid` | @media (max-width: 600px) | grid-template-columns | TODO |
| 133 | 880 | `.action-grid` | @media (max-width: 600px) | grid-template-columns | TODO |
| 134 | 884 | `.detail-list > div` | @media (max-width: 600px) | grid-template-columns, gap | TODO |
| 135 | 890 | `/* Workbench layout: no maximum dimensions; only usable minimums constrain panels. */ html, body, #app` | global | width, min-width, min-height, height | TODO |
| 136 | 901 | `.debugger-shell` | global | width, min-width, height, min-height, margin, padding, gap | TODO |
| 137 | 911 | `.workbench-topbar` | global | justify-content, flex, height, min-height, display, align-items, gap, padding, border-bottom, background | TODO |
| 138 | 924 | `.workbench-topbar .brand` | global | display, flex, align-items, gap, color, font-size, font-weight, letter-spacing, white-space | TODO |
| 139 | 936 | `.workbench-topbar .brandmark` | global | display, width, height, flex, place-items, border, border-radius, color, font, letter-spacing | TODO |
| 140 | 949 | `.workbench-topbar .workspace-tabs` | global | display, height, min-width, flex, align-items, gap, flex-wrap | TODO |
| 141 | 959 | `.workbench-topbar .workspace-tab` | global | height, min-height, padding, border, border-radius, background, color, font, letter-spacing, white-space | TODO |
| 142 | 972 | `.workbench-topbar .workspace-tab:hover` | global | border-color, background, color | TODO |
| 143 | 978 | `.workbench-topbar .workspace-tab.active` | global | border-color, background, color, box-shadow | TODO |
| 144 | 985 | `.workbench-topbar .top-right` | global | display, min-width, margin-left, align-items, gap, color, font-size, white-space | TODO |
| 145 | 996 | `.workbench-topbar .runtime-mark` | global | display, align-items, gap, color, font, letter-spacing | TODO |
| 146 | 1005 | `.workbench-topbar .status-dot` | global | display, width, height, flex, margin-right, border, border-radius, background, box-shadow | TODO |
| 147 | 1017 | `.workbench-topbar .status-dot.active` | global | background | TODO |
| 148 | 1021 | `.workbench-topbar .keycap` | global | padding, border, border-radius, color, font | TODO |
| 149 | 1031 | `.workbench-topbar` | @media (max-width: 1050px) | gap, padding-right, padding-left | TODO |
| 150 | 1036 | `.workbench-topbar .brand` | @media (max-width: 1050px) | gap, font-size | TODO |
| 151 | 1041 | `.workbench-topbar .workspace-tab` | @media (max-width: 1050px) | padding-right, padding-left | TODO |
| 152 | 1046 | `.workbench-topbar .top-right` | @media (max-width: 1050px) | gap | TODO |
| 153 | 1051 | `.debugger-shell` | global | display, grid-template-columns, flex, min-height, min-width, gap, overflow | TODO |
| 154 | 1061 | `.catalog-rail` | global | min-width, min-height, padding, overflow, border-right, background | TODO |
| 155 | 1070 | `.catalog-rail.collapsed` | global | padding | TODO |
| 156 | 1074 | `.rail-heading, .diagnostics-heading` | global | display, min-height, align-items, justify-content, gap | TODO |
| 157 | 1083 | `.rail-toggle` | global | min-width, padding | TODO |
| 158 | 1088 | `.catalog-rail > .catalog-panel` | global | margin-top, padding, border, background | TODO |
| 159 | 1095 | `.catalog-rail .panel-heading` | global | align-items | TODO |
| 160 | 1099 | `.catalog-rail .panel-heading .section-index` | global | display | TODO |
| 161 | 1103 | `.catalog-rail .panel-heading h2` | global | font-size | TODO |
| 162 | 1107 | `.debugger-shell.catalog-is-collapsed` | global | grid-template-columns | TODO |
| 163 | 1111 | `.workbench-main` | global | display, min-width, min-height, flex-direction | TODO |
| 164 | 1118 | `.workflow-toolbar` | global | display, min-height, align-items, justify-content, gap, padding, border-bottom, background | TODO |
| 165 | 1129 | `.workflow-toolbar h2` | global | margin-top, font-size | TODO |
| 166 | 1134 | `.workflow-toolbar .section-index` | global | font-size | TODO |
| 167 | 1138 | `.primary-workspace` | global | display, grid-template-columns, flex, min-width, min-height | TODO |
| 168 | 1146 | `.debugger-shell.inspector-is-collapsed .primary-workspace` | global | grid-template-columns | TODO |
| 169 | 1150 | `.workspace-mode` | global | display, min-width, flex-direction, gap | TODO |
| 170 | 1157 | `.workspace-mode > .panel, .workspace-mode > .operations-panel, .workspace-mode > .snapshot-panel` | global | min-width | TODO |
| 171 | 1163 | `.workspace-content` | global | display, min-width, min-height, flex, flex-direction, gap, padding, overflow | TODO |
| 172 | 1174 | `.workspace-content > .panel, .workspace-content > .operations-panel, .workspace-content > .snapshot-panel` | global | min-width | TODO |
| 173 | 1180 | `.workspace-content .operations-grid` | global | grid-template-columns | TODO |
| 174 | 1184 | `.workspace-content .snapshot-panel` | global | overflow | TODO |
| 175 | 1188 | `.inspector-rail` | global | display, min-width, min-height, flex-direction, padding, border-left, background | TODO |
| 176 | 1200 | `.inspector-rail > .inspector-object` | global | min-height, flex, overflow | TODO |
| 177 | 1206 | `.inspector-rail.collapsed` | global | padding | TODO |
| 178 | 1210 | `.inspector-placeholder` | global | display, min-height, flex-direction, align-items, justify-content, gap, margin-top, padding, border, background | TODO |
| 179 | 1223 | `.inspector-placeholder .placeholder-mark` | global | color, font | TODO |
| 180 | 1228 | `.inspector-placeholder h3` | global | margin, font-size | TODO |
| 181 | 1233 | `.inspector-placeholder p, .inspector-placeholder small` | global | margin, color, font-size, line-height | TODO |
| 182 | 1241 | `.inspector-placeholder small` | global | color | TODO |
| 183 | 1245 | `.workspace-notice` | global | padding, border-left, background | TODO |
| 184 | 1251 | `.diagnostics-dock` | global | flex, min-height, padding, border-top, background | TODO |
| 185 | 1259 | `.diagnostics-heading` | global | margin-bottom | TODO |
| 186 | 1263 | `.diagnostics-heading h2` | global | font-size | TODO |
| 187 | 1267 | `.diagnostics-content` | global | min-height, overflow | TODO |
| 188 | 1272 | `.diagnostics-content .error-message` | global | margin | TODO |
| 189 | 1276 | `.diagnostics-reopen` | global | align-self, margin, padding, border, background, color, cursor | TODO |
| 190 | 1286 | `.workbench-topbar + .debugger-shell ~ .footer-bar` | global | padding, background | TODO |
| 191 | 1293 | `.debugger-shell` | @media (min-width: 1600px) | grid-template-columns | TODO |
| 192 | 1296 | `.primary-workspace` | @media (min-width: 1600px) | grid-template-columns | TODO |
| 193 | 1299 | `.debugger-shell.catalog-is-collapsed` | @media (min-width: 1600px) | grid-template-columns | TODO |
| 194 | 1305 | `.primary-workspace` | @media (max-width: 1050px) | grid-template-columns | TODO |
| 195 | 1311 | `.debugger-shell, .debugger-shell.catalog-is-collapsed` | @media (max-width: 760px) | grid-template-columns | TODO |
| 196 | 1315 | `.catalog-rail` | @media (max-width: 760px) | border-right, border-bottom | TODO |
| 197 | 1319 | `.catalog-rail.collapsed > :not(.rail-heading)` | @media (max-width: 760px) | display | TODO |
| 198 | 1322 | `.primary-workspace, .debugger-shell.inspector-is-collapsed .primary-workspace` | @media (max-width: 760px) | grid-template-columns | TODO |
| 199 | 1326 | `.inspector-rail` | @media (max-width: 760px) | border-top, border-left | TODO |
| 200 | 1330 | `.inspector-rail.collapsed` | @media (max-width: 760px) | min-height | TODO |
| 201 | 1333 | `.inspector-rail.collapsed > :not(.rail-heading)` | @media (max-width: 760px) | display | TODO |
| 202 | 1336 | `.workflow-toolbar` | @media (max-width: 760px) | align-items, flex-direction | TODO |
| 203 | 1340 | `.toolbar-actions` | @media (max-width: 760px) | width | TODO |
| 204 | 1343 | `.diagnostics-dock` | @media (max-width: 760px) | min-height | TODO |
| 205 | 1347 | `/* Snapshot Compare: compact engineering controls and explicit first-divergence summary. */ .compare-controls` | global | display, grid-template-columns, align-items, gap, margin-top, padding, border, background | TODO |
| 206 | 1360 | `.compare-controls h3` | global | margin, font-size | TODO |
| 207 | 1361 | `.compare-controls label` | global | display, gap, color, font-size, text-transform, letter-spacing | TODO |
| 208 | 1362 | `.compare-controls select` | global | min-width, width, padding, color, background, border, font | TODO |
| 209 | 1371 | `.compare-results` | global | display, gap, margin-top | TODO |
| 210 | 1372 | `.compare-summary` | global | display, grid-template-columns, gap | TODO |
| 211 | 1373 | `.compare-summary > div` | global | min-width, padding, border | TODO |
| 212 | 1374 | `.compare-summary strong` | global | display, overflow-wrap, margin-top, font-size | TODO |
| 213 | 1375 | `.compare-metadata` | global | display, grid-template-columns, gap | TODO |
| 214 | 1376 | `.compare-metadata > div` | global | display, gap, min-width | TODO |
| 215 | 1377 | `.compare-metadata span` | global | color, font-size, text-transform | TODO |
| 216 | 1378 | `.compare-metadata code` | global | overflow-wrap, font-size | TODO |
| 217 | 1379 | `.difference-table` | global | min-width | TODO |
| 218 | 1380 | `.property-delta` | global | display, grid-template-columns, gap, padding | TODO |
| 219 | 1381 | `.property-delta strong` | global | color, font-weight | TODO |
| 220 | 1382 | `.property-delta span` | global | overflow-wrap, font-family, font-size | TODO |
| 221 | 1384 | `.compare-controls` | @media (max-width: 980px) | grid-template-columns | TODO |
| 222 | 1385 | `.compare-controls > div:first-child` | @media (max-width: 980px) | grid-column | TODO |
| 223 | 1386 | `.compare-controls > button` | @media (max-width: 980px) | justify-self | TODO |
| 224 | 1387 | `.compare-summary` | @media (max-width: 980px) | grid-template-columns | TODO |
| 225 | 1390 | `.compare-controls, .compare-summary, .compare-metadata` | @media (max-width: 560px) | grid-template-columns | TODO |
| 226 | 1391 | `.compare-controls > div:first-child` | @media (max-width: 560px) | grid-column | TODO |
| 227 | 1393 | `/* Origin SBar chart — engineering-terminal presentation. */ .origin-chart-panel` | global | min-width, margin-top, border, border-bottom, background | TODO |
| 228 | 1403 | `/* Origin range selection is a pointer-transparent overlay over the full chart. */ .origin-chart-viewport` | global | position, width, min-width | TODO |
| 229 | 1410 | `.origin-selection-overlay` | global | position, z-index, inset, overflow, pointer-events | TODO |
| 230 | 1418 | `.origin-selection-shade` | global | position, top, bottom, background | TODO |
| 231 | 1425 | `.origin-selection-line` | global | position, top, bottom, width | TODO |
| 232 | 1432 | `.origin-selection-line-start, .origin-selection-line-end` | global | background, box-shadow | TODO |
| 233 | 1438 | `.origin-selection-line-preview` | global | border-left | TODO |
| 234 | 1442 | `/* Run chart has an independent chart instance and no Origin range-selection state. */ .run-chart-panel` | global | display, min-width, min-height, flex, flex-direction, margin, overflow, border, background | TODO |
| 235 | 1455 | `.run-chart-heading` | global | display, min-width, min-height, flex, align-items, justify-content, gap, padding, border-bottom, background | TODO |
| 236 | 1468 | `.run-chart-heading .chart-heading-actions` | global | margin-left, flex | TODO |
| 237 | 1473 | `.run-chart-heading .chart-tool-button` | global | min-width, min-height, padding, border, border-radius, background, color, font | TODO |
| 238 | 1484 | `.run-chart-title` | global | display, min-width, align-items | TODO |
| 239 | 1490 | `.run-chart-title-line` | global | display, min-width, align-items, gap | TODO |
| 240 | 1497 | `.run-chart-name` | global | color, font, letter-spacing, white-space | TODO |
| 241 | 1504 | `.run-chart-stage` | global | position, min-width, min-height, flex, overflow, background | TODO |
| 242 | 1513 | `/* Replay delegates its chart runtime to ChartSurface while keeping its own header, layer legend, selection markers and interaction policy. */ .run-chart-surface` | global | position, inset, width, height, min-height | TODO |
| 243 | 1523 | `.run-chart-surface > .origin-chart-viewport` | global | min-height, height, flex | TODO |
| 244 | 1528 | `.run-chart-surface .origin-chart-host` | global | height | TODO |
| 245 | 1531 | `.run-chart-host` | global | position, inset, width, height, min-width | TODO |
| 246 | 1539 | `.run-structure-overlay` | global | position, z-index, inset, width, height, overflow, pointer-events | TODO |
| 247 | 1549 | `.replay-target-status` | global | display, align-items, margin-left, padding, border, color, background, font-size, font-weight, letter-spacing, white-space | TODO |
| 248 | 1563 | `.run-chart-legend` | global | pointer-events | TODO |
| 249 | 1567 | `.run-chart-legend .origin-chart-legend-item` | global | pointer-events, display, align-items, gap, padding, border, border-radius, background, color, font, cursor | TODO |
| 250 | 1581 | `.run-chart-legend .origin-chart-legend-item.active` | global | color | TODO |
| 251 | 1585 | `.run-chart-legend .origin-chart-legend-item:hover:not(:disabled)` | global | border-color, background | TODO |
| 252 | 1590 | `.run-chart-legend .origin-chart-legend-item:disabled` | global | opacity, cursor | TODO |
| 253 | 1595 | `.run-chart-message` | global | position, z-index, top, left, transform, width, max-width, margin, padding, border, background, color, font-size, line-height, text-align, pointer-events | TODO |
| 254 | 1614 | `/* Stable, chart-sized default state for an unavailable Live Replay projection. */ .run-chart-host.is-empty` | global | visibility | TODO |
| 255 | 1619 | `.run-chart-empty` | global | position, z-index, inset, display, min-width, min-height, place-items, padding, background, pointer-events | TODO |
| 256 | 1634 | `.run-chart-empty-card` | global | display, width, flex-direction, align-items, gap, padding, border, border-radius, background, text-align | TODO |
| 257 | 1647 | `.run-chart-empty-kicker` | global | color, font, letter-spacing | TODO |
| 258 | 1653 | `.run-chart-empty-title` | global | color, font, letter-spacing | TODO |
| 259 | 1659 | `.run-chart-empty-description` | global | max-width, margin, color, font-size, line-height | TODO |
| 260 | 1667 | `.run-chart-empty-flow` | global | display, align-items, justify-content, flex-wrap, gap, margin-top, color, font, letter-spacing | TODO |
| 261 | 1679 | `.run-chart-empty-flow i` | global | color, font-style | TODO |
| 262 | 1686 | `.run-chart-empty-card` | @media (max-width: 560px) | gap, padding | TODO |
| 263 | 1690 | `.run-chart-empty-title` | @media (max-width: 560px) | font-size | TODO |
| 264 | 1694 | `.run-chart-empty-flow` | @media (max-width: 560px) | gap, font-size | TODO |
| 265 | 1700 | `.run-chart-stage > .chart-error` | global | position, z-index, top, right, max-width, margin | TODO |
| 266 | 1709 | `.run-chart-legend` | global | position, z-index, top, right, bottom, left, display, align-items, flex-wrap, gap, color, font, pointer-events | TODO |
| 267 | 1725 | `/* Keep legend markers in the same visual state as their labels across all charts. */ .origin-chart-legend-item .legend-dot` | global | opacity | TODO |
| 268 | 1730 | `.origin-chart-legend-item:not(.active):not(:disabled) .legend-dot` | global | opacity | TODO |
| 269 | 1734 | `/* RunChart cannot inherit ChartSurface.vue's scoped marker-color rules. Use the same centralized tokens as Dataset for both legend color and geometry. */ .run-chart-legend .legend-dot` | global | display, width, height, flex, border-radius | TODO |
| 270 | 1744 | `.run-chart-legend .sbar-dot` | global | background | TODO |
| 271 | 1747 | `.run-chart-legend .cbar-dot` | global | background | TODO |
| 272 | 1750 | `.run-chart-legend .swing-dot` | global | background | TODO |
| 273 | 1753 | `.run-chart-legend .volume-dot` | global | background | TODO |
| 274 | 1756 | `.run-chart-legend .run-chart-structure-gap` | global | color, font-size, letter-spacing | TODO |
| 275 | 1764 | `.run-chart-heading` | @media (max-width: 720px) | align-items, flex-wrap, gap | TODO |
| 276 | 1771 | `.origin-chart-heading` | global | display, align-items, justify-content, gap, padding, border-bottom | TODO |
| 277 | 1780 | `.chart-bar-count` | global | color, font, white-space | TODO |
| 278 | 1786 | `.origin-structure-overlay` | global | position, z-index, inset, width, height, overflow, pointer-events | TODO |
| 279 | 1796 | `.origin-chart-host` | global | width, min-width, height | TODO |
| 280 | 1802 | `.origin-chart-empty` | global | display, min-height, place-items, padding, color, font-size | TODO |
| 281 | 1811 | `.chart-error` | global | margin | TODO |
| 282 | 1817 | `.origin-chart-host` | @media (max-width: 720px) | height | TODO |
| 283 | 1820 | `.origin-chart-heading` | @media (max-width: 720px) | align-items | TODO |
| 284 | 1825 | `/* Trading-workstation chart hierarchy: restrained chrome, readable market data, no plot grid. */ .chart-title-block` | global | display, min-width, gap | TODO |
| 285 | 1833 | `.chart-title-block h3` | global | font-size, letter-spacing | TODO |
| 286 | 1838 | `.chart-instrument` | global | max-width, overflow-wrap, color, font | TODO |
| 287 | 1845 | `.chart-heading-actions` | global | display, align-items, gap | TODO |
| 288 | 1851 | `.chart-tool-button` | global | min-width, padding, border, background, color, font, letter-spacing, cursor | TODO |
| 289 | 1862 | `.chart-tool-button:hover:not(:disabled)` | global | border-color, color | TODO |
| 290 | 1867 | `.chart-data-strip` | global | display, min-width, align-items, flex-wrap, gap, padding, border-bottom, background | TODO |
| 291 | 1878 | `.chart-data-strip > span` | global | display, min-width, align-items, gap, font | TODO |
| 292 | 1886 | `.chart-data-strip small` | global | color, font-size | TODO |
| 293 | 1891 | `.chart-data-strip strong` | global | color, font-weight, font-variant-numeric | TODO |
| 294 | 1897 | `.chart-data-strip > span:nth-child(2) strong` | global | color | TODO |
| 295 | 1901 | `.chart-data-strip > span:nth-child(3) strong` | global | color | TODO |
| 296 | 1905 | `.chart-data-strip .chart-latest-id` | global | flex, justify-content, overflow-wrap | TODO |
| 297 | 1911 | `.chart-data-strip .chart-latest-id strong` | global | color, overflow-wrap | TODO |
| 298 | 1916 | `.origin-chart-host` | global | height | TODO |
| 299 | 1922 | `.origin-chart-host` | @media (max-width: 720px) | height | TODO |
| 300 | 1925 | `.chart-data-strip .chart-latest-id` | @media (max-width: 720px) | flex-basis, justify-content | TODO |
| 301 | 1931 | `/* Dataset owns Catalog discovery; Replay and Compare reclaim the full workspace width. */ .debugger-shell.catalog-is-hidden` | global | grid-template-columns | TODO |
| 302 | 1936 | `.dataset-preparation-panel` | global | display, grid-template-columns, gap, padding, border-top | TODO |
| 303 | 1944 | `.dataset-preparation-panel > .panel` | global | min-width | TODO |
| 304 | 1950 | `.dataset-preparation-panel` | @media (min-width: 1100px) | grid-template-columns, align-items | TODO |
| 305 | 1955 | `/* Approved workbench reconstruction: dense, full-viewport engineering terminal. */ :root` | global | --dbg-bg, --dbg-surface-1, --dbg-surface-2, --dbg-surface-3, --dbg-border, --dbg-border-strong, --dbg-text-primary, --dbg-text-secondary, --dbg-text-muted, --dbg-text-disabled, --dbg-accent, --dbg-accent-hover, --dbg-accent-subtle, --dbg-success, --dbg-warning, --dbg-error, --dbg-info, --dbg-error-surface, --dbg-selection-border, --dbg-selection-surface, --dbg-chart-up, --dbg-chart-down, --dbg-chart-neutral, --dbg-chart-unprocessed, --dbg-chart-volume-up, --dbg-chart-volume-down, --dbg-chart-cbar, --dbg-chart-swing, --dbg-chart-trend, --dbg-chart-keyzone, --dbg-chart-crosshair, --dbg-legend-sbar, --dbg-legend-cbar, --dbg-legend-swing, --dbg-legend-volume, color, background, font-size | TODO |
| 306 | 1999 | `html, body, #app` | global | width, height, min-width, min-height, overflow | TODO |
| 307 | 2006 | `body` | global | background | TODO |
| 308 | 2007 | `.debugger-shell` | global | width, height, min-height, margin, padding, gap, overflow, background | TODO |
| 309 | 2017 | `.workbench-topbar` | global | position, z-index, display, flex, min-height, height, align-items, gap, padding, border-bottom, background | TODO |
| 310 | 2030 | `.brand-block` | global | min-width | TODO |
| 311 | 2031 | `.brand-block h1` | global | margin, font-size, line-height, font-weight, letter-spacing | TODO |
| 312 | 2038 | `.brand-block .eyebrow` | global | margin, color, font-size, letter-spacing | TODO |
| 313 | 2044 | `.workspace-switcher` | global | position, left, top, height, transform, flex-wrap, gap | TODO |
| 314 | 2053 | `.workspace-tab` | global | height, min-height, padding, border, border-radius, background, color, font | TODO |
| 315 | 2063 | `.workspace-tab.active` | global | border-color, background, color, box-shadow | TODO |
| 316 | 2069 | `.runtime-mark` | global | margin-left, font-size, white-space | TODO |
| 317 | 2074 | `.debugger-shell` | global | position, display, grid-template-columns, flex, min-height, overflow | TODO |
| 318 | 2082 | `.workbench-main` | global | min-height, overflow | TODO |
| 319 | 2086 | `.workflow-toolbar` | global | min-height, height, padding, gap, background, border-bottom | TODO |
| 320 | 2094 | `.workflow-toolbar h2` | global | font-size, letter-spacing | TODO |
| 321 | 2095 | `.workflow-toolbar .section-index` | global | font-size | TODO |
| 322 | 2096 | `.toolbar-actions` | global | flex-wrap | TODO |
| 323 | 2097 | `.subtle-button` | global | padding, border-radius, background, font-size | TODO |
| 324 | 2103 | `.primary-workspace` | global | display, grid-template-columns, min-height, overflow | TODO |
| 325 | 2109 | `.workspace-content` | global | min-height, gap, padding, overflow, background | TODO |
| 326 | 2116 | `.inspector-rail` | global | min-height, padding, overflow, border, background | TODO |
| 327 | 2123 | `.rail-heading` | global | position, top, z-index, min-height, height, padding, border-bottom, background | TODO |
| 328 | 2133 | `.rail-heading .section-index` | global | color | TODO |
| 329 | 2134 | `.inspector-placeholder` | global | min-height, margin, padding, gap, border, background | TODO |
| 330 | 2142 | `.inspector-placeholder .placeholder-mark` | global | font-size | TODO |
| 331 | 2143 | `.inspector-placeholder h3` | global | font-size | TODO |
| 332 | 2144 | `.inspector-placeholder p, .inspector-placeholder small` | global | font-size | TODO |
| 333 | 2145 | `.catalog-rail` | global | position, z-index, left, top, bottom, width, padding, border, background, box-shadow | TODO |
| 334 | 2157 | `.catalog-rail.collapsed` | global | width | TODO |
| 335 | 2158 | `.debugger-shell.catalog-is-hidden .catalog-rail` | global | display | TODO |
| 336 | 2159 | `.catalog-rail .rail-heading` | global | margin | TODO |
| 337 | 2160 | `.catalog-rail .catalog-panel` | global | margin-top | TODO |
| 338 | 2161 | `.catalog-rail .instrument-group-row` | global | padding | TODO |
| 339 | 2162 | `.catalog-rail .dataset-row` | global | padding | TODO |
| 340 | 2163 | `.catalog-rail .load-options` | global | margin-top, padding-top | TODO |
| 341 | 2164 | `.dataset-preparation-panel` | global | display, grid-template-columns, gap, padding, border-top | TODO |
| 342 | 2171 | `.dataset-preparation-panel > .panel` | global | padding | TODO |
| 343 | 2172 | `.origin-chart-panel, .run-chart-panel` | global | margin, border-color, border-radius, background | TODO |
| 344 | 2178 | `.origin-chart-heading` | global | min-height, padding, align-items, background, border-bottom-color | TODO |
| 345 | 2185 | `.chart-title-block` | global | gap | TODO |
| 346 | 2186 | `.chart-title-block h3` | global | font-size, letter-spacing | TODO |
| 347 | 2187 | `.chart-title-block .section-index` | global | font-size | TODO |
| 348 | 2188 | `.chart-instrument` | global | font-size | TODO |
| 349 | 2189 | `.chart-bar-count` | global | font-size | TODO |
| 350 | 2190 | `.chart-data-strip` | global | gap, padding, background, border-bottom-color | TODO |
| 351 | 2196 | `.chart-data-strip > span` | global | font-size | TODO |
| 352 | 2197 | `.chart-data-strip small` | global | font-size | TODO |
| 353 | 2198 | `.chart-data-strip strong` | global | font-size | TODO |
| 354 | 2199 | `.origin-chart-host` | global | height | TODO |
| 355 | 2200 | `.run-chart-host` | global | height | TODO |
| 356 | 2201 | `.chart-selection-hint` | global | margin, font-size | TODO |
| 357 | 2202 | `.diagnostics-dock` | global | position, z-index, flex, min-height, height, padding, overflow, border, border-left, border-right, border-radius, background | TODO |
| 358 | 2216 | `/* Let an open Diagnostics dock menu escape the panel's normal clipping. */ .diagnostics-dock:has(.dock-menu[open])` | global | overflow | TODO |
| 359 | 2221 | `.diagnostics-heading` | global | min-height, height, margin, padding, border-bottom, background | TODO |
| 360 | 2229 | `.diagnostics-heading h2` | global | font-size | TODO |
| 361 | 2230 | `.diagnostics-content` | global | min-height, height, padding, overflow | TODO |
| 362 | 2236 | `.diagnostics-reopen` | global | position, z-index, right, bottom, margin, font-size | TODO |
| 363 | 2244 | `.footer-bar` | global | display | TODO |
| 364 | 2247 | `.panel, .operations-panel, .snapshot-panel` | global | border-color, background | TODO |
| 365 | 2251 | `.panel-heading` | global | min-height, margin-bottom | TODO |
| 366 | 2255 | `h2` | global | font-size | TODO |
| 367 | 2256 | `h3` | global | font-size | TODO |
| 368 | 2257 | `.metric, .origin-identity, .range-summary > div` | global | background | TODO |
| 369 | 2258 | `.primary-button` | global | width, padding, border-radius, font-size | TODO |
| 370 | 2264 | `.compare-controls` | global | gap, margin-top, padding, background | TODO |
| 371 | 2270 | `.compare-summary > div` | global | padding | TODO |
| 372 | 2271 | `.snapshot-panel` | global | padding | TODO |
| 373 | 2272 | `table` | global | font-size | TODO |
| 374 | 2273 | `th, td` | global | padding | TODO |
| 375 | 2274 | `.error-message` | global | padding, font-size | TODO |
| 376 | 2275 | `.empty-state` | global | padding, font-size | TODO |
| 377 | 2277 | `.dataset-preparation-panel` | @media (max-width: 1100px) | grid-template-columns | TODO |
| 378 | 2279 | `/* Native dock splitters: pointer-driven, bounded resizing with visible grab affordance. */ .primary-workspace` | global | grid-template-columns | TODO |
| 379 | 2285 | `.diagnostics-dock` | global | flex-basis, height, min-height | TODO |
| 380 | 2290 | `.panel-resize-edge` | global | position, z-index, background, touch-action | TODO |
| 381 | 2296 | `.panel-resize-edge:hover, .panel-resize-edge:active` | global | background | TODO |
| 382 | 2300 | `.panel-resize-edge:focus-visible` | global | outline, outline-offset, background | TODO |
| 383 | 2305 | `.inspector-resize-edge` | global | left, top, bottom, width, cursor | TODO |
| 384 | 2312 | `.diagnostics-resize-edge` | global | top, left, right, height, cursor | TODO |
| 385 | 2319 | `.inspector-rail` | global | position | TODO |
| 386 | 2320 | `.diagnostics-dock` | global | position | TODO |
| 387 | 2321 | `.inspector-rail.collapsed .inspector-resize-edge` | global | display | TODO |
| 388 | 2322 | `/* Inspector side docking uses the primary workspace's column tracks. */ .primary-workspace.inspector-dock-left` | global | grid-template-columns | TODO |
| 389 | 2329 | `.primary-workspace.inspector-dock-left .inspector-rail` | global | grid-column, grid-row, border-right, border-left | TODO |
| 390 | 2335 | `.primary-workspace.inspector-dock-left .workspace-content` | global | grid-column, grid-row | TODO |
| 391 | 2339 | `.primary-workspace.inspector-dock-left .inspector-resize-edge` | global | left, right | TODO |
| 392 | 2343 | `.dock-actions` | global | display, align-items, gap | TODO |
| 393 | 2348 | `.dock-menu` | global | position, display, flex | TODO |
| 394 | 2353 | `.dock-menu > summary` | global | display, align-items, justify-content, min-width, list-style, cursor, user-select | TODO |
| 395 | 2362 | `.dock-menu > summary::-webkit-details-marker` | global | display | TODO |
| 396 | 2363 | `.dock-menu > summary::marker` | global | content | TODO |
| 397 | 2364 | `/* Dock-header icon controls are borderless at rest; hovering reveals a frame. */ .inspector-rail .rail-heading > .dock-menu > summary, .inspector-rail .rail-heading > .rail-toggle, .diagnostics-dock .dock-actions > .dock-menu > summary, .diagnostics-dock .dock-actions > [data-testid="diagnostics-collapse-toggle"]` | global | width, min-width, height, padding, border, border-radius, background, color, box-shadow | TODO |
| 398 | 2380 | `.inspector-rail .rail-heading > .dock-menu > summary:hover, .inspector-rail .rail-heading > .rail-toggle:hover, .diagnostics-dock .dock-actions > .dock-menu > summary:hover, .diagnostics-dock .dock-actions > [data-testid="diagnostics-collapse-toggle"]:hover` | global | border-color, background, color | TODO |
| 399 | 2389 | `.dock-menu[open] > summary` | global | color, background, box-shadow | TODO |
| 400 | 2395 | `.dock-menu-options` | global | position, z-index, top, right, display, grid-template-columns, min-width, padding, gap, border, border-radius, background, box-shadow | TODO |
| 401 | 2410 | `.dock-menu-option` | global | min-height, padding, border, border-radius, background, color, text-align, font, letter-spacing, cursor | TODO |
| 402 | 2422 | `.dock-menu-option:hover` | global | border-color, background, color | TODO |
| 403 | 2427 | `.dock-menu-option[aria-pressed="true"]` | global | background, color | TODO |
| 404 | 2431 | `.dock-menu-option[aria-pressed="true"]::before` | global | content | TODO |
| 405 | 2434 | `.dock-menu summary:focus-visible, .dock-menu-option:focus-visible` | global | outline, outline-offset | TODO |
| 406 | 2439 | `.dock-actions .subtle-button` | global | flex | TODO |
| 407 | 2440 | `/* Object Inspector — exact fields from the currently selected authoritative SBar. */ .inspector-object` | global | min-width, padding | TODO |
| 408 | 2448 | `.inspector-runtime-context` | global | display, min-width, flex-wrap, gap, margin, padding, border-bottom, color, font, letter-spacing | TODO |
| 409 | 2460 | `.inspector-runtime-context span` | global | min-width, overflow-wrap | TODO |
| 410 | 2465 | `.inspector-runtime-context code` | global | color, font | TODO |
| 411 | 2470 | `.inspector-object-heading` | global | display, min-width, align-items, justify-content, gap, padding-bottom, border-bottom | TODO |
| 412 | 2480 | `.inspector-object-heading .section-index` | global | margin, font-size | TODO |
| 413 | 2484 | `.inspector-object-heading h3` | global | margin, color, font-size | TODO |
| 414 | 2489 | `.inspector-object-kind` | global | flex, padding, border, color, font, letter-spacing | TODO |
| 415 | 2497 | `.inspector-fields` | global | display, gap, margin | TODO |
| 416 | 2502 | `.inspector-field` | global | display, min-width, grid-template-columns, gap, padding, border-bottom | TODO |
| 417 | 2510 | `.inspector-field dt, .inspector-market-grid dt` | global | color, font, text-transform, letter-spacing | TODO |
| 418 | 2517 | `.inspector-field dd, .inspector-market-grid dd` | global | min-width, margin, color, font, font-variant-numeric, overflow-wrap | TODO |
| 419 | 2526 | `.inspector-field code` | global | color, font, user-select | TODO |
| 420 | 2531 | `.inspector-subsection` | global | margin-top | TODO |
| 421 | 2534 | `.inspector-subsection > .section-index` | global | margin, font-size | TODO |
| 422 | 2538 | `.inspector-market-grid` | global | display, grid-template-columns, gap, margin, background, border | TODO |
| 423 | 2546 | `.inspector-market-grid > div` | global | display, min-width, gap, padding, background | TODO |
| 424 | 2553 | `.inspector-market-grid dd` | global | font-size | TODO |
| 425 | 2556 | `.inspector-market-grid .inspector-volume` | global | grid-column, grid-template-columns, align-items | TODO |
| 426 | 2561 | `.inspector-copy-status` | global | margin, color, font, letter-spacing | TODO |
| 427 | 2567 | `.inspector-provenance` | global | margin, color, font-size, line-height | TODO |
| 428 | 2574 | `.inspector-empty` | global | display, min-width, min-height, flex-direction, align-items, justify-content, gap, margin, padding, border, background | TODO |
| 429 | 2587 | `.inspector-empty .placeholder-mark` | global | color, font | TODO |
| 430 | 2591 | `.inspector-empty h3` | global | margin, font-size | TODO |
| 431 | 2595 | `.inspector-empty p, .inspector-empty small` | global | margin, color, font-size, line-height, overflow-wrap | TODO |
| 432 | 2603 | `.inspector-empty small` | global | color | TODO |
| 433 | 2606 | `.difference-row-selected` | global | background | TODO |
| 434 | 2608 | `.difference-select-button` | global | max-width, padding, border, background, color, font, text-align, overflow-wrap, cursor | TODO |
| 435 | 2619 | `.difference-select-button:hover, .difference-select-button:focus-visible` | global | border-color, outline | TODO |
| 436 | 2621 | `.difference-select-button.selected` | global | border-color, color | TODO |
| 437 | 2622 | `.inspector-difference-properties` | global | display, gap | TODO |
| 438 | 2623 | `.inspector-difference-property` | global | min-width, padding-top, border-top | TODO |
| 439 | 2624 | `.inspector-difference-property > strong` | global | display, margin-bottom, font-size, overflow-wrap | TODO |
| 440 | 2625 | `.inspector-difference-values` | global | display, gap | TODO |
| 441 | 2626 | `.inspector-difference-values > div` | global | display, grid-template-columns, gap | TODO |
| 442 | 2627 | `.inspector-difference-values span` | global | color, font-size, letter-spacing | TODO |
| 443 | 2628 | `.inspector-difference-values code` | global | color, font-size, white-space, overflow-wrap | TODO |
| 444 | 2629 | `.difference-kind-added` | global | color | TODO |
| 445 | 2630 | `.difference-kind-removed` | global | color | TODO |
| 446 | 2631 | `.difference-kind-modified` | global | color | TODO |
| 447 | 2632 | `.inspector-object-list` | global | display, gap, max-height, overflow | TODO |
| 448 | 2639 | `.inspector-object-row` | global | display, min-width, align-items, justify-content, gap, padding, border, background, color, text-align, cursor | TODO |
| 449 | 2652 | `.inspector-object-row > span` | global | display, min-width, gap | TODO |
| 450 | 2657 | `.inspector-object-row strong, .inspector-object-row code` | global | font-size, overflow-wrap | TODO |
| 451 | 2662 | `.inspector-object-row small` | global | color, font-size, overflow-wrap | TODO |
| 452 | 2667 | `.inspector-object-row:hover, .inspector-object-row:focus-visible` | global | border-color, outline | TODO |
| 453 | 2672 | `.inspector-object-row.selected` | global | border-color, background | TODO |
| 454 | 2676 | `.inspector-list-heading` | global | margin-top | TODO |
| 455 | 2677 | `/* Native drag handles for changing a panel's dock without moving its contents. */ .panel-dock-drag-handle` | global | cursor, user-select, border-bottom | TODO |
| 456 | 2684 | `.panel-dock-drag-handle:hover` | global | color, border-bottom-color | TODO |
| 457 | 2689 | `.panel-dock-drag-handle:active` | global | cursor | TODO |
| 458 | 2693 | `/* Replay / Compare dual-chart workspace shell. */ .dual-chart-stack` | global | --upper-chart-track, --lower-chart-track, display, grid-template-rows, flex, min-width, min-height, overflow, border, background | TODO |
| 459 | 2712 | `.dual-chart-track` | global | display, min-width, min-height, flex-direction, overflow | TODO |
| 460 | 2720 | `.dual-chart-track > *` | global | flex, min-width, min-height, height | TODO |
| 461 | 2727 | `.dual-chart-track > .run-chart-panel` | global | display, min-height, flex-direction, border, border-radius | TODO |
| 462 | 2735 | `.dual-chart-track .run-chart-host` | global | flex, min-height, height | TODO |
| 463 | 2741 | `.dual-chart-splitter` | global | position, z-index, display, min-height, align-items, justify-content, border, background, cursor, touch-action | TODO |
| 464 | 2754 | `.dual-chart-splitter:hover, .dual-chart-splitter:focus-visible` | global | background | TODO |
| 465 | 2759 | `/* The splitter is programmatically focused on hover for immediate arrow-key resizing. Suppress browser/user-agent focus rings so moving across the chart boundary never flashes a border, including after keyboard input makes :focus-visible match. */ .dual-chart-splitter:focus, .dual-chart-splitter:focus-visible` | global | outline, box-shadow | TODO |
| 466 | 2768 | `.snapshot-reference-panel, .comparison-chart-panel` | global | display, min-width, min-height, height, border-top, flex-direction, overflow, background | TODO |
| 467 | 2780 | `.snapshot-reference-heading` | global | display, min-height, align-items, justify-content, gap, padding, border-bottom, background | TODO |
| 468 | 2791 | `.comparison-chart-heading` | global | display, flex, min-height, align-items, justify-content, gap, padding, border-bottom, background | TODO |
| 469 | 2803 | `.snapshot-reference-title` | global | display, min-width, align-items, gap | TODO |
| 470 | 2810 | `.snapshot-reference-sync-indicator` | global | display, flex, align-items, justify-content, color, font, cursor | TODO |
| 471 | 2820 | `.snapshot-reference-heading h3` | global | margin, font-size, letter-spacing | TODO |
| 472 | 2826 | `.comparison-chart-heading h3` | global | min-width, margin, font-size, line-height, letter-spacing | TODO |
| 473 | 2834 | `.snapshot-reference-select` | global | position, display, min-width, align-items, gap, color, font | TODO |
| 474 | 2844 | `.snapshot-reference-instrument` | global | max-width, overflow, color, text-overflow, white-space | TODO |
| 475 | 2852 | `.snapshot-reference-control` | global | position, display, min-width, flex, font, cursor | TODO |
| 476 | 2861 | `.snapshot-reference-control::after` | global | position, top, right, width, height, border-right, border-bottom, content, pointer-events, transform | TODO |
| 477 | 2874 | `.snapshot-reference-selected-label` | global | position, z-index, right, bottom, left, display, overflow, color, font, line-height, pointer-events, white-space | TODO |
| 478 | 2889 | `.snapshot-reference-select select` | global | width, min-width, height, padding, appearance, border, border-radius, background, color, font, color-scheme | TODO |
| 479 | 2903 | `.snapshot-reference-select select option` | global | background, color | TODO |
| 480 | 2908 | `.snapshot-reference-select select:hover:not(:disabled)` | global | background | TODO |
| 481 | 2912 | `.snapshot-reference-select select:focus-visible` | global | outline | TODO |
| 482 | 2916 | `.snapshot-reference-select select:disabled` | global | color, cursor, opacity | TODO |
| 483 | 2922 | `.snapshot-reference-select select option` | global | background, color | TODO |
| 484 | 2927 | `.snapshot-reference-stage` | global | position, display, min-width, min-height, flex, align-items, justify-content, padding, overflow, background | TODO |
| 485 | 2940 | `.snapshot-reference-stage.has-reference` | global | align-items, justify-content | TODO |
| 486 | 2945 | `.snapshot-reference-stage.has-reference` | global | padding, overflow | TODO |
| 487 | 2950 | `.snapshot-reference-loading` | global | display, min-width, flex-direction, align-items, justify-content, gap, padding, color, text-align, font | TODO |
| 488 | 2963 | `.snapshot-reference-loading strong` | global | color, font-size, font-weight, letter-spacing | TODO |
| 489 | 2970 | `.snapshot-reference-loading-spinner` | global | width, height, border, border-top-color, border-radius, animation | TODO |
| 490 | 2981 | `to` | @keyframes snapshot-reference-spin | transform | TODO |
| 491 | 2985 | `.snapshot-reference-loading-spinner` | @media (prefers-reduced-motion: reduce) | animation-duration | TODO |
| 492 | 2989 | `.snapshot-reference-chart` | global | display, width, height, min-width, min-height, overflow | TODO |
| 493 | 2998 | `.snapshot-reference-chart > .origin-chart-panel` | global | width, height, min-width, min-height | TODO |
| 494 | 3005 | `.reference-status-dot-error` | global | background | TODO |
| 495 | 3009 | `.snapshot-reference-state` | global | display, width, flex-direction, gap, padding, border, background | TODO |
| 496 | 3019 | `.snapshot-reference-identity` | global | display, min-width, align-items, gap, font | TODO |
| 497 | 3027 | `.snapshot-reference-identity strong` | global | overflow-wrap, color | TODO |
| 498 | 3032 | `.reference-status-dot` | global | width, height, flex, border-radius, background | TODO |
| 499 | 3040 | `.reference-tag, .comparison-chart-state` | global | padding, border, color, font, letter-spacing | TODO |
| 500 | 3049 | `.snapshot-reference-unavailable, .snapshot-reference-empty p, .comparison-chart-empty p` | global | max-width, margin, color, font-size, line-height | TODO |
| 501 | 3059 | `.snapshot-reference-empty, .comparison-chart-empty` | global | display, min-width, flex-direction, align-items, justify-content, gap | TODO |
| 502 | 3069 | `.snapshot-reference-empty strong, .comparison-chart-empty strong` | global | color, font-size, font-weight | TODO |
| 503 | 3076 | `.snapshot-reference-foot` | global | display, height, min-height, min-width, flex, align-items, gap, padding, overflow, background, color, font, letter-spacing | TODO |
| 504 | 3092 | `.snapshot-reference-foot span` | global | min-width, overflow, text-overflow, white-space | TODO |
| 505 | 3099 | `.snapshot-reference-foot b` | global | color, font-weight, letter-spacing | TODO |
| 506 | 3105 | `.snapshot-reference-foot .snapshot-reference-state-key` | global | margin-left | TODO |
| 507 | 3109 | `.comparison-chart-state` | global | flex, white-space | TODO |
| 508 | 3114 | `.comparison-chart-empty > span` | global | color, font, letter-spacing | TODO |
| 509 | 3122 | `.dual-chart-stack` | @media (max-height: 760px) | flex-basis, grid-template-rows | TODO |
| 510 | 3129 | `.snapshot-reference-foot` | @media (max-height: 760px) | gap, flex-wrap, padding | TODO |
| 511 | 3136 | `/* Explicit App Shell geometry: four direct regions; chart content begins below the 44px Topbar. */ .debugger-shell` | global | position, display, flex, min-width, min-height, overflow | TODO |
| 512 | 3149 | `.workbench-main` | global | position, inset, display, min-width, min-height, flex-direction | TODO |
| 513 | 3162 | `/* Keep the Chart Workspace edge 5px above bottom-docked Diagnostics, matching the Inspector-to-Diagnostics gap without shrinking chart content internally. */ .debugger-shell.diagnostics-dock-bottom .workbench-main` | global | bottom | TODO |
| 514 | 3172 | `.chart-panels` | global | display, grid-template-columns, flex, min-width, min-height, overflow | TODO |
| 515 | 3181 | `.chart-panels.catalog-is-collapsed` | global | grid-template-columns | TODO |
| 516 | 3185 | `.debugger-shell.catalog-is-hidden .chart-panels` | global | grid-template-columns | TODO |
| 517 | 3189 | `.chart-panels > .catalog-rail` | global | min-width, min-height, padding, overflow, border-right, background | TODO |
| 518 | 3198 | `.chart-panels > .catalog-rail.collapsed` | global | padding | TODO |
| 519 | 3202 | `.chart-panels > .catalog-rail.collapsed > :not(.rail-heading)` | global | display | TODO |
| 520 | 3206 | `.chart-panels > .workspace-content` | global | min-width, min-height, flex, overflow | TODO |
| 521 | 3213 | `.inspector-rail` | global | position, z-index, display, min-width, min-height, flex-direction, padding, overflow, border, background | TODO |
| 522 | 3226 | `.inspector-rail.dock-left, .inspector-rail.dock-right` | global | bottom, width | TODO |
| 523 | 3235 | `.inspector-rail.dock-left` | global | left, right, border-right | TODO |
| 524 | 3241 | `.inspector-rail.dock-right` | global | right, left, border-left | TODO |
| 525 | 3247 | `.inspector-rail.dock-top, .inspector-rail.dock-bottom` | global | right, height, flex-direction | TODO |
| 526 | 3257 | `.inspector-rail.dock-top` | global | top, bottom, border-bottom | TODO |
| 527 | 3263 | `.inspector-rail.dock-bottom` | global | bottom, top, border-top | TODO |
| 528 | 3269 | `.inspector-rail.collapsed.dock-left, .inspector-rail.collapsed.dock-right` | global | width, padding | TODO |
| 529 | 3275 | `.inspector-rail.collapsed.dock-top, .inspector-rail.collapsed.dock-bottom` | global | height, min-height, padding | TODO |
| 530 | 3282 | `.inspector-rail.collapsed > :not(.rail-heading)` | global | display | TODO |
| 531 | 3286 | `.inspector-rail .rail-heading` | global | position, flex, min-height, padding, border-bottom, background | TODO |
| 532 | 3295 | `.inspector-rail .panel-title` | global | color, font-size, font-weight, letter-spacing, text-transform, white-space | TODO |
| 533 | 3304 | `.inspector-rail .inspector-object-tag` | global | padding | TODO |
| 534 | 3308 | `.inspector-rail.collapsed .panel-title` | global | writing-mode, transform, letter-spacing | TODO |
| 535 | 3314 | `.inspector-rail.collapsed .inspector-object-tag, .inspector-rail.collapsed .dock-menu` | global | display | TODO |
| 536 | 3319 | `.inspector-rail.collapsed .rail-heading` | global | min-height, padding | TODO |
| 537 | 3324 | `.inspector-rail.collapsed .rail-heading.collapsed-heading-click-target` | global | cursor | TODO |
| 538 | 3328 | `.inspector-rail .panel-resize-edge` | global | position, z-index | TODO |
| 539 | 3333 | `.inspector-rail.dock-left .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 540 | 3338 | `.inspector-rail.dock-right .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 541 | 3343 | `.inspector-rail.dock-top .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 542 | 3348 | `.inspector-rail.dock-bottom .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 543 | 3353 | `.inspector-rail.collapsed .inspector-resize-edge` | global | display | TODO |
| 544 | 3357 | `.inspector-rail.dock-left .dock-menu-options, .inspector-rail.dock-right .dock-menu-options` | global | right | TODO |
| 545 | 3362 | `.diagnostics-dock` | global | position, z-index, display, min-width, min-height, padding, overflow, border, background | TODO |
| 546 | 3374 | `.diagnostics-dock.dock-left, .diagnostics-dock.dock-right` | global | top, bottom, width, height, flex-direction | TODO |
| 547 | 3383 | `.diagnostics-dock.dock-left` | global | left, right, border-right | TODO |
| 548 | 3385 | `.diagnostics-dock.dock-right` | global | right, left, border-left | TODO |
| 549 | 3386 | `.diagnostics-dock.dock-top, .diagnostics-dock.dock-bottom` | global | left, right, width, height, flex-direction | TODO |
| 550 | 3395 | `.diagnostics-dock.dock-top` | global | top, bottom, border-bottom | TODO |
| 551 | 3397 | `.diagnostics-dock.dock-bottom` | global | bottom, top, border-top | TODO |
| 552 | 3398 | `.diagnostics-dock .diagnostics-heading` | global | position, display, flex, min-width, min-height, align-items, gap, margin, padding, background | TODO |
| 553 | 3411 | `.diagnostics-dock .diagnostics-title-block` | global | display, flex, min-width, align-items, gap | TODO |
| 554 | 3419 | `.diagnostics-dock .diagnostics-title-block` | global | gap | TODO |
| 555 | 3423 | `.diagnostics-dock .diagnostics-panel-title` | global | color, font-size, font-weight, letter-spacing, text-transform, white-space | TODO |
| 556 | 3432 | `.diagnostics-dock .diagnostics-tabs` | global | display, flex, align-self, align-items, gap, min-width, overflow-x, scrollbar-width, scrollbar-color | TODO |
| 557 | 3444 | `.diagnostics-dock .diagnostics-tabs button` | global | flex, height, padding, border, border-bottom, border-radius, background, color, font-size, white-space, cursor | TODO |
| 558 | 3458 | `.diagnostics-dock .diagnostics-tabs button.active` | global | border-bottom-color, color | TODO |
| 559 | 3463 | `.diagnostics-dock .dock-actions` | global | display, flex, align-items, justify-content, gap | TODO |
| 560 | 3471 | `.diagnostics-dock .diagnostics-content` | global | flex, width, height, min-width, min-height, overflow | TODO |
| 561 | 3480 | `.diagnostics-dock .panel-resize-edge` | global | position, z-index | TODO |
| 562 | 3482 | `.diagnostics-dock.dock-left .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 563 | 3487 | `.diagnostics-dock.dock-right .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 564 | 3492 | `.diagnostics-dock.dock-top .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 565 | 3497 | `.diagnostics-dock.dock-bottom .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | TODO |
| 566 | 3502 | `/* Side docks stack the title row above the category row, as in the frozen prototype. */ .diagnostics-dock.dock-left .diagnostics-heading, .diagnostics-dock.dock-right .diagnostics-heading` | global | min-height, align-items, flex-direction, gap, padding | TODO |
| 567 | 3512 | `.diagnostics-dock.dock-left .diagnostics-title-block, .diagnostics-dock.dock-right .diagnostics-title-block` | global | min-height | TODO |
| 568 | 3517 | `.diagnostics-dock.dock-left .diagnostics-tabs, .diagnostics-dock.dock-right .diagnostics-tabs` | global | flex, width, height, min-height | TODO |
| 569 | 3525 | `.diagnostics-dock.dock-left .dock-actions, .diagnostics-dock.dock-right .dock-actions` | global | position, top, right | TODO |
| 570 | 3532 | `.diagnostics-dock.dock-left .diagnostics-title-block, .diagnostics-dock.dock-right .diagnostics-title-block` | global | padding-right | TODO |
| 571 | 3537 | `/* Horizontal docks hide only the title block. Categories lead the row and the same action controls follow immediately on their right. */ .diagnostics-dock.dock-top .diagnostics-heading, .diagnostics-dock.dock-bottom .diagnostics-heading` | global | min-height, height, flex-direction, gap, padding, border-bottom | TODO |
| 572 | 3549 | `.diagnostics-dock.dock-top .diagnostics-title-block, .diagnostics-dock.dock-bottom .diagnostics-title-block` | global | display | TODO |
| 573 | 3554 | `.diagnostics-dock.dock-top .diagnostics-tabs, .diagnostics-dock.dock-bottom .diagnostics-tabs` | global | flex, min-width, order | TODO |
| 574 | 3561 | `.diagnostics-dock.dock-top .dock-actions, .diagnostics-dock.dock-bottom .dock-actions` | global | position, order, margin-left | TODO |
| 575 | 3568 | `.diagnostics-reopen` | global | position, z-index, margin | TODO |
| 576 | 3574 | `.debugger-shell.diagnostics-dock-left .diagnostics-reopen` | global | left, top, right, bottom, writing-mode | TODO |
| 577 | 3576 | `.debugger-shell.diagnostics-dock-right .diagnostics-reopen` | global | right, top, left, bottom, writing-mode | TODO |
| 578 | 3577 | `.debugger-shell.diagnostics-dock-top .diagnostics-reopen` | global | left, top, right, bottom | TODO |
| 579 | 3578 | `.debugger-shell.diagnostics-dock-bottom .diagnostics-reopen` | global | left, bottom, right, top | TODO |
| 580 | 3579 | `.diagnostics-dock.dock-top .dock-menu-options, .diagnostics-dock.dock-bottom .dock-menu-options, .inspector-rail.dock-top .dock-menu-options, .inspector-rail.dock-bottom .dock-menu-options` | global | grid-template-columns, min-width | TODO |
| 581 | 3589 | `.chart-panels` | @media (min-width: 1600px) | grid-template-columns | TODO |
| 582 | 3590 | `.chart-panels.catalog-is-collapsed` | @media (min-width: 1600px) | grid-template-columns | TODO |
| 583 | 3594 | `.chart-panels, .chart-panels.catalog-is-collapsed, .debugger-shell.catalog-is-hidden .chart-panels` | @media (max-width: 760px) | grid-template-columns | TODO |
| 584 | 3599 | `.chart-panels > .catalog-rail` | @media (max-width: 760px) | max-height, border-right, border-bottom | TODO |
| 585 | 3606 | `/* Prototype spacing pass — keep the workbench dense and align controls to shared rows. */ :root` | global | line-height | TODO |
| 586 | 3611 | `.debugger-shell` | global | gap | TODO |
| 587 | 3615 | `.workflow-toolbar` | global | display, flex, min-width, align-items, justify-content, gap, padding, overflow | TODO |
| 588 | 3626 | `.workflow-toolbar > div:first-child` | global | display, min-width, align-items, gap | TODO |
| 589 | 3633 | `.workflow-toolbar .section-index` | global | flex, margin, white-space, letter-spacing | TODO |
| 590 | 3640 | `.workflow-toolbar h2` | global | min-width, margin, line-height, white-space | TODO |
| 591 | 3647 | `.toolbar-actions` | global | display, flex, align-items, gap, margin-left | TODO |
| 592 | 3655 | `.subtle-button` | global | min-height, padding, line-height | TODO |
| 593 | 3661 | `.chart-panels` | global | gap | TODO |
| 594 | 3665 | `.chart-panels > .catalog-rail` | global | padding, border-right | TODO |
| 595 | 3670 | `.chart-panels > .workspace-content` | global | display, min-width, min-height, flex-direction, gap, padding, overflow | TODO |
| 596 | 3680 | `.workspace-mode` | global | min-width, min-height | TODO |
| 597 | 3685 | `.replay-controls, .compare-workspace` | global | display, flex, flex-direction, gap | TODO |
| 598 | 3693 | `.replay-controls > .dual-chart-stack, .compare-workspace > .dual-chart-stack` | global | flex, min-width, min-height | TODO |
| 599 | 3700 | `.inspector-rail` | global | padding | TODO |
| 600 | 3704 | `.inspector-rail .rail-heading` | global | display, flex, min-width, align-items, gap, margin, padding, border-bottom, background | TODO |
| 601 | 3716 | `.inspector-rail .rail-heading .panel-dock-drag-handle` | global | min-width, margin, white-space | TODO |
| 602 | 3722 | `.inspector-rail .rail-heading .dock-menu` | global | margin-left | TODO |
| 603 | 3726 | `.inspector-rail > .inspector-object` | global | min-width, min-height, flex, overflow | TODO |
| 604 | 3733 | `.diagnostics-dock .diagnostics-heading` | global | flex, min-height, padding | TODO |
| 605 | 3739 | `.diagnostics-dock .diagnostics-content` | global | padding | TODO |
| 606 | 3745 | `.workflow-toolbar` | @media (max-width: 1100px) | gap, padding-inline | TODO |
| 607 | 3749 | `.workflow-toolbar > div:first-child` | @media (max-width: 1100px) | gap | TODO |
| 608 | 3753 | `.workflow-toolbar h2` | @media (max-width: 1100px) | overflow, text-overflow | TODO |
| 609 | 3758 | `.toolbar-actions` | @media (max-width: 1100px) | gap | TODO |
| 610 | 3763 | `/* Match the frozen prototype's Topbar tab anchor and compact control geometry. */ .workbench-topbar .workspace-tabs` | global | position, top, left, height, transform, z-index, flex, gap | TODO |
| 611 | 3775 | `.workbench-topbar .workspace-tab` | global | height, min-height, padding, line-height, font-family, font-size, letter-spacing | TODO |
| 612 | 3785 | `.workbench-topbar .brand` | global | gap, white-space | TODO |
| 613 | 3790 | `.workbench-topbar .top-right` | global | position, z-index, gap, margin-left | TODO |
| 614 | 3799 | `.workbench-topbar .workspace-tab` | @media (max-width: 1050px) | padding-right, padding-left | TODO |
| 615 | 3803 | `.workbench-topbar .top-right` | @media (max-width: 1050px) | gap | TODO |
| 616 | 3808 | `/* Frozen-prototype panel dimensions and collapsed rails. */ .inspector-rail.collapsed.dock-left, .inspector-rail.collapsed.dock-right` | global | width, padding | TODO |
| 617 | 3816 | `.inspector-rail.collapsed .rail-heading` | global | height, min-height, flex, flex-direction, justify-content, gap, padding, border-bottom | TODO |
| 618 | 3827 | `.inspector-rail.collapsed .panel-dock-drag-handle` | global | writing-mode, transform | TODO |
| 619 | 3832 | `.inspector-rail.collapsed .dock-menu` | global | margin | TODO |
| 620 | 3836 | `.diagnostics-dock.collapsed.dock-left, .diagnostics-dock.collapsed.dock-right` | global | width, min-width | TODO |
| 621 | 3842 | `.diagnostics-dock.collapsed.dock-top, .diagnostics-dock.collapsed.dock-bottom` | global | height, min-height | TODO |
| 622 | 3848 | `.diagnostics-dock.collapsed .diagnostics-content, .diagnostics-dock.collapsed .diagnostics-resize-edge` | global | display | TODO |
| 623 | 3853 | `.diagnostics-dock.collapsed .diagnostics-heading` | global | height, min-height, flex | TODO |
| 624 | 3859 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading, .diagnostics-dock.collapsed.dock-right .diagnostics-heading` | global | flex-direction, justify-content, gap, padding, border-bottom | TODO |
| 625 | 3868 | `.diagnostics-dock.collapsed.dock-left .diagnostics-tabs, .diagnostics-dock.collapsed.dock-right .diagnostics-tabs` | global | display | TODO |
| 626 | 3873 | `/* Keep the real Diagnostics title, vertically oriented like the Inspector rail. */ .diagnostics-dock.collapsed.dock-left .diagnostics-title-block, .diagnostics-dock.collapsed.dock-right .diagnostics-title-block` | global | display, flex, min-width | TODO |
| 627 | 3881 | `.diagnostics-dock.collapsed.dock-left .diagnostics-panel-title, .diagnostics-dock.collapsed.dock-right .diagnostics-panel-title` | global | writing-mode, transform, letter-spacing | TODO |
| 628 | 3888 | `/* Center the vertical title in the 36px collapsed rail; undo the expanded side-dock action clearance, which otherwise shifts the title off-center. */ .diagnostics-dock.collapsed.dock-left .diagnostics-title-block, .diagnostics-dock.collapsed.dock-right .diagnostics-title-block` | global | width, justify-content, padding-right | TODO |
| 629 | 3897 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading::before, .diagnostics-dock.collapsed.dock-right .diagnostics-heading::before` | global | content | TODO |
| 630 | 3902 | `.diagnostics-dock.collapsed.dock-left .dock-actions, .diagnostics-dock.collapsed.dock-right .dock-actions` | global | position, flex-direction, gap, margin-top | TODO |
| 631 | 3910 | `/* Compact workspace-mode toolbar aligned with the frozen prototype. */ .workspace-title` | global | flex, color, font-size, font-weight, letter-spacing | TODO |
| 632 | 3919 | `.toolbar-context` | global | min-width, overflow, color, font, text-overflow, white-space | TODO |
| 633 | 3927 | `.spacer` | global | flex, min-width | TODO |
| 634 | 3928 | `.tag` | global | flex, border, border-radius, padding, color, font, letter-spacing, white-space | TODO |
| 635 | 3938 | `.tag.amber` | global | border-color, background, color | TODO |
| 636 | 3943 | `.tag.green` | global | border-color, background, color | TODO |
| 637 | 3948 | `.replay-toolbar-actions` | global | display, min-width, flex, align-items, gap, margin-left, white-space | TODO |
| 638 | 3958 | `.replay-transport` | global | display, flex, align-items, gap | TODO |
| 639 | 3965 | `.replay-toolbar-actions .subtle-button` | global | min-height, padding, border-radius, font, letter-spacing | TODO |
| 640 | 3973 | `.replay-toolbar-actions .replay-play-toggle:not(:disabled)` | global | border-color, background, color | TODO |
| 641 | 3979 | `.replay-toolbar-actions .replay-play-toggle:hover:not(:disabled)` | global | border-color | TODO |
| 642 | 3983 | `.replay-toolbar-actions .run-stop-toggle:not(:disabled)` | global | border-color, background, color | TODO |
| 643 | 3989 | `.replay-toolbar-actions .run-stop-toggle:hover:not(:disabled)` | global | border-color | TODO |
| 644 | 3993 | `.run-state` | global | display, flex, align-items, gap, color, font, white-space | TODO |
| 645 | 4003 | `.run-state b` | global | color, font-weight | TODO |
| 646 | 4008 | `.run-state .run-status-running, .run-state .run-status-paused, .run-state .run-status-completed` | global | color | TODO |
| 647 | 4014 | `.run-state .run-status-failed` | global | color | TODO |
| 648 | 4018 | `.run-state .run-status-ready, .run-state .run-status-disposed, .run-state .run-status-none` | global | color | TODO |
| 649 | 4024 | `.replay-progress` | global | width, height, flex, overflow, border-radius, background | TODO |
| 650 | 4033 | `.replay-progress i` | global | display, height, border-radius, background, transition | TODO |
| 651 | 4041 | `.toolbar-error` | global | max-width, overflow, font-size, text-overflow, white-space | TODO |
| 652 | 4051 | `.replay-toolbar-actions` | @media (max-width: 1280px) | gap | TODO |
| 653 | 4054 | `.replay-toolbar-actions .subtle-button` | @media (max-width: 1280px) | padding-inline, font-size | TODO |
| 654 | 4061 | `/* Dataset mode follows the prototype's single control row above the Origin chart. */ .dataset-controls-host` | global | flex, min-width, overflow | TODO |
| 655 | 4068 | `.dataset-controls` | global | display, min-width, min-height, align-items, gap, padding, background | TODO |
| 656 | 4078 | `.dataset-controls-label` | global | display, flex, align-items, gap, white-space | TODO |
| 657 | 4086 | `.dataset-controls-label .section-index` | global | margin, color, font, letter-spacing | TODO |
| 658 | 4093 | `.dataset-controls-label > strong` | global | color, font-size, letter-spacing | TODO |
| 659 | 4099 | `.dataset-controls-label .status-label` | global | padding, font-size | TODO |
| 660 | 4104 | `.dataset-range-summary` | global | display, flex, min-width, align-items, gap | TODO |
| 661 | 4112 | `.dataset-range-selected` | global | display, flex, min-width, align-items, gap, color, font, white-space | TODO |
| 662 | 4123 | `.dataset-range-selected > span:first-child` | global | color, font-size, letter-spacing | TODO |
| 663 | 4129 | `.dataset-range-selected code` | global | color | TODO |
| 664 | 4133 | `.dataset-range-selected strong` | global | color, font-weight | TODO |
| 665 | 4138 | `.dataset-range-pending, .dataset-range-empty` | global | min-width, overflow, color, font-size, text-overflow, white-space | TODO |
| 666 | 4148 | `.dataset-range-pending code` | global | color, font-family | TODO |
| 667 | 4153 | `.dataset-range-status` | global | flex, min-width, overflow, color, font, text-overflow, white-space | TODO |
| 668 | 4163 | `.dataset-create-button` | global | flex, min-height, padding, white-space | TODO |
| 669 | 4170 | `.test-dataset-details` | global | position, flex, color, font-size | TODO |
| 670 | 4177 | `.test-dataset-details > summary, .catalog-origin-details > summary` | global | cursor, list-style, white-space | TODO |
| 671 | 4184 | `.test-dataset-details > summary::-webkit-details-marker, .catalog-origin-details > summary::-webkit-details-marker` | global | display | TODO |
| 672 | 4189 | `.test-dataset-details > summary` | global | padding, border, border-radius, font, letter-spacing | TODO |
| 673 | 4197 | `.test-dataset-details[open]` | global | position, z-index, top, right, width, padding, border, border-radius, background, box-shadow | TODO |
| 674 | 4210 | `.test-dataset-details[open] > summary` | global | margin-bottom | TODO |
| 675 | 4214 | `.test-dataset-detail-list` | global | display, grid-template-columns, gap | TODO |
| 676 | 4220 | `.test-dataset-detail-list > div` | global | display, min-width, flex-direction, gap | TODO |
| 677 | 4227 | `.test-dataset-detail-list > div > span` | global | color, font | TODO |
| 678 | 4232 | `.test-dataset-detail-list code` | global | overflow-wrap, color, font | TODO |
| 679 | 4238 | `.dataset-controls-message` | global | flex, max-width, margin, overflow, font-size, text-overflow | TODO |
| 680 | 4247 | `.catalog-origin-details` | global | flex, margin-top, padding-top, border-top | TODO |
| 681 | 4254 | `.catalog-origin-details > summary` | global | color, font, letter-spacing | TODO |
| 682 | 4260 | `.catalog-origin-details[open] > .result-panel` | global | margin-top, padding, border, border-top, border-radius, background, box-shadow | TODO |
| 683 | 4270 | `.catalog-origin-details .panel-heading h2` | global | font-size | TODO |
| 684 | 4276 | `.dataset-controls` | @media (max-width: 1100px) | gap, padding-inline | TODO |
| 685 | 4280 | `.dataset-controls-label` | @media (max-width: 1100px) | gap | TODO |
| 686 | 4284 | `.dataset-range-summary` | @media (max-width: 1100px) | flex-basis, gap | TODO |
| 687 | 4289 | `.dataset-range-status` | @media (max-width: 1100px) | display | TODO |
| 688 | 4293 | `.test-dataset-details > summary` | @media (max-width: 1100px) | padding-inline | TODO |
| 689 | 4298 | `.dataset-controls` | global | position, z-index | TODO |
| 690 | 4304 | `.chart-panels > .dataset-workspace-content` | global | overflow | TODO |
| 691 | 4310 | `/* The side Inspector is positioned at the exact edge reserved by workbench-main. The left-facing frame belongs to the positioned workspace itself, so inset that workspace by 5px rather than trying to move only its inner grid. Replay/Compare remain unchanged. */ .debugger-shell:not(.catalog-is-hidden).inspector-dock-left .workbench-main` | global | left | TODO |
| 692 | 4322 | `.dataset-workspace-content > .origin-chart-panel` | global | display, flex, min-height, flex-direction, margin | TODO |
| 693 | 4330 | `.dataset-workspace-content > .origin-chart-panel > .origin-chart-viewport` | global | flex, height, min-height | TODO |
| 694 | 4336 | `.dataset-workspace-content .origin-chart-host` | global | height, min-height | TODO |
| 695 | 4341 | `.dataset-workspace-content .origin-chart-panel > .chart-selection-hint` | global | flex | TODO |
| 696 | 4345 | `/* Compare mirrors the prototype's toolbar controls → summary strip → dual-chart stack. */ .compare-toolbar-actions` | global | min-width, gap | TODO |
| 697 | 4352 | `.compare-toolbar-select` | global | display, min-width, align-items, gap, color, font, letter-spacing, white-space | TODO |
| 698 | 4363 | `.compare-toolbar-select select` | global | width, max-width, min-width, height, padding, overflow, border, border-radius, background, color, font, text-overflow | TODO |
| 699 | 4378 | `.compare-run-button` | global | flex, min-height, padding, font-size, white-space | TODO |
| 700 | 4386 | `.compare-workspace > .compare-summary` | global | display, flex, min-width, min-height, align-items, gap, padding, border-bottom, background | TODO |
| 701 | 4398 | `.compare-summary .metric` | global | display, flex, align-items, gap, font-size, white-space | TODO |
| 702 | 4407 | `.compare-summary .metric .label` | global | color, font-size, letter-spacing | TODO |
| 703 | 4413 | `.compare-summary .metric .value` | global | color, font | TODO |
| 704 | 4418 | `.compare-summary .compare-divergence` | global | color | TODO |
| 705 | 4420 | `.compare-summary .compare-difference-count` | global | color | TODO |
| 706 | 4421 | `.compare-summary .compare-identity-match` | global | color | TODO |
| 707 | 4422 | `.compare-summary .compare-identity-mismatch` | global | color | TODO |
| 708 | 4423 | `.compare-summary .metric` | global | position, min-width | TODO |
| 709 | 4428 | `.compare-summary .metric + .metric` | global | padding-left | TODO |
| 710 | 4432 | `.compare-summary .metric + .metric::before` | global | position, top, bottom, left, width, background, content, pointer-events | TODO |
| 711 | 4443 | `.compare-summary .metric .value` | global | overflow, max-width, text-overflow | TODO |
| 712 | 4449 | `.comparison-chart-heading .section-index` | global | margin, color, font, letter-spacing | TODO |
| 713 | 4456 | `.comparison-chart-heading h3` | global | color, font-size, letter-spacing | TODO |
| 714 | 4462 | `.comparison-chart-state` | global | display, align-items, gap, padding, border-radius | TODO |
| 715 | 4470 | `.comparison-chart-state.is-ready` | global | border-color, color | TODO |
| 716 | 4475 | `.comparison-chart-state.is-pending` | global | color | TODO |
| 717 | 4479 | `.comparison-chart-empty` | global | position, flex, padding, background, background-size | TODO |
| 718 | 4490 | `.comparison-chart-empty-mark` | global | display, width, height, place-items, border, border-radius, color, font | TODO |
| 719 | 4501 | `.comparison-chart-empty strong` | global | margin-top, font-size, letter-spacing | TODO |
| 720 | 4507 | `.comparison-chart-empty p` | global | max-width, font-size, line-height | TODO |
| 721 | 4513 | `.comparison-chart-integrity` | global | margin-top, color, font, letter-spacing | TODO |
| 722 | 4520 | `.comparison-chart-integrity i` | global | padding-inline, color, font-style | TODO |
| 723 | 4526 | `.compare-summary .footnote` | global | min-width, margin-left, overflow, font, text-overflow, white-space | TODO |
| 724 | 4535 | `.compare-summary-error` | global | max-width, margin, overflow, font-size, text-overflow, white-space | TODO |
| 725 | 4544 | `.snapshot-store-disclosure` | global | flex, min-width, margin-top, border-top | TODO |
| 726 | 4551 | `.snapshot-store-disclosure > summary` | global | display, min-height, align-items, justify-content, gap, padding, color, cursor, font, letter-spacing, list-style | TODO |
| 727 | 4565 | `.snapshot-store-title` | global | display, min-width, align-items, gap | TODO |
| 728 | 4572 | `.snapshot-store-title > span` | global | color | TODO |
| 729 | 4576 | `.snapshot-store-counts` | global | color, font-size, letter-spacing, white-space | TODO |
| 730 | 4583 | `.snapshot-store-separator` | global | padding-inline, color | TODO |
| 731 | 4588 | `.snapshot-store-disclosure > summary::after` | global | width, height, flex, border-right, border-bottom, content, transform | TODO |
| 732 | 4598 | `.snapshot-store-disclosure[open] > summary::after` | global | transform | TODO |
| 733 | 4602 | `.snapshot-store-disclosure > summary::-webkit-details-marker` | global | display | TODO |
| 734 | 4606 | `.snapshot-store-disclosure[open]` | global | max-height, overflow | TODO |
| 735 | 4611 | `.snapshot-store-disclosure > .snapshot-panel` | global | margin-top, padding, border-color, border-radius, background | TODO |
| 736 | 4621 | `.compare-toolbar-select select` | @media (max-width: 1280px) | width, max-width | TODO |
| 737 | 4625 | `.compare-workspace > .compare-summary` | @media (max-width: 1280px) | gap, padding-inline | TODO |
| 738 | 4630 | `.compare-summary .footnote` | @media (max-width: 1280px) | display | TODO |
| 739 | 4637 | `.compare-toolbar-actions` | @media (max-width: 1050px) | gap | TODO |
| 740 | 4638 | `.compare-toolbar-select` | @media (max-width: 1050px) | gap, font-size | TODO |
| 741 | 4639 | `.compare-toolbar-select select` | @media (max-width: 1050px) | width, max-width | TODO |
| 742 | 4640 | `.compare-run-button` | @media (max-width: 1050px) | padding-inline, font-size | TODO |
| 743 | 4641 | `.compare-workspace > .compare-summary` | @media (max-width: 1050px) | gap | TODO |
| 744 | 4642 | `.compare-summary .metric` | @media (max-width: 1050px) | gap | TODO |
| 745 | 4643 | `.compare-summary .metric + .metric` | @media (max-width: 1050px) | padding-left | TODO |
| 746 | 4644 | `.compare-summary .metric + .metric::before` | @media (max-width: 1050px) | top, bottom | TODO |
| 747 | 4648 | `.compare-toolbar-select > span` | @media (max-width: 1050px) | display | TODO |
| 748 | 4649 | `.compare-toolbar-select select` | @media (max-width: 1050px) | width, max-width | TODO |
| 749 | 4651 | `/* Collapsed horizontal Inspector rails follow the Diagnostics toolbar geometry. */ .inspector-rail.collapsed.dock-top, .inspector-rail.collapsed.dock-bottom` | global | padding | TODO |
| 750 | 4658 | `.inspector-rail.collapsed.dock-top .rail-heading, .inspector-rail.collapsed.dock-bottom .rail-heading` | global | width, height, min-height, flex, flex-direction, align-items, justify-content, gap, padding, border-bottom | TODO |
| 751 | 4671 | `.inspector-rail.collapsed.dock-top .panel-title, .inspector-rail.collapsed.dock-bottom .panel-title, .inspector-rail.collapsed.dock-top .inspector-object-tag, .inspector-rail.collapsed.dock-bottom .inspector-object-tag, .inspector-rail.collapsed.dock-top .dock-menu, .inspector-rail.collapsed.dock-bottom .dock-menu` | global | display | TODO |
| 752 | 4679 | `.inspector-rail.collapsed.dock-top .rail-heading > .spacer, .inspector-rail.collapsed.dock-bottom .rail-heading > .spacer` | global | display | TODO |
| 753 | 4683 | `.inspector-rail.collapsed.dock-top .rail-heading > .rail-toggle, .inspector-rail.collapsed.dock-bottom .rail-heading > .rail-toggle` | global | display, flex, align-items, justify-content, width, height, margin, padding, writing-mode, transform | TODO |
| 754 | 4696 | `/* A collapsed side rail keeps its reopen control, not the Dock menu. */ .diagnostics-dock.collapsed.dock-left .dock-actions > .dock-menu, .diagnostics-dock.collapsed.dock-right .dock-actions > .dock-menu` | global | display | TODO |
| 755 | 4702 | `.diagnostics-dock.collapsed.dock-left .dock-actions > [data-testid="diagnostics-collapse-toggle"], .diagnostics-dock.collapsed.dock-right .dock-actions > [data-testid="diagnostics-collapse-toggle"]` | global | display, flex, align-items, justify-content, width, height, margin, padding | TODO |
| 756 | 4713 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading, .diagnostics-dock.collapsed.dock-right .diagnostics-heading` | global | cursor | TODO |
| 757 | 4717 | `/* Development-only browser tooling entry point; not part of the production UI. */ .devtools-context-menu` | global | position, z-index, min-width, padding, border, border-radius, background, box-shadow | TODO |
| 758 | 4730 | `.devtools-context-menu button` | global | display, width, min-height, padding, border, border-radius, background, color, text-align, cursor, font | TODO |
| 759 | 4744 | `.devtools-context-menu button:hover, .devtools-context-menu button:focus-visible` | global | outline, background | TODO |
| 760 | 4750 | `/* Replay playback speed selector — compact Bilibili-style current value + menu. */ /* The toolbar normally clips horizontal overflow; let the speed menu escape below it. */ .workflow-toolbar:has(.replay-speed-menu)` | global | position, z-index, overflow | TODO |
| 761 | 4759 | `.replay-speed-control` | global | position, display, flex | TODO |
| 762 | 4765 | `.replay-speed-trigger` | global | display, min-width, min-height, align-items, justify-content, padding, border, border-radius, background, color, font-size, cursor | TODO |
| 763 | 4780 | `.replay-speed-trigger:hover, .replay-speed-trigger[aria-expanded="true"]` | global | background, color | TODO |
| 764 | 4786 | `.replay-speed-menu` | global | position, z-index, top, right, display, width, flex-direction, gap, padding, border, border-radius, background, box-shadow | TODO |
| 765 | 4802 | `.replay-speed-option` | global | display, min-height, align-items, justify-content, padding, border, border-radius, background, color, font-size, text-align, cursor | TODO |
| 766 | 4817 | `.replay-speed-option:hover, .replay-speed-option:focus-visible` | global | outline, background, color | TODO |
| 767 | 4824 | `.replay-speed-option.selected` | global | color, background | TODO |
| 768 | 4829 | `.replay-speed-check` | global | color, font-size | TODO |
| 769 | 4834 | `/* Shared operation feedback (vue-sonner). Keep toasts above docked panels and menus. */ [data-sonner-toaster]` | global | z-index | TODO |
| 770 | 4840 | `[data-sonner-toast]` | global | font-family, border-color, background, color, box-shadow | TODO |
| 771 | 4848 | `[data-sonner-toast] [data-description]` | global | color | TODO |
| 772 | 4852 | `[data-sonner-toast][data-type="success"]` | global | border-color | TODO |
| 773 | 4856 | `[data-sonner-toast][data-type="warning"]` | global | border-color | TODO |
| 774 | 4860 | `[data-sonner-toast][data-type="error"]` | global | border-color | TODO |