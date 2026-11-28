import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const entries = Object.entries(pkg.exports).filter(([, target]) => typeof target === 'object');
const files = entries.map(([, target]) => resolve(root, target.import.replace('./dist/', './src/').replace(/\.js$/, '.ts')));
const configFile = ts.readConfigFile(resolve(root, 'tsconfig.json'), ts.sys.readFile);
if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, '\n'));
const config = ts.parseJsonConfigFileContent(configFile.config, ts.sys, root);
const program = ts.createProgram(files, { ...config.options, noEmit: false, declaration: true, emitDeclarationOnly: true });
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
// Capture declaration shapes reachable from public entries, including re-exported interfaces.
// Private implementation members do not form the consumer contract.
const emitted = new Map();
const result = program.emit(undefined, (path, source) => {
  if (path.endsWith('.d.ts')) emitted.set(resolve(path), normalizeDeclaration(path, source));
}, undefined, true);
if (result.emitSkipped) throw new Error('Cannot emit public UI declarations');
const reachable = new Set();
function visit(path) {
  if (reachable.has(path)) return;
  const source = emitted.get(path);
  if (source === undefined) throw new Error(`Missing declaration for ${relative(root, path)}`);
  reachable.add(path);
  for (const imported of ts.preProcessFile(source, true, true).importedFiles) {
    if (!imported.fileName.startsWith('.')) continue;
    const dependency = resolve(dirname(path), imported.fileName.replace(/\.js$/, '.d.ts'));
    visit(dependency);
  }
}
for (const [, target] of entries) visit(resolve(root, target.types));
const declarations = Object.fromEntries([...reachable].sort().map(path => [relative(root, path).replaceAll('\\', '/'), emitted.get(path)]));
const snapshot = { schemaVersion: 2, package: pkg.name, exports: pkg.exports, entrypoints, declarations };
const file = resolve(root, 'review/api-surface.json');
const serialized = JSON.stringify(snapshot, null, 2) + '\n';
if (process.argv[2] === '--write') {
  writeFileSync(file, serialized);
  console.log('[ui-api] Wrote reviewed API baseline.');
} else if (process.argv[2] === '--check') {
  if (readFileSync(file, 'utf8') !== serialized) throw new Error('UI API changed. Review the public surface and update review/api-surface.json explicitly.');
  console.log(`[ui-api] ${entries.length} entrypoints match the independent UI baseline.`);
} else throw new Error('Usage: node scripts/api-surface.mjs --check|--write');

function normalizeDeclaration(path, source) {
  const parsed = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const transformed = ts.transform(parsed, [context => {
    const visit = node => {
      if (ts.isClassElement(node) && !ts.isConstructorDeclaration(node)
        && (node.name && ts.isPrivateIdentifier(node.name)
          || ts.getModifiers(node)?.some(modifier => modifier.kind === ts.SyntaxKind.PrivateKeyword))) return undefined;
      return ts.visitEachChild(node, visit, context);
    };
    return node => ts.visitNode(node, visit);
  }]);
  try {
    return ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed }).printFile(transformed.transformed[0]);
  } finally { transformed.dispose(); }
}
