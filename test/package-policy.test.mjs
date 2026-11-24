import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPackageGlob, parseNpmPackResult } from '../scripts/package-policy.mjs';

test('npm pack results support both array and package-keyed npm formats', () => {
  const pack = { name: '@haiyue/ui', filename: 'haiyue-ui-0.3.0.tgz', files: [{ path: 'package.json' }] };
  assert.deepEqual(parseNpmPackResult(JSON.stringify([pack]), pack.name), pack);
  assert.deepEqual(parseNpmPackResult(JSON.stringify({ [pack.name]: pack }), pack.name), pack);
});

test('npm pack results reject missing packages and incomplete metadata', () => {
  for (const result of [[], {}, null, { '@haiyue/ui': { name: '@haiyue/ui', filename: 'empty.tgz' } }]) {
    assert.throws(() => parseNpmPackResult(JSON.stringify(result), '@haiyue/ui'), /Invalid npm pack result/);
  }
});

test('publication allowlist includes nested JS/types and excludes source, maps and adjacent directories', () => {
  assert.equal(matchesPackageGlob('dist/button.js', 'dist/**/*.js'), true);
  assert.equal(matchesPackageGlob('dist/shared/tokens.d.ts', 'dist/**/*.d.ts'), true);
  assert.equal(matchesPackageGlob('dist/button.js.map', 'dist/**/*.js'), false);
  assert.equal(matchesPackageGlob('src/button.ts', 'dist/**/*.d.ts'), false);
  assert.equal(matchesPackageGlob('themes/nested/custom.css', 'themes/*.css'), false);
});
