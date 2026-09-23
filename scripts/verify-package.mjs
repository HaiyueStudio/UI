import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { rollup } from 'rollup';
import { matchesPackageGlob } from './package-policy.mjs';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json')));
const policy = JSON.parse(readFileSync(resolve(root, 'review/package-budget.json')));
const budget = policy.package;
assert.equal(policy.schemaVersion, 1);
assert.equal(pkg.name, '@haiyue/ui');
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies']) {
  assert.equal(Object.keys(pkg[field] ?? {}).length, 0, `${field} must remain empty`);
}
assert.deepEqual(pkg.files, budget.declaredFiles);
assert.deepEqual(pkg.sideEffects, budget.sideEffects);
const output = resolve(root, '.artifacts/packages');
mkdirSync(output, { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout;
}
assert.ok(process.env.npm_execpath, 'Run through npm run verify:package');
const [pack] = JSON.parse(run(process.execPath, [process.env.npm_execpath, 'pack', '--ignore-scripts', '--json', '--pack-destination', output, '--cache=.npm-cache']));
for (const [metric, maximum] of [['size',budget.maxPackedBytes],['unpackedSize',budget.maxUnpackedBytes],['entryCount',budget.maxFileCount]]) {
  assert.ok(pack[metric] <= maximum, `${metric}: ${pack[metric]} exceeds ${maximum}`);
}
for (const file of pack.files) assert.ok(budget.allowedFilePatterns.some(pattern => matchesPackageGlob(file.path, pattern)), `Unexpected packed file: ${file.path}`);
const temporary = mkdtempSync(resolve(tmpdir(), 'haiyue-ui-package-'));
try {
  run('tar', ['-xzf', resolve(output, pack.filename), '-C', temporary]);
  const packedRoot = resolve(temporary, 'package');
  for (const target of Object.values(pkg.exports)) {
    for (const path of typeof target === 'string' ? [target] : Object.values(target)) {
      assert.ok(existsSync(resolve(packedRoot, path)), `Missing packed export: ${path}`);
    }
  }
  const consumer = '\0ui-button-consumer';
  const bundle = await rollup({
    input: consumer,
    plugins: [{
      name: 'packed-ui-consumer',
      resolveId(id) {
        if (id === consumer) return consumer;
        if (id === '@haiyue/ui/button') return resolve(packedRoot, pkg.exports['./button'].import);
        return null;
      },
      load(id) { return id === consumer ? readFileSync(resolve(root, 'scripts/fixtures/button-consumer.mjs'), 'utf8') : null; },
    }],
    onwarn(warning) { throw new Error(warning.message); },
  });
  let gzipBytes;
  try {
    const { output: chunks } = await bundle.generate({ format: 'es' });
    for (const name of ['HYButton', 'defineButtonComponents']) assert.ok(chunks.some(chunk => chunk.exports?.includes(name)), `Missing consumer export: ${name}`);
    const code = chunks.map(chunk => chunk.code ?? '').join('\n');
    gzipBytes = gzipSync(code).length;
    assert.ok(gzipBytes <= policy.buttonConsumerMaxGzipBytes, `Button consumer: ${gzipBytes} exceeds ${policy.buttonConsumerMaxGzipBytes}`);
    assert.ok(!code.includes('class HYExpandable'), 'Isolated button entry included unrelated components');
  } finally { await bundle.close(); }
  const report = { package: pkg.name, version: pkg.version, file: resolve(output, pack.filename), packedBytes: pack.size, unpackedBytes: pack.unpackedSize, files: pack.entryCount, buttonGzipBytes: gzipBytes, sha256: createHash('sha256').update(readFileSync(resolve(output, pack.filename))).digest('hex') };
  writeFileSync(resolve(root, '.artifacts/package-check.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
} finally { rmSync(temporary, { recursive: true, force: true }); }
