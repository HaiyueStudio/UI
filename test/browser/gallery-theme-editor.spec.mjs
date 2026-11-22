import { test, expect } from '@playwright/test';

const tokenInput = (page, token) => page.locator(`#theme-settings input[data-theme-token="${token}"]`);
const category = (page, name) => page.locator('#theme-editor-categories').getByRole('button', { name, exact: true });
const customPreview = page => page.locator('.theme-editor-preview');

test.beforeEach(async ({ page }) => { await page.goto('/examples/'); });

test('skin choices remain compact and centered in both built-in and custom skins', async ({ page }) => {
  for (const skin of ['dark', 'light', 'custom']) {
    await page.locator(`.theme-picker [data-theme="${skin}"]`).click();
    for (const choice of await page.locator('.theme-picker [data-theme]').all()) {
      const button = await choice.getByRole('button').boundingBox();
      const content = await choice.locator('.theme-choice-content').boundingBox();
      expect(button.height).toBe(34);
      expect(Math.abs(content.y + content.height / 2 - button.y - button.height / 2)).toBeLessThan(1);
      expect(content.x).toBeGreaterThanOrEqual(button.x);
      expect(content.x + content.width).toBeLessThanOrEqual(button.x + button.width);
    }
    await expect(page.locator('#theme-settings-open').getByRole('button')).toHaveCSS('height', '34px');
  }
});

test('settings preview independently, apply a custom skin and restore focus on close', async ({ page }) => {
  const trigger = page.locator('#theme-settings-open').getByRole('button');
  await trigger.click();
  await expect(page.locator('#theme-settings')).toHaveAttribute('open', '');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'dark');
  await expect(customPreview(page).getByRole('button', { name: '开始创作' })).toHaveCSS('font-size', '15px');
  await tokenInput(page, '--hy-accent-color').fill('#287d65');
  await expect(customPreview(page).locator('.theme-preview-heading small')).toHaveCSS('color', 'rgb(40, 125, 101)');
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'dark');
  await page.locator('#theme-apply').click();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'custom');
  await expect(page.locator('.theme-picker [data-theme="custom"]').getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#theme-settings')).not.toHaveAttribute('open');
  await expect(trigger).toBeFocused();
});

test('color, type, spacing, radius and size edits survive switching and reloading, then reset to terracotta', async ({ page }) => {
  await page.locator('.theme-picker [data-theme="custom"]').click();
  await page.locator('#theme-settings-open').click();
  await tokenInput(page, '--hy-canvas-color').fill('#efe8dd');
  await tokenInput(page, '--hy-focus-ring-color').fill('rgba(40, 125, 101, 0.25)');
  await category(page, '字体').click();
  await tokenInput(page, '--hy-font-size-sm').fill('18');
  await tokenInput(page, '--hy-font-family').fill('Georgia, serif');
  await category(page, '间距').click();
  await tokenInput(page, '--hy-space-5').fill('7');
  await category(page, '圆角').click();
  await tokenInput(page, '--hy-radius-sm').fill('3');
  await category(page, '尺寸').click();
  await tokenInput(page, '--hy-control-height-sm').fill('46');
  const previewButton = customPreview(page).getByRole('button', { name: '开始创作' });
  await expect(previewButton).toHaveCSS('font-size', '18px');
  await expect(previewButton).toHaveCSS('font-family', 'Georgia, serif');
  await expect(previewButton).toHaveCSS('padding-left', '7px');
  await expect(previewButton).toHaveCSS('border-top-left-radius', '3px');
  await expect(customPreview(page).locator('hy-input [part="control"]')).toHaveCSS('height', '46px');
  await page.keyboard.press('Escape');
  await page.locator('.theme-picker [data-theme="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-hy-theme', 'light');
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--hy-font-size-sm').trim())).toBe('12px');
  await page.locator('.theme-picker [data-theme="custom"]').click();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'custom');
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--hy-font-size-sm').trim())).toBe('18px');
  await page.locator('#theme-settings-open').click();
  await expect(tokenInput(page, '--hy-canvas-color')).toHaveValue('#efe8dd');
  await expect(tokenInput(page, '--hy-focus-ring-color')).toHaveValue('rgba(40, 125, 101, 0.25)');
  await page.locator('#theme-reset').click();
  await expect(tokenInput(page, '--hy-canvas-color')).toHaveValue('#f4e8dc');
  await expect(previewButton).toHaveCSS('font-size', '15px');
  await expect(previewButton).toHaveCSS('padding-left', '15px');
  await expect(previewButton).toHaveCSS('border-top-left-radius', '10px');
  await expect(customPreview(page).locator('hy-input [part="control"]')).toHaveCSS('height', '38px');
  await page.reload();
  expect(await page.locator('html').evaluate(element => getComputedStyle(element).getPropertyValue('--hy-font-size-sm').trim())).toBe('15px');
});

test('invalid parameters and malformed saved settings cannot break the gallery', async ({ page }) => {
  await page.evaluate(() => localStorage.setItem('haiyue-gallery-theme-v1', '{broken json'));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'dark');
  await page.locator('#theme-settings-open').click();
  await tokenInput(page, '--hy-accent-color').fill('not-a-color');
  await expect(tokenInput(page, '--hy-accent-color')).toHaveAttribute('aria-invalid', 'true');
  await expect(customPreview(page).locator('.theme-preview-heading small')).toHaveCSS('color', 'rgb(164, 73, 50)');
  await category(page, '尺寸').click();
  await tokenInput(page, '--hy-control-height-sm').fill('10000');
  await expect(tokenInput(page, '--hy-control-height-sm')).toHaveAttribute('aria-invalid', 'true');
  await expect(customPreview(page).locator('hy-input [part="control"]')).toHaveCSS('height', '38px');
  await page.evaluate(() => localStorage.setItem('haiyue-gallery-theme-v1', JSON.stringify({ skin: 'custom', overrides: { '--hy-accent-color': 'invalid', '--hy-control-height-sm': '10000px', '--hy-font-size-sm': '16px' } })));
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-gallery-skin', 'custom');
  await page.locator('#theme-settings-open').click();
  await expect(tokenInput(page, '--hy-accent-color')).toHaveValue('#a44932');
  await expect(customPreview(page).getByRole('button', { name: '开始创作' })).toHaveCSS('font-size', '16px');
});

test('skin settings are reachable and fit on mobile screens', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.mobile-theme-slot .theme-picker')).toBeVisible();
  await page.locator('.theme-picker [data-theme="custom"]').click();
  await page.locator('#theme-settings-open').click();
  const panel = page.locator('#theme-settings [part="panel"]');
  const bounds = await panel.boundingBox();
  expect(bounds.x).toBeGreaterThanOrEqual(0);
  expect(bounds.width).toBeLessThanOrEqual(390);
  expect(bounds.height).toBeLessThanOrEqual(844);
  await category(page, '尺寸').click();
  await tokenInput(page, '--hy-control-height-sm').fill('40');
  await page.locator('#theme-apply').click();
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('.sidebar .theme-picker')).toBeVisible();
  await expect(page.locator('.theme-picker')).toHaveCount(1);
});
