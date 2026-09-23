import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/test/browser/expandable.html'); });
for (const name of ['plain', 'nested']) {
  test(`${name}: Escape restores size and focus without losing content`, async ({ page }) => {
    const input = page.getByRole('textbox', { name: `${name === 'plain' ? 'Plain' : 'Nested'} content` });
    await input.fill('edited content');
    await page.getByRole('button', { name: `Expand ${name}`, exact: true }).click();
    await expect(page.getByRole('button', { name: `Restore ${name}`, exact: true })).toHaveAttribute('aria-expanded', 'true');
    await input.focus();
    await page.keyboard.press('Escape');
    const button=page.getByRole('button', { name: `Expand ${name}`, exact: true });
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveValue('edited content');
    await expect(page.locator('#events')).toHaveText(`${name}:true\n${name}:false\n`);
  });
}
test('an inner menu can consume Escape before its container', async ({ page }) => {
  await page.locator('#consume').check();
  await page.getByRole('button', {name:'Expand nested',exact:true}).click();
  await page.getByRole('textbox', {name:'Nested content'}).focus();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Restore nested',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#events')).toHaveText('nested:true\n');
});
test('nested expanded containers close only the innermost owner per Escape', async ({ page }) => {
  await page.getByRole('button',{name:'Expand outer',exact:true}).click();
  await page.getByRole('button',{name:'Expand inner',exact:true}).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button',{name:'Expand inner',exact:true})).toHaveAttribute('aria-expanded','false');
  await expect(page.getByRole('button',{name:'Restore outer',exact:true})).toHaveAttribute('aria-expanded','true');
  await expect(page.locator('#events')).toHaveText('outer:true\ninner:true\ninner:false\n');
});
test('disconnect closes the panel and reconnect restores the requested state once', async ({ page }) => {
  await page.getByRole('button',{name:'Expand nested',exact:true}).click();
  await page.locator('#detach').click();
  await expect(page.getByRole('button',{name:'Restore nested',exact:true})).toHaveCount(0);
  await page.locator('#reconnect').click();
  await page.getByRole('button',{name:'Restore nested',exact:true}).focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('#events')).toHaveText('nested:true\nnested:true\nnested:false\n');
  await expect(page.getByRole('textbox',{name:'Nested content'})).toHaveValue('preserved');
});
test('keyboard activation and restore button emit exactly one event per transition', async ({ page }) => {
  await page.getByRole('button',{name:'Expand plain',exact:true}).focus();
  await page.keyboard.press('Enter');
  await page.getByRole('button',{name:'Restore plain',exact:true}).click();
  await expect(page.locator('#events')).toHaveText('plain:true\nplain:false\n');
});
