import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "./src/index.ts",
  format: "esm",
  outDir: "./dist",
  clean: true,
  platform: "node",
  dts: false,
  // Bundle workspace + npm deps so Vercel Node does not resolve `.ts` package exports.
  deps: {
    alwaysBundle: [/.*/],
  },
});
