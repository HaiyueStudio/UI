import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = resolve(repositoryRoot, '.artifacts/pages');

if (!outputRoot.startsWith(`${repositoryRoot}${sep}`)) {
  throw new Error(`Refusing to build GitHub Pages outside the repository: ${outputRoot}`);
}

const inputs = ['dist', 'examples', 'themes'];
for (const input of inputs) {
  if (!existsSync(resolve(repositoryRoot, input))) {
    throw new Error(`GitHub Pages input is missing: ${input}`);
  }
}

rmSync(outputRoot, { recursive: true, force: true });
mkdirSync(outputRoot, { recursive: true });

for (const input of inputs) {
  cpSync(resolve(repositoryRoot, input), resolve(outputRoot, input), { recursive: true });
}

writeFileSync(resolve(outputRoot, '.nojekyll'), '');
writeFileSync(resolve(outputRoot, 'index.html'), `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="refresh" content="0; url=./examples/" />
  <link rel="canonical" href="./examples/" />
  <title>Haiyue UI · Component Gallery</title>
</head>
<body>
  <p><a href="./examples/">打开 Haiyue UI 组件示例</a></p>
  <script>location.replace(new URL('./examples/', location.href));</script>
</body>
</html>
`);

console.log(`GitHub Pages site built at ${outputRoot}`);
