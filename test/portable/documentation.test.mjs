import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { HY_COMPONENTS } from '../../dist/core/index.js';

test('current documentation counts track the catalog and focused registrations', () => {
  const read = path => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
  assert.ok(read('docs/portable-ui.md').includes(`${HY_COMPONENTS.length} 种语义组件`));
  assert.ok(read('docs/web-adapter.md').includes(`catalog 共 ${HY_COMPONENTS.length} 种语义`));
  const registration = read('src/adapters/web/controls.ts').match(/function definePortableWebComponents\(\): void \{([^}]+)\}/)[1];
  const count = [...registration.matchAll(/define\w+Components\(\)/g)].length;
  assert.ok(read('docs/web-adapter.md').includes(`复用的 ${count} 类组件`));
});
