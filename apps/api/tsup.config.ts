import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node22",
  noExternal: ["@barberflow/shared"],
  clean: true,
  sourcemap: false,
});
