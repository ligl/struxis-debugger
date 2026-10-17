export function mountDocumentContextMenu(): () => void {
  const menu = document.createElement("div");
  menu.className = "document-context-menu";
  menu.dataset.documentContextMenu = "true";
  menu.setAttribute("role", "menu");
  menu.setAttribute("aria-label", "Document actions");
  menu.hidden = true;

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.className = "document-context-menu__item";
  copyButton.setAttribute("role", "menuitem");
  copyButton.textContent = "复制文档 HTML";
  menu.append(copyButton);
  document.body.append(menu);

  let lastX = 0;
  let lastY = 0;

  function closeMenu(): void {
    menu.hidden = true;
  }

  function openMenu(event: MouseEvent): void {
    event.preventDefault();
    lastX = event.clientX;
    lastY = event.clientY;
    menu.hidden = false;

    const rect = menu.getBoundingClientRect();
    const maxX = Math.max(0, window.innerWidth - rect.width - 8);
    const maxY = Math.max(0, window.innerHeight - rect.height - 8);
    menu.style.left = `${Math.min(lastX, maxX)}px`;
    menu.style.top = `${Math.min(lastY, maxY)}px`;
    copyButton.textContent = "复制文档 HTML";
    copyButton.removeAttribute("title");
    copyButton.focus();
  }

  async function copyDocumentHtml(): Promise<void> {
    const copy = document.documentElement.cloneNode(true) as HTMLElement;
    copy.querySelector("[data-document-context-menu]")?.remove();
    const html = `<!DOCTYPE html>\n${copy.outerHTML}`;

    try {
      let copied = false;
      if (navigator.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(html);
          copied = true;
        } catch {
          // Fall back for WebViews where Clipboard API permissions are unavailable.
        }
      }

      if (!copied) {
        const textarea = document.createElement("textarea");
        textarea.value = html;
        textarea.setAttribute("aria-hidden", "true");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.append(textarea);
        textarea.select();
        try {
          copied = document.execCommand("copy");
        } finally {
          textarea.remove();
        }
        if (!copied) throw new Error("Clipboard API and execCommand are unavailable");
      }

      copyButton.textContent = "已复制文档 HTML";
      copyButton.title = "当前页面 HTML 已复制到剪贴板";
    } catch (error) {
      copyButton.textContent = "复制失败，点击重试";
      copyButton.title = error instanceof Error ? error.message : String(error);
    }
  }

  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === "Escape") closeMenu();
  }

  function onDocumentClick(event: MouseEvent): void {
    if (!menu.contains(event.target as Node)) closeMenu();
  }

  function onViewportChange(): void {
    closeMenu();
  }

  document.addEventListener("contextmenu", openMenu);
  document.addEventListener("click", onDocumentClick);
  document.addEventListener("keydown", onKeyDown);
  window.addEventListener("resize", onViewportChange);
  window.addEventListener("scroll", onViewportChange, true);
  copyButton.addEventListener("click", () => void copyDocumentHtml());

  return () => {
    document.removeEventListener("contextmenu", openMenu);
    document.removeEventListener("click", onDocumentClick);
    document.removeEventListener("keydown", onKeyDown);
    window.removeEventListener("resize", onViewportChange);
    window.removeEventListener("scroll", onViewportChange, true);
    menu.remove();
  };
}
