import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageJson = JSON.parse(readFileSync(resolve(repositoryRoot, 'package.json'), 'utf8'));
const componentSubpaths = Object.entries(packageJson.exports)
  .filter(([subpath, entry]) => subpath.startsWith('./')
    && typeof entry === 'object'
    && entry !== null
    && 'types' in entry
    && 'import' in entry)
  .map(([subpath]) => subpath.slice(2));

globalThis.HTMLElement ??= class HTMLElement {};

test('package publishes one explicit side-effect-free subpath per component', () => {
  assert.equal(packageJson.name, '@haiyue/ui');
  assert.deepEqual(packageJson.sideEffects, ['./themes/*.css']);
  assert.equal(packageJson.workspaces, undefined);

  for (const name of componentSubpaths) {
    const entry = packageJson.exports[`./${name}`];
    assert.deepEqual(entry, {
      types: `./dist/${name}.d.ts`,
      import: `./dist/${name}.js`,
    });
    assert.equal(entry.source, undefined, `${name} must not publish a source condition`);
    assert.equal(existsSync(resolve(repositoryRoot, entry.types)), true, `${entry.types} must exist`);
    assert.equal(existsSync(resolve(repositoryRoot, entry.import)), true, `${entry.import} must exist`);
  }
});

test('package publishes both Haiyue themes as optional CSS subpaths', () => {
  const themes = {
    './themes/light.css': './themes/haiyue-light.css',
    './themes/dark.css': './themes/haiyue-dark.css',
  };
  for (const [subpath, relativePath] of Object.entries(themes)) {
    assert.equal(packageJson.exports[subpath], relativePath);
    const source = readFileSync(resolve(repositoryRoot, relativePath), 'utf8');
    assert.match(source, new RegExp(`data-hy-theme=["']${subpath.includes('light') ? 'light' : 'dark'}["']`));
    assert.match(source, /--hy-accent-color:/);
    assert.match(source, /--hy-surface-color:/);
  }
});

test('component subpaths do not pull the root barrel or sibling component entries', async () => {
  for (const name of componentSubpaths) {
    const entryPath = resolve(repositoryRoot, `dist/${name}.js`);
    const source = readFileSync(entryPath, 'utf8');
    assert.doesNotMatch(source, /['"]\.\/index\.js['"]/, `${name} must not import the root barrel`);

    const referencedModules = [...source.matchAll(/(?:from\s*|import\s*)['"]\.\/([^'"]+)\.js['"]/gu)]
      .map(match => match[1]);
    const siblingEntries = referencedModules.filter(moduleName => componentSubpaths.includes(moduleName));
    assert.deepEqual(siblingEntries, [], `${name} unexpectedly imports component entries: ${siblingEntries.join(', ')}`);

    const module = await import(pathToFileURL(entryPath));
    assert.ok(Object.keys(module).length > 0, `${name} subpath must expose its focused API`);
  }
});

test('public component names consistently use the Haiyue HY and hy prefixes', () => {
  for (const name of componentSubpaths) {
    const implementation = readFileSync(resolve(repositoryRoot, `dist/${name}.js`), 'utf8');
    const declarations = readFileSync(resolve(repositoryRoot, `dist/${name}.d.ts`), 'utf8');
    assert.doesNotMatch(implementation, /\bGE[A-Z]|['"`]ge-[a-z]/u, `${name} contains a legacy runtime name`);
    assert.doesNotMatch(declarations, /\bGE[A-Z]/u, `${name} contains a legacy public type`);
    assert.match(implementation, new RegExp(`['"]hy-${name}['"]`), `${name} must register hy-${name}`);
  }
});

test('the all-components registration function remains confined to the root entry', () => {
  const rootEntry = readFileSync(resolve(repositoryRoot, 'dist/index.js'), 'utf8');
  assert.match(rootEntry, /function defineHaiyueUI\(\)/);
  for (const name of componentSubpaths) {
    const componentEntry = readFileSync(resolve(repositoryRoot, `dist/${name}.js`), 'utf8');
    assert.doesNotMatch(componentEntry, /defineHaiyueUI/);
  }
});
