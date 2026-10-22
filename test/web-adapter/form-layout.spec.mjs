import {test,expect} from '@playwright/test';
test('form help and error changes remain accessible without losing the focused native input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/examples/portable-ui/');await page.waitForFunction(()=>!!window.demo);
 await page.evaluate(async()=>{demo.dispose();const {HYWebRenderer}=await import('/dist/adapters/web/index.js'),{HYPage}=await import('/dist/portable/index.js'),{hyNode:n}=await import('/dist/core/index.js');window.form=new HYPage(new HYWebRenderer(document.querySelector('#app')));form.mount(n('FormGroup','field',{label:'Project name',description:'Shown below the label'},{children:[n('TextInput','input',{value:'Draft'})]}));window.original=document.querySelector('hy-input').shadowRoot.querySelector('input');});
 const input=page.getByRole('textbox',{name:'Project name'});await input.focus();await input.press('ControlOrMeta+A');
 await page.evaluate(()=>form.setProps('/field','FormGroup',{label:'Project name',description:'Updated help',error:'Name is required'}));
 await expect(input).toBeFocused();await expect(input).toHaveAttribute('aria-description','Updated help. Name is required');await expect(input).toHaveAttribute('aria-invalid','true');await expect(page.locator('[data-hy-help]')).toHaveText('Updated help');expect(await page.evaluate(()=>original===document.querySelector('hy-input').shadowRoot.querySelector('input'))).toBe(true);await expect(input).toHaveValue('Draft');
 await page.evaluate(()=>form.setProps('/field','FormGroup',{label:'Project name'}));await expect(input).not.toHaveAttribute('aria-invalid');await expect(input).not.toHaveAttribute('aria-description');await page.evaluate(()=>form.dispose());expect(errors).toEqual([]);
});
