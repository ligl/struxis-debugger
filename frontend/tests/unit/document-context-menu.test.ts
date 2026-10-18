import { afterEach, describe, expect, it, vi } from "vitest";
import { mountDocumentContextMenu } from "../../src/document-context-menu";

describe("document HTML context menu", () => {
  let cleanup: (() => void) | undefined;
  let clipboardDescriptor: PropertyDescriptor | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
    document.getElementById("app")?.remove();
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    clipboardDescriptor = undefined;
  });

  it("copies the current rendered document HTML without including the menu itself", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    // jsdom starts with an empty body; model the rendered application root.
    const appRoot = document.createElement("div");
    appRoot.id = "app";
    appRoot.innerHTML = "<main><h1>Debugger fixture</h1></main>";
    document.body.append(appRoot);

    cleanup = mountDocumentContextMenu();
    const contextMenuEvent = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 90,
      clientY: 70,
    });
    document.dispatchEvent(contextMenuEvent);

    expect(contextMenuEvent.defaultPrevented).toBe(true);
    const menu = document.querySelector<HTMLElement>("[data-document-context-menu]");
    expect(menu).not.toBeNull();
    expect(menu!.hidden).toBe(false);

    const copyButton = menu!.querySelector<HTMLButtonElement>("button");
    expect(copyButton?.textContent).toBe("复制文档 HTML");
    copyButton!.click();

    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    const copiedHtml = writeText.mock.calls[0][0] as string;
    expect(copiedHtml).toMatch(/^<!DOCTYPE html>/i);
    expect(copiedHtml).toContain("<html");
    expect(copiedHtml).toContain("id=\"app\"");
    expect(copiedHtml).toContain("Debugger fixture");
    expect(copiedHtml).not.toContain("data-document-context-menu");
    expect(copyButton!.textContent).toBe("已复制文档 HTML");
  });

  it("closes when Escape is pressed and removes listeners on cleanup", () => {
    cleanup = mountDocumentContextMenu();
    document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    const menu = document.querySelector<HTMLElement>("[data-document-context-menu]")!;

    expect(menu.hidden).toBe(false);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(menu.hidden).toBe(true);

    cleanup();
    cleanup = undefined;
    document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
    expect(document.querySelector("[data-document-context-menu]")).toBeNull();
  });
});
