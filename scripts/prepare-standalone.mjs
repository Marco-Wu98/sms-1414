import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
const standaloneNext = path.join(standalone, ".next");
await mkdir(standaloneNext, { recursive: true });
await cp(path.join(root, ".next", "static"), path.join(standaloneNext, "static"), { recursive: true, force: true });
await cp(path.join(root, "public"), path.join(standalone, "public"), { recursive: true, force: true });
