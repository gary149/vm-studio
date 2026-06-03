// Loads .env.local, bundles the MAI integration test with esbuild, runs it in Node.
import { build } from "esbuild";
import { readFileSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// --- minimal .env.local loader ---
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  const text = readFileSync(envPath, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = val;
  }
}

// --- bundle the TS test to a temp ESM file ---
const outDir = mkdtempSync(join(tmpdir(), "mai-test-"));
const outFile = join(outDir, "test.mjs");

await build({
  entryPoints: [new URL("../tests/mai-image.test.ts", import.meta.url).pathname],
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  outfile: outFile,
  logLevel: "warning",
});

await import(pathToFileURL(outFile).href);
