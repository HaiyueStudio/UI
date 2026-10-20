import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,relative,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {rollup} from 'rollup';
const root=fileURLToPath(new URL('../../',import.meta.url));
function run(args,cwd) {
  const result=spawnSync(process.execPath,args,{cwd,encoding:'utf8',env:process.env});
  assert.equal(result.status,0,result.error?.message||result.stderr||result.stdout);return result.stdout;
}
test('Web adapter tarball has independent exports/types, no eager registration and only focused browser dependencies',async()=>{
  const temp=mkdtempSync(resolve(tmpdir(),'haiyue-ui-web-'));
  try{
    const pack=JSON.parse(run([process.env.npm_execpath,'pack','--ignore-scripts','--json','--offline','--cache='+temp+'/cache','--pack-destination='+temp],root))[0];
    const consumer=resolve(temp,'consumer');mkdirSync(consumer);
    writeFileSync(resolve(consumer,'package.json'),JSON.stringify({name:'web-consumer',version:'1.0.0',private:true,type:'module'}));
    run([process.env.npm_execpath,'install',resolve(temp,pack.filename),'--offline','--ignore-scripts','--no-audit','--no-fund','--cache='+temp+'/cache'],consumer);
    const installed=resolve(consumer,'node_modules/@haiyue/ui');
    const pkg=JSON.parse(readFileSync(resolve(installed,'package.json')));
    assert.deepEqual(pkg.exports['./adapters/web'],{types:'./dist/adapters/web/index.d.ts',import:'./dist/adapters/web/index.js'});
    for(const field of ['dependencies','optionalDependencies','peerDependencies'])assert.equal(Object.keys(pkg[field]??{}).length,0);
    writeFileSync(resolve(consumer,'import.mjs'),[
      "globalThis.HTMLElement=class {};",
      "for(const key of ['window','document','customElements'])Object.defineProperty(globalThis,key,{get(){throw new Error('eager platform access: '+key);}});",
      "const web=await import('@haiyue/ui/adapters/web');",
      "if(Object.keys(web).sort().join(',')!=='HYWebRenderer,definePortableWebComponents')throw new Error('unexpected runtime surface');",
    ].join('\n'));
    run(['import.mjs'],consumer);
    writeFileSync(resolve(consumer,'check.ts'),[
      "import {HYWebRenderer,definePortableWebComponents,type HYWebRendererOptions,type HYWebEnvironment,type HYWebPlatformContext,type HYWebDiagnostics} from '@haiyue/ui/adapters/web';",
      "import {HYPage} from '@haiyue/ui/portable';",
      "import {hyNode} from '@haiyue/ui/core';",
      "const environment:HYWebEnvironment={direction:'rtl',safeArea:'environment'};",
      "const options:HYWebRendererOptions={environment,resolveResource:resource=>resource.id,platformViews:{preview:(host,context:HYWebPlatformContext)=>({mount(){host.dataset.slot=context.slot;},update(id){host.id=id;},layout(){},visible(){},focus(){host.focus();},dispose(){host.replaceChildren();}})}};",
      "definePortableWebComponents();const renderer=new HYWebRenderer(document.body,options);",
      "const stats:HYWebDiagnostics=renderer.diagnostics;const page=new HYPage(renderer);page.mount(hyNode('Text','x',{text:String(stats.commits)}));page.dispose();",
    ].join('\n'));
    writeFileSync(resolve(consumer,'tsconfig.json'),JSON.stringify({compilerOptions:{target:'ESNext',module:'NodeNext',moduleResolution:'NodeNext',lib:['ESNext','DOM','DOM.Iterable'],types:[],strict:true,noEmit:true,skipLibCheck:false},include:['check.ts']}));
    run([resolve(root,'node_modules/typescript/bin/tsc'),'-p','tsconfig.json'],consumer);
    const bundle=await rollup({input:resolve(installed,'dist/adapters/web/index.js'),onwarn:warning=>{throw new Error(warning.message);}});
    try{
      const dist=realpathSync(resolve(installed,'dist')),modules=bundle.cache.modules.map(m=>relative(dist,realpathSync(m.id)).split(sep).join('/'));
      const focused=new Set(['radio.js','rate.js','badge.js','divider.js','button.js','checkbox.js','select.js','tabs.js','input.js','range.js','dialog.js','portable/theme.js']);
      assert.ok(modules.every(path=>path.startsWith('core/')||path.startsWith('adapters/web/')||focused.has(path)),modules.join('\n'));
      assert.equal(modules.includes('index.js'),false);
    }finally{await bundle.close();}
  }finally{rmSync(temp,{recursive:true,force:true});}
});
