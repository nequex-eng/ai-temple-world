import { copyFile, cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const output = path.join(root, "dist");
const files = ["index.html", "style.css", "manifest.webmanifest", "sw.js", "_headers", "robots.txt", "sitemap.xml", "google0231bbe40ae157c7.html"];
const folders = ["src", "icons"];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
for (const file of files) await copyFile(path.join(root, file), path.join(output, file));
for (const folder of folders) await cp(path.join(root, folder), path.join(output, folder), { recursive: true });
await copyFile(path.join(root, "scripts/pages-worker.js"), path.join(output, "_worker.js"));
import { execFileSync } from "node:child_process";
execFileSync("npx", ["--yes", "sharp-cli", "-i", "og-image.svg", "-o", path.join(output, "og-image.jpg"), "resize", "1200", "630"], { stdio: "inherit" });
console.log("Prepared Cloudflare Pages output in dist/ with a raster JPG share image.");
