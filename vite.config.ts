import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Base is "./" so the static build can be hosted from any subpath.
export default defineConfig({
  base: "./",
  plugins: [react()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
