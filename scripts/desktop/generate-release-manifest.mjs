#!/usr/bin/env node
/**
 * Build desktop-manifest.json and Tauri latest.json from CI artifact filenames.
 *
 * Usage:
 *   node scripts/desktop/generate-release-manifest.mjs \
 *     --version 0.1.0 \
 *     --tag desktop-v0.1.0 \
 *     --repo finey-dev/topwaatch \
 *     --assets-dir ./release-assets
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

const VARIANT_MATCHERS = [
  {
    id: "appImageX64",
    test: (name) => /\.AppImage$/i.test(name) && /(amd64|x86_64|x64)/i.test(name),
  },
  {
    id: "appImageArm",
    test: (name) => /\.AppImage$/i.test(name) && /(aarch64|arm64|arm)/i.test(name),
  },
  {
    id: "debianUbuntu",
    test: (name) => /\.deb$/i.test(name) && /(amd64|x86_64|x64)/i.test(name),
  },
  {
    id: "fedora",
    test: (name) => /\.rpm$/i.test(name) && /(x86_64|amd64|x64)/i.test(name),
  },
  {
    id: "installer",
    test: (name) =>
      /-setup\.exe$/i.test(name) ||
      (/\.exe$/i.test(name) && /(x64|x86_64|amd64)/i.test(name)) ||
      /\.msi$/i.test(name),
  },
];

const UPDATER_PLATFORM_MATCHERS = [
  { key: "linux-x86_64", test: (name) => /\.AppImage\.sig$/i.test(name) && /(amd64|x86_64|x64)/i.test(name) },
  { key: "linux-aarch64", test: (name) => /\.AppImage\.sig$/i.test(name) && /(aarch64|arm64|arm)/i.test(name) },
  { key: "windows-x86_64", test: (name) => /-setup\.exe\.sig$/i.test(name) || (/\.exe\.sig$/i.test(name) && /(x64|x86_64|amd64)/i.test(name)) },
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith("--")) continue;
    const key = token.slice(2);
    const value = argv[i + 1];
    if (value && !value.startsWith("--")) {
      args[key] = value;
      i += 1;
    } else {
      args[key] = true;
    }
  }
  return args;
}

function releaseAssetUrl(repo, tag, filename) {
  return `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(filename)}`;
}

async function readSignature(assetsDir, binaryName) {
  const sigPath = path.join(assetsDir, `${binaryName}.sig`);
  try {
    return (await readFile(sigPath, "utf8")).trim();
  } catch {
    return null;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const version = args.version;
  const tag = args.tag;
  const repo = args.repo ?? "finey-dev/topwaatch";
  const assetsDir = path.resolve(args["assets-dir"] ?? "./release-assets");
  const outDir = path.resolve(args["out-dir"] ?? "apps/desktop/releases");
  const publishedAt = args["published-at"] ?? new Date().toISOString();

  if (!version || !tag) {
    throw new Error("--version and --tag are required");
  }

  const files = await readdir(assetsDir);
  const installables = files.filter(
    (name) =>
      !name.endsWith(".sig") &&
      !name.endsWith(".json") &&
      !name.endsWith(".zip") &&
      !name.endsWith(".tar.gz"),
  );

  const variants = Object.fromEntries(
    VARIANT_MATCHERS.map(({ id }) => [id, { available: false, url: null }]),
  );

  for (const { id, test } of VARIANT_MATCHERS) {
    const match = installables.find((name) => test(name));
    if (!match) continue;
    variants[id] = {
      available: true,
      url: releaseAssetUrl(repo, tag, match),
      fileName: match,
    };
  }

  const desktopManifest = {
    version,
    tag,
    publishedAt,
    repo,
    variants,
  };

  const platforms = {};
  for (const { key, test } of UPDATER_PLATFORM_MATCHERS) {
    const sigFile = files.find((name) => test(name));
    if (!sigFile) continue;
    const binaryName = sigFile.replace(/\.sig$/i, "");
    const signature = await readSignature(assetsDir, binaryName);
    if (!signature) continue;
    platforms[key] = {
      url: releaseAssetUrl(repo, tag, binaryName),
      signature,
    };
  }

  const latestJson = {
    version,
    notes: `TopWaatch Desktop ${version}`,
    pub_date: publishedAt,
    platforms,
  };

  await mkdir(outDir, { recursive: true });
  await writeFile(
    path.join(outDir, "desktop-manifest.json"),
    `${JSON.stringify(desktopManifest, null, 2)}\n`,
  );
  await writeFile(
    path.join(outDir, "latest.json"),
    `${JSON.stringify(latestJson, null, 2)}\n`,
  );

  console.log(`Wrote ${path.join(outDir, "desktop-manifest.json")}`);
  console.log(`Wrote ${path.join(outDir, "latest.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
