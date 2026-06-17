import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base is "./" so the static build can be hosted from any subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Provide a working in-memory localStorage in tests. Node 22+ ships an experimental
    // built-in `localStorage` that is unavailable without --localstorage-file and shadows
    // jsdom's, so the App smoke test needs this polyfill.
    setupFiles: ["./src/test-setup.ts"],
    environmentOptions: { jsdom: { url: "http://localhost/" } },
  },
});
