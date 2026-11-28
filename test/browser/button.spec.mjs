import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/button.html'); });

test('renders attribute and slotted icons before or after the label', async ({ page }) => {
  const attribute = page.locator('#attribute-icon');
  await expect(attribute.locator('[part="icon"]')).toContainText('↓');
  await expect(attribute.locator('[part="content"]')).toHaveText('Download');

  const slotted = page.locator('#slotted-icon');
  await expect(page.getByTestId('upload-icon')).toBeVisible();
  await expect(page.getByTestId('legacy-icon')).toBeVisible();
  await expect(slotted.getByRole('button')).toHaveClass(/icon-end/);
  await slotted.evaluate(element => { element.iconPosition = 'start'; element.icon = 'fallback'; });
  await expect(slotted).toHaveAttribute('icon-position', 'start');
  await expect(slotted.getByRole('button')).not.toHaveClass(/icon-end/);
});

test('loading shows a spinner, exposes busy state, and blocks clicks', async ({ page }) => {
  const button = page.locator('#loading');
  await button.evaluate(element => { element.loading = true; element.click(); });
  await expect(button.getByRole('button')).toBeDisabled();
  await expect(button.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  await expect(button.locator('[part="spinner"]')).toBeVisible();
  await expect(page.locator('#events')).toHaveText('0');

  await button.evaluate(element => { element.loading = false; element.click(); });
  await expect(button.getByRole('button')).not.toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#events')).toHaveText('1');
});

test('button group exposes group semantics and horizontal or vertical layout', async ({ page }) => {
  const group = page.locator('#group');
  await expect(group.getByRole('group', { name: 'History actions' })).toBeVisible();
  await expect(group.locator('hy-button')).toHaveCount(3);
  await group.evaluate(element => { element.orientation = 'vertical'; });
  await expect(group).toHaveAttribute('orientation', 'vertical');
  await expect(group.locator('[part="group"]')).toHaveCSS('flex-direction', 'column');
});

test('buttons without icons center their labels without a fallback gap', async ({page})=>{
  const results=await page.evaluate(()=>{
    return ['attribute','slotted'].map(mode=>{
      const host=document.createElement('hy-button');host.style.width='180px';if(mode==='attribute')host.setAttribute('label','Centered');else host.textContent='Centered';document.body.append(host);
      const root=host.shadowRoot,button=root.querySelector('button').getBoundingClientRect(),content=root.querySelector('[part=content]').getBoundingClientRect();
      return [root.querySelector('[part=icon]').hidden,content.x+content.width/2-button.x-button.width/2];
    });
  });for(const [hidden,offset] of results){expect(hidden).toBe(true);expect(Math.abs(offset)).toBeLessThan(.6);}
});

test('removing an icon or ending loading restores a centered text-only layout',async({page})=>{
  const host=page.locator('#attribute-icon');await host.evaluate(e=>{e.style.width='180px';e.icon='';e.loading=true;e.loading=false;});await expect(host.locator('[part=icon]')).toBeHidden();
  await host.evaluate(e=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.slot='icon';svg.id='temporary-icon';e.append(svg);});await expect(host.locator('[part=icon]')).toBeVisible();
  await host.locator('#temporary-icon').evaluate(e=>e.remove());await expect(host.locator('[part=icon]')).toBeHidden();
  expect(await host.evaluate(e=>{const button=e.shadowRoot.querySelector('button').getBoundingClientRect(),content=e.shadowRoot.querySelector('[part=content]').getBoundingClientRect();return Math.abs(content.x+content.width/2-button.x-button.width/2);})).toBeLessThan(.6);
});

test('an empty forwarded icon slot has no gap and tracks projected icon changes',async({page})=>{
  await page.evaluate(()=>{
    const wrapper=document.createElement('div');wrapper.id='icon-wrapper';wrapper.attachShadow({mode:'open'}).innerHTML='<hy-button id="forwarded" label="Centered" style="width:180px"><slot name="icon" slot="icon"></slot></hy-button>';document.body.append(wrapper);
  });
  const icon=page.locator('#forwarded [part=icon]');await expect(icon).toBeHidden();
  await page.locator('#icon-wrapper').evaluate(e=>{const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.id='forwarded-svg';svg.slot='icon';e.append(svg);});await expect(icon).toBeVisible();
  await page.locator('#forwarded-svg').evaluate(e=>e.remove());await expect(icon).toBeHidden();
});

test('component gallery demonstrates loading and button-group orientation', async ({ page }) => {
  await page.goto('/examples/#button');
  await page.locator('#button-request').click();
  await expect(page.locator('#button-request').getByRole('button')).toHaveAttribute('aria-busy', 'true');
  await expect(page.locator('#button-event')).toContainText('"loading":true');
  await expect(page.locator('#button-request').getByRole('button')).not.toHaveAttribute('aria-busy', 'true', { timeout: 2000 });
  await expect(page.locator('#button-event')).toContainText('"status":200');

  await page.locator('#button-group-orientation').selectOption('vertical');
  await expect(page.locator('#button-group-live')).toHaveAttribute('orientation', 'vertical');
});
