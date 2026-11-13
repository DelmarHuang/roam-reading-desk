import { build } from "esbuild";
import { copyFile, readFile, writeFile } from "node:fs/promises";

await build({
  entryPoints: ["src/index.js"],
  outfile: "extension.js",
  bundle: true,
  format: "esm",
  platform: "browser",
  target: ["es2020"],
  minify: false,
  sourcemap: false,
  legalComments: "eof"
});
// Concatenate the user-supplied native styles verbatim as a build step.
await writeFile("extension.css", (await Promise.all(["src/extension.css", "src/native-comments.css", "src/native-mark.css", "src/reading-desk.css"].map(path => readFile(path, "utf8")))).join("\n"));
await copyFile("node_modules/katex/LICENSE", "KATEX-LICENSE.txt");
await copyFile("node_modules/fflate/LICENSE", "FFLATE-LICENSE.txt");
