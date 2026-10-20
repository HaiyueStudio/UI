import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { rollup } from 'rollup';
const root=fileURLToPath(new URL('../../',import.meta.url));
function run(cmd,args,cwd) {
  const result=spawnSync(cmd,args,{cwd,encoding:'utf8',env:process.env});
  assert.equal(result.status,0,result.error?.message || result.stderr || result.stdout);return result.stdout;
}
test('fresh tarball installs offline; core/portable import and types need no platform globals or sibling repository',async()=>{
  const temp=mkdtempSync(resolve(tmpdir(),'haiyue-ui-portable-'));
  try {
    assert.ok(process.env.npm_execpath,'Run tests through npm');
    const pack=JSON.parse(run(process.execPath,[process.env.npm_execpath,'pack','--ignore-scripts','--json','--offline',`--cache=${temp}/cache`,`--pack-destination=${temp}`],root))[0];
    assert.equal(pack.files.some(f=>/^(src|test|review|examples)\//.test(f.path)),false);
    const consumer=resolve(temp,'consumer');mkdirSync(consumer);
    writeFileSync(resolve(consumer,'package.json'),JSON.stringify({name:'portable-consumer',version:'1.0.0',private:true,type:'module'}));
    run(process.execPath,[process.env.npm_execpath,'install',resolve(temp,pack.filename),'--offline','--ignore-scripts','--no-audit','--no-fund',`--cache=${temp}/cache`],consumer);
    const installed=JSON.parse(readFileSync(resolve(consumer,'node_modules/@haiyue/ui/package.json')));
    for(const field of ['dependencies','peerDependencies','optionalDependencies'])assert.equal(Object.keys(installed[field]??{}).length,0);
    writeFileSync(resolve(consumer,'check.mjs'),`
      import assert from 'node:assert/strict';
      for (const name of ['window','document','HTMLElement','customElements','NativeScript']) Object.defineProperty(globalThis,name,{get(){throw new Error('platform access: '+name);}});
      const core=await import('@haiyue/ui/core'); const portable=await import('@haiyue/ui/portable');
      assert.equal(core.hyNode('Text','label',{text:'offline'}).props.text,'offline');
      assert.equal(typeof portable.HYPage,'function');
    `);
    run(process.execPath,['check.mjs'],consumer);
    writeFileSync(resolve(consumer,'check.ts'),`
      import {hyNode,type HYRenderer,type HYNode} from '@haiyue/ui/core';
      import {HYPage,type HYBinding} from '@haiyue/ui/portable';
      export const node:HYNode=hyNode('Text','label',{text:'offline'});
      export function mount(renderer:HYRenderer){const page=new HYPage(renderer);page.mount(node);return page;}
      export const bindings:HYBinding<{title:string}>[]=[{key:'/label',kind:'Text',select:s=>({text:s.title})}];
      // @ts-expect-error No DOM declarations should enter either public subpath.
      const leaked: HTMLElement = {};
    `);
    writeFileSync(resolve(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ESNext',module:'NodeNext',moduleResolution:'NodeNext',lib:['ESNext'],types:[],strict:true,noEmit:true,skipLibCheck:false},include:['check.ts']}));
    run(process.execPath,[resolve(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],consumer);
    const bundle=await rollup({input:resolve(consumer,'node_modules/@haiyue/ui/dist/portable/index.js'),onwarn:w=>{throw new Error(w.message);}});
    try {
      const modules=bundle.cache.modules.map(m=>realpathSync(m.id));
      const allowed=realpathSync(resolve(consumer,'node_modules/@haiyue/ui/dist'));
      assert.ok(modules.every(path=>path.startsWith(`${allowed}${sep}core${sep}`)||path.startsWith(`${allowed}${sep}portable${sep}`)),modules.join('\n'));
    } finally {await bundle.close();}
  } finally {rmSync(temp,{recursive:true,force:true});}
});
