// Vitest for @fbg/web (added in B-31). Keeps the defaults the package already ran with (Node environment,
// `*.test.ts` under src) and adds the `@/` path alias from tsconfig.json so tests can import app modules,
// plus `.test.tsx` so server-rendered markup can be asserted with react-dom/server (no DOM library needed).
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // tsconfig.json keeps `jsx: "preserve"` for Next; tests need JSX compiled with React's automatic runtime.
  oxc: { jsx: { runtime: "automatic", importSource: "react" } },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
  },
});
