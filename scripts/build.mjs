import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const publicDir = join(root, "public");
const distDir = join(root, "dist");

await rm(distDir, { recursive: true, force: true });
await mkdir(distDir, { recursive: true });
await cp(publicDir, distDir, { recursive: true });

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";
const config = `window.WORKTODO_CONFIG = ${JSON.stringify(
  { supabaseUrl, supabaseAnonKey },
  null,
  2
)};\n`;

await writeFile(join(distDir, "config.js"), config);

const htmlPath = join(distDir, "index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(htmlPath, html.replace("./config.js", "./config.js"));

