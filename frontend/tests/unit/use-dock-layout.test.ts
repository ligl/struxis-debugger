import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { defineComponent } from "vue";
import { useDockLayout } from "../../src/composables/useDockLayout";

let cleanup: (() => void)[] = [];

function createLayout() {
  let layout!: ReturnType<typeof useDockLayout>;
  const wrapper = mount(defineComponent({
    setup() {
      layout = useDockLayout();
      return () => null;
    },
  }));
  cleanup.push(() => wrapper.unmount());
  return layout;
}

afterEach(() => {
  cleanup.forEach((unmount) => unmount());
  cleanup = [];
});

describe("useDockLayout", () => {
  it("owns the default dock directions, sizes, and shell reservation values", () => {
    const layout = createLayout();

    expect(layout.inspectorDock.value).toBe("right");
    expect(layout.diagnosticsDock.value).toBe("bottom");
    expect(layout.inspectorWidth.value).toBe(282);
    expect(layout.diagnosticsHeight.value).toBe(164);
    expect(layout.shellStyle.value["--inspector-reserve-right"]).toBe("282px");
    expect(layout.shellStyle.value["--diagnostics-reserve-bottom"]).toBe("36px");
  });

  it("updates dock reservations from the authoritative panel state", () => {
    const layout = createLayout();

    layout.setDock("inspector", "left");
    layout.setDock("diagnostics", "top");
    layout.toggleCollapsed("diagnostics");

    expect(layout.shellStyle.value["--inspector-reserve-left"]).toBe("282px");
    expect(layout.shellStyle.value["--diagnostics-reserve-top"]).toBe("164px");
    expect(layout.shellStyle.value["--inspector-offset-top"]).toBe("164px");

    layout.toggleCollapsed("inspector");
    expect(layout.shellStyle.value["--inspector-reserve-left"]).toBe("36px");
  });

  it("expands a collapsed Inspector panel when its heading is clicked", () => {
    const layout = createLayout();
    layout.toggleCollapsed("inspector");

    expect(layout.inspectorCollapsed.value).toBe(true);
    layout.handleInspectorHeadingClick();
    expect(layout.inspectorCollapsed.value).toBe(false);
    expect(layout.shellStyle.value["--inspector-reserve-right"]).toBe("282px");
  });

  it("does not collapse an already expanded Inspector when its heading is clicked", () => {
    const layout = createLayout();

    layout.handleInspectorHeadingClick();

    expect(layout.inspectorCollapsed.value).toBe(false);
    expect(layout.shellStyle.value["--inspector-reserve-right"]).toBe("282px");
  });

  it("expands a collapsed side-docked Diagnostics panel when its heading is clicked", () => {
    const layout = createLayout();
    layout.setDock("diagnostics", "left");

    expect(layout.diagnosticsCollapsed.value).toBe(true);
    layout.handleDiagnosticsHeadingClick();
    expect(layout.diagnosticsCollapsed.value).toBe(false);
    expect(layout.shellStyle.value["--diagnostics-reserve-left"]).toBe("330px");
  });

  it("does not expand collapsed Diagnostics from a heading click when docked vertically", () => {
    const layout = createLayout();

    layout.handleDiagnosticsHeadingClick();

    expect(layout.diagnosticsCollapsed.value).toBe(true);
    expect(layout.shellStyle.value["--diagnostics-reserve-bottom"]).toBe("36px");
  });

  it("keeps a dock menu open for internal pointer interactions and closes it outside", () => {
    document.body.innerHTML = `
      <details class="dock-menu" data-testid="dock-menu" open>
        <summary>Move panel</summary>
        <button data-testid="dock-menu-option">Dock Left</button>
      </details>
      <button data-testid="outside-target">Outside</button>
    `;
    createLayout();

    const menu = document.querySelector<HTMLDetailsElement>('[data-testid="dock-menu"]')!;
    const option = document.querySelector<HTMLButtonElement>('[data-testid="dock-menu-option"]')!;
    const outside = document.querySelector<HTMLButtonElement>('[data-testid="outside-target"]')!;

    option.dispatchEvent(new Event("pointerdown", { bubbles: true }) as PointerEvent);
    expect(menu.open).toBe(true);

    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }) as PointerEvent);
    expect(menu.open).toBe(false);
  });

  it("removes the dock menu dismissal listener on unmount", () => {
    document.body.innerHTML = `
      <details class="dock-menu" data-testid="dock-menu" open>
        <summary>Move panel</summary>
      </details>
      <button data-testid="outside-target">Outside</button>
    `;
    const layout = createLayout();
    const menu = document.querySelector<HTMLDetailsElement>('[data-testid="dock-menu"]')!;
    const outside = document.querySelector<HTMLButtonElement>('[data-testid="outside-target"]')!;

    const wrapper = cleanup.pop();
    wrapper?.();
    outside.dispatchEvent(new Event("pointerdown", { bubbles: true }) as PointerEvent);

    expect(menu.open).toBe(true);
    void layout;
  });

  it("resizes the active dock axis through keyboard controls", () => {
    const layout = createLayout();
    let defaultPrevented = false;
    const event = {
      key: "ArrowUp",
      preventDefault: () => { defaultPrevented = true; },
    } as KeyboardEvent;

    layout.handlePanelResizeKey("diagnostics", event);

    expect(defaultPrevented).toBe(true);
    expect(layout.diagnosticsHeight.value).toBe(176);
  });
});
