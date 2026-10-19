// Run after build with the example server on 127.0.0.1:4187. No product or GPU benchmark.
import {chromium,webkit} from '@playwright/test';
import {writeFileSync} from 'node:fs';
const base=process.env.HY_WEB_EVIDENCE_URL??'http://127.0.0.1:4187';
const output=new URL('./',import.meta.url);
const report={recordedAt:new Date().toISOString(),kind:'headless-browser-integration',browsers:[],memory:[]};
for(const [name,engine]of Object.entries({chromium,webkit})){
  const browser=await engine.launch(),page=await browser.newPage({viewport:{width:1100,height:900}});
  try{
    await page.goto(base+'/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
    await page.screenshot({path:new URL(name+'-desktop.png',output).pathname,fullPage:true});
    await page.getByRole('button',{name:'预览设置',exact:true}).click();
    await page.screenshot({path:new URL(name+'-modal.png',output).pathname});
    await page.keyboard.press('Escape');await page.locator('#theme').click();await page.locator('#font').click();
    await page.setViewportSize({width:420,height:850});
    await page.screenshot({path:new URL(name+'-narrow.png',output).pathname,fullPage:true});
    report.browsers.push({name,version:browser.version(),userAgent:await page.evaluate(()=>navigator.userAgent)});
    if(name!=='chromium')continue;
    await page.evaluate(async()=>{
      demo.dispose();
      const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
      const {HYPage}=await import('/dist/portable/index.js');
      const {hyNode:n}=await import('/dist/core/index.js');
      const options=[{value:'a',label:'A'},{value:'b',label:'B'}];
      window.cycles=async(count)=>{
        let mounted=0,disposed=0;
        for(let i=0;i<count;i++){
          const renderer=new HYWebRenderer(document.querySelector('#app'),{platformViews:{preview:host=>{
            const canvas=document.createElement('canvas');
            return {mount(){mounted++;host.append(canvas);},update(){},layout(){},visible(){},focus(){},dispose(){disposed++;canvas.remove();}};
          }}});
          const page=new HYPage(renderer);
          page.mount(n('Column','root',{}, {children:[
            n('Button','button',{text:'Save'}),n('Toggle','toggle',{checked:true}),
            n('TextInput','input',{value:'text'}),n('TextArea','area',{value:'notes'}),
            n('Select','select',{value:'a',options}),n('Tabs','tabs',{value:'a',options}),
            n('Slider','slider',{min:0,max:1,step:.1,value:.5}),
            n('Dialog','dialog',{title:'Dialog',open:false}),
            n('PlatformView','preview',{slot:'preview',resourceId:'same'})]}));
          page.setProps('/root/input','TextInput',{value:'edited'});
          page.suspend();page.resume();page.dispose();
          const stats=renderer.diagnostics;
          if(stats.activeNodes||stats.activeListeners||stats.activeResources)throw new Error('lifecycle leak');
        }
        await new Promise(resolve=>setTimeout(resolve,50));return {count,mounted,disposed};
      };
    });
    const cdp=await page.context().newCDPSession(page);await cdp.send('Performance.enable');
    await page.evaluate(()=>cycles(10)); // Warm constructors/styles before observation.
    for(const count of [0,50,50]){
      const cycle=await page.evaluate(count=>cycles(count),count);
      await cdp.send('HeapProfiler.collectGarbage');
      const heap=await cdp.send('Runtime.getHeapUsage'),dom=await cdp.send('Memory.getDOMCounters');
      report.memory.push({cycle,heap,dom});
    }
    await cdp.detach();
  }finally{await browser.close();}
}
writeFileSync(new URL('browser-environment.json',output),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
