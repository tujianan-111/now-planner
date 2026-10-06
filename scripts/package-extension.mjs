import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import JSZip from "jszip";

const sourceDir = "extension";
const output = "dist/now-planner-extension.zip";
const zip = new JSZip();

function addDirectory(directory) {
  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stats = statSync(fullPath);
    if (stats.isDirectory()) {
      addDirectory(fullPath);
    } else {
      zip.file(relative(sourceDir, fullPath).replaceAll("\\", "/"), readFileSync(fullPath));
    }
  }
}

addDirectory(sourceDir);
mkdirSync("dist", { recursive: true });
const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
writeFileSync(output, buffer);
console.log(`Created ${output}`);
