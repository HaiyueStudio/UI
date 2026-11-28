import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/badge.html');
  await page.waitForFunction(() => customElements.get('hy-badge'));
  await page.locator('#badge').evaluate(badge => {
    badge.count = 8; badge.dragRemovable = true; badge.color = '#ff5d73';
    window.badgeRemovals = [];
    badge.addEventListener('badge-remove', event => window.badgeRemovals.push(event.detail));
  });
});

const marker = page => page.locator('#badge [part=badge]');
const preview = page => page.locator('[data-hy-badge-drag]');
const anchor = page => preview(page).locator('[data-hy-badge-anchor]');
const bridge = page => preview(page).locator('[data-hy-badge-bridge]');
const radius = page => anchor(page).evaluate(circle => circle.r.baseVal.value);

async function begin(page, offCenter = false) {
  const bounds = await marker(page).boundingBox();
  const point = { x: bounds.x + (offCenter ? 3 : bounds.width / 2), y: bounds.y + (offCenter ? 3 : bounds.height / 2) };
  await page.mouse.move(point.x, point.y); await page.mouse.down();
  return { ...point, bounds };
}

test('liquid bridge stretches, disconnects and reconnects while its anchor stays at the origin', async ({ page }) => {
  const origin = await begin(page);
  await page.mouse.move(origin.x + 18, origin.y);
  await expect(bridge(page)).toBeVisible(); await expect(preview(page)).toHaveText('8');
  await expect(preview(page).locator('[data-hy-badge-liquid]')).toHaveAttribute('fill', 'rgb(255, 93, 115)');
  const near = await radius(page), nearPath = await bridge(page).getAttribute('d');
  await page.screenshot({ path: '.artifacts/badge-liquid-near.png', clip: { x: 110, y: 45, width: 185, height: 115 } });
  await page.mouse.move(origin.x + 44, origin.y);
  const stretched = await radius(page), bounds = await anchor(page).boundingBox();
  expect(stretched).toBeGreaterThan(0); expect(stretched).toBeLessThan(near);
  expect(bounds.x + bounds.width / 2).toBeCloseTo(origin.bounds.x + origin.bounds.width / 2, 0);
  expect(bounds.y + bounds.height / 2).toBeCloseTo(origin.bounds.y + origin.bounds.height / 2, 0);
  expect(await bridge(page).getAttribute('d')).not.toBe(nearPath);
  await page.screenshot({ path: '.artifacts/badge-liquid-stretched.png', clip: { x: 110, y: 45, width: 185, height: 115 } });
  await page.mouse.move(origin.x + 100, origin.y);
  await expect(bridge(page)).toBeHidden(); await expect(anchor(page)).toBeHidden();
  await expect(page.locator('#badge')).toHaveJSProperty('removed', false);
  await page.mouse.move(origin.x + 18, origin.y);
  await expect(bridge(page)).toBeVisible(); expect(await radius(page)).toBeGreaterThan(stretched);
  await page.mouse.move(origin.x, origin.y); await page.mouse.up();
  await expect(preview(page)).toHaveCount(0); await expect(marker(page)).toHaveCSS('opacity', '1');
  expect(await page.evaluate(() => window.badgeRemovals)).toEqual([]);
});

test('wide counts and dots keep crisp labels and align the liquid body for off-center diagonal dragging', async ({ page }) => {
  for (const dot of [false, true]) {
    await page.locator('#badge').evaluate((badge, dot) => { badge.count = 120; badge.dot = dot; badge.offset = [9, -4]; badge.size = 'small'; }, dot);
    const origin = await begin(page, true);
    await page.mouse.move(origin.x - 24, origin.y + 19);
    const body = preview(page).locator('[data-hy-badge-body]');
    await expect(bridge(page)).toBeVisible(); await expect(preview(page)).toHaveText(dot ? '' : '99+');
    const shape = await body.boundingBox(), fixed = await anchor(page).boundingBox();
    if (dot) expect(shape.width).toBeCloseTo(shape.height, 0); else expect(shape.width).toBeGreaterThan(shape.height);
    expect(shape.x + shape.width / 2).toBeCloseTo(origin.bounds.x + origin.bounds.width / 2 - 24, 0);
    expect(fixed.x + fixed.width / 2).toBeCloseTo(origin.bounds.x + origin.bounds.width / 2, 0);
    for (const delta of [[0, 9], [-12, -16], [0, 0]]) {
      await page.mouse.move(origin.x + delta[0], origin.y + delta[1]);
      expect(await bridge(page).getAttribute('d')).not.toMatch(/NaN|Infinity/);
    }
    await page.keyboard.press('Escape'); await page.mouse.up();
    await expect(preview(page)).toHaveCount(0); await expect(marker(page)).toBeVisible();
  }
});
