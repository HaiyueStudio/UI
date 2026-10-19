import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync,statSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hyNode,hyKey} from '../../../dist/core/index.js';
import {HYPage} from '../../../dist/portable/index.js';
import {RecordingRenderer} from '../../../test/portable/recording.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));process.chdir(root);
const read=file=>readFileSync(file,'utf8');
const hash=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
const command=(cmd,args)=>{const result=spawnSync(cmd,args,{encoding:'utf8'});assert.equal(result.status,0,result.stderr);return result.stdout.trim();};
const before=JSON.parse(command('git',['show','HEAD:review/api-surface.json']));
const current=JSON.parse(read('review/api-surface.json'));
for(const key of Object.keys(before.exports))assert.deepEqual(current.exports[key],before.exports[key]);
for(const key of Object.keys(before.entrypoints))assert.deepEqual(current.entrypoints[key],before.entrypoints[key]);
assert.deepEqual(Object.keys(current.entrypoints).filter(key=>!before.entrypoints[key]),['./core','./portable']);
const renderer=new RecordingRenderer(),page=new HYPage(renderer);
const tree=hyNode('Column','page',{}, {children:Array.from({length:1000},(_,i)=>hyNode('Text',`item-${i}`,{text:`Item ${i}`}))});
page.mount(tree);
page.setProps(hyKey('page','item-500'),'Text',{text:'Changed'});
const single=renderer.batches.at(-1).mutations;
assert.equal(single.length,1);assert.equal(single[0].type,'update');
const previousCount=renderer.batches.length;
page.setProps(hyKey('page','item-500'),'Text',{text:'Changed'});assert.equal(renderer.batches.length,previousCount);
page.transaction(()=>{for(let i=0;i<100;i++)page.setProps(hyKey('page',`item-${i%2}`),'Text',{text:String(i)});});
const batched=renderer.batches.length-previousCount, batchMutations=renderer.batches.at(-1).mutations.length;
assert.equal(batched,1);assert.equal(batchMutations,2);
page.dispose();assert.equal(renderer.nodes.size,0);
function result(file){const text=read(file),tests=Number([...text.matchAll(/ℹ tests (\d+)/g)].at(-1)?.[1]),passed=Number([...text.matchAll(/ℹ pass (\d+)/g)].at(-1)?.[1]);assert.ok(tests>0&&tests===passed);assert.match(text,/ℹ fail 0/);return {status:'passed',tests,passed,log:file,sha256:hash(file)};}
const paths=[];
function walk(dir){for(const entry of readdirSync(dir).sort()){const path=resolve(dir,entry);if(statSync(path).isDirectory())walk(path);else paths.push(relative(root,path));}}
for(const directory of ['src','test/portable'])walk(directory);
paths.push('package.json','package-lock.json','tsconfig.json','tsconfig.base.json','tsconfig.portable.json','README.md','CHANGELOG.md','review/api-surface.json','review/package-budget.json','test/package-boundaries.test.mjs','scripts/verify-package.mjs');
const sources=Object.fromEntries(paths.sort().map(file=>[file,hash(file)]));
const artifact=JSON.parse(read('.artifacts/package-check.json'));artifact.file=relative(root,artifact.file);
assert.equal(hash(artifact.file),artifact.sha256);
const report={schemaVersion:1,goal:'m24-native-ui/g03-component-core',status:'passed',recordedAt:new Date().toISOString(),
  environment:{platform:process.platform,arch:process.arch,node:process.version,npm:command('npm',['--version'])},
  source:{head:command('git',['rev-parse','HEAD']),kind:'working-tree-snapshot',sha256:createHash('sha256').update(JSON.stringify(sources)).digest('hex'),files:sources},
  checks:{portable:result('review/m24-ui/g03/portable-tests.log'),packageAndFullSuite:result('review/m24-ui/g03/package-check.log'),
    legacyAPI:{status:'passed',preservedEntryPoints:Object.keys(before.entrypoints).length,newEntryPoints:['./core','./portable']},
    noDOMTypes:'passed: source + installed declarations, lib ESNext and types []',freshConsumer:'passed: offline tarball install/import/typecheck without sibling source'},
  operationCounts:{nodes:1001,singlePropertyUpdates:single.length,identicalPropsWrites:0,oneHundredChanges:{commits:batched,updates:batchMutations},activeNodesAfterDispose:renderer.nodes.size},
  package:artifact,limits:['Recording backend only; no platform renderer or native layout implemented in G03.','Actual IME, accessibility, asynchronous native setter feedback and surface integration belong to G05/G06/G08.','ShaderLab shared UI integration and device comparisons belong to G07.','No publication; manifest version remains 0.2.0 until the G10 version decision.']};
writeFileSync('review/m24-ui/g03/verification.json',JSON.stringify(report,null,2)+'\n');
const freezeFiles=['src/core/types.ts','src/core/index.ts','src/portable/page.ts','src/portable/index.ts','src/portable/theme.ts','review/api-surface.json','review/m24-ui/g03/schema-1.1.md','docs/for-ai/adr/2026-10-16-g03-component-core.md'];
writeFileSync('review/m24-ui/g03/freeze.json',JSON.stringify({schema:'haiyue-portable-ui/1.1',protocol:1,sourceSnapshot:report.source.sha256,packageSha256:artifact.sha256,files:Object.fromEntries(freezeFiles.map(file=>[file,hash(file)]))},null,2)+'\n');
console.log(JSON.stringify({status:report.status,sourceSnapshot:report.source.sha256,checks:report.checks,package:artifact,operationCounts:report.operationCounts},null,2));
