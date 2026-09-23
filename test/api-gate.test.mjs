import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, cpSync, symlinkSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const source = fileURLToPath(new URL('../', import.meta.url));
test('UI API gate works without Engine and rejects an unreviewed public export', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'ui-api-isolation-'));
  try {
    for (const item of ['scripts/api-surface.mjs', 'src', 'review/api-surface.json', 'package.json']) {
      mkdirSync(resolve(root, item, '..'), { recursive: true });
      cpSync(resolve(source, item), resolve(root, item), { recursive: true });
    }
    symlinkSync(resolve(source, 'node_modules'), resolve(root, 'node_modules'), 'dir');
    const run = () => spawnSync(process.execPath, ['scripts/api-surface.mjs', '--check'], { cwd: root, encoding: 'utf8' });
    let result = run();
    assert.equal(result.status, 0, result.stderr);
    const entry = resolve(root, 'src/expandable.ts');
    writeFileSync(entry, readFileSync(entry, 'utf8') + '\nexport const HYUnreviewed = 1;\n');
    result = run();
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /UI API changed/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
