#!/usr/bin/env node
// Sync the htmlstudio package from the sibling repo into frontend/vendor/htmlstudio.
//
// Run from frontend/:   npm run sync:htmlstudio
//
// Assumes the htmlstudio repo lives at ../../htmlstudio (sibling of AgentSite).
// Builds htmlstudio first, then copies dist/ + package.json + LICENSE + README.md
// into vendor/htmlstudio. We vendor a prebuilt copy because Docker's build
// context is the AgentSite root, so a `file:../../htmlstudio` dep is invisible
// inside the container.

import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, "..");
const sourceDir = resolve(frontendDir, "..", "..", "htmlstudio");
const vendorDir = resolve(frontendDir, "vendor", "htmlstudio");

if (!existsSync(sourceDir)) {
  console.error(`htmlstudio repo not found at ${sourceDir}. Clone it next to AgentSite and try again.`);
  process.exit(1);
}

console.log(`Building htmlstudio at ${sourceDir}…`);
execSync("npm run build", { cwd: sourceDir, stdio: "inherit" });

if (existsSync(vendorDir)) rmSync(vendorDir, { recursive: true, force: true });
mkdirSync(vendorDir, { recursive: true });

for (const entry of ["dist", "package.json", "LICENSE", "README.md"]) {
  const from = resolve(sourceDir, entry);
  const to = resolve(vendorDir, entry);
  if (!existsSync(from)) {
    console.warn(`  skipping ${entry} (not in source)`);
    continue;
  }
  cpSync(from, to, { recursive: true });
  console.log(`  copied ${entry}`);
}

console.log(`\nVendored htmlstudio → ${vendorDir}`);
console.log(`Now run: npm install && npm run build`);
