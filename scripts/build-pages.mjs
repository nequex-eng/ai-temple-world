import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
const files = ["index.html", "style.css", "manifest.webmanifest", "sw.js", "_headers"];
const folders = ["src", "icons"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(path.join(root, file), path.join(output, file));
for (const folder of folders) await cp(path.join(root, folder), path.join(output, folder), { recursive: true });
console.log("Prepared Cloudflare Pages output in dist/.");
