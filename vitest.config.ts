import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "next/server": path.resolve(__dirname, "node_modules/next/server.js"),
      "next/navigation": path.resolve(__dirname, "node_modules/next/navigation.js"),
      "next/headers": path.resolve(__dirname, "node_modules/next/headers.js"),
    },
  },
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: [],
  },
});
