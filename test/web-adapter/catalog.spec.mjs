import {test,expect} from '@playwright/test';
test('catalog real WebComponents preserve controlled values and release listeners',async({page})=>{
  await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
  await page.evaluate(async()=>{
    demo.dispose();const {hyNode:n}=await import('/dist/core/index.js');const {HYPage}=await import('/dist/portable/index.js');const {HYWebRenderer}=await import('/dist/adapters/web/index.js');
    const renderer=new HYWebRenderer(document.querySelector('#app'));window.catalogEvents=[];
    window.catalog=new HYPage(renderer,{onEvent:e=>catalogEvents.push(e)});window.catalogRenderer=renderer;
    catalog.mount(n('Column','catalog',{}, {children:[n('Checkbox','check',{text:'Accept notices',checked:false}),n('RadioGroup','radio',{value:'a',options:[{value:'a',label:'A'},{value:'b',label:'B'},{value:'c',label:'C',disabled:true}]}),n('Rate','rate',{value:2,count:5,a11y:{label:'Rating'}}),n('Badge','badge',{text:'NEW'}),n('Divider','divider',{text:'Details'})]}));
  });
  await page.locator('hy-checkbox label').click();
  await expect(page.getByRole('checkbox',{name:'Accept notices'})).not.toBeChecked();
  await page.locator('hy-radio[label="B"]').click();
  await expect(page.getByRole('radio',{name:'A',exact:true})).toBeChecked();
  await expect(page.getByRole('radio',{name:'B',exact:true})).not.toBeChecked();
  await expect(page.getByRole('radio',{name:'C',exact:true})).toBeDisabled();
  await page.getByRole('slider',{name:'Rating'}).focus();await page.keyboard.press('ArrowRight');
  const events=await page.evaluate(()=>catalogEvents.filter(e=>['valueChange','commit'].includes(e.type)));
  expect(events.map(e=>[e.type,e.value])).toEqual([['valueChange',true],['commit',true],['valueChange','b'],['commit','b'],['valueChange',3],['commit',3]]);
  await expect(page.getByRole('slider',{name:'Rating'})).toHaveAttribute('aria-valuenow','2');
  for(const text of ['0','001','100','9999999','NEW']){await page.evaluate(text=>catalog.setProps('/catalog/badge','Badge',{text}),text);await expect(page.locator('hy-badge [part=badge-content]')).toHaveText(text);}
  await page.evaluate(()=>{catalog.setProps('/catalog/check','Checkbox',{text:'Accept notices',checked:true,disabled:true});catalog.setProps('/catalog/rate','Rate',{value:4,count:5,readOnly:true});});
  await expect(page.getByRole('checkbox',{name:'Accept notices'})).toBeChecked();await expect(page.getByRole('checkbox',{name:'Accept notices'})).toBeDisabled();
  expect(await page.evaluate(()=>{catalog.dispose();return catalogRenderer.diagnostics;})).toMatchObject({activeNodes:0,activeResources:0,activeListeners:0});
});
