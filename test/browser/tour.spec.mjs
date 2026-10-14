import { test, expect } from '@playwright/test';

test('tour navigates targets, finishes, and returns focus', async ({ page }) => {
  await page.goto('/test/browser/tour.html');
  await page.locator('#launch').click();
  const tour = page.locator('#tour');
  await expect(tour).toHaveAttribute('open', '');
  await expect(tour.getByRole('dialog')).toContainText('Scene tree');
  await expect(tour.locator('[part="highlight"]')).toBeVisible();
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour).toHaveAttribute('current', '1');
  await expect(tour.getByRole('dialog')).toContainText('Inspector');
  await tour.getByRole('button', { name: 'Next' }).click();
  await expect(tour.getByRole('dialog')).toContainText('Ready');
  await expect(tour.locator('[part="highlight"]')).toBeHidden();
  await tour.getByRole('button', { name: 'Finish' }).click();
  await expect(tour).not.toHaveAttribute('open', '');
  await expect(page.locator('#events')).toContainText('tour-finish');
  await expect(page.locator('#launch')).toBeFocused();
});

test('tour closes with Escape and reports the reason', async ({ page }) => {
  await page.goto('/test/browser/tour.html');
  await page.locator('#launch').click();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tour')).not.toHaveAttribute('open', '');
  await expect(page.locator('#events')).toContainText('"reason":"escape"');
});

test('gallery tour can advance through configured steps', async ({ page }) => {
  await page.goto('/examples/#tour');
  await page.locator('#tour-launch').click();
  await expect(page.locator('#tour-live').getByRole('dialog')).toContainText('Choose a scene');
  await page.locator('#tour-live').getByRole('button', { name: 'Next' }).click();
  await expect(page.locator('#tour-state')).toContainText('step 2');
});
