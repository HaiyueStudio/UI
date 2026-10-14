import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/collapse.html'); });

test('supports multiple expanded panels and emits composed state details', async ({ page }) => {
  const collapse = page.locator('#collapse'); const triggers = collapse.getByRole('button'); const regions = collapse.getByRole('region');
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true'); await expect(regions.nth(0)).toBeVisible();
  await triggers.nth(1).click(); await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveAttribute('active-keys', '["scene","assets"]'); await expect(page.locator('#events')).toContainText('"changedKey":"assets"');
  await expect(triggers.nth(2)).toBeDisabled();
});

test('accordion and icon-only modes keep native keyboard disclosure semantics', async ({ page }) => {
  const collapse = page.locator('#collapse'); const triggers = collapse.getByRole('button');
  await collapse.evaluate(element => { element.accordion = true; element.activeKeys = ['scene']; });
  await triggers.nth(1).focus(); await page.keyboard.press('Enter'); await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await collapse.evaluate(element => { element.collapsible = 'icon'; }); await triggers.nth(1).click({ position: { x: 100, y: 20 } }); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await triggers.nth(1).focus(); await page.keyboard.press('Enter'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await collapse.locator('[part="arrow"]').nth(1).click(); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
});

test('destroy-on-hidden removes inactive body content', async ({ page }) => {
  const collapse = page.locator('#collapse'); await collapse.evaluate(element => { element.destroyOnHidden = true; });
  const first = collapse.getByRole('button').nth(0); await first.click();
  await expect(collapse.locator('[part="body"]').nth(0)).toBeEmpty(); await first.click(); await expect(collapse.locator('[part="body"]').nth(0)).toContainText('Camera');
});

test('component gallery demonstrates accordion and appearance controls', async ({ page }) => {
  await page.goto('/examples/#collapse'); const collapse = page.locator('#collapse-live');
  await collapse.getByRole('button').nth(1).click(); await expect(page.locator('#collapse-state')).toContainText('assets');
  await page.locator('#collapse-accordion').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await collapse.getByRole('button').nth(2).click(); await expect(collapse.getByRole('button').nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(collapse.getByRole('button').nth(2)).toHaveAttribute('aria-expanded', 'true');
});
