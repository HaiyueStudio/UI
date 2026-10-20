import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rollup } from 'rollup';
import { nodeResolve } from '@rollup/plugin-node-resolve';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const input = resolve(repositoryRoot, 'examples/code-editor.js');
const output = resolve(repositoryRoot, 'examples/vendor/codemirror.js');

mkdirSync(dirname(output), { recursive: true });

const bundle = await rollup({ input, plugins: [nodeResolve({ browser: true })] });
try {
  await bundle.write({
    file: output,
    format: 'es',
    generatedCode: 'es2015',
    sourcemap: false,
  });
} finally {
  await bundle.close();
}

console.log(`CodeMirror example asset built at ${output}`);
