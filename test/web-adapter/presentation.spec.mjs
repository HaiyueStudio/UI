import {test,expect} from '@playwright/test';
test('portable vectors, busy states, typography and tab variants share semantic theme tokens',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
 await page.evaluate(async()=>{
  demo.dispose();const {HYWebRenderer}=await import('/dist/adapters/web/index.js'),{HYPage}=await import('/dist/portable/index.js'),{hyNode:n}=await import('/dist/core/index.js');
  const theme={color:{text:'#eeeeee',muted:'#999999',surface:'#151515',input:'#222222',accent:'#7777ff',danger:'#ff5555',border:'#444444',focus:'#9999ff',selected:'#5555bb',pressed:'#333355',elevated:'#292929',onAccent:'#ffffff'},fontSize:14,lineHeight:20,gap:8,radius:8,typography:{title:{fontSize:24,lineHeight:32,weight:'bold'},caption:{fontSize:12,lineHeight:18}}};
  window.p0Renderer=new HYWebRenderer(document.querySelector('#app'),{environment:{theme,fontScale:1.5}});window.p0=new HYPage(p0Renderer);window.p0Events=[];
  window.p0Tree=(busy=false,variant='segmented')=>n('Column','root',{}, {children:[n('Text','title',{text:'Title',textStyle:'title'}),n('Text','caption',{text:'Hint',textStyle:'caption',tone:'muted'}),n('Button','save',{text:'',icon:'save',variant:'primary',busy,layout:{width:44,height:44},a11y:{label:'Save'}}),n('Tabs','tabs',{value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B',disabled:true}],variant})]});
  p0.mount(p0Tree());
 });
 const save=page.getByRole('button',{name:'Save',exact:true});await expect(save).toBeEnabled();
 expect(await page.locator('[data-hy-key="/root/save"] [slot=icon] svg').count()).toBe(1);
 await expect(page.locator('[data-hy-key="/root/title"]')).toHaveCSS('font-size','36px');
 await expect(page.locator('[data-hy-key="/root/caption"]')).toHaveCSS('color','rgb(153, 153, 153)');
 await expect(page.getByRole('tab',{name:'A',exact:true})).toHaveCSS('background-color','rgb(85, 85, 187)');
 await expect(page.getByRole('tab',{name:'B',exact:true})).toBeDisabled();
 expect(await save.boundingBox()).toMatchObject({width:44,height:44});
 await page.evaluate(()=>{window.p0Button=document.querySelector('[data-hy-key="/root/save"]');p0.render(p0Tree(true,'underline'));});
 await expect(save).toBeDisabled();await expect(save).toHaveAttribute('aria-busy','true');
 await expect(page.getByRole('tab',{name:'A',exact:true})).toHaveCSS('border-bottom-width','2px');
 expect(await page.evaluate(()=>document.querySelector('[data-hy-key="/root/save"]')===p0Button)).toBe(true);
 await page.evaluate(()=>{p0.render(p0Tree());p0.dispose();});
 expect(await page.evaluate(()=>p0Renderer.diagnostics)).toMatchObject({activeNodes:0,activeResources:0,activeListeners:0});expect(errors).toEqual([]);
});
