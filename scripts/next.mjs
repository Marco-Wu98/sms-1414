import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const nextCli = path.join(root, "node_modules", "next", "dist", "bin", "next");
// Use the matching bundled WASM fallback when the platform's native SWC cannot load.
process.env.NEXT_TEST_WASM_DIR = path.join(root, "node_modules", "@next", "swc-wasm-nodejs");
const result = spawnSync(process.execPath, [nextCli, ...process.argv.slice(2)], { cwd: root, env: process.env, stdio: "inherit" });
process.exit(result.status ?? 1);
