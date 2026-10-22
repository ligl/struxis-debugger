import { mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent } from "vue";
import { useDevtoolsContextMenu } from "../../src/composables/useDevtoolsContextMenu";

const { invoke, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}));

vi.mock("@tauri-apps/api/core", () => ({ invoke, isTauri }));

let wrapper: ReturnType<typeof mount> | null = null;
let reloadSpy: ReturnType<typeof vi.spyOn>;

function mountMenu() {
  let api!: ReturnType<typeof useDevtoolsContextMenu>;
  wrapper = mount(defineComponent({
    setup() {
      api = useDevtoolsContextMenu();
      return () => null;
    },
  }));
  return api;
}

beforeEach(() => {
  vi.clearAllMocks();
  isTauri.mockReturnValue(true);
  reloadSpy = vi.spyOn(window.location, "reload").mockImplementation(() => undefined);
});

afterEach(() => {
  wrapper?.unmount();
  wrapper = null;
  reloadSpy.mockRestore();
});

describe("useDevtoolsContextMenu", () => {
  it("opens at a bounded pointer position only in Tauri", () => {
    const api = mountMenu();
    const event = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: window.innerWidth + 100,
      clientY: window.innerHeight + 100,
    });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(api.devtoolsContextMenu.value.visible).toBe(true);
    expect(api.devtoolsContextMenu.value.x).toBe(window.innerWidth - 190);
    expect(api.devtoolsContextMenu.value.y).toBe(window.innerHeight - 82);

    isTauri.mockReturnValue(false);
    const ignored = new MouseEvent("contextmenu", { cancelable: true });
    window.dispatchEvent(ignored);
    expect(ignored.defaultPrevented).toBe(false);
    expect(api.devtoolsContextMenu.value.visible).toBe(true);
  });

  it("opens DevTools and dismisses the menu", async () => {
    const api = mountMenu();
    api.devtoolsContextMenu.value.visible = true;

    await api.openDevtoolsFromContextMenu();

    expect(invoke).toHaveBeenCalledWith("open_devtools");
    expect(api.devtoolsContextMenu.value.visible).toBe(false);
  });

  it("dismisses on click or keydown and removes listeners on unmount", () => {
    const api = mountMenu();
    api.devtoolsContextMenu.value.visible = true;
    window.dispatchEvent(new MouseEvent("click"));
    expect(api.devtoolsContextMenu.value.visible).toBe(false);

    api.devtoolsContextMenu.value.visible = true;
    window.dispatchEvent(new KeyboardEvent("keydown"));
    expect(api.devtoolsContextMenu.value.visible).toBe(false);

    wrapper?.unmount();
    wrapper = null;
    api.devtoolsContextMenu.value.visible = false;
    window.dispatchEvent(new MouseEvent("contextmenu", { cancelable: true }));
    expect(api.devtoolsContextMenu.value.visible).toBe(false);
  });

  it("dismisses the menu before refreshing the page", () => {
    const api = mountMenu();
    api.devtoolsContextMenu.value.visible = true;

    api.refreshPageFromContextMenu();

    expect(api.devtoolsContextMenu.value.visible).toBe(false);
    expect(reloadSpy).toHaveBeenCalledOnce();
  });
});
