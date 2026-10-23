import { onMounted, onUnmounted, ref } from "vue";
import { invoke, isTauri } from "@tauri-apps/api/core";

interface DevtoolsContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

/**
 * Owns the development-only Tauri context menu, its global event listeners,
 * and its two development actions. It does not participate in workspace state.
 */
export function useDevtoolsContextMenu(options: { reloadPage?: () => void } = {}) {
  const devtoolsContextMenu = ref<DevtoolsContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
  });
  const devtoolsAvailable = import.meta.env.DEV;

  function handleContextMenu(event: MouseEvent): void {
    // Check Tauri at event time rather than module initialization. The native
    // bridge may not be detectable yet when this module is first evaluated.
    if (!devtoolsAvailable || !isTauri()) return;
    event.preventDefault();
    devtoolsContextMenu.value = {
      visible: true,
      x: Math.min(event.clientX, window.innerWidth - 190),
      y: Math.min(event.clientY, window.innerHeight - 82),
    };
  }

  function dismissDevtoolsContextMenu(): void {
    devtoolsContextMenu.value.visible = false;
  }

  async function openDevtoolsFromContextMenu(): Promise<void> {
    dismissDevtoolsContextMenu();
    await invoke("open_devtools");
  }

  function refreshPageFromContextMenu(): void {
    dismissDevtoolsContextMenu();
    (options.reloadPage ?? (() => window.location.reload()))();
  }

  onMounted(() => {
    if (!devtoolsAvailable) return;
    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("click", dismissDevtoolsContextMenu);
    window.addEventListener("keydown", dismissDevtoolsContextMenu);
  });

  onUnmounted(() => {
    window.removeEventListener("contextmenu", handleContextMenu);
    window.removeEventListener("click", dismissDevtoolsContextMenu);
    window.removeEventListener("keydown", dismissDevtoolsContextMenu);
  });

  return {
    devtoolsContextMenu,
    devtoolsAvailable,
    handleContextMenu,
    dismissDevtoolsContextMenu,
    openDevtoolsFromContextMenu,
    refreshPageFromContextMenu,
  };
}
