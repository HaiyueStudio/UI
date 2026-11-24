import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = fileURLToPath(new URL('../', import.meta.url));
test('UI API gate checks export names and public declarations without private implementation churn', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ui-api-isolation-'));
  try {
    for (const item of ['scripts/api-surface.mjs', 'src', 'review/api-surface.json', 'package.json', 'tsconfig.json', 'tsconfig.base.json']) {
      mkdirSync(resolve(root, item, '..'), { recursive: true });
      cpSync(resolve(source, item), resolve(root, item), { recursive: true });
    }
    symlinkSync(resolve(source, 'node_modules'), resolve(root, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const run = () => spawnSync(process.execPath, ['scripts/api-surface.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const toast = resolve(root, 'src/toast.ts');
    const original = readFileSync(toast, 'utf8');
    writeFileSync(toast, original.replace('export class HYToast extends HTMLElement {', 'export class HYToast extends HTMLElement {\n  private _implementationOnly = 1;'));
    result = run();
    assert.equal(result.status, 0, 'Private implementation detail must not change the API contract: ' + result.stderr);
    writeFileSync(toast, original.replace('readonly reason: HYToastCloseReason;', 'readonly reason: string;'));
    result = run();
    assert.notEqual(result.status, 0, 'Event detail widening must require public API review');
    assert.match(result.stderr, /UI API changed/);
    writeFileSync(toast, original);
    const treeTypes = resolve(root, 'src/tree-types.ts');
    const originalTreeTypes = readFileSync(treeTypes, 'utf8');
    assert.match(originalTreeTypes, /label\?: string/);
    writeFileSync(treeTypes, originalTreeTypes.replace('label?: string', 'label?: number'));
    result = run();
    assert.notEqual(result.status, 0, 'Re-exported interface members must require public API review');
    assert.match(result.stderr, /UI API changed/);
    writeFileSync(treeTypes, originalTreeTypes);
    const entry = resolve(root, 'src/expandable.ts');
    writeFileSync(entry, readFileSync(entry, 'utf8') + '\nexport const HYUnreviewed = 1;\n');
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UI API changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
