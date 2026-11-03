import { defineConfig } from "vite";
import { configDefaults } from "vitest/config";
import vue from "@vitejs/plugin-vue";

const config = {
  plugins: [vue()],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1421,
    strictPort: true,
  },
  test: {
    environment: "jsdom",
    clearMocks: true,
    exclude: [...configDefaults.exclude, "e2e/**"],
  },
};

// Use the workspace Vite type instance for plugins. Vitest may resolve its own
// Vite copy; importing defineConfig from vitest/config can make plugin types
// incompatible even when both copies are the same Vite release.
export default defineConfig(config as Parameters<typeof defineConfig>[0]);