import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,cpSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
const root=fileURLToPath(new URL('../../../',import.meta.url)); // review/m24-ui/g05 -> UI
const directory=fileURLToPath(new URL('./',import.meta.url));
const read=path=>JSON.parse(readFileSync(resolve(root,path)));
const hash=path=>createHash('sha256').update(readFileSync(path)).digest('hex');
const before=read('review/m24-ui/g05/api-before.json'),after=read('review/api-surface.json');
for(const field of ['exports','entrypoints'])for(const [key,value]of Object.entries(before[field]))assert.deepEqual(after[field][key],value);
assert.deepEqual(Object.keys(after.exports).filter(key=>!before.exports[key]),['./adapters/web']);
const results=read('.artifacts/web-adapter-results.json');
assert.equal(results.stats.expected,38);assert.equal(results.stats.unexpected,0);assert.equal(results.stats.skipped,0);assert.equal(results.stats.flaky,0);
const log=readFileSync(resolve(directory,'release-check.log'),'utf8');
for(const marker of ['pass 94','fail 0','61 passed','38 passed','Verified 7 GitHub Pages example pages.'])assert.ok(log.includes(marker),marker);
cpSync(resolve(root,'.artifacts/web-adapter-results.json'),resolve(directory,'web-tests.json'));
const pkg=read('.artifacts/package-check.json');
assert.equal(hash(pkg.file),pkg.sha256);
const files=execFileSync('rg',['--files','src','test','docs','scripts','examples'],{cwd:root,encoding:'utf8'}).trim().split('\n');
files.push('package.json','package-lock.json','README.md','CHANGELOG.md','tsconfig.json','tsconfig.base.json','tsconfig.portable.json',
  'playwright.config.mjs','.github/workflows/check.yml','review/api-surface.json','review/package-budget.json',
  'review/m24-ui/g05/browser-evidence.mjs','review/m24-ui/g05/capture-evidence.mjs');
const snapshot=Object.fromEntries([...new Set(files)].sort().map(path=>[path,hash(resolve(root,path))]));
const artifactNames=['package-budget-check.log','release-check.log','web-tests.json','browser-environment.json','browser-evidence.log','api-compatibility.json','package-growth.json',
  'chromium-desktop.png','chromium-modal.png','chromium-narrow.png','webkit-desktop.png','webkit-modal.png','webkit-narrow.png'];
const report={schemaVersion:1,goal:'m24-native-ui/g05-web-adapter',status:'passed',recordedAt:new Date().toISOString(),
  environment:{platform:process.platform,arch:process.arch,osRelease:os.release(),node:process.version,npm:execFileSync('npm',['--version'],{encoding:'utf8'}).trim()},
  source:{head:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),kind:'working-tree-snapshot',
    sha256:createHash('sha256').update(JSON.stringify(snapshot)).digest('hex'),files:snapshot},
  commands:['npm run release:check','node review/m24-ui/g05/browser-evidence.mjs'],
  results:{unit:94,legacyChromium:61,adapterChromium:19,adapterWebKit:19,pages:7,entrypoints:39,independentOfflineConsumer:'passed'},
  package:pkg,artifacts:Object.fromEntries(artifactNames.map(path=>[path,hash(resolve(directory,path))])),
  pending:[{owner:'G07/G10',kind:'pending-device',items:['Safari app','system Chinese IME candidate interaction','VoiceOver','system clipboard permissions','mobile soft keyboard and safe areas']},
    {owner:'G07',kind:'pending-product',items:['ShaderLab shared page migration','same-device old/new UI p95 and GPU frame-time comparison']}],
  notes:['WebKit automation is not Safari/VoiceOver physical acceptance.','Canvas demo validates resource ownership, not GPU performance.','Current 0.2.0 manifest is a local artifact identity; no package published.']};
writeFileSync(resolve(directory,'verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({source:report.source.sha256,results:report.results,package:pkg.sha256},null,2));
