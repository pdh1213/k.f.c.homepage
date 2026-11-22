import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const require = createRequire(import.meta.url);
const runtime = path.join(path.dirname(require.resolve("electron/package.json")), "dist");
const version = require("../package.json").version;
if (!existsSync(path.join(runtime, "electron.exe"))) throw new Error("Install the Windows Electron runtime with npm ci.");
const builder = path.join(path.dirname(require.resolve("electron-builder/package.json")), "cli.js");
const built = spawnSync(process.execPath, [builder, "--win", "nsis", "--x64", "--publish", "never",
  "--config.electronDist=" + runtime], { stdio: "inherit" });
if (built.status !== 0) throw built.error || new Error("Windows installer build failed.");
mkdirSync("outputs/windows", { recursive: true });
for (const file of [`KFC-Chat-Setup-${version}.exe`, `KFC-Chat-Setup-${version}.exe.blockmap`, "latest.yml"]) {
  copyFileSync(path.join("release", file), path.join("outputs/windows", file));
}
copyFileSync(`release/KFC-Chat-Setup-${version}.exe`, "outputs/windows/KFC-Chat-Setup.exe");
