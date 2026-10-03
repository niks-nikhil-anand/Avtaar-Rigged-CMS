import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
const key = process.env.GEMINI_API_KEY;
if (!key) throw new Error("A server key is required for this check.");
async function inspect(path) {
  let count = 0;
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const file = join(path, entry.name);
    if (entry.isDirectory()) count += await inspect(file);
    else if (/\.(js|json|map|html)$/.test(entry.name)) {
      if ((await readFile(file)).includes(Buffer.from(key))) throw new Error("A permanent API key was found in a client artifact.");
      count++;
    }
  }
  return count;
}
console.log(`Checked ${await inspect(".next/static")} client artifacts: permanent API key absent.`);
