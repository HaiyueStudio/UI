import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/anchor.html'); });

test('renders nested links and scrolls an owned container', async ({ page }) => {
  const anchor = page.locator('#anchor');
  await expect(anchor.locator('[part="link"]')).toHaveCount(3);
  await anchor.locator('[data-href="#two"]').click();
  await expect.poll(() => page.locator('#scroll').evaluate(element => element.scrollTop)).toBeGreaterThan(150);
  await expect(anchor).toHaveAttribute('active-href', '#two');
  await expect(anchor.locator('[data-href="#two"]')).toHaveAttribute('aria-current', 'location');
});

test('keeps the clicked target highlighted throughout smooth scrolling', async ({ page }) => {
  const changes = await page.locator('#anchor').evaluate(element => new Promise(resolve => {
    const values = [];
    element.addEventListener('anchor-change', event => values.push(event.detail.href));
    element.shadowRoot.querySelector('[data-href="#three"]').click();
    window.setTimeout(() => resolve(values), 700);
  }));
  expect(changes).toEqual(['#three']);
  await expect(page.locator('#anchor')).toHaveAttribute('active-href', '#three');
});

test('tracks the active target while scrolling and emits anchor-change', async ({ page }) => {
  const detail = await page.locator('#anchor').evaluate(element => new Promise(resolve => {
    element.addEventListener('anchor-change', event => resolve(event.detail.href), { once: true });
    element.scrollContainer.scrollTop = element.scrollContainer.scrollHeight;
  }));
  expect(detail).toBe('#three');
  await expect(page.locator('#anchor')).toHaveAttribute('active-href', '#three');
});

test('allows anchor-click cancellation and exposes gallery navigation', async ({ page }) => {
  const anchor = page.locator('#anchor');
  await anchor.evaluate(element => element.addEventListener('anchor-click', event => event.preventDefault(), { once: true }));
  await anchor.locator('[data-href="#two"]').click();
  expect(await page.locator('#scroll').evaluate(element => element.scrollTop)).toBe(0);
  await page.goto('/examples/#anchor');
  await page.locator('#anchor-publish-button').click();
  await expect(page.locator('#anchor-live')).toHaveAttribute('active-href', '#anchor-publish');
});
