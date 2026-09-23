import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const entries = Object.entries(pkg.exports).filter(([, target]) => typeof target === 'object');
const files = entries.map(([, target]) => resolve(root, target.import.replace('./dist/', './src/').replace(/\.js$/, '.ts')));
const program = ts.createProgram(files, { target: ts.ScriptTarget.ESNext, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler, skipLibCheck: true });
const checker = program.getTypeChecker();
const entrypoints = Object.fromEntries(entries.map(([name], index) => {
  const source = program.getSourceFile(files[index]);
  const symbol = source && checker.getSymbolAtLocation(source);
  if (!symbol) throw new Error(`Cannot inspect public entry ${name}`);
  const exports = checker.getExportsOfModule(symbol).map(symbol => {
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    return { name: symbol.name, kind: target.flags & ts.SymbolFlags.Value ? 'value' : 'type' };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return [name, exports];
}));
const snapshot = { schemaVersion: 1, package: pkg.name, exports: pkg.exports, entrypoints };
const file = resolve(root, 'review/api-surface.json');
const serialized = JSON.stringify(snapshot, null, 2) + '\n';
if (process.argv[2] === '--write') {
  writeFileSync(file, serialized);
  console.log('[ui-api] Wrote reviewed API baseline.');
} else if (process.argv[2] === '--check') {
  if (readFileSync(file, 'utf8') !== serialized) throw new Error('UI API changed. Review the public surface and update review/api-surface.json explicitly.');
  console.log(`[ui-api] ${entries.length} entrypoints match the independent UI baseline.`);
} else throw new Error('Usage: node scripts/api-surface.mjs --check|--write');
