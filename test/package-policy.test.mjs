import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesPackageGlob } from '../scripts/package-policy.mjs';
test('publication allowlist includes nested JS/types and excludes source, maps and adjacent directories', () => {
  assert.equal(matchesPackageGlob('dist/button.js', 'dist/**/*.js'), true);
  assert.equal(matchesPackageGlob('dist/shared/tokens.d.ts', 'dist/**/*.d.ts'), true);
  assert.equal(matchesPackageGlob('dist/button.js.map', 'dist/**/*.js'), false);
  assert.equal(matchesPackageGlob('src/button.ts', 'dist/**/*.d.ts'), false);
  assert.equal(matchesPackageGlob('themes/nested/custom.css', 'themes/*.css'), false);
});
