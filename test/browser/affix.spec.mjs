import { test, expect } from '@playwright/test';

test('affix pins content, preserves its layout, and releases it again', async ({ page }) => {
  await page.goto('/test/browser/affix.html');
  const affix = page.locator('#affix');
  await expect(affix).not.toHaveAttribute('affixed', '');
  await page.evaluate(() => scrollTo(0, 240));
  await expect(affix).toHaveAttribute('affixed', '');
  const content = affix.locator('[part="content"]');
  await expect(content).toHaveCSS('position', 'fixed');
  await expect(content).toHaveCSS('top', '12px');
  await expect(affix.locator('[part="placeholder"]')).toHaveCSS('height', '40px');
  await expect(page.locator('#events')).toContainText('true');
  await page.evaluate(() => scrollTo(0, 0));
  await expect(affix).not.toHaveAttribute('affixed', '');
});

test('gallery affix supports a custom scroll target', async ({ page }) => {
  await page.goto('/examples/#affix');
  await page.locator('#affix-scroll').evaluate(element => { element.scrollTop = 240; element.dispatchEvent(new Event('scroll')); });
  await expect(page.locator('#affix-live')).toHaveAttribute('affixed', '');
  await expect(page.locator('#affix-state')).toContainText('affixed');
});
