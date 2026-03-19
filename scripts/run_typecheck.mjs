import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const projectRoot = resolve(import.meta.dirname, "..");
const tsconfigPath = join(projectRoot, "tsconfig.json");
const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf8"));
let tempConfigPath = null;
let configPath = tsconfigPath;

if (Array.isArray(tsconfig.include)) {
  const filteredInclude = tsconfig.include.filter((entry) => entry !== ".next/types/**/*.ts");
  if (filteredInclude.length !== tsconfig.include.length) {
    tempConfigPath = join(projectRoot, `.tsconfig.typecheck.${process.pid}.json`);
    writeFileSync(tempConfigPath, JSON.stringify({ ...tsconfig, include: filteredInclude }, null, 2));
    configPath = tempConfigPath;
  }
}

const result = spawnSync(
  process.execPath,
  [join(projectRoot, "node_modules", "typescript", "bin", "tsc"), "--noEmit", "-p", configPath],
  { cwd: projectRoot, stdio: "inherit" },
);

if (tempConfigPath && existsSync(tempConfigPath)) {
  unlinkSync(tempConfigPath);
}

process.exit(result.status ?? 1);
