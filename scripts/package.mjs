import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';
const root = fileURLToPath(new URL('../', import.meta.url));
const { version } = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const files = {};
async function collect(relative) {
  const path = join(root, relative);
  for (const entry of await readdir(path, { withFileTypes: true })) {
    const name = join(relative, entry.name);
    if (entry.isDirectory()) await collect(name);
    else if (entry.isFile()) files[`reading-desk/${name.split('\\').join('/')}`] = new Uint8Array(await readFile(join(root, name)));
  }
}
for (const name of ['src','scripts','tests']) await collect(name);
for (const name of ['extension.js','extension.css','README.md','CHANGELOG.md','package.json','package-lock.json','FFLATE-LICENSE.txt','KATEX-LICENSE.txt']) files[`reading-desk/${name}`] = new Uint8Array(await readFile(join(root,name)));
const output = process.argv[2] ? resolve(process.argv[2]) : join(root,'dist',`Reading-Desk-${version}.zip`);
await mkdir(dirname(output),{recursive:true});
await writeFile(output,zipSync(files,{level:6}));
console.log(output);
