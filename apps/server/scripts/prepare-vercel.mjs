import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(root, "dist");
const outDir = join(root, ".vercel/output");
const funcDir = join(outDir, "functions", "index.func");

if (!existsSync(join(distDir, "index.mjs"))) {
  throw new Error("dist/index.mjs missing  run `bun run build` first");
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(funcDir, { recursive: true });

for (const name of readdirSync(distDir)) {
  if (name.endsWith(".d.mts") || name.endsWith(".d.ts")) continue;
  cpSync(join(distDir, name), join(funcDir, name));
}

writeFileSync(
  join(funcDir, ".vc-config.json"),
  `${JSON.stringify(
    {
      runtime: "nodejs22.x",
      handler: "index.mjs",
      launcherType: "Nodejs",
      supportsResponseStreaming: true,
      maxDuration: 300,
    },
    null,
    2,
  )}\n`,
);

writeFileSync(
  join(outDir, "config.json"),
  `${JSON.stringify(
    {
      version: 3,
      routes: [{ src: "/(.*)", dest: "/" }],
    },
    null,
    2,
  )}\n`,
);

console.log("Prepared Vercel Build Output at apps/server/.vercel/output");
