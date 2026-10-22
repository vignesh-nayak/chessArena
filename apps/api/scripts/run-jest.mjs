import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const jestBin = require.resolve("jest/bin/jest");
const cwd = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const child = spawn(
  process.execPath,
  ["--experimental-vm-modules", jestBin, "--runInBand", ...process.argv.slice(2)],
  { stdio: "inherit", cwd, env: process.env },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
