import { computed, onMounted, onUnmounted, ref } from "vue";

export type DockDirection = "left" | "right" | "top" | "bottom";
export type DockPanel = "inspector" | "diagnostics";
type DockAxis = "horizontal" | "vertical";
type ResizeTarget = DockPanel | null;

const dockDragMime = "application/x-struxis-debugger-panel";
const COLLAPSED_RAIL_SIZE = 36;

export function useDockLayout() {
  const inspectorCollapsed = ref(false);
  const diagnosticsCollapsed = ref(true);
  const inspectorDock = ref<DockDirection>("right");
  const diagnosticsDock = ref<DockDirection>("bottom");
  const inspectorWidth = ref(300);
  const inspectorHeight = ref(145);
  const diagnosticsWidth = ref(330);
  const diagnosticsHeight = ref(164);
  const panelResizeTarget = ref<ResizeTarget>(null);
  let panelResizeStart = 0;
  let panelResizeInitialSize = 0;

  const shellStyle = computed<Record<string, string>>(() => ({
    "--inspector-width": inspectorWidth.value + "px",
    "--inspector-height": inspectorHeight.value + "px",
    "--diagnostics-width": diagnosticsWidth.value + "px",
    "--diagnostics-height": diagnosticsHeight.value + "px",
    "--inspector-reserve-left": !inspectorCollapsed.value && inspectorDock.value === "left" ? inspectorWidth.value + "px" : (inspectorDock.value === "left" ? "36px" : "0px"),
    "--inspector-reserve-right": !inspectorCollapsed.value && inspectorDock.value === "right" ? inspectorWidth.value + "px" : (inspectorDock.value === "right" ? "36px" : "0px"),
    "--inspector-reserve-top": !inspectorCollapsed.value && inspectorDock.value === "top" ? inspectorHeight.value + "px" : (inspectorDock.value === "top" ? "36px" : "0px"),
    "--inspector-reserve-bottom": !inspectorCollapsed.value && inspectorDock.value === "bottom" ? inspectorHeight.value + "px" : (inspectorDock.value === "bottom" ? "36px" : "0px"),
    "--diagnostics-reserve-left": diagnosticsDock.value === "left" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsWidth.value + "px") : "0px",
    "--diagnostics-reserve-right": diagnosticsDock.value === "right" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsWidth.value + "px") : "0px",
    "--diagnostics-reserve-top": diagnosticsDock.value === "top" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsHeight.value + "px") : "0px",
    "--diagnostics-reserve-bottom": diagnosticsDock.value === "bottom" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsHeight.value + "px") : "0px",
    "--inspector-offset-left": diagnosticsDock.value === "left" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsWidth.value + "px") : "0px",
    "--inspector-offset-right": diagnosticsDock.value === "right" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsWidth.value + "px") : "0px",
    "--inspector-offset-top": diagnosticsDock.value === "top" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsHeight.value + "px") : "0px",
    "--inspector-offset-bottom": diagnosticsDock.value === "bottom" ? (diagnosticsCollapsed.value ? "36px" : diagnosticsHeight.value + "px") : "0px",
  }));

  function closeDockMenus(event?: Event): void {
    const target = event?.target;
    document.querySelectorAll<HTMLDetailsElement>(".dock-menu[open]").forEach((menu) => {
      if (target instanceof Element && menu.contains(target)) return;
      menu.open = false;
    });
  }

  function handleDockMenuPointerDown(event: PointerEvent): void {
    closeDockMenus(event);
  }

  function setDock(target: DockPanel, direction: DockDirection): void {
    if (target === "inspector") inspectorDock.value = direction;
    else diagnosticsDock.value = direction;
  }

  function toggleCollapsed(target: DockPanel): void {
    if (target === "inspector") inspectorCollapsed.value = !inspectorCollapsed.value;
    else diagnosticsCollapsed.value = !diagnosticsCollapsed.value;
  }

  function handleInspectorHeadingClick(): void {
    if (inspectorCollapsed.value) inspectorCollapsed.value = false;
  }

  function handleDiagnosticsHeadingClick(): void {
    if (diagnosticsCollapsed.value && (diagnosticsDock.value === "left" || diagnosticsDock.value === "right")) {
      diagnosticsCollapsed.value = false;
    }
  }

  function dockFor(target: DockPanel): DockDirection {
    return target === "inspector" ? inspectorDock.value : diagnosticsDock.value;
  }

  function workbenchExtent(axis: DockAxis): number {
    const shell = document.querySelector<HTMLElement>('[data-testid="debugger-shell"]');
    const topbarHeight = document.querySelector<HTMLElement>('[data-testid="topbar"]')?.clientHeight ?? 44;
    const measured = axis === "horizontal"
      ? shell?.clientWidth
      : shell ? Math.max(0, shell.clientHeight - topbarHeight) : undefined;
    return measured && measured > 0
      ? measured
      : axis === "horizontal" ? window.innerWidth : Math.max(0, window.innerHeight - topbarHeight);
  }

  function peerDockReservation(target: DockPanel, axis: DockAxis): number {
    const peerDirection = target === "inspector" ? diagnosticsDock.value : inspectorDock.value;
    const peerUsesAxis = axis === "horizontal"
      ? peerDirection === "left" || peerDirection === "right"
      : peerDirection === "top" || peerDirection === "bottom";
    if (!peerUsesAxis) return 0;

    if (target === "inspector") {
      if (diagnosticsCollapsed.value) return COLLAPSED_RAIL_SIZE;
      return axis === "horizontal" ? diagnosticsWidth.value : diagnosticsHeight.value;
    }
    if (inspectorCollapsed.value) return COLLAPSED_RAIL_SIZE;
    return axis === "horizontal" ? inspectorWidth.value : inspectorHeight.value;
  }

  function dockSizeLimit(target: DockPanel, axis: DockAxis): number {
    const minimum = axis === "horizontal" ? 180 : 100;
    const chartMinimum = axis === "horizontal" ? 320 : 180;
    const configuredMaximum = axis === "horizontal"
      ? Math.min(520, window.innerWidth * 0.5)
      : Math.min(480, window.innerHeight * 0.55);
    // Preserve the prototype's 5px inset when calculating the remaining chart area.
    const layoutInset = 5;
    const available = workbenchExtent(axis) - peerDockReservation(target, axis) - chartMinimum - layoutInset;
    return Math.max(minimum, Math.min(configuredMaximum, available));
  }

  function inspectorWidthLimit(): number { return dockSizeLimit("inspector", "horizontal"); }
  function inspectorHeightLimit(): number { return dockSizeLimit("inspector", "vertical"); }
  function diagnosticsWidthLimit(): number { return dockSizeLimit("diagnostics", "horizontal"); }
  function diagnosticsHeightLimit(): number { return dockSizeLimit("diagnostics", "vertical"); }

  function resizeIsHorizontal(target: DockPanel): boolean {
    const dock = dockFor(target);
    return dock === "left" || dock === "right";
  }

  function resizeValue(target: DockPanel, value: number): void {
    const horizontal = resizeIsHorizontal(target);
    if (target === "inspector") {
      if (horizontal) inspectorWidth.value = value;
      else inspectorHeight.value = value;
    } else if (horizontal) diagnosticsWidth.value = value;
    else diagnosticsHeight.value = value;
  }

  function resizeLimit(target: DockPanel): number {
    return target === "inspector"
      ? (resizeIsHorizontal(target) ? inspectorWidthLimit() : inspectorHeightLimit())
      : (resizeIsHorizontal(target) ? diagnosticsWidthLimit() : diagnosticsHeightLimit());
  }

  function resizeMinimum(target: DockPanel): number {
    return resizeIsHorizontal(target) ? 180 : 100;
  }

  function startPanelResize(target: DockPanel, event: PointerEvent): void {
    if (event.button !== 0) return;
    panelResizeTarget.value = target;
    const dock = dockFor(target);
    panelResizeStart = dock === "left" || dock === "right" ? event.clientX : event.clientY;
    panelResizeInitialSize = target === "inspector"
      ? (dock === "left" || dock === "right" ? inspectorWidth.value : inspectorHeight.value)
      : (dock === "left" || dock === "right" ? diagnosticsWidth.value : diagnosticsHeight.value);
    event.preventDefault();
  }

  function handlePanelResize(event: PointerEvent): void {
    const target = panelResizeTarget.value;
    if (!target) return;
    const dock = dockFor(target);
    const horizontal = dock === "left" || dock === "right";
    const coordinate = horizontal ? event.clientX : event.clientY;
    const growsTowardPositive = dock === "left" || dock === "top";
    const delta = growsTowardPositive ? coordinate - panelResizeStart : panelResizeStart - coordinate;
    const value = Math.max(resizeMinimum(target), Math.min(resizeLimit(target), panelResizeInitialSize + delta));
    resizeValue(target, value);
  }

  function handlePanelResizeKey(target: DockPanel, event: KeyboardEvent): void {
    const dock = dockFor(target);
    const horizontal = dock === "left" || dock === "right";
    const positiveKey = horizontal ? "ArrowRight" : "ArrowDown";
    const negativeKey = horizontal ? "ArrowLeft" : "ArrowUp";
    const increase = dock === "left" || dock === "top"
      ? event.key === positiveKey
      : event.key === negativeKey;
    const decrease = dock === "left" || dock === "top"
      ? event.key === negativeKey
      : event.key === positiveKey;
    if (!increase && !decrease && event.key !== "Home" && event.key !== "End") return;
    event.preventDefault();
    const minimum = resizeMinimum(target);
    const maximum = resizeLimit(target);
    const current = target === "inspector"
      ? (horizontal ? inspectorWidth.value : inspectorHeight.value)
      : (horizontal ? diagnosticsWidth.value : diagnosticsHeight.value);
    resizeValue(target, event.key === "Home"
      ? minimum
      : event.key === "End"
        ? maximum
        : Math.max(minimum, Math.min(maximum, current + (increase ? 12 : -12))));
  }

  function stopPanelResize(): void {
    panelResizeTarget.value = null;
  }

  function startDockDrag(target: DockPanel, event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData(dockDragMime, target);
  }

  function allowDockDrop(event: DragEvent): void {
    if (!event.dataTransfer) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }

  function dropDockPanel(event: DragEvent): void {
    const transfer = event.dataTransfer;
    if (!transfer) return;
    const target = transfer.getData(dockDragMime);
    if (target !== "inspector" && target !== "diagnostics") return;
    event.preventDefault();
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const x = (event.clientX - bounds.left) / Math.max(1, bounds.width);
    const y = (event.clientY - bounds.top) / Math.max(1, bounds.height);
    let direction: DockDirection | null = null;
    if (x < 0.13) direction = "left";
    else if (x > 0.87) direction = "right";
    else if (y < 0.16) direction = "top";
    else if (y > 0.84) direction = "bottom";
    if (direction) setDock(target, direction);
  }

  onMounted(() => {
    document.addEventListener("pointerdown", handleDockMenuPointerDown);
    window.addEventListener("pointermove", handlePanelResize);
    window.addEventListener("pointerup", stopPanelResize);
    window.addEventListener("pointercancel", stopPanelResize);
  });
  onUnmounted(() => {
    document.removeEventListener("pointerdown", handleDockMenuPointerDown);
    window.removeEventListener("pointermove", handlePanelResize);
    window.removeEventListener("pointerup", stopPanelResize);
    window.removeEventListener("pointercancel", stopPanelResize);
  });

  return {
    inspectorCollapsed, diagnosticsCollapsed, inspectorDock, diagnosticsDock,
    inspectorWidth, inspectorHeight, diagnosticsWidth, diagnosticsHeight,
    shellStyle, setDock, toggleCollapsed, handleInspectorHeadingClick, handleDiagnosticsHeadingClick, closeDockMenus,
    startPanelResize, handlePanelResizeKey, inspectorWidthLimit, inspectorHeightLimit,
    diagnosticsWidthLimit, diagnosticsHeightLimit, startDockDrag, allowDockDrop, dropDockPanel,
  };
}
