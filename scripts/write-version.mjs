#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, "..");

const pkgPath = path.join(root, "package.json");
const envPath = path.join(root, ".env.local");

function safe(cmd) {
  try {
    return execSync(cmd, { cwd: root, stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const base = pkg.version || "0.0.0";
const short = safe("git rev-parse --short HEAD");
const count = safe("git rev-list --count HEAD");
const branch = safe("git rev-parse --abbrev-ref HEAD");
const time = new Date().toISOString().replace(/[-:TZ]/g, "").slice(0, 12);

// Compose a readable app version
// Example: v0.1.0+123-abc123@main (20250101T1200)
let appVersion = `v${base}`;
if (count || short) appVersion += `+${count || "0"}-${short || "dev"}`;
if (branch && branch !== "HEAD") appVersion += `@${branch}`;
appVersion += ` (${time})`;

let existing = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
const lines = existing.split(/\r?\n/).filter(Boolean);
const key = "NEXT_PUBLIC_APP_VERSION";
const nextLine = `${key}=${appVersion}`;

let updated = false;
const newLines = lines.map((l) => {
  if (l.startsWith(`${key}=`)) {
    updated = true;
    return nextLine;
  }
  return l;
});
if (!updated) newLines.push(nextLine);

writeFileSync(envPath, newLines.join("\n") + "\n", "utf8");
console.log(`Wrote ${key} to .env.local => ${appVersion}`);

