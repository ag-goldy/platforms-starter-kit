import { readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const envFile = process.argv[2] ?? ".env.local";
const targets = ["development", "preview", "production"];

if (!existsSync(envFile)) {
  process.stderr.write(`Missing env file: ${envFile}\n`);
  process.exit(1);
}

function unquote(value) {
  const s = value.trim();
  if (s.length >= 2 && s.startsWith("\"") && s.endsWith("\"")) return s.slice(1, -1);
  return s;
}

function parseEnvFile(content) {
  const out = new Map();
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const withoutExport = line.startsWith("export ") ? line.slice(7).trim() : line;
    const eqIndex = withoutExport.indexOf("=");
    if (eqIndex === -1) continue;
    const key = withoutExport.slice(0, eqIndex).trim();
    if (!key) continue;
    const value = unquote(withoutExport.slice(eqIndex + 1));
    out.set(key, value);
  }
  return [...out.entries()];
}

const entries = parseEnvFile(readFileSync(envFile, "utf8"));

let updated = 0;
let skippedEmpty = 0;
const failures = [];

for (const [key, value] of entries) {
  if (value === "") {
    skippedEmpty++;
    continue;
  }

  const isPublic = key.startsWith("NEXT_PUBLIC_");

  for (const target of targets) {
    const args = [
      "env",
      "add",
      key,
      target,
      "--force",
      "--yes",
      "--non-interactive",
    ];
    if (!isPublic && target !== "development") args.splice(args.length - 1, 0, "--sensitive");
    const res = spawnSync("vercel", args, { input: value, encoding: "utf8" });
    if (res.status === 0) {
      updated++;
    } else {
      failures.push({ key, target, stderr: res.stderr, stdout: res.stdout });
    }
  }
}

process.stdout.write(
  `Env sync complete. Updated: ${updated}. Skipped empty: ${skippedEmpty}. Failed: ${failures.length}.\n`
);

if (failures.length > 0) {
  for (const f of failures) {
    process.stderr.write(`Failed ${f.key} (${f.target})\n`);
    const msg = (f.stderr || f.stdout || "").toString();
    if (msg) process.stderr.write(`${msg}\n`);
  }
  process.exit(2);
}
