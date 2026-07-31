import { configDefaults, defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, ".superpowers/**"],
    include: ["**/*.test.ts", "**/*.test.tsx"],
    maxWorkers: 4,
  },
});
