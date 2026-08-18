import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const output = resolve(repositoryRoot, '.artifacts/packages');
mkdirSync(output, { recursive: true });

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error('npm_execpath is required to pack the UI candidate.');
const result = spawnSync(process.execPath, [
  npmCli,
  'pack',
  '-w',
  './ui',
  '--pack-destination',
  output,
  '--loglevel=error',
  '--cache=.npm-cache',
], { cwd: repositoryRoot, stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
