import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pagesRoot = resolve(repositoryRoot, '.artifacts/pages');
const examplePages = [
  'examples/index.html',
  'examples/checkbox/index.html',
  'examples/radio/index.html',
  'examples/split/index.html',
  'examples/tree/index.html',
];

function resolveLocalReference(pagePath, reference) {
  if (/^(?:[a-z]+:|\/\/|#|@)/iu.test(reference)) return undefined;
  const target = resolve(dirname(pagePath), reference);
  if (!target.startsWith(`${pagesRoot}${sep}`)) {
    throw new Error(`GitHub Pages reference escapes the site root: ${reference}`);
  }
  return target;
}

for (const relativePath of examplePages) {
  const pagePath = resolve(pagesRoot, relativePath);
  if (!existsSync(pagePath)) throw new Error(`GitHub Pages example is missing: ${relativePath}`);

  const html = readFileSync(pagePath, 'utf8');
  const references = [
    ...[...html.matchAll(/\b(?:href|src)="([^"#]+)"/gu)].map(match => match[1]),
    ...[...html.matchAll(/\bfrom\s+'([^']+)'/gu)].map(match => match[1]),
  ];

  for (const reference of references) {
    const target = resolveLocalReference(pagePath, reference);
    if (target && !existsSync(target)) {
      throw new Error(`GitHub Pages reference is missing: ${relativePath} -> ${reference}`);
    }
  }
}

const rootEntry = readFileSync(resolve(pagesRoot, 'index.html'), 'utf8');
if (!rootEntry.includes('./examples/')) throw new Error('GitHub Pages root does not link to the gallery.');
if (!existsSync(resolve(pagesRoot, '.nojekyll'))) throw new Error('GitHub Pages .nojekyll marker is missing.');

console.log(`Verified ${examplePages.length} GitHub Pages example pages.`);
