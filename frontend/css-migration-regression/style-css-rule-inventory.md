# Temporary global CSS rule inventory

- Source: `crates/struxis-debugger/frontend/src/style.css`
- Source blob after latest scoped migration: `f5c1f37e4860a634e9a6de8c303002edadea1daf`
- Source lines: 4786; rule occurrences recorded: 762
- Status: temporary migration aid; regenerate when source CSS changes; remove with the temporary CSS migration regression suite after migration and visual acceptance.
- Method: lexical scan that skips comments/quoted strings and tracks at-rule nesting. Not a standards-compliant CSS AST; property names are extracted heuristically. Do not use this report alone to change cascade behavior.
- Ordering: source order preserved. Repeated selectors are intentionally not deduplicated.
- 2026-10-27 delta: removed the final global `.dataset-controls` rule (`position`, `z-index`) after moving those declarations into `TestDatasetPanel.vue`; this inventory drops that rule occurrence. Subsequent line references were shifted by five lines to reflect the removal. Line references remain a lexical migration aid and must be regenerated before any broad selector cleanup.


| # | Line | Selector | At-rule context | Properties (heuristic) | Owner candidate | Review status |
|---:|---:|---|---|---|---|---|
| 1 | 1 | `:root` | global | --dbg-surface-1, --dbg-surface-2, --dbg-surface-3, --dbg-border, --dbg-border-strong, --dbg-text-primary, --dbg-text-secondary, --dbg-text-muted, --dbg-text-disabled, --dbg-accent, --dbg-accent-hover, --dbg-accent-subtle, --dbg-success, --dbg-warning, --dbg-error, --dbg-info, --dbg-error-surface, --dbg-selection-border, --dbg-selection-surface, --dbg-chart-up, --dbg-chart-down, --dbg-chart-neutral, --dbg-chart-unprocessed, --dbg-chart-volume-up, --dbg-chart-volume-down, --dbg-chart-cbar, --dbg-chart-swing, --dbg-chart-trend, --dbg-chart-keyzone, --dbg-chart-crosshair, font-family, color, background, font-synthesis, text-rendering, -webkit-font-smoothing, font-optical-sizing, font-size, color-scheme | Candidate: Foundations / native controls | Heuristic only |
| 2 | 44 | `*` | global | box-sizing | Candidate: Foundations / native controls | Heuristic only |
| 3 | 48 | `body` | global | margin, min-width, min-height, background | Candidate: Foundations / native controls | Heuristic only |
| 4 | 55 | `button, input` | global | font | Candidate: Foundations / native controls | Heuristic only |
| 5 | 60 | `button` | global | color | Candidate: Foundations / native controls | Heuristic only |
| 6 | 64 | `button:focus-visible, input:focus-visible` | global | outline, outline-offset | Candidate: Foundations / native controls | Heuristic only |
| 7 | 70 | `.debugger-shell` | global | height, min-height, margin, padding, display, flex-direction, gap, overflow | Candidate: Shell / Workspace | Heuristic only |
| 8 | 83 | `.topbar, .panel-heading, .footer-bar, .table-heading` | global | display, align-items, justify-content, gap | Candidate: Shell / Workspace | Heuristic only |
| 9 | 93 | `.topbar` | global | padding, border-bottom | Candidate: Shell / Workspace | Heuristic only |
| 10 | 98 | `.eyebrow, .section-index, .field-label` | global | margin, color, font, letter-spacing | Manual review: unclassified | Heuristic only |
| 11 | 107 | `h1, h2, h3, p` | global | margin-top | Manual review: unclassified | Heuristic only |
| 12 | 114 | `h1` | global | margin, font-size, font-weight, letter-spacing | Manual review: unclassified | Heuristic only |
| 13 | 121 | `h2` | global | margin, font-size, font-weight | Manual review: unclassified | Heuristic only |
| 14 | 127 | `h3` | global | margin, font-size, font-weight | Manual review: unclassified | Heuristic only |
| 15 | 133 | `.subtitle` | global | margin, color, font | Manual review: unclassified | Heuristic only |
| 16 | 139 | `.runtime-mark` | global | display, align-items, gap, color, font, letter-spacing | Manual review: unclassified | Heuristic only |
| 17 | 148 | `.runtime-dot, .dataset-status` | global | display, flex, width, height, border, border-radius, background | Candidate: Dataset / Catalog | Heuristic only |
| 18 | 159 | `.runtime-dot.active, .dataset-status.ready` | global | border-color, background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 19 | 166 | `.workspace` | global | display, grid-template-columns, gap, flex, align-items | Candidate: Shell / Workspace | Heuristic only |
| 20 | 174 | `.panel` | global | min-width, border, background | Manual review: unclassified | Heuristic only |
| 21 | 180 | `.catalog-panel, .result-panel` | global | padding | Candidate: Dataset / Catalog | Heuristic only |
| 22 | 185 | `.panel-heading` | global | min-height, margin-bottom | Manual review: unclassified | Heuristic only |
| 23 | 190 | `.subtle-button` | global | padding, border, background, color, cursor | Manual review: unclassified | Heuristic only |
| 24 | 198 | `.subtle-button:hover:not(:disabled)` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 25 | 203 | `button:disabled` | global | cursor, opacity | Candidate: Foundations / native controls | Heuristic only |
| 26 | 208 | `.instrument-list` | global | display, flex-direction, gap | Candidate: Dataset / Catalog | Heuristic only |
| 27 | 214 | `.instrument-group` | global | min-width, border, background | Candidate: Dataset / Catalog | Heuristic only |
| 28 | 220 | `.instrument-group.unresolved` | global | border-color | Candidate: Dataset / Catalog | Heuristic only |
| 29 | 224 | `.instrument-group-row` | global | display, width, min-width, align-items, gap, padding, border, background, text-align, cursor | Candidate: Dataset / Catalog | Heuristic only |
| 30 | 237 | `.instrument-group-row:hover` | global | background | Candidate: Dataset / Catalog | Heuristic only |
| 31 | 241 | `.group-chevron` | global | flex, color, font | Manual review: unclassified | Heuristic only |
| 32 | 247 | `.instrument-group-name` | global | min-width, flex, color, font, overflow-wrap | Candidate: Dataset / Catalog | Heuristic only |
| 33 | 255 | `.instrument-group.unresolved .instrument-group-name` | global | color | Candidate: Dataset / Catalog | Heuristic only |
| 34 | 259 | `.group-count, .group-ready` | global | flex, color, font, white-space | Manual review: unclassified | Heuristic only |
| 35 | 267 | `.group-ready` | global | color | Manual review: unclassified | Heuristic only |
| 36 | 271 | `.instrument-group .dataset-list` | global | display, flex-direction, gap, padding | Candidate: Dataset / Catalog | Heuristic only |
| 37 | 278 | `.instrument-group .dataset-row` | global | border-width, border-color, background | Candidate: Dataset / Catalog | Heuristic only |
| 38 | 284 | `.instrument-group .dataset-row:last-child` | global | border-bottom | Candidate: Dataset / Catalog | Heuristic only |
| 39 | 288 | `.instrument-group .dataset-row:hover:not(:disabled)` | global | background | Candidate: Dataset / Catalog | Heuristic only |
| 40 | 292 | `.instrument-group .dataset-row.selected` | global | border-color, background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 41 | 298 | `.dataset-row` | global | display, width, align-items, gap, padding, text-align, border, background, cursor | Candidate: Dataset / Catalog | Heuristic only |
| 42 | 310 | `.dataset-row:hover:not(:disabled)` | global | border-color, background | Candidate: Dataset / Catalog | Heuristic only |
| 43 | 315 | `.dataset-row.selected` | global | border-color, background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 44 | 321 | `.dataset-row.unavailable` | global | color | Candidate: Dataset / Catalog | Heuristic only |
| 45 | 325 | `.dataset-status` | global | margin-top | Candidate: Dataset / Catalog | Heuristic only |
| 46 | 329 | `.dataset-status:not(.ready)` | global | border-radius | Candidate: Dataset / Catalog | Heuristic only |
| 47 | 333 | `.dataset-details` | global | display, min-width, flex, flex-direction, gap | Candidate: Dataset / Catalog | Heuristic only |
| 48 | 341 | `.dataset-details strong` | global | overflow-wrap, color, font-size, font-weight | Candidate: Dataset / Catalog | Heuristic only |
| 49 | 348 | `.dataset-details small, .microcopy, .source-note` | global | color, font-size, line-height, overflow-wrap | Candidate: Dataset / Catalog | Heuristic only |
| 50 | 357 | `.dataset-state` | global | flex, color, font, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 51 | 364 | `.unavailable .dataset-state` | global | color | Candidate: Dataset / Catalog | Heuristic only |
| 52 | 368 | `.diagnostic` | global | color | Manual review: unclassified | Heuristic only |
| 53 | 372 | `.load-options` | global | margin-top, padding-top, border-top | Manual review: unclassified | Heuristic only |
| 54 | 378 | `.toggle-row` | global | display, align-items, gap, margin-bottom, cursor | Manual review: unclassified | Heuristic only |
| 55 | 386 | `.toggle-row input` | global | margin, accent-color | Manual review: unclassified | Heuristic only |
| 56 | 391 | `.toggle-row span` | global | display, flex-direction, gap | Manual review: unclassified | Heuristic only |
| 57 | 397 | `.toggle-row strong` | global | font-size, font-weight | Manual review: unclassified | Heuristic only |
| 58 | 402 | `.toggle-row small` | global | color, font-size | Manual review: unclassified | Heuristic only |
| 59 | 407 | `.primary-button` | global | display, width, align-items, justify-content, gap, padding, border, background, color, font, letter-spacing, cursor | Manual review: unclassified | Heuristic only |
| 60 | 422 | `.primary-button:hover:not(:disabled)` | global | border-color, background | Manual review: unclassified | Heuristic only |
| 61 | 427 | `.microcopy` | global | margin | Manual review: unclassified | Heuristic only |
| 62 | 431 | `.status-label` | global | padding, border, color, font, letter-spacing, white-space | Manual review: unclassified | Heuristic only |
| 63 | 440 | `.status-label.loaded` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 64 | 445 | `.status-label.loading` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 65 | 450 | `.status-label.failed` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 66 | 455 | `.origin-identity` | global | display, gap, padding, border, background | Manual review: unclassified | Heuristic only |
| 67 | 463 | `.origin-identity code` | global | margin-bottom, color, font, overflow-wrap | Manual review: unclassified | Heuristic only |
| 68 | 470 | `.origin-identity code.fingerprint` | global | margin-bottom, color | Manual review: unclassified | Heuristic only |
| 69 | 475 | `.metric-grid` | global | display, grid-template-columns, margin, border-top, border-left | Manual review: unclassified | Heuristic only |
| 70 | 483 | `.metric` | global | display, min-width, flex-direction, gap, padding, border-right, border-bottom | Manual review: unclassified | Heuristic only |
| 71 | 493 | `.metric span` | global | color, font, letter-spacing | Manual review: unclassified | Heuristic only |
| 72 | 499 | `.metric strong` | global | color, font-size, font-weight, overflow-wrap | Manual review: unclassified | Heuristic only |
| 73 | 506 | `.range-summary` | global | display, grid-template-columns, gap, margin | Manual review: unclassified | Heuristic only |
| 74 | 513 | `.range-summary > div` | global | display, min-width, flex-direction, gap, padding, border | Manual review: unclassified | Heuristic only |
| 75 | 522 | `.range-summary strong` | global | color, font, overflow-wrap | Manual review: unclassified | Heuristic only |
| 76 | 528 | `.range-summary small` | global | color, font, overflow-wrap | Manual review: unclassified | Heuristic only |
| 77 | 534 | `.table-heading` | global | align-items, margin-bottom | Manual review: unclassified | Heuristic only |
| 78 | 539 | `.table-heading > span` | global | color, font | Manual review: unclassified | Heuristic only |
| 79 | 544 | `.table-scroll` | global | width, overflow-x, border | Manual review: unclassified | Heuristic only |
| 80 | 550 | `table` | global | width, border-collapse, font, white-space | Manual review: unclassified | Heuristic only |
| 81 | 557 | `thead` | global | background, color | Manual review: unclassified | Heuristic only |
| 82 | 562 | `th, td` | global | padding, border-bottom, text-align | Manual review: unclassified | Heuristic only |
| 83 | 569 | `th:first-child, td:first-child` | global | text-align | Manual review: unclassified | Heuristic only |
| 84 | 574 | `th` | global | font-weight | Manual review: unclassified | Heuristic only |
| 85 | 578 | `tbody tr:last-child td` | global | border-bottom | Manual review: unclassified | Heuristic only |
| 86 | 582 | `tbody tr:hover` | global | background | Manual review: unclassified | Heuristic only |
| 87 | 586 | `td` | global | color | Manual review: unclassified | Heuristic only |
| 88 | 590 | `.timestamp-cell` | global | color | Manual review: unclassified | Heuristic only |
| 89 | 594 | `.source-note` | global | margin | Manual review: unclassified | Heuristic only |
| 90 | 598 | `.error-message` | global | display, flex-direction, gap, margin-bottom, padding, border, background, color, font-size, line-height, overflow-wrap | Manual review: unclassified | Heuristic only |
| 91 | 612 | `.error-message small` | global | color | Manual review: unclassified | Heuristic only |
| 92 | 616 | `.empty-state` | global | padding, border, color, font-size, line-height | Manual review: unclassified | Heuristic only |
| 93 | 624 | `.no-origin` | global | display, min-height, align-content, justify-items, padding, text-align | Manual review: unclassified | Heuristic only |
| 94 | 633 | `.no-origin-glyph` | global | color, font | Manual review: unclassified | Heuristic only |
| 95 | 638 | `.no-origin h3` | global | margin, font-size | Manual review: unclassified | Heuristic only |
| 96 | 643 | `.no-origin p` | global | max-width, margin, color, font-size, line-height | Manual review: unclassified | Heuristic only |
| 97 | 651 | `.footer-bar` | global | padding-top, border-top, color, font, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 98 | 661 | `.workspace` | @media (max-width: 980px) | grid-template-columns | Candidate: Shell / Workspace | Heuristic only |
| 99 | 667 | `.debugger-shell` | @media (max-width: 600px) | padding | Candidate: Shell / Workspace | Heuristic only |
| 100 | 670 | `.topbar` | @media (max-width: 600px) | align-items | Candidate: Shell / Workspace | Heuristic only |
| 101 | 674 | `.runtime-mark` | @media (max-width: 600px) | max-width, text-align, line-height | Manual review: unclassified | Heuristic only |
| 102 | 680 | `.catalog-panel, .result-panel` | @media (max-width: 600px) | padding | Candidate: Dataset / Catalog | Heuristic only |
| 103 | 685 | `.range-summary` | @media (max-width: 600px) | grid-template-columns | Manual review: unclassified | Heuristic only |
| 104 | 689 | `.footer-bar` | @media (max-width: 600px) | align-items, flex-direction, gap | Candidate: Shell / Workspace | Heuristic only |
| 105 | 696 | `.operations-grid` | global | display, grid-template-columns, gap, align-items | Manual review: unclassified | Heuristic only |
| 106 | 704 | `.operations-panel, .snapshot-panel` | global | padding | Candidate: Dataset / Catalog | Heuristic only |
| 107 | 709 | `.form-grid` | global | display, grid-template-columns, gap, margin | Manual review: unclassified | Heuristic only |
| 108 | 716 | `.form-field` | global | display, min-width, flex-direction, gap, color, font, letter-spacing | Manual review: unclassified | Heuristic only |
| 109 | 726 | `.form-field input` | global | width, min-width, padding, border, border-radius, background, color, font, letter-spacing | Manual review: unclassified | Heuristic only |
| 110 | 738 | `.action-grid` | global | display, grid-template-columns, gap, margin | Manual review: unclassified | Heuristic only |
| 111 | 745 | `.action-button` | global | min-width, padding, border, background, color, font, letter-spacing, cursor | Manual review: unclassified | Heuristic only |
| 112 | 756 | `.action-button:hover:not(:disabled)` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 113 | 761 | `.action-button.action-primary` | global | border-color, background, color | Manual review: unclassified | Heuristic only |
| 114 | 767 | `.action-button.action-primary:hover:not(:disabled)` | global | border-color | Manual review: unclassified | Heuristic only |
| 115 | 771 | `.detail-list` | global | display, gap, margin-top, border-top | Manual review: unclassified | Heuristic only |
| 116 | 778 | `.detail-list > div` | global | display, grid-template-columns, gap, padding, border-bottom, align-items | Manual review: unclassified | Heuristic only |
| 117 | 787 | `.detail-list > div > span` | global | color, font | Manual review: unclassified | Heuristic only |
| 118 | 792 | `.detail-list code, .detail-list strong` | global | min-width, color, font, overflow-wrap | Manual review: unclassified | Heuristic only |
| 119 | 800 | `.success-message` | global | margin, padding, border, color, font-size, line-height | Manual review: unclassified | Heuristic only |
| 120 | 809 | `.snapshot-panel` | global | min-width | Candidate: Dataset / Catalog | Heuristic only |
| 121 | 813 | `.snapshot-table` | global | min-width | Manual review: unclassified | Heuristic only |
| 122 | 817 | `.snapshot-table td` | global | vertical-align | Manual review: unclassified | Heuristic only |
| 123 | 821 | `.snapshot-table td:first-child, .snapshot-table td:last-child` | global | text-align | Manual review: unclassified | Heuristic only |
| 124 | 826 | `.snapshot-table td > strong, .snapshot-table td > small` | global | display, max-width, overflow-wrap | Manual review: unclassified | Heuristic only |
| 125 | 833 | `.snapshot-table td > strong` | global | color, font-weight | Manual review: unclassified | Heuristic only |
| 126 | 838 | `.snapshot-table td > small` | global | margin-top, color, font-size, line-height | Manual review: unclassified | Heuristic only |
| 127 | 845 | `.artifact-kind` | global | display, padding, border, color, font-size, white-space | Manual review: unclassified | Heuristic only |
| 128 | 854 | `.artifact-kind.published` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 129 | 859 | `.artifact-kind.invalid` | global | border-color, color | Manual review: unclassified | Heuristic only |
| 130 | 866 | `.operations-grid` | @media (max-width: 980px) | grid-template-columns | Manual review: unclassified | Heuristic only |
| 131 | 872 | `.operations-panel, .snapshot-panel` | @media (max-width: 600px) | padding | Candidate: Dataset / Catalog | Heuristic only |
| 132 | 876 | `.form-grid` | @media (max-width: 600px) | grid-template-columns | Manual review: unclassified | Heuristic only |
| 133 | 880 | `.action-grid` | @media (max-width: 600px) | grid-template-columns | Manual review: unclassified | Heuristic only |
| 134 | 884 | `.detail-list > div` | @media (max-width: 600px) | grid-template-columns, gap | Manual review: unclassified | Heuristic only |
| 135 | 890 | `/* Workbench layout: no maximum dimensions; only usable minimums constrain panels. */ html, body, #app` | global | width, min-width, min-height, height | Manual review: unclassified | Heuristic only |
| 136 | 901 | `.debugger-shell` | global | width, min-width, height, min-height, margin, padding, gap | Candidate: Shell / Workspace | Heuristic only |
| 137 | 911 | `.workbench-topbar` | global | justify-content, flex, height, min-height, display, align-items, gap, padding, border-bottom, background | Candidate: Shell / Workspace | Heuristic only |
| 138 | 924 | `.workbench-topbar .brand` | global | display, flex, align-items, gap, color, font-size, font-weight, letter-spacing, white-space | Candidate: Shell / Workspace | Heuristic only |
| 139 | 936 | `.workbench-topbar .brandmark` | global | display, width, height, flex, place-items, border, border-radius, color, font, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 140 | 949 | `.workbench-topbar .workspace-tabs` | global | display, height, min-width, flex, align-items, gap, flex-wrap | Candidate: Shell / Workspace | Heuristic only |
| 141 | 959 | `.workbench-topbar .workspace-tab` | global | height, min-height, padding, border, border-radius, background, color, font, letter-spacing, white-space | Candidate: Shell / Workspace | Heuristic only |
| 142 | 972 | `.workbench-topbar .workspace-tab:hover` | global | border-color, background, color | Candidate: Shell / Workspace | Heuristic only |
| 143 | 978 | `.workbench-topbar .workspace-tab.active` | global | border-color, background, color, box-shadow | Candidate: Shell / Workspace | Heuristic only |
| 144 | 985 | `.workbench-topbar .top-right` | global | display, min-width, margin-left, align-items, gap, color, font-size, white-space | Candidate: Shell / Workspace | Heuristic only |
| 145 | 996 | `.workbench-topbar .runtime-mark` | global | display, align-items, gap, color, font, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 146 | 1005 | `.workbench-topbar .status-dot` | global | display, width, height, flex, margin-right, border, border-radius, background, box-shadow | Candidate: Shell / Workspace | Heuristic only |
| 147 | 1017 | `.workbench-topbar .status-dot.active` | global | background | Candidate: Shell / Workspace | Heuristic only |
| 148 | 1021 | `.workbench-topbar .keycap` | global | padding, border, border-radius, color, font | Candidate: Shell / Workspace | Heuristic only |
| 149 | 1031 | `.workbench-topbar` | @media (max-width: 1050px) | gap, padding-right, padding-left | Candidate: Shell / Workspace | Heuristic only |
| 150 | 1036 | `.workbench-topbar .brand` | @media (max-width: 1050px) | gap, font-size | Candidate: Shell / Workspace | Heuristic only |
| 151 | 1041 | `.workbench-topbar .workspace-tab` | @media (max-width: 1050px) | padding-right, padding-left | Candidate: Shell / Workspace | Heuristic only |
| 152 | 1046 | `.workbench-topbar .top-right` | @media (max-width: 1050px) | gap | Candidate: Shell / Workspace | Heuristic only |
| 153 | 1051 | `.debugger-shell` | global | display, grid-template-columns, flex, min-height, min-width, gap, overflow | Candidate: Shell / Workspace | Heuristic only |
| 154 | 1061 | `.catalog-rail` | global | min-width, min-height, padding, overflow, border-right, background | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 155 | 1070 | `.catalog-rail.collapsed` | global | padding | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 156 | 1074 | `.rail-heading, .diagnostics-heading` | global | display, min-height, align-items, justify-content, gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 157 | 1083 | `.rail-toggle` | global | min-width, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 158 | 1088 | `.catalog-rail > .catalog-panel` | global | margin-top, padding, border, background | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 159 | 1095 | `.catalog-rail .panel-heading` | global | align-items | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 160 | 1099 | `.catalog-rail .panel-heading .section-index` | global | display | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 161 | 1103 | `.catalog-rail .panel-heading h2` | global | font-size | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 162 | 1107 | `.debugger-shell.catalog-is-collapsed` | global | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 163 | 1111 | `.workbench-main` | global | display, min-width, min-height, flex-direction | Candidate: Shell / Workspace | Heuristic only |
| 164 | 1118 | `.workflow-toolbar` | global | display, min-height, align-items, justify-content, gap, padding, border-bottom, background | Candidate: Shell / Workspace | Heuristic only |
| 165 | 1129 | `.workflow-toolbar h2` | global | margin-top, font-size | Candidate: Shell / Workspace | Heuristic only |
| 166 | 1134 | `.workflow-toolbar .section-index` | global | font-size | Candidate: Shell / Workspace | Heuristic only |
| 167 | 1138 | `.primary-workspace` | global | display, grid-template-columns, flex, min-width, min-height | Candidate: Shell / Workspace | Heuristic only |
| 168 | 1146 | `.debugger-shell.inspector-is-collapsed .primary-workspace` | global | grid-template-columns | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 169 | 1150 | `.workspace-mode` | global | display, min-width, flex-direction, gap | Candidate: Shell / Workspace | Heuristic only |
| 170 | 1157 | `.workspace-mode > .panel, .workspace-mode > .operations-panel, .workspace-mode > .snapshot-panel` | global | min-width | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 171 | 1163 | `.workspace-content` | global | display, min-width, min-height, flex, flex-direction, gap, padding, overflow | Candidate: Shell / Workspace | Heuristic only |
| 172 | 1174 | `.workspace-content > .panel, .workspace-content > .operations-panel, .workspace-content > .snapshot-panel` | global | min-width | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 173 | 1180 | `.workspace-content .operations-grid` | global | grid-template-columns | Candidate: Shell / Workspace | Heuristic only |
| 174 | 1184 | `.workspace-content .snapshot-panel` | global | overflow | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 175 | 1188 | `.inspector-rail` | global | display, min-width, min-height, flex-direction, padding, border-left, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 176 | 1200 | `.inspector-rail > .inspector-object` | global | min-height, flex, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 177 | 1206 | `.inspector-rail.collapsed` | global | padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 178 | 1210 | `.inspector-placeholder` | global | display, min-height, flex-direction, align-items, justify-content, gap, margin-top, padding, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 179 | 1223 | `.inspector-placeholder .placeholder-mark` | global | color, font | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 180 | 1228 | `.inspector-placeholder h3` | global | margin, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 181 | 1233 | `.inspector-placeholder p, .inspector-placeholder small` | global | margin, color, font-size, line-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 182 | 1241 | `.inspector-placeholder small` | global | color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 183 | 1245 | `.workspace-notice` | global | padding, border-left, background | Candidate: Shell / Workspace | Heuristic only |
| 184 | 1251 | `.diagnostics-dock` | global | flex, min-height, padding, border-top, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 185 | 1259 | `.diagnostics-heading` | global | margin-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 186 | 1263 | `.diagnostics-heading h2` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 187 | 1267 | `.diagnostics-content` | global | min-height, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 188 | 1272 | `.diagnostics-content .error-message` | global | margin | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 189 | 1276 | `.diagnostics-reopen` | global | align-self, margin, padding, border, background, color, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 190 | 1286 | `.workbench-topbar + .debugger-shell ~ .footer-bar` | global | padding, background | Candidate: Shell / Workspace | Heuristic only |
| 191 | 1293 | `.debugger-shell` | @media (min-width: 1600px) | grid-template-columns | Candidate: Shell / Workspace | Heuristic only |
| 192 | 1296 | `.primary-workspace` | @media (min-width: 1600px) | grid-template-columns | Candidate: Shell / Workspace | Heuristic only |
| 193 | 1299 | `.debugger-shell.catalog-is-collapsed` | @media (min-width: 1600px) | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 194 | 1305 | `.primary-workspace` | @media (max-width: 1050px) | grid-template-columns | Candidate: Shell / Workspace | Heuristic only |
| 195 | 1311 | `.debugger-shell, .debugger-shell.catalog-is-collapsed` | @media (max-width: 760px) | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 196 | 1315 | `.catalog-rail` | @media (max-width: 760px) | border-right, border-bottom | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 197 | 1319 | `.catalog-rail.collapsed > :not(.rail-heading)` | @media (max-width: 760px) | display | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 198 | 1322 | `.primary-workspace, .debugger-shell.inspector-is-collapsed .primary-workspace` | @media (max-width: 760px) | grid-template-columns | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 199 | 1326 | `.inspector-rail` | @media (max-width: 760px) | border-top, border-left | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 200 | 1330 | `.inspector-rail.collapsed` | @media (max-width: 760px) | min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 201 | 1333 | `.inspector-rail.collapsed > :not(.rail-heading)` | @media (max-width: 760px) | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 202 | 1336 | `.workflow-toolbar` | @media (max-width: 760px) | align-items, flex-direction | Candidate: Shell / Workspace | Heuristic only |
| 203 | 1340 | `.toolbar-actions` | @media (max-width: 760px) | width | Manual review: unclassified | Heuristic only |
| 204 | 1343 | `.diagnostics-dock` | @media (max-width: 760px) | min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 205 | 1347 | `/* Snapshot Compare: compact engineering controls and explicit first-divergence summary. */ .compare-controls` | global | display, grid-template-columns, align-items, gap, margin-top, padding, border, background | Candidate: Compare | Heuristic only |
| 206 | 1360 | `.compare-controls h3` | global | margin, font-size | Candidate: Compare | Heuristic only |
| 207 | 1361 | `.compare-controls label` | global | display, gap, color, font-size, text-transform, letter-spacing | Candidate: Compare | Heuristic only |
| 208 | 1362 | `.compare-controls select` | global | min-width, width, padding, color, background, border, font | Candidate: Compare | Heuristic only |
| 209 | 1371 | `.compare-results` | global | display, gap, margin-top | Candidate: Compare | Heuristic only |
| 210 | 1372 | `.compare-summary` | global | display, grid-template-columns, gap | Candidate: Compare | Heuristic only |
| 211 | 1373 | `.compare-summary > div` | global | min-width, padding, border | Candidate: Compare | Heuristic only |
| 212 | 1374 | `.compare-summary strong` | global | display, overflow-wrap, margin-top, font-size | Candidate: Compare | Heuristic only |
| 213 | 1375 | `.compare-metadata` | global | display, grid-template-columns, gap | Candidate: Compare | Heuristic only |
| 214 | 1376 | `.compare-metadata > div` | global | display, gap, min-width | Candidate: Compare | Heuristic only |
| 215 | 1377 | `.compare-metadata span` | global | color, font-size, text-transform | Candidate: Compare | Heuristic only |
| 216 | 1378 | `.compare-metadata code` | global | overflow-wrap, font-size | Candidate: Compare | Heuristic only |
| 217 | 1379 | `.difference-table` | global | min-width | Candidate: Compare | Heuristic only |
| 218 | 1380 | `.property-delta` | global | display, grid-template-columns, gap, padding | Manual review: unclassified | Heuristic only |
| 219 | 1381 | `.property-delta strong` | global | color, font-weight | Manual review: unclassified | Heuristic only |
| 220 | 1382 | `.property-delta span` | global | overflow-wrap, font-family, font-size | Manual review: unclassified | Heuristic only |
| 221 | 1384 | `.compare-controls` | @media (max-width: 980px) | grid-template-columns | Candidate: Compare | Heuristic only |
| 222 | 1385 | `.compare-controls > div:first-child` | @media (max-width: 980px) | grid-column | Candidate: Compare | Heuristic only |
| 223 | 1386 | `.compare-controls > button` | @media (max-width: 980px) | justify-self | Candidate: Compare | Heuristic only |
| 224 | 1387 | `.compare-summary` | @media (max-width: 980px) | grid-template-columns | Candidate: Compare | Heuristic only |
| 225 | 1390 | `.compare-controls, .compare-summary, .compare-metadata` | @media (max-width: 560px) | grid-template-columns | Candidate: Compare | Heuristic only |
| 226 | 1391 | `.compare-controls > div:first-child` | @media (max-width: 560px) | grid-column | Candidate: Compare | Heuristic only |
| 227 | 1393 | `/* Origin SBar chart — engineering-terminal presentation. */ .origin-chart-panel` | global | min-width, margin-top, border, border-bottom, background | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 228 | 1403 | `/* Origin range selection is a pointer-transparent overlay over the full chart. */ .origin-chart-viewport` | global | position, width, min-width | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 229 | 1410 | `.origin-selection-overlay` | global | position, z-index, inset, overflow, pointer-events | Candidate: Dataset / Catalog | Heuristic only |
| 230 | 1418 | `.origin-selection-shade` | global | position, top, bottom, background | Candidate: Dataset / Catalog | Heuristic only |
| 231 | 1425 | `.origin-selection-line` | global | position, top, bottom, width | Candidate: Dataset / Catalog | Heuristic only |
| 232 | 1432 | `.origin-selection-line-start, .origin-selection-line-end` | global | background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 233 | 1438 | `.origin-selection-line-preview` | global | border-left | Candidate: Dataset / Catalog | Heuristic only |
| 234 | 1442 | `/* Run chart has an independent chart instance and no Origin range-selection state. */ .run-chart-panel` | global | display, min-width, min-height, flex, flex-direction, margin, overflow, border, background | Candidate: Chart / Replay | Heuristic only |
| 235 | 1455 | `.run-chart-heading` | global | display, min-width, min-height, flex, align-items, justify-content, gap, padding, border-bottom, background | Candidate: Chart / Replay | Heuristic only |
| 236 | 1468 | `.run-chart-heading .chart-heading-actions` | global | margin-left, flex | Candidate: Chart / Replay | Heuristic only |
| 237 | 1473 | `.run-chart-heading .chart-tool-button` | global | min-width, min-height, padding, border, border-radius, background, color, font | Candidate: Chart / Replay | Heuristic only |
| 238 | 1484 | `.run-chart-title` | global | display, min-width, align-items | Candidate: Chart / Replay | Heuristic only |
| 239 | 1490 | `.run-chart-title-line` | global | display, min-width, align-items, gap | Candidate: Chart / Replay | Heuristic only |
| 240 | 1497 | `.run-chart-name` | global | color, font, letter-spacing, white-space | Candidate: Chart / Replay | Heuristic only |
| 241 | 1504 | `.run-chart-stage` | global | position, min-width, min-height, flex, overflow, background | Candidate: Chart / Replay | Heuristic only |
| 242 | 1513 | `/* Replay delegates its chart runtime to ChartSurface while keeping its own header, layer legend, selection markers and interaction policy. */ .run-chart-surface` | global | position, inset, width, height, min-height | Candidate: Chart / Replay | Heuristic only |
| 243 | 1523 | `.run-chart-surface > .origin-chart-viewport` | global | min-height, height, flex | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 244 | 1528 | `.run-chart-surface .origin-chart-host` | global | height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 245 | 1531 | `.run-chart-host` | global | position, inset, width, height, min-width | Candidate: Chart / Replay | Heuristic only |
| 246 | 1539 | `.run-structure-overlay` | global | position, z-index, inset, width, height, overflow, pointer-events | Manual review: unclassified | Heuristic only |
| 247 | 1549 | `.replay-target-status` | global | display, align-items, margin-left, padding, border, color, background, font-size, font-weight, letter-spacing, white-space | Candidate: Chart / Replay | Heuristic only |
| 248 | 1563 | `.run-chart-legend` | global | pointer-events | Candidate: Chart / Replay | Heuristic only |
| 249 | 1567 | `.run-chart-legend .origin-chart-legend-item` | global | pointer-events, display, align-items, gap, padding, border, border-radius, background, color, font, cursor | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 250 | 1581 | `.run-chart-legend .origin-chart-legend-item.active` | global | color | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 251 | 1585 | `.run-chart-legend .origin-chart-legend-item:hover:not(:disabled)` | global | border-color, background | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 252 | 1590 | `.run-chart-legend .origin-chart-legend-item:disabled` | global | opacity, cursor | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 253 | 1595 | `.run-chart-message` | global | position, z-index, top, left, transform, width, max-width, margin, padding, border, background, color, font-size, line-height, text-align, pointer-events | Candidate: Chart / Replay | Heuristic only |
| 254 | 1614 | `/* Stable, chart-sized default state for an unavailable Live Replay projection. */ .run-chart-host.is-empty` | global | visibility | Candidate: Chart / Replay | Heuristic only |
| 255 | 1619 | `.run-chart-empty` | global | position, z-index, inset, display, min-width, min-height, place-items, padding, background, pointer-events | Candidate: Chart / Replay | Heuristic only |
| 256 | 1634 | `.run-chart-empty-card` | global | display, width, flex-direction, align-items, gap, padding, border, border-radius, background, text-align | Candidate: Chart / Replay | Heuristic only |
| 257 | 1647 | `.run-chart-empty-kicker` | global | color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 258 | 1653 | `.run-chart-empty-title` | global | color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 259 | 1659 | `.run-chart-empty-description` | global | max-width, margin, color, font-size, line-height | Candidate: Chart / Replay | Heuristic only |
| 260 | 1667 | `.run-chart-empty-flow` | global | display, align-items, justify-content, flex-wrap, gap, margin-top, color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 261 | 1679 | `.run-chart-empty-flow i` | global | color, font-style | Candidate: Chart / Replay | Heuristic only |
| 262 | 1686 | `.run-chart-empty-card` | @media (max-width: 560px) | gap, padding | Candidate: Chart / Replay | Heuristic only |
| 263 | 1690 | `.run-chart-empty-title` | @media (max-width: 560px) | font-size | Candidate: Chart / Replay | Heuristic only |
| 264 | 1694 | `.run-chart-empty-flow` | @media (max-width: 560px) | gap, font-size | Candidate: Chart / Replay | Heuristic only |
| 265 | 1700 | `.run-chart-stage > .chart-error` | global | position, z-index, top, right, max-width, margin | Candidate: Chart / Replay | Heuristic only |
| 266 | 1709 | `.run-chart-legend` | global | position, z-index, top, right, bottom, left, display, align-items, flex-wrap, gap, color, font, pointer-events | Candidate: Chart / Replay | Heuristic only |
| 267 | 1725 | `/* Keep legend markers in the same visual state as their labels across all charts. */ .origin-chart-legend-item .legend-dot` | global | opacity | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 268 | 1730 | `.origin-chart-legend-item:not(.active):not(:disabled) .legend-dot` | global | opacity | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 269 | 1734 | `/* RunChart cannot inherit ChartSurface.vue's scoped marker-color rules. Use the same centralized tokens as Dataset for both legend color and geometry. */ .run-chart-legend .legend-dot` | global | display, width, height, flex, border-radius | Candidate: Chart / Replay | Heuristic only |
| 270 | 1744 | `.run-chart-legend .sbar-dot` | global | background | Candidate: Chart / Replay | Heuristic only |
| 271 | 1747 | `.run-chart-legend .cbar-dot` | global | background | Candidate: Chart / Replay | Heuristic only |
| 272 | 1750 | `.run-chart-legend .swing-dot` | global | background | Candidate: Chart / Replay | Heuristic only |
| 273 | 1753 | `.run-chart-legend .volume-dot` | global | background | Candidate: Chart / Replay | Heuristic only |
| 274 | 1756 | `.run-chart-legend .run-chart-structure-gap` | global | color, font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 275 | 1764 | `.run-chart-heading` | @media (max-width: 720px) | align-items, flex-wrap, gap | Candidate: Chart / Replay | Heuristic only |
| 276 | 1771 | `.origin-chart-heading` | global | display, align-items, justify-content, gap, padding, border-bottom | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 277 | 1780 | `.chart-bar-count` | global | color, font, white-space | Candidate: Chart / Replay | Heuristic only |
| 278 | 1786 | `.origin-structure-overlay` | global | position, z-index, inset, width, height, overflow, pointer-events | Manual review: unclassified | Heuristic only |
| 279 | 1796 | `.origin-chart-host` | global | width, min-width, height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 280 | 1802 | `.origin-chart-empty` | global | display, min-height, place-items, padding, color, font-size | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 281 | 1811 | `.chart-error` | global | margin | Candidate: Chart / Replay | Heuristic only |
| 282 | 1817 | `.origin-chart-host` | @media (max-width: 720px) | height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 283 | 1820 | `.origin-chart-heading` | @media (max-width: 720px) | align-items | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 284 | 1825 | `/* Trading-workstation chart hierarchy: restrained chrome, readable market data, no plot grid. */ .chart-title-block` | global | display, min-width, gap | Candidate: Chart / Replay | Heuristic only |
| 285 | 1833 | `.chart-title-block h3` | global | font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 286 | 1838 | `.chart-instrument` | global | max-width, overflow-wrap, color, font | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 287 | 1845 | `.chart-heading-actions` | global | display, align-items, gap | Candidate: Chart / Replay | Heuristic only |
| 288 | 1851 | `.chart-tool-button` | global | min-width, padding, border, background, color, font, letter-spacing, cursor | Candidate: Chart / Replay | Heuristic only |
| 289 | 1862 | `.chart-tool-button:hover:not(:disabled)` | global | border-color, color | Candidate: Chart / Replay | Heuristic only |
| 290 | 1867 | `.chart-data-strip` | global | display, min-width, align-items, flex-wrap, gap, padding, border-bottom, background | Candidate: Chart / Replay | Heuristic only |
| 291 | 1878 | `.chart-data-strip > span` | global | display, min-width, align-items, gap, font | Candidate: Chart / Replay | Heuristic only |
| 292 | 1886 | `.chart-data-strip small` | global | color, font-size | Candidate: Chart / Replay | Heuristic only |
| 293 | 1891 | `.chart-data-strip strong` | global | color, font-weight, font-variant-numeric | Candidate: Chart / Replay | Heuristic only |
| 294 | 1897 | `.chart-data-strip > span:nth-child(2) strong` | global | color | Candidate: Chart / Replay | Heuristic only |
| 295 | 1901 | `.chart-data-strip > span:nth-child(3) strong` | global | color | Candidate: Chart / Replay | Heuristic only |
| 296 | 1905 | `.chart-data-strip .chart-latest-id` | global | flex, justify-content, overflow-wrap | Candidate: Chart / Replay | Heuristic only |
| 297 | 1911 | `.chart-data-strip .chart-latest-id strong` | global | color, overflow-wrap | Candidate: Chart / Replay | Heuristic only |
| 298 | 1916 | `.origin-chart-host` | global | height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 299 | 1922 | `.origin-chart-host` | @media (max-width: 720px) | height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 300 | 1925 | `.chart-data-strip .chart-latest-id` | @media (max-width: 720px) | flex-basis, justify-content | Candidate: Chart / Replay | Heuristic only |
| 301 | 1931 | `/* Dataset owns Catalog discovery; Replay and Compare reclaim the full workspace width. */ .debugger-shell.catalog-is-hidden` | global | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace | Heuristic only |
| 302 | 1936 | `.dataset-preparation-panel` | global | display, grid-template-columns, gap, padding, border-top | Candidate: Dataset / Catalog | Heuristic only |
| 303 | 1944 | `.dataset-preparation-panel > .panel` | global | min-width | Candidate: Dataset / Catalog | Heuristic only |
| 304 | 1950 | `.dataset-preparation-panel` | @media (min-width: 1100px) | grid-template-columns, align-items | Candidate: Dataset / Catalog | Heuristic only |
| 305 | 1955 | `/* Approved workbench reconstruction: dense, full-viewport engineering terminal. */ :root` | global | --dbg-bg, --dbg-surface-1, --dbg-surface-2, --dbg-surface-3, --dbg-border, --dbg-border-strong, --dbg-text-primary, --dbg-text-secondary, --dbg-text-muted, --dbg-text-disabled, --dbg-accent, --dbg-accent-hover, --dbg-accent-subtle, --dbg-success, --dbg-warning, --dbg-error, --dbg-info, --dbg-error-surface, --dbg-selection-border, --dbg-selection-surface, --dbg-chart-up, --dbg-chart-down, --dbg-chart-neutral, --dbg-chart-unprocessed, --dbg-chart-volume-up, --dbg-chart-volume-down, --dbg-chart-cbar, --dbg-chart-swing, --dbg-chart-trend, --dbg-chart-keyzone, --dbg-chart-crosshair, --dbg-legend-sbar, --dbg-legend-cbar, --dbg-legend-swing, --dbg-legend-volume, color, background, font-size | Candidate: Shell / Workspace | Heuristic only |
| 306 | 1999 | `html, body, #app` | global | width, height, min-width, min-height, overflow | Candidate: Foundations / native controls | Heuristic only |
| 307 | 2006 | `body` | global | background | Candidate: Foundations / native controls | Heuristic only |
| 308 | 2007 | `.debugger-shell` | global | width, height, min-height, margin, padding, gap, overflow, background | Candidate: Shell / Workspace | Heuristic only |
| 309 | 2017 | `.workbench-topbar` | global | position, z-index, display, flex, min-height, height, align-items, gap, padding, border-bottom, background | Candidate: Shell / Workspace | Heuristic only |
| 310 | 2030 | `.brand-block` | global | min-width | Manual review: unclassified | Heuristic only |
| 311 | 2031 | `.brand-block h1` | global | margin, font-size, line-height, font-weight, letter-spacing | Manual review: unclassified | Heuristic only |
| 312 | 2038 | `.brand-block .eyebrow` | global | margin, color, font-size, letter-spacing | Manual review: unclassified | Heuristic only |
| 313 | 2044 | `.workspace-switcher` | global | position, left, top, height, transform, flex-wrap, gap | Candidate: Shell / Workspace | Heuristic only |
| 314 | 2053 | `.workspace-tab` | global | height, min-height, padding, border, border-radius, background, color, font | Candidate: Shell / Workspace | Heuristic only |
| 315 | 2063 | `.workspace-tab.active` | global | border-color, background, color, box-shadow | Candidate: Shell / Workspace | Heuristic only |
| 316 | 2069 | `.runtime-mark` | global | margin-left, font-size, white-space | Manual review: unclassified | Heuristic only |
| 317 | 2074 | `.debugger-shell` | global | position, display, grid-template-columns, flex, min-height, overflow | Candidate: Shell / Workspace | Heuristic only |
| 318 | 2082 | `.workbench-main` | global | min-height, overflow | Candidate: Shell / Workspace | Heuristic only |
| 319 | 2086 | `.workflow-toolbar` | global | min-height, height, padding, gap, background, border-bottom | Candidate: Shell / Workspace | Heuristic only |
| 320 | 2094 | `.workflow-toolbar h2` | global | font-size, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 321 | 2095 | `.workflow-toolbar .section-index` | global | font-size | Candidate: Shell / Workspace | Heuristic only |
| 322 | 2096 | `.toolbar-actions` | global | flex-wrap | Manual review: unclassified | Heuristic only |
| 323 | 2097 | `.subtle-button` | global | padding, border-radius, background, font-size | Manual review: unclassified | Heuristic only |
| 324 | 2103 | `.primary-workspace` | global | display, grid-template-columns, min-height, overflow | Candidate: Shell / Workspace | Heuristic only |
| 325 | 2109 | `.workspace-content` | global | min-height, gap, padding, overflow, background | Candidate: Shell / Workspace | Heuristic only |
| 326 | 2116 | `.inspector-rail` | global | min-height, padding, overflow, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 327 | 2123 | `.rail-heading` | global | position, top, z-index, min-height, height, padding, border-bottom, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 328 | 2133 | `.rail-heading .section-index` | global | color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 329 | 2134 | `.inspector-placeholder` | global | min-height, margin, padding, gap, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 330 | 2142 | `.inspector-placeholder .placeholder-mark` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 331 | 2143 | `.inspector-placeholder h3` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 332 | 2144 | `.inspector-placeholder p, .inspector-placeholder small` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 333 | 2145 | `.catalog-rail` | global | position, z-index, left, top, bottom, width, padding, border, background, box-shadow | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 334 | 2157 | `.catalog-rail.collapsed` | global | width | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 335 | 2158 | `.debugger-shell.catalog-is-hidden .catalog-rail` | global | display | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 336 | 2159 | `.catalog-rail .rail-heading` | global | margin | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 337 | 2160 | `.catalog-rail .catalog-panel` | global | margin-top | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 338 | 2161 | `.catalog-rail .instrument-group-row` | global | padding | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 339 | 2162 | `.catalog-rail .dataset-row` | global | padding | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 340 | 2163 | `.catalog-rail .load-options` | global | margin-top, padding-top | Manual review: Dataset / Catalog + Dock / Inspector / Diagnostics | Heuristic only |
| 341 | 2164 | `.dataset-preparation-panel` | global | display, grid-template-columns, gap, padding, border-top | Candidate: Dataset / Catalog | Heuristic only |
| 342 | 2171 | `.dataset-preparation-panel > .panel` | global | padding | Candidate: Dataset / Catalog | Heuristic only |
| 343 | 2172 | `.origin-chart-panel, .run-chart-panel` | global | margin, border-color, border-radius, background | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 344 | 2178 | `.origin-chart-heading` | global | min-height, padding, align-items, background, border-bottom-color | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 345 | 2185 | `.chart-title-block` | global | gap | Candidate: Chart / Replay | Heuristic only |
| 346 | 2186 | `.chart-title-block h3` | global | font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 347 | 2187 | `.chart-title-block .section-index` | global | font-size | Candidate: Chart / Replay | Heuristic only |
| 348 | 2188 | `.chart-instrument` | global | font-size | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 349 | 2189 | `.chart-bar-count` | global | font-size | Candidate: Chart / Replay | Heuristic only |
| 350 | 2190 | `.chart-data-strip` | global | gap, padding, background, border-bottom-color | Candidate: Chart / Replay | Heuristic only |
| 351 | 2196 | `.chart-data-strip > span` | global | font-size | Candidate: Chart / Replay | Heuristic only |
| 352 | 2197 | `.chart-data-strip small` | global | font-size | Candidate: Chart / Replay | Heuristic only |
| 353 | 2198 | `.chart-data-strip strong` | global | font-size | Candidate: Chart / Replay | Heuristic only |
| 354 | 2199 | `.origin-chart-host` | global | height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 355 | 2200 | `.run-chart-host` | global | height | Candidate: Chart / Replay | Heuristic only |
| 356 | 2201 | `.chart-selection-hint` | global | margin, font-size | Candidate: Chart / Replay | Heuristic only |
| 357 | 2202 | `.diagnostics-dock` | global | position, z-index, flex, min-height, height, padding, overflow, border, border-left, border-right, border-radius, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 358 | 2216 | `/* Let an open Diagnostics dock menu escape the panel's normal clipping. */ .diagnostics-dock:has(.dock-menu[open])` | global | overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 359 | 2221 | `.diagnostics-heading` | global | min-height, height, margin, padding, border-bottom, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 360 | 2229 | `.diagnostics-heading h2` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 361 | 2230 | `.diagnostics-content` | global | min-height, height, padding, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 362 | 2236 | `.diagnostics-reopen` | global | position, z-index, right, bottom, margin, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 363 | 2244 | `.footer-bar` | global | display | Candidate: Shell / Workspace | Heuristic only |
| 364 | 2247 | `.panel, .operations-panel, .snapshot-panel` | global | border-color, background | Candidate: Dataset / Catalog | Heuristic only |
| 365 | 2251 | `.panel-heading` | global | min-height, margin-bottom | Manual review: unclassified | Heuristic only |
| 366 | 2255 | `h2` | global | font-size | Manual review: unclassified | Heuristic only |
| 367 | 2256 | `h3` | global | font-size | Manual review: unclassified | Heuristic only |
| 368 | 2257 | `.metric, .origin-identity, .range-summary > div` | global | background | Manual review: unclassified | Heuristic only |
| 369 | 2258 | `.primary-button` | global | width, padding, border-radius, font-size | Manual review: unclassified | Heuristic only |
| 370 | 2264 | `.compare-controls` | global | gap, margin-top, padding, background | Candidate: Compare | Heuristic only |
| 371 | 2270 | `.compare-summary > div` | global | padding | Candidate: Compare | Heuristic only |
| 372 | 2271 | `.snapshot-panel` | global | padding | Candidate: Dataset / Catalog | Heuristic only |
| 373 | 2272 | `table` | global | font-size | Manual review: unclassified | Heuristic only |
| 374 | 2273 | `th, td` | global | padding | Manual review: unclassified | Heuristic only |
| 375 | 2274 | `.error-message` | global | padding, font-size | Manual review: unclassified | Heuristic only |
| 376 | 2275 | `.empty-state` | global | padding, font-size | Manual review: unclassified | Heuristic only |
| 377 | 2277 | `.dataset-preparation-panel` | @media (max-width: 1100px) | grid-template-columns | Candidate: Dataset / Catalog | Heuristic only |
| 378 | 2279 | `/* Native dock splitters: pointer-driven, bounded resizing with visible grab affordance. */ .primary-workspace` | global | grid-template-columns | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 379 | 2285 | `.diagnostics-dock` | global | flex-basis, height, min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 380 | 2290 | `.panel-resize-edge` | global | position, z-index, background, touch-action | Manual review: unclassified | Heuristic only |
| 381 | 2296 | `.panel-resize-edge:hover, .panel-resize-edge:active` | global | background | Manual review: unclassified | Heuristic only |
| 382 | 2300 | `.panel-resize-edge:focus-visible` | global | outline, outline-offset, background | Manual review: unclassified | Heuristic only |
| 383 | 2305 | `.inspector-resize-edge` | global | left, top, bottom, width, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 384 | 2312 | `.diagnostics-resize-edge` | global | top, left, right, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 385 | 2319 | `.inspector-rail` | global | position | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 386 | 2320 | `.diagnostics-dock` | global | position | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 387 | 2321 | `.inspector-rail.collapsed .inspector-resize-edge` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 388 | 2322 | `/* Inspector side docking uses the primary workspace's column tracks. */ .primary-workspace.inspector-dock-left` | global | grid-template-columns | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 389 | 2329 | `.primary-workspace.inspector-dock-left .inspector-rail` | global | grid-column, grid-row, border-right, border-left | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 390 | 2335 | `.primary-workspace.inspector-dock-left .workspace-content` | global | grid-column, grid-row | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 391 | 2339 | `.primary-workspace.inspector-dock-left .inspector-resize-edge` | global | left, right | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 392 | 2343 | `.dock-actions` | global | display, align-items, gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 393 | 2348 | `.dock-menu` | global | position, display, flex | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 394 | 2353 | `.dock-menu > summary` | global | display, align-items, justify-content, min-width, list-style, cursor, user-select | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 395 | 2362 | `.dock-menu > summary::-webkit-details-marker` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 396 | 2363 | `.dock-menu > summary::marker` | global | content | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 397 | 2364 | `/* Dock-header icon controls are borderless at rest; hovering reveals a frame. */ .inspector-rail .rail-heading > .dock-menu > summary, .inspector-rail .rail-heading > .rail-toggle, .diagnostics-dock .dock-actions > .dock-menu > summary, .diagnostics-dock .dock-actions > [data-testid="diagnostics-collapse-toggle"]` | global | width, min-width, height, padding, border, border-radius, background, color, box-shadow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 398 | 2380 | `.inspector-rail .rail-heading > .dock-menu > summary:hover, .inspector-rail .rail-heading > .rail-toggle:hover, .diagnostics-dock .dock-actions > .dock-menu > summary:hover, .diagnostics-dock .dock-actions > [data-testid="diagnostics-collapse-toggle"]:hover` | global | border-color, background, color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 399 | 2389 | `.dock-menu[open] > summary` | global | color, background, box-shadow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 400 | 2395 | `.dock-menu-options` | global | position, z-index, top, right, display, grid-template-columns, min-width, padding, gap, border, border-radius, background, box-shadow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 401 | 2410 | `.dock-menu-option` | global | min-height, padding, border, border-radius, background, color, text-align, font, letter-spacing, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 402 | 2422 | `.dock-menu-option:hover` | global | border-color, background, color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 403 | 2427 | `.dock-menu-option[aria-pressed="true"]` | global | background, color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 404 | 2431 | `.dock-menu-option[aria-pressed="true"]::before` | global | content | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 405 | 2434 | `.dock-menu summary:focus-visible, .dock-menu-option:focus-visible` | global | outline, outline-offset | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 406 | 2439 | `.dock-actions .subtle-button` | global | flex | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 407 | 2440 | `/* Object Inspector — exact fields from the currently selected authoritative SBar. */ .inspector-object` | global | min-width, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 408 | 2448 | `.inspector-runtime-context` | global | display, min-width, flex-wrap, gap, margin, padding, border-bottom, color, font, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 409 | 2460 | `.inspector-runtime-context span` | global | min-width, overflow-wrap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 410 | 2465 | `.inspector-runtime-context code` | global | color, font | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 411 | 2470 | `.inspector-object-heading` | global | display, min-width, align-items, justify-content, gap, padding-bottom, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 412 | 2480 | `.inspector-object-heading .section-index` | global | margin, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 413 | 2484 | `.inspector-object-heading h3` | global | margin, color, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 414 | 2489 | `.inspector-object-kind` | global | flex, padding, border, color, font, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 415 | 2497 | `.inspector-fields` | global | display, gap, margin | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 416 | 2502 | `.inspector-field` | global | display, min-width, grid-template-columns, gap, padding, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 417 | 2510 | `.inspector-field dt, .inspector-market-grid dt` | global | color, font, text-transform, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 418 | 2517 | `.inspector-field dd, .inspector-market-grid dd` | global | min-width, margin, color, font, font-variant-numeric, overflow-wrap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 419 | 2526 | `.inspector-field code` | global | color, font, user-select | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 420 | 2531 | `.inspector-subsection` | global | margin-top | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 421 | 2534 | `.inspector-subsection > .section-index` | global | margin, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 422 | 2538 | `.inspector-market-grid` | global | display, grid-template-columns, gap, margin, background, border | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 423 | 2546 | `.inspector-market-grid > div` | global | display, min-width, gap, padding, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 424 | 2553 | `.inspector-market-grid dd` | global | font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 425 | 2556 | `.inspector-market-grid .inspector-volume` | global | grid-column, grid-template-columns, align-items | Manual review: Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 426 | 2561 | `.inspector-copy-status` | global | margin, color, font, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 427 | 2567 | `.inspector-provenance` | global | margin, color, font-size, line-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 428 | 2574 | `.inspector-empty` | global | display, min-width, min-height, flex-direction, align-items, justify-content, gap, margin, padding, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 429 | 2587 | `.inspector-empty .placeholder-mark` | global | color, font | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 430 | 2591 | `.inspector-empty h3` | global | margin, font-size | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 431 | 2595 | `.inspector-empty p, .inspector-empty small` | global | margin, color, font-size, line-height, overflow-wrap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 432 | 2603 | `.inspector-empty small` | global | color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 433 | 2606 | `.difference-row-selected` | global | background | Candidate: Compare | Heuristic only |
| 434 | 2608 | `.difference-select-button` | global | max-width, padding, border, background, color, font, text-align, overflow-wrap, cursor | Candidate: Compare | Heuristic only |
| 435 | 2619 | `.difference-select-button:hover, .difference-select-button:focus-visible` | global | border-color, outline | Candidate: Compare | Heuristic only |
| 436 | 2621 | `.difference-select-button.selected` | global | border-color, color | Candidate: Compare | Heuristic only |
| 437 | 2622 | `.inspector-difference-properties` | global | display, gap | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 438 | 2623 | `.inspector-difference-property` | global | min-width, padding-top, border-top | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 439 | 2624 | `.inspector-difference-property > strong` | global | display, margin-bottom, font-size, overflow-wrap | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 440 | 2625 | `.inspector-difference-values` | global | display, gap | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 441 | 2626 | `.inspector-difference-values > div` | global | display, grid-template-columns, gap | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 442 | 2627 | `.inspector-difference-values span` | global | color, font-size, letter-spacing | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 443 | 2628 | `.inspector-difference-values code` | global | color, font-size, white-space, overflow-wrap | Manual review: Dock / Inspector / Diagnostics + Compare | Heuristic only |
| 444 | 2629 | `.difference-kind-added` | global | color | Candidate: Compare | Heuristic only |
| 445 | 2630 | `.difference-kind-removed` | global | color | Candidate: Compare | Heuristic only |
| 446 | 2631 | `.difference-kind-modified` | global | color | Candidate: Compare | Heuristic only |
| 447 | 2632 | `.inspector-object-list` | global | display, gap, max-height, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 448 | 2639 | `.inspector-object-row` | global | display, min-width, align-items, justify-content, gap, padding, border, background, color, text-align, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 449 | 2652 | `.inspector-object-row > span` | global | display, min-width, gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 450 | 2657 | `.inspector-object-row strong, .inspector-object-row code` | global | font-size, overflow-wrap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 451 | 2662 | `.inspector-object-row small` | global | color, font-size, overflow-wrap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 452 | 2667 | `.inspector-object-row:hover, .inspector-object-row:focus-visible` | global | border-color, outline | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 453 | 2672 | `.inspector-object-row.selected` | global | border-color, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 454 | 2676 | `.inspector-list-heading` | global | margin-top | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 455 | 2677 | `/* Native drag handles for changing a panel's dock without moving its contents. */ .panel-dock-drag-handle` | global | cursor, user-select, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 456 | 2684 | `.panel-dock-drag-handle:hover` | global | color, border-bottom-color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 457 | 2689 | `.panel-dock-drag-handle:active` | global | cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 458 | 2693 | `/* Replay / Compare dual-chart workspace shell. */ .dual-chart-stack` | global | --upper-chart-track, --lower-chart-track, display, grid-template-rows, flex, min-width, min-height, overflow, border, background | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 459 | 2712 | `.dual-chart-track` | global | display, min-width, min-height, flex-direction, overflow | Candidate: Chart / Replay | Heuristic only |
| 460 | 2720 | `.dual-chart-track > *` | global | flex, min-width, min-height, height | Candidate: Chart / Replay | Heuristic only |
| 461 | 2727 | `.dual-chart-track > .run-chart-panel` | global | display, min-height, flex-direction, border, border-radius | Candidate: Chart / Replay | Heuristic only |
| 462 | 2735 | `.dual-chart-track .run-chart-host` | global | flex, min-height, height | Candidate: Chart / Replay | Heuristic only |
| 463 | 2741 | `.dual-chart-splitter` | global | position, z-index, display, min-height, align-items, justify-content, border, background, cursor, touch-action | Manual review: Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 464 | 2754 | `.dual-chart-splitter:hover, .dual-chart-splitter:focus-visible` | global | background | Manual review: Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 465 | 2759 | `/* The splitter is programmatically focused on hover for immediate arrow-key resizing. Suppress browser/user-agent focus rings so moving across the chart boundary never flashes a border, including after keyboard input makes :focus-visible match. */ .dual-chart-splitter:focus, .dual-chart-splitter:focus-visible` | global | outline, box-shadow | Manual review: Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 466 | 2768 | `.snapshot-reference-panel, .comparison-chart-panel` | global | display, min-width, min-height, height, border-top, flex-direction, overflow, background | Candidate: Chart / Replay | Heuristic only |
| 467 | 2780 | `.snapshot-reference-heading` | global | display, min-height, align-items, justify-content, gap, padding, border-bottom, background | Candidate: Chart / Replay | Heuristic only |
| 468 | 2791 | `.comparison-chart-heading` | global | display, flex, min-height, align-items, justify-content, gap, padding, border-bottom, background | Candidate: Chart / Replay | Heuristic only |
| 469 | 2803 | `.snapshot-reference-title` | global | display, min-width, align-items, gap | Candidate: Chart / Replay | Heuristic only |
| 470 | 2810 | `.snapshot-reference-sync-indicator` | global | display, flex, align-items, justify-content, color, font, cursor | Candidate: Chart / Replay | Heuristic only |
| 471 | 2820 | `.snapshot-reference-heading h3` | global | margin, font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 472 | 2826 | `.comparison-chart-heading h3` | global | min-width, margin, font-size, line-height, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 473 | 2834 | `.snapshot-reference-select` | global | position, display, min-width, align-items, gap, color, font | Candidate: Chart / Replay | Heuristic only |
| 474 | 2844 | `.snapshot-reference-instrument` | global | max-width, overflow, color, text-overflow, white-space | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 475 | 2852 | `.snapshot-reference-control` | global | position, display, min-width, flex, font, cursor | Candidate: Chart / Replay | Heuristic only |
| 476 | 2861 | `.snapshot-reference-control::after` | global | position, top, right, width, height, border-right, border-bottom, content, pointer-events, transform | Candidate: Chart / Replay | Heuristic only |
| 477 | 2874 | `.snapshot-reference-selected-label` | global | position, z-index, right, bottom, left, display, overflow, color, font, line-height, pointer-events, white-space | Candidate: Chart / Replay | Heuristic only |
| 478 | 2889 | `.snapshot-reference-select select` | global | width, min-width, height, padding, appearance, border, border-radius, background, color, font, color-scheme | Candidate: Chart / Replay | Heuristic only |
| 479 | 2903 | `.snapshot-reference-select select option` | global | background, color | Candidate: Chart / Replay | Heuristic only |
| 480 | 2908 | `.snapshot-reference-select select:hover:not(:disabled)` | global | background | Candidate: Chart / Replay | Heuristic only |
| 481 | 2912 | `.snapshot-reference-select select:focus-visible` | global | outline | Candidate: Chart / Replay | Heuristic only |
| 482 | 2916 | `.snapshot-reference-select select:disabled` | global | color, cursor, opacity | Candidate: Chart / Replay | Heuristic only |
| 483 | 2922 | `.snapshot-reference-select select option` | global | background, color | Candidate: Chart / Replay | Heuristic only |
| 484 | 2927 | `.snapshot-reference-stage` | global | position, display, min-width, min-height, flex, align-items, justify-content, padding, overflow, background | Candidate: Chart / Replay | Heuristic only |
| 485 | 2940 | `.snapshot-reference-stage.has-reference` | global | align-items, justify-content | Candidate: Chart / Replay | Heuristic only |
| 486 | 2945 | `.snapshot-reference-stage.has-reference` | global | padding, overflow | Candidate: Chart / Replay | Heuristic only |
| 487 | 2950 | `.snapshot-reference-loading` | global | display, min-width, flex-direction, align-items, justify-content, gap, padding, color, text-align, font | Candidate: Chart / Replay | Heuristic only |
| 488 | 2963 | `.snapshot-reference-loading strong` | global | color, font-size, font-weight, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 489 | 2970 | `.snapshot-reference-loading-spinner` | global | width, height, border, border-top-color, border-radius, animation | Candidate: Chart / Replay | Heuristic only |
| 490 | 2981 | `to` | @keyframes snapshot-reference-spin | transform | Manual review: unclassified | Heuristic only |
| 491 | 2985 | `.snapshot-reference-loading-spinner` | @media (prefers-reduced-motion: reduce) | animation-duration | Candidate: Chart / Replay | Heuristic only |
| 492 | 2989 | `.snapshot-reference-chart` | global | display, width, height, min-width, min-height, overflow | Candidate: Chart / Replay | Heuristic only |
| 493 | 2998 | `.snapshot-reference-chart > .origin-chart-panel` | global | width, height, min-width, min-height | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 494 | 3005 | `.reference-status-dot-error` | global | background | Manual review: unclassified | Heuristic only |
| 495 | 3009 | `.snapshot-reference-state` | global | display, width, flex-direction, gap, padding, border, background | Candidate: Chart / Replay | Heuristic only |
| 496 | 3019 | `.snapshot-reference-identity` | global | display, min-width, align-items, gap, font | Candidate: Chart / Replay | Heuristic only |
| 497 | 3027 | `.snapshot-reference-identity strong` | global | overflow-wrap, color | Candidate: Chart / Replay | Heuristic only |
| 498 | 3032 | `.reference-status-dot` | global | width, height, flex, border-radius, background | Manual review: unclassified | Heuristic only |
| 499 | 3040 | `.reference-tag, .comparison-chart-state` | global | padding, border, color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 500 | 3049 | `.snapshot-reference-unavailable, .snapshot-reference-empty p, .comparison-chart-empty p` | global | max-width, margin, color, font-size, line-height | Candidate: Chart / Replay | Heuristic only |
| 501 | 3059 | `.snapshot-reference-empty, .comparison-chart-empty` | global | display, min-width, flex-direction, align-items, justify-content, gap | Candidate: Chart / Replay | Heuristic only |
| 502 | 3069 | `.snapshot-reference-empty strong, .comparison-chart-empty strong` | global | color, font-size, font-weight | Candidate: Chart / Replay | Heuristic only |
| 503 | 3076 | `.snapshot-reference-foot` | global | display, height, min-height, min-width, flex, align-items, gap, padding, overflow, background, color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 504 | 3092 | `.snapshot-reference-foot span` | global | min-width, overflow, text-overflow, white-space | Candidate: Chart / Replay | Heuristic only |
| 505 | 3099 | `.snapshot-reference-foot b` | global | color, font-weight, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 506 | 3105 | `.snapshot-reference-foot .snapshot-reference-state-key` | global | margin-left | Candidate: Chart / Replay | Heuristic only |
| 507 | 3109 | `.comparison-chart-state` | global | flex, white-space | Candidate: Chart / Replay | Heuristic only |
| 508 | 3114 | `.comparison-chart-empty > span` | global | color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 509 | 3122 | `.dual-chart-stack` | @media (max-height: 760px) | flex-basis, grid-template-rows | Candidate: Chart / Replay | Heuristic only |
| 510 | 3129 | `.snapshot-reference-foot` | @media (max-height: 760px) | gap, flex-wrap, padding | Candidate: Chart / Replay | Heuristic only |
| 511 | 3136 | `/* Explicit App Shell geometry: four direct regions; chart content begins below the 44px Topbar. */ .debugger-shell` | global | position, display, flex, min-width, min-height, overflow | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 512 | 3149 | `.workbench-main` | global | position, inset, display, min-width, min-height, flex-direction | Candidate: Shell / Workspace | Heuristic only |
| 513 | 3162 | `/* Keep the Chart Workspace edge 5px above bottom-docked Diagnostics, matching the Inspector-to-Diagnostics gap without shrinking chart content internally. */ .debugger-shell.diagnostics-dock-bottom .workbench-main` | global | bottom | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 514 | 3172 | `.chart-panels` | global | display, grid-template-columns, flex, min-width, min-height, overflow | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 515 | 3181 | `.chart-panels.catalog-is-collapsed` | global | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 516 | 3185 | `.debugger-shell.catalog-is-hidden .chart-panels` | global | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 517 | 3189 | `.chart-panels > .catalog-rail` | global | min-width, min-height, padding, overflow, border-right, background | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 518 | 3198 | `.chart-panels > .catalog-rail.collapsed` | global | padding | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 519 | 3202 | `.chart-panels > .catalog-rail.collapsed > :not(.rail-heading)` | global | display | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 520 | 3206 | `.chart-panels > .workspace-content` | global | min-width, min-height, flex, overflow | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 521 | 3213 | `.inspector-rail` | global | position, z-index, display, min-width, min-height, flex-direction, padding, overflow, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 522 | 3226 | `.inspector-rail.dock-left, .inspector-rail.dock-right` | global | bottom, width | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 523 | 3235 | `.inspector-rail.dock-left` | global | left, right, border-right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 524 | 3241 | `.inspector-rail.dock-right` | global | right, left, border-left | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 525 | 3247 | `.inspector-rail.dock-top, .inspector-rail.dock-bottom` | global | right, height, flex-direction | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 526 | 3257 | `.inspector-rail.dock-top` | global | top, bottom, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 527 | 3263 | `.inspector-rail.dock-bottom` | global | bottom, top, border-top | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 528 | 3269 | `.inspector-rail.collapsed.dock-left, .inspector-rail.collapsed.dock-right` | global | width, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 529 | 3275 | `.inspector-rail.collapsed.dock-top, .inspector-rail.collapsed.dock-bottom` | global | height, min-height, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 530 | 3282 | `.inspector-rail.collapsed > :not(.rail-heading)` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 531 | 3286 | `.inspector-rail .rail-heading` | global | position, flex, min-height, padding, border-bottom, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 532 | 3295 | `.inspector-rail .panel-title` | global | color, font-size, font-weight, letter-spacing, text-transform, white-space | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 533 | 3304 | `.inspector-rail .inspector-object-tag` | global | padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 534 | 3308 | `.inspector-rail.collapsed .panel-title` | global | writing-mode, transform, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 535 | 3314 | `.inspector-rail.collapsed .inspector-object-tag, .inspector-rail.collapsed .dock-menu` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 536 | 3319 | `.inspector-rail.collapsed .rail-heading` | global | min-height, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 537 | 3324 | `.inspector-rail.collapsed .rail-heading.collapsed-heading-click-target` | global | cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 538 | 3328 | `.inspector-rail .panel-resize-edge` | global | position, z-index | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 539 | 3333 | `.inspector-rail.dock-left .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 540 | 3338 | `.inspector-rail.dock-right .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 541 | 3343 | `.inspector-rail.dock-top .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 542 | 3348 | `.inspector-rail.dock-bottom .inspector-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 543 | 3353 | `.inspector-rail.collapsed .inspector-resize-edge` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 544 | 3357 | `.inspector-rail.dock-left .dock-menu-options, .inspector-rail.dock-right .dock-menu-options` | global | right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 545 | 3362 | `.diagnostics-dock` | global | position, z-index, display, min-width, min-height, padding, overflow, border, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 546 | 3374 | `.diagnostics-dock.dock-left, .diagnostics-dock.dock-right` | global | top, bottom, width, height, flex-direction | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 547 | 3383 | `.diagnostics-dock.dock-left` | global | left, right, border-right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 548 | 3385 | `.diagnostics-dock.dock-right` | global | right, left, border-left | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 549 | 3386 | `.diagnostics-dock.dock-top, .diagnostics-dock.dock-bottom` | global | left, right, width, height, flex-direction | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 550 | 3395 | `.diagnostics-dock.dock-top` | global | top, bottom, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 551 | 3397 | `.diagnostics-dock.dock-bottom` | global | bottom, top, border-top | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 552 | 3398 | `.diagnostics-dock .diagnostics-heading` | global | position, display, flex, min-width, min-height, align-items, gap, margin, padding, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 553 | 3411 | `.diagnostics-dock .diagnostics-title-block` | global | display, flex, min-width, align-items, gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 554 | 3419 | `.diagnostics-dock .diagnostics-title-block` | global | gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 555 | 3423 | `.diagnostics-dock .diagnostics-panel-title` | global | color, font-size, font-weight, letter-spacing, text-transform, white-space | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 556 | 3432 | `.diagnostics-dock .diagnostics-tabs` | global | display, flex, align-self, align-items, gap, min-width, overflow-x, scrollbar-width, scrollbar-color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 557 | 3444 | `.diagnostics-dock .diagnostics-tabs button` | global | flex, height, padding, border, border-bottom, border-radius, background, color, font-size, white-space, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 558 | 3458 | `.diagnostics-dock .diagnostics-tabs button.active` | global | border-bottom-color, color | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 559 | 3463 | `.diagnostics-dock .dock-actions` | global | display, flex, align-items, justify-content, gap | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 560 | 3471 | `.diagnostics-dock .diagnostics-content` | global | flex, width, height, min-width, min-height, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 561 | 3480 | `.diagnostics-dock .panel-resize-edge` | global | position, z-index | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 562 | 3482 | `.diagnostics-dock.dock-left .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 563 | 3487 | `.diagnostics-dock.dock-right .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 564 | 3492 | `.diagnostics-dock.dock-top .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 565 | 3497 | `.diagnostics-dock.dock-bottom .diagnostics-resize-edge` | global | top, right, bottom, left, width, height, cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 566 | 3502 | `/* Side docks stack the title row above the category row, as in the frozen prototype. */ .diagnostics-dock.dock-left .diagnostics-heading, .diagnostics-dock.dock-right .diagnostics-heading` | global | min-height, align-items, flex-direction, gap, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 567 | 3512 | `.diagnostics-dock.dock-left .diagnostics-title-block, .diagnostics-dock.dock-right .diagnostics-title-block` | global | min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 568 | 3517 | `.diagnostics-dock.dock-left .diagnostics-tabs, .diagnostics-dock.dock-right .diagnostics-tabs` | global | flex, width, height, min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 569 | 3525 | `.diagnostics-dock.dock-left .dock-actions, .diagnostics-dock.dock-right .dock-actions` | global | position, top, right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 570 | 3532 | `.diagnostics-dock.dock-left .diagnostics-title-block, .diagnostics-dock.dock-right .diagnostics-title-block` | global | padding-right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 571 | 3537 | `/* Horizontal docks hide only the title block. Categories lead the row and the same action controls follow immediately on their right. */ .diagnostics-dock.dock-top .diagnostics-heading, .diagnostics-dock.dock-bottom .diagnostics-heading` | global | min-height, height, flex-direction, gap, padding, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 572 | 3549 | `.diagnostics-dock.dock-top .diagnostics-title-block, .diagnostics-dock.dock-bottom .diagnostics-title-block` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 573 | 3554 | `.diagnostics-dock.dock-top .diagnostics-tabs, .diagnostics-dock.dock-bottom .diagnostics-tabs` | global | flex, min-width, order | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 574 | 3561 | `.diagnostics-dock.dock-top .dock-actions, .diagnostics-dock.dock-bottom .dock-actions` | global | position, order, margin-left | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 575 | 3568 | `.diagnostics-reopen` | global | position, z-index, margin | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 576 | 3574 | `.debugger-shell.diagnostics-dock-left .diagnostics-reopen` | global | left, top, right, bottom, writing-mode | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 577 | 3576 | `.debugger-shell.diagnostics-dock-right .diagnostics-reopen` | global | right, top, left, bottom, writing-mode | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 578 | 3577 | `.debugger-shell.diagnostics-dock-top .diagnostics-reopen` | global | left, top, right, bottom | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 579 | 3578 | `.debugger-shell.diagnostics-dock-bottom .diagnostics-reopen` | global | left, bottom, right, top | Manual review: Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 580 | 3579 | `.diagnostics-dock.dock-top .dock-menu-options, .diagnostics-dock.dock-bottom .dock-menu-options, .inspector-rail.dock-top .dock-menu-options, .inspector-rail.dock-bottom .dock-menu-options` | global | grid-template-columns, min-width | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 581 | 3589 | `.chart-panels` | @media (min-width: 1600px) | grid-template-columns | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 582 | 3590 | `.chart-panels.catalog-is-collapsed` | @media (min-width: 1600px) | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 583 | 3594 | `.chart-panels, .chart-panels.catalog-is-collapsed, .debugger-shell.catalog-is-hidden .chart-panels` | @media (max-width: 760px) | grid-template-columns | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 584 | 3599 | `.chart-panels > .catalog-rail` | @media (max-width: 760px) | max-height, border-right, border-bottom | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 585 | 3606 | `/* Prototype spacing pass — keep the workbench dense and align controls to shared rows. */ :root` | global | line-height | Candidate: Shell / Workspace | Heuristic only |
| 586 | 3611 | `.debugger-shell` | global | gap | Candidate: Shell / Workspace | Heuristic only |
| 587 | 3615 | `.workflow-toolbar` | global | display, flex, min-width, align-items, justify-content, gap, padding, overflow | Candidate: Shell / Workspace | Heuristic only |
| 588 | 3626 | `.workflow-toolbar > div:first-child` | global | display, min-width, align-items, gap | Candidate: Shell / Workspace | Heuristic only |
| 589 | 3633 | `.workflow-toolbar .section-index` | global | flex, margin, white-space, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 590 | 3640 | `.workflow-toolbar h2` | global | min-width, margin, line-height, white-space | Candidate: Shell / Workspace | Heuristic only |
| 591 | 3647 | `.toolbar-actions` | global | display, flex, align-items, gap, margin-left | Manual review: unclassified | Heuristic only |
| 592 | 3655 | `.subtle-button` | global | min-height, padding, line-height | Manual review: unclassified | Heuristic only |
| 593 | 3661 | `.chart-panels` | global | gap | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 594 | 3665 | `.chart-panels > .catalog-rail` | global | padding, border-right | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics + Chart / Replay | Heuristic only |
| 595 | 3670 | `.chart-panels > .workspace-content` | global | display, min-width, min-height, flex-direction, gap, padding, overflow | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 596 | 3680 | `.workspace-mode` | global | min-width, min-height | Candidate: Shell / Workspace | Heuristic only |
| 597 | 3685 | `.replay-controls, .compare-workspace` | global | display, flex, flex-direction, gap | Manual review: Shell / Workspace + Chart / Replay + Compare | Heuristic only |
| 598 | 3693 | `.replay-controls > .dual-chart-stack, .compare-workspace > .dual-chart-stack` | global | flex, min-width, min-height | Manual review: Shell / Workspace + Chart / Replay + Compare | Heuristic only |
| 599 | 3700 | `.inspector-rail` | global | padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 600 | 3704 | `.inspector-rail .rail-heading` | global | display, flex, min-width, align-items, gap, margin, padding, border-bottom, background | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 601 | 3716 | `.inspector-rail .rail-heading .panel-dock-drag-handle` | global | min-width, margin, white-space | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 602 | 3722 | `.inspector-rail .rail-heading .dock-menu` | global | margin-left | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 603 | 3726 | `.inspector-rail > .inspector-object` | global | min-width, min-height, flex, overflow | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 604 | 3733 | `.diagnostics-dock .diagnostics-heading` | global | flex, min-height, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 605 | 3739 | `.diagnostics-dock .diagnostics-content` | global | padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 606 | 3745 | `.workflow-toolbar` | @media (max-width: 1100px) | gap, padding-inline | Candidate: Shell / Workspace | Heuristic only |
| 607 | 3749 | `.workflow-toolbar > div:first-child` | @media (max-width: 1100px) | gap | Candidate: Shell / Workspace | Heuristic only |
| 608 | 3753 | `.workflow-toolbar h2` | @media (max-width: 1100px) | overflow, text-overflow | Candidate: Shell / Workspace | Heuristic only |
| 609 | 3758 | `.toolbar-actions` | @media (max-width: 1100px) | gap | Manual review: unclassified | Heuristic only |
| 610 | 3763 | `/* Match the frozen prototype's Topbar tab anchor and compact control geometry. */ .workbench-topbar .workspace-tabs` | global | position, top, left, height, transform, z-index, flex, gap | Candidate: Shell / Workspace | Heuristic only |
| 611 | 3775 | `.workbench-topbar .workspace-tab` | global | height, min-height, padding, line-height, font-family, font-size, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 612 | 3785 | `.workbench-topbar .brand` | global | gap, white-space | Candidate: Shell / Workspace | Heuristic only |
| 613 | 3790 | `.workbench-topbar .top-right` | global | position, z-index, gap, margin-left | Candidate: Shell / Workspace | Heuristic only |
| 614 | 3799 | `.workbench-topbar .workspace-tab` | @media (max-width: 1050px) | padding-right, padding-left | Candidate: Shell / Workspace | Heuristic only |
| 615 | 3803 | `.workbench-topbar .top-right` | @media (max-width: 1050px) | gap | Candidate: Shell / Workspace | Heuristic only |
| 616 | 3808 | `/* Frozen-prototype panel dimensions and collapsed rails. */ .inspector-rail.collapsed.dock-left, .inspector-rail.collapsed.dock-right` | global | width, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 617 | 3816 | `.inspector-rail.collapsed .rail-heading` | global | height, min-height, flex, flex-direction, justify-content, gap, padding, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 618 | 3827 | `.inspector-rail.collapsed .panel-dock-drag-handle` | global | writing-mode, transform | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 619 | 3832 | `.inspector-rail.collapsed .dock-menu` | global | margin | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 620 | 3836 | `.diagnostics-dock.collapsed.dock-left, .diagnostics-dock.collapsed.dock-right` | global | width, min-width | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 621 | 3842 | `.diagnostics-dock.collapsed.dock-top, .diagnostics-dock.collapsed.dock-bottom` | global | height, min-height | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 622 | 3848 | `.diagnostics-dock.collapsed .diagnostics-content, .diagnostics-dock.collapsed .diagnostics-resize-edge` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 623 | 3853 | `.diagnostics-dock.collapsed .diagnostics-heading` | global | height, min-height, flex | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 624 | 3859 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading, .diagnostics-dock.collapsed.dock-right .diagnostics-heading` | global | flex-direction, justify-content, gap, padding, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 625 | 3868 | `.diagnostics-dock.collapsed.dock-left .diagnostics-tabs, .diagnostics-dock.collapsed.dock-right .diagnostics-tabs` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 626 | 3873 | `/* Keep the real Diagnostics title, vertically oriented like the Inspector rail. */ .diagnostics-dock.collapsed.dock-left .diagnostics-title-block, .diagnostics-dock.collapsed.dock-right .diagnostics-title-block` | global | display, flex, min-width | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 627 | 3881 | `.diagnostics-dock.collapsed.dock-left .diagnostics-panel-title, .diagnostics-dock.collapsed.dock-right .diagnostics-panel-title` | global | writing-mode, transform, letter-spacing | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 628 | 3888 | `/* Center the vertical title in the 36px collapsed rail; undo the expanded side-dock action clearance, which otherwise shifts the title off-center. */ .diagnostics-dock.collapsed.dock-left .diagnostics-title-block, .diagnostics-dock.collapsed.dock-right .diagnostics-title-block` | global | width, justify-content, padding-right | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 629 | 3897 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading::before, .diagnostics-dock.collapsed.dock-right .diagnostics-heading::before` | global | content | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 630 | 3902 | `.diagnostics-dock.collapsed.dock-left .dock-actions, .diagnostics-dock.collapsed.dock-right .dock-actions` | global | position, flex-direction, gap, margin-top | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 631 | 3910 | `/* Compact workspace-mode toolbar aligned with the frozen prototype. */ .workspace-title` | global | flex, color, font-size, font-weight, letter-spacing | Candidate: Shell / Workspace | Heuristic only |
| 632 | 3919 | `.toolbar-context` | global | min-width, overflow, color, font, text-overflow, white-space | Manual review: unclassified | Heuristic only |
| 633 | 3927 | `.spacer` | global | flex, min-width | Manual review: unclassified | Heuristic only |
| 634 | 3928 | `.tag` | global | flex, border, border-radius, padding, color, font, letter-spacing, white-space | Manual review: unclassified | Heuristic only |
| 635 | 3938 | `.tag.amber` | global | border-color, background, color | Manual review: unclassified | Heuristic only |
| 636 | 3943 | `.tag.green` | global | border-color, background, color | Manual review: unclassified | Heuristic only |
| 637 | 3948 | `.replay-toolbar-actions` | global | display, min-width, flex, align-items, gap, margin-left, white-space | Candidate: Chart / Replay | Heuristic only |
| 638 | 3958 | `.replay-transport` | global | display, flex, align-items, gap | Candidate: Chart / Replay | Heuristic only |
| 639 | 3965 | `.replay-toolbar-actions .subtle-button` | global | min-height, padding, border-radius, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 640 | 3973 | `.replay-toolbar-actions .replay-play-toggle:not(:disabled)` | global | border-color, background, color | Candidate: Chart / Replay | Heuristic only |
| 641 | 3979 | `.replay-toolbar-actions .replay-play-toggle:hover:not(:disabled)` | global | border-color | Candidate: Chart / Replay | Heuristic only |
| 642 | 3983 | `.replay-toolbar-actions .run-stop-toggle:not(:disabled)` | global | border-color, background, color | Candidate: Chart / Replay | Heuristic only |
| 643 | 3989 | `.replay-toolbar-actions .run-stop-toggle:hover:not(:disabled)` | global | border-color | Candidate: Chart / Replay | Heuristic only |
| 644 | 3993 | `.run-state` | global | display, flex, align-items, gap, color, font, white-space | Manual review: unclassified | Heuristic only |
| 645 | 4003 | `.run-state b` | global | color, font-weight | Manual review: unclassified | Heuristic only |
| 646 | 4008 | `.run-state .run-status-running, .run-state .run-status-paused, .run-state .run-status-completed` | global | color | Manual review: unclassified | Heuristic only |
| 647 | 4014 | `.run-state .run-status-failed` | global | color | Manual review: unclassified | Heuristic only |
| 648 | 4018 | `.run-state .run-status-ready, .run-state .run-status-disposed, .run-state .run-status-none` | global | color | Manual review: unclassified | Heuristic only |
| 649 | 4024 | `.replay-progress` | global | width, height, flex, overflow, border-radius, background | Candidate: Chart / Replay | Heuristic only |
| 650 | 4033 | `.replay-progress i` | global | display, height, border-radius, background, transition | Candidate: Chart / Replay | Heuristic only |
| 651 | 4041 | `.toolbar-error` | global | max-width, overflow, font-size, text-overflow, white-space | Manual review: unclassified | Heuristic only |
| 652 | 4051 | `.replay-toolbar-actions` | @media (max-width: 1280px) | gap | Candidate: Chart / Replay | Heuristic only |
| 653 | 4054 | `.replay-toolbar-actions .subtle-button` | @media (max-width: 1280px) | padding-inline, font-size | Candidate: Chart / Replay | Heuristic only |
| 654 | 4061 | `/* Dataset mode follows the prototype's single control row above the Origin chart. */ .dataset-controls-host` | global | flex, min-width, overflow | Manual review: Dataset / Catalog + Chart / Replay | Heuristic only |
| 655 | 4068 | `.dataset-controls` | global | display, min-width, min-height, align-items, gap, padding, background | Candidate: Dataset / Catalog | Heuristic only |
| 656 | 4078 | `.dataset-controls-label` | global | display, flex, align-items, gap, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 657 | 4086 | `.dataset-controls-label .section-index` | global | margin, color, font, letter-spacing | Candidate: Dataset / Catalog | Heuristic only |
| 658 | 4093 | `.dataset-controls-label > strong` | global | color, font-size, letter-spacing | Candidate: Dataset / Catalog | Heuristic only |
| 659 | 4099 | `.dataset-controls-label .status-label` | global | padding, font-size | Candidate: Dataset / Catalog | Heuristic only |
| 660 | 4104 | `.dataset-range-summary` | global | display, flex, min-width, align-items, gap | Candidate: Dataset / Catalog | Heuristic only |
| 661 | 4112 | `.dataset-range-selected` | global | display, flex, min-width, align-items, gap, color, font, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 662 | 4123 | `.dataset-range-selected > span:first-child` | global | color, font-size, letter-spacing | Candidate: Dataset / Catalog | Heuristic only |
| 663 | 4129 | `.dataset-range-selected code` | global | color | Candidate: Dataset / Catalog | Heuristic only |
| 664 | 4133 | `.dataset-range-selected strong` | global | color, font-weight | Candidate: Dataset / Catalog | Heuristic only |
| 665 | 4138 | `.dataset-range-pending, .dataset-range-empty` | global | min-width, overflow, color, font-size, text-overflow, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 666 | 4148 | `.dataset-range-pending code` | global | color, font-family | Candidate: Dataset / Catalog | Heuristic only |
| 667 | 4153 | `.dataset-range-status` | global | flex, min-width, overflow, color, font, text-overflow, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 668 | 4163 | `.dataset-create-button` | global | flex, min-height, padding, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 669 | 4170 | `.test-dataset-details` | global | position, flex, color, font-size | Candidate: Dataset / Catalog | Heuristic only |
| 670 | 4177 | `.test-dataset-details > summary, .catalog-origin-details > summary` | global | cursor, list-style, white-space | Candidate: Dataset / Catalog | Heuristic only |
| 671 | 4184 | `.test-dataset-details > summary::-webkit-details-marker, .catalog-origin-details > summary::-webkit-details-marker` | global | display | Candidate: Dataset / Catalog | Heuristic only |
| 672 | 4189 | `.test-dataset-details > summary` | global | padding, border, border-radius, font, letter-spacing | Candidate: Dataset / Catalog | Heuristic only |
| 673 | 4197 | `.test-dataset-details[open]` | global | position, z-index, top, right, width, padding, border, border-radius, background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 674 | 4210 | `.test-dataset-details[open] > summary` | global | margin-bottom | Candidate: Dataset / Catalog | Heuristic only |
| 675 | 4214 | `.test-dataset-detail-list` | global | display, grid-template-columns, gap | Candidate: Dataset / Catalog | Heuristic only |
| 676 | 4220 | `.test-dataset-detail-list > div` | global | display, min-width, flex-direction, gap | Candidate: Dataset / Catalog | Heuristic only |
| 677 | 4227 | `.test-dataset-detail-list > div > span` | global | color, font | Candidate: Dataset / Catalog | Heuristic only |
| 678 | 4232 | `.test-dataset-detail-list code` | global | overflow-wrap, color, font | Candidate: Dataset / Catalog | Heuristic only |
| 679 | 4238 | `.dataset-controls-message` | global | flex, max-width, margin, overflow, font-size, text-overflow | Candidate: Dataset / Catalog | Heuristic only |
| 680 | 4247 | `.catalog-origin-details` | global | flex, margin-top, padding-top, border-top | Candidate: Dataset / Catalog | Heuristic only |
| 681 | 4254 | `.catalog-origin-details > summary` | global | color, font, letter-spacing | Candidate: Dataset / Catalog | Heuristic only |
| 682 | 4260 | `.catalog-origin-details[open] > .result-panel` | global | margin-top, padding, border, border-top, border-radius, background, box-shadow | Candidate: Dataset / Catalog | Heuristic only |
| 683 | 4270 | `.catalog-origin-details .panel-heading h2` | global | font-size | Candidate: Dataset / Catalog | Heuristic only |
| 684 | 4276 | `.dataset-controls` | @media (max-width: 1100px) | gap, padding-inline | Candidate: Dataset / Catalog | Heuristic only |
| 685 | 4280 | `.dataset-controls-label` | @media (max-width: 1100px) | gap | Candidate: Dataset / Catalog | Heuristic only |
| 686 | 4284 | `.dataset-range-summary` | @media (max-width: 1100px) | flex-basis, gap | Candidate: Dataset / Catalog | Heuristic only |
| 687 | 4289 | `.dataset-range-status` | @media (max-width: 1100px) | display | Candidate: Dataset / Catalog | Heuristic only |
| 688 | 4293 | `.test-dataset-details > summary` | @media (max-width: 1100px) | padding-inline | Candidate: Dataset / Catalog | Heuristic only |
| 689 | 4299 | `.chart-panels > .dataset-workspace-content` | global | overflow | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 690 | 4305 | `/* The side Inspector is positioned at the exact edge reserved by workbench-main. The left-facing frame belongs to the positioned workspace itself, so inset that workspace by 5px rather than trying to move only its inner grid. Replay/Compare remain unchanged. */ .debugger-shell:not(.catalog-is-hidden).inspector-dock-left .workbench-main` | global | left | Manual review: Dataset / Catalog + Shell / Workspace + Dock / Inspector / Diagnostics | Heuristic only |
| 691 | 4317 | `.dataset-workspace-content > .origin-chart-panel` | global | display, flex, min-height, flex-direction, margin | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 692 | 4325 | `.dataset-workspace-content > .origin-chart-panel > .origin-chart-viewport` | global | flex, height, min-height | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 693 | 4331 | `.dataset-workspace-content .origin-chart-host` | global | height, min-height | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 694 | 4336 | `.dataset-workspace-content .origin-chart-panel > .chart-selection-hint` | global | flex | Manual review: Dataset / Catalog + Shell / Workspace + Chart / Replay | Heuristic only |
| 695 | 4340 | `/* Compare mirrors the prototype's toolbar controls → summary strip → dual-chart stack. */ .compare-toolbar-actions` | global | min-width, gap | Manual review: Chart / Replay + Compare | Heuristic only |
| 696 | 4347 | `.compare-toolbar-select` | global | display, min-width, align-items, gap, color, font, letter-spacing, white-space | Candidate: Compare | Heuristic only |
| 697 | 4358 | `.compare-toolbar-select select` | global | width, max-width, min-width, height, padding, overflow, border, border-radius, background, color, font, text-overflow | Candidate: Compare | Heuristic only |
| 698 | 4373 | `.compare-run-button` | global | flex, min-height, padding, font-size, white-space | Candidate: Compare | Heuristic only |
| 699 | 4381 | `.compare-workspace > .compare-summary` | global | display, flex, min-width, min-height, align-items, gap, padding, border-bottom, background | Manual review: Shell / Workspace + Compare | Heuristic only |
| 700 | 4393 | `.compare-summary .metric` | global | display, flex, align-items, gap, font-size, white-space | Candidate: Compare | Heuristic only |
| 701 | 4402 | `.compare-summary .metric .label` | global | color, font-size, letter-spacing | Candidate: Compare | Heuristic only |
| 702 | 4408 | `.compare-summary .metric .value` | global | color, font | Candidate: Compare | Heuristic only |
| 703 | 4413 | `.compare-summary .compare-divergence` | global | color | Candidate: Compare | Heuristic only |
| 704 | 4415 | `.compare-summary .compare-difference-count` | global | color | Candidate: Compare | Heuristic only |
| 705 | 4416 | `.compare-summary .compare-identity-match` | global | color | Candidate: Compare | Heuristic only |
| 706 | 4417 | `.compare-summary .compare-identity-mismatch` | global | color | Candidate: Compare | Heuristic only |
| 707 | 4418 | `.compare-summary .metric` | global | position, min-width | Candidate: Compare | Heuristic only |
| 708 | 4423 | `.compare-summary .metric + .metric` | global | padding-left | Candidate: Compare | Heuristic only |
| 709 | 4427 | `.compare-summary .metric + .metric::before` | global | position, top, bottom, left, width, background, content, pointer-events | Candidate: Compare | Heuristic only |
| 710 | 4438 | `.compare-summary .metric .value` | global | overflow, max-width, text-overflow | Candidate: Compare | Heuristic only |
| 711 | 4444 | `.comparison-chart-heading .section-index` | global | margin, color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 712 | 4451 | `.comparison-chart-heading h3` | global | color, font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 713 | 4457 | `.comparison-chart-state` | global | display, align-items, gap, padding, border-radius | Candidate: Chart / Replay | Heuristic only |
| 714 | 4465 | `.comparison-chart-state.is-ready` | global | border-color, color | Candidate: Chart / Replay | Heuristic only |
| 715 | 4470 | `.comparison-chart-state.is-pending` | global | color | Candidate: Chart / Replay | Heuristic only |
| 716 | 4474 | `.comparison-chart-empty` | global | position, flex, padding, background, background-size | Candidate: Chart / Replay | Heuristic only |
| 717 | 4485 | `.comparison-chart-empty-mark` | global | display, width, height, place-items, border, border-radius, color, font | Candidate: Chart / Replay | Heuristic only |
| 718 | 4496 | `.comparison-chart-empty strong` | global | margin-top, font-size, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 719 | 4502 | `.comparison-chart-empty p` | global | max-width, font-size, line-height | Candidate: Chart / Replay | Heuristic only |
| 720 | 4508 | `.comparison-chart-integrity` | global | margin-top, color, font, letter-spacing | Candidate: Chart / Replay | Heuristic only |
| 721 | 4515 | `.comparison-chart-integrity i` | global | padding-inline, color, font-style | Candidate: Chart / Replay | Heuristic only |
| 722 | 4521 | `.compare-summary .footnote` | global | min-width, margin-left, overflow, font, text-overflow, white-space | Candidate: Compare | Heuristic only |
| 723 | 4530 | `.compare-summary-error` | global | max-width, margin, overflow, font-size, text-overflow, white-space | Candidate: Compare | Heuristic only |
| 724 | 4542 | `.compare-toolbar-select select` | @media (max-width: 1280px) | width, max-width | Candidate: Compare | Heuristic only |
| 725 | 4546 | `.compare-workspace > .compare-summary` | @media (max-width: 1280px) | gap, padding-inline | Manual review: Shell / Workspace + Compare | Heuristic only |
| 726 | 4551 | `.compare-summary .footnote` | @media (max-width: 1280px) | display | Candidate: Compare | Heuristic only |
| 727 | 4558 | `.compare-toolbar-actions` | @media (max-width: 1050px) | gap | Candidate: Compare | Heuristic only |
| 728 | 4559 | `.compare-toolbar-select` | @media (max-width: 1050px) | gap, font-size | Candidate: Compare | Heuristic only |
| 729 | 4560 | `.compare-toolbar-select select` | @media (max-width: 1050px) | width, max-width | Candidate: Compare | Heuristic only |
| 730 | 4561 | `.compare-run-button` | @media (max-width: 1050px) | padding-inline, font-size | Candidate: Compare | Heuristic only |
| 731 | 4562 | `.compare-workspace > .compare-summary` | @media (max-width: 1050px) | gap | Manual review: Shell / Workspace + Compare | Heuristic only |
| 732 | 4563 | `.compare-summary .metric` | @media (max-width: 1050px) | gap | Candidate: Compare | Heuristic only |
| 733 | 4564 | `.compare-summary .metric + .metric` | @media (max-width: 1050px) | padding-left | Candidate: Compare | Heuristic only |
| 734 | 4565 | `.compare-summary .metric + .metric::before` | @media (max-width: 1050px) | top, bottom | Candidate: Compare | Heuristic only |
| 735 | 4569 | `.compare-toolbar-select > span` | @media (max-width: 1050px) | display | Candidate: Compare | Heuristic only |
| 736 | 4570 | `.compare-toolbar-select select` | @media (max-width: 1050px) | width, max-width | Candidate: Compare | Heuristic only |
| 737 | 4572 | `/* Collapsed horizontal Inspector rails follow the Diagnostics toolbar geometry. */ .inspector-rail.collapsed.dock-top, .inspector-rail.collapsed.dock-bottom` | global | padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 738 | 4579 | `.inspector-rail.collapsed.dock-top .rail-heading, .inspector-rail.collapsed.dock-bottom .rail-heading` | global | width, height, min-height, flex, flex-direction, align-items, justify-content, gap, padding, border-bottom | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 739 | 4592 | `.inspector-rail.collapsed.dock-top .panel-title, .inspector-rail.collapsed.dock-bottom .panel-title, .inspector-rail.collapsed.dock-top .inspector-object-tag, .inspector-rail.collapsed.dock-bottom .inspector-object-tag, .inspector-rail.collapsed.dock-top .dock-menu, .inspector-rail.collapsed.dock-bottom .dock-menu` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 740 | 4600 | `.inspector-rail.collapsed.dock-top .rail-heading > .spacer, .inspector-rail.collapsed.dock-bottom .rail-heading > .spacer` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 741 | 4604 | `.inspector-rail.collapsed.dock-top .rail-heading > .rail-toggle, .inspector-rail.collapsed.dock-bottom .rail-heading > .rail-toggle` | global | display, flex, align-items, justify-content, width, height, margin, padding, writing-mode, transform | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 742 | 4617 | `/* A collapsed side rail keeps its reopen control, not the Dock menu. */ .diagnostics-dock.collapsed.dock-left .dock-actions > .dock-menu, .diagnostics-dock.collapsed.dock-right .dock-actions > .dock-menu` | global | display | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 743 | 4623 | `.diagnostics-dock.collapsed.dock-left .dock-actions > [data-testid="diagnostics-collapse-toggle"], .diagnostics-dock.collapsed.dock-right .dock-actions > [data-testid="diagnostics-collapse-toggle"]` | global | display, flex, align-items, justify-content, width, height, margin, padding | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 744 | 4634 | `.diagnostics-dock.collapsed.dock-left .diagnostics-heading, .diagnostics-dock.collapsed.dock-right .diagnostics-heading` | global | cursor | Candidate: Dock / Inspector / Diagnostics | Heuristic only |
| 745 | 4638 | `/* Development-only browser tooling entry point; not part of the production UI. */ .devtools-context-menu` | global | position, z-index, min-width, padding, border, border-radius, background, box-shadow | Manual review: unclassified | Heuristic only |
| 746 | 4651 | `.devtools-context-menu button` | global | display, width, min-height, padding, border, border-radius, background, color, text-align, cursor, font | Manual review: unclassified | Heuristic only |
| 747 | 4665 | `.devtools-context-menu button:hover, .devtools-context-menu button:focus-visible` | global | outline, background | Manual review: unclassified | Heuristic only |
| 748 | 4671 | `/* Replay playback speed selector — compact Bilibili-style current value + menu. */ /* The toolbar normally clips horizontal overflow; let the speed menu escape below it. */ .workflow-toolbar:has(.replay-speed-menu)` | global | position, z-index, overflow | Manual review: Shell / Workspace + Chart / Replay | Heuristic only |
| 749 | 4680 | `.replay-speed-control` | global | position, display, flex | Candidate: Chart / Replay | Heuristic only |
| 750 | 4686 | `.replay-speed-trigger` | global | display, min-width, min-height, align-items, justify-content, padding, border, border-radius, background, color, font-size, cursor | Candidate: Chart / Replay | Heuristic only |
| 751 | 4701 | `.replay-speed-trigger:hover, .replay-speed-trigger[aria-expanded="true"]` | global | background, color | Candidate: Chart / Replay | Heuristic only |
| 752 | 4707 | `.replay-speed-menu` | global | position, z-index, top, right, display, width, flex-direction, gap, padding, border, border-radius, background, box-shadow | Candidate: Chart / Replay | Heuristic only |
| 753 | 4723 | `.replay-speed-option` | global | display, min-height, align-items, justify-content, padding, border, border-radius, background, color, font-size, text-align, cursor | Candidate: Chart / Replay | Heuristic only |
| 754 | 4738 | `.replay-speed-option:hover, .replay-speed-option:focus-visible` | global | outline, background, color | Candidate: Chart / Replay | Heuristic only |
| 755 | 4745 | `.replay-speed-option.selected` | global | color, background | Candidate: Chart / Replay | Heuristic only |
| 756 | 4750 | `.replay-speed-check` | global | color, font-size | Candidate: Chart / Replay | Heuristic only |
| 757 | 4755 | `/* Shared operation feedback (vue-sonner). Keep toasts above docked panels and menus. */ [data-sonner-toaster]` | global | z-index | Manual review: Dock / Inspector / Diagnostics + Toast integration | Heuristic only |
| 758 | 4761 | `[data-sonner-toast]` | global | font-family, border-color, background, color, box-shadow | Candidate: Toast integration | Heuristic only |
| 759 | 4769 | `[data-sonner-toast] [data-description]` | global | color | Candidate: Toast integration | Heuristic only |
| 760 | 4773 | `[data-sonner-toast][data-type="success"]` | global | border-color | Candidate: Toast integration | Heuristic only |
| 761 | 4777 | `[data-sonner-toast][data-type="warning"]` | global | border-color | Candidate: Toast integration | Heuristic only |
| 762 | 4781 | `[data-sonner-toast][data-type="error"]` | global | border-color | Candidate: Toast integration | Heuristic only |
