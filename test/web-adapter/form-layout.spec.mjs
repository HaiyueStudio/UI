import {test,expect} from '@playwright/test';
test('form help and error changes remain accessible without losing the focused native input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
 await page.evaluate(async()=>{demo.dispose();const {HYWebRenderer}=await import('/dist/adapters/web/index.js'),{HYPage}=await import('/dist/portable/index.js'),{hyNode:n}=await import('/dist/core/index.js');window.form=new HYPage(new HYWebRenderer(document.querySelector('#app')));form.mount(n('FormGroup','field',{label:'Project name',description:'Shown below the label'},{children:[n('TextInput','input',{value:'Draft'})]}));window.original=document.querySelector('hy-input').shadowRoot.querySelector('input');});
 const input=page.getByRole('textbox',{name:'Project name'});await input.focus();await input.press('ControlOrMeta+A');
 await page.evaluate(()=>form.setProps('/field','FormGroup',{label:'Project name',description:'Updated help',error:'Name is required'}));
 await expect(input).toBeFocused();await expect(input).toHaveAttribute('aria-description','Updated help. Name is required');await expect(input).toHaveAttribute('aria-invalid','true');await expect(page.locator('[data-hy-help]')).toHaveText('Updated help');expect(await page.evaluate(()=>original===document.querySelector('hy-input').shadowRoot.querySelector('input'))).toBe(true);await expect(input).toHaveValue('Draft');
 await page.evaluate(()=>form.setProps('/field','FormGroup',{label:'Project name'}));await expect(input).not.toHaveAttribute('aria-invalid');await expect(input).not.toHaveAttribute('aria-description');await page.evaluate(()=>form.dispose());expect(errors).toEqual([]);
});
test('portable input has one focus surface and fills its height at regular and large font sizes',async({page})=>{
 await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
 await page.evaluate(async()=>{
  demo.dispose();const {HYWebRenderer}=await import('/dist/adapters/web/index.js'),{HYPage}=await import('/dist/portable/index.js'),{hyNode:n}=await import('/dist/core/index.js');
  window.inputPage=new HYPage(new HYWebRenderer(document.querySelector('#app')));
  inputPage.mount(n('Row','name',{layout:{align:'center'}},{children:[n('Text','label',{text:'Name'}),n('TextInput','input',{value:'Untitled shader',layout:{width:240,height:44,minHeight:44},a11y:{label:'Project name'}})]}));
 });
 const input=page.getByRole('textbox',{name:'Project name'});await input.focus();await input.press('End');await input.pressSequentially(' test');await expect(input).toHaveValue('Untitled shader test');
 for(const height of [44,56]){
  await page.evaluate(height=>inputPage.setProps('/name/input','TextInput',{value:'Untitled shader test',layout:{width:240,height,minHeight:height},a11y:{label:'Project name'}}),height);
  const bounds=await input.evaluate(input=>{const control=input.closest('.control'),host=input.getRootNode().host,c=getComputedStyle(control),s=getComputedStyle(input),r=input.getBoundingClientRect(),p=control.getBoundingClientRect();return {height:r.height,controlHeight:p.height,hostHeight:host.getBoundingClientRect().height,top:r.top-p.top,bottom:p.bottom-r.bottom,outline:s.outlineStyle,border:s.borderTopWidth,focus:c.boxShadow};});
  expect(bounds.hostHeight).toBe(height);expect(bounds.controlHeight).toBe(height);expect(bounds.top).toBeCloseTo(1,0);expect(bounds.bottom).toBeCloseTo(1,0);expect(bounds.height).toBe(height-2);expect(bounds.outline).toBe('none');expect(bounds.border).toBe('0px');expect(bounds.focus).not.toBe('none');await expect(input).toBeFocused();
 }
 await page.evaluate(()=>inputPage.dispose());
});
