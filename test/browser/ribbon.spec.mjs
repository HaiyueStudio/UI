import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/ribbon.html');
  await page.waitForFunction(() => window.ready);
});

test('focused entry registers explicitly and root registration exposes the same component', async ({ page }) => {
  expect(await page.evaluate(() => window.registrationIsExplicit)).toBe(true);
  expect(await page.evaluate(() => window.constructedRibbon.getAttributeNames())).toEqual([]);
  expect(await page.evaluate(async () => {
    const focused = await import('/dist/ribbon.js');
    const root = await import('/dist/index.js');
    root.defineHaiyueUI();
    root.defineHaiyueUI();
    return root.HYRibbon === focused.HYRibbon && customElements.get('hy-ribbon') === focused.HYRibbon;
  })).toBe(true);
  await expect(page.locator('#ribbon [part="ribbon"]')).toHaveText('Featured');
  await expect(page.locator('#ribbon [part="fold"]')).toHaveAttribute('aria-hidden', 'true');
});

test('placements and folds follow the inherited text direction', async ({ page }) => {
  const host = page.locator('#ribbon');
  const label = host.locator('[part="ribbon"]');
  const fold = host.locator('[part="fold"]');
  const side = async () => {
    const wrapper = await host.boundingBox();
    const ribbon = await label.boundingBox();
    const corner = await fold.boundingBox();
    return { left: Math.round(ribbon.x - wrapper.x), right: Math.round(ribbon.x + ribbon.width - wrapper.x - wrapper.width), corner: Math.round(corner.x - wrapper.x) };
  };
  expect((await side()).right).toBe(8);
  expect((await side()).corner).toBe(320);
  await host.evaluate(element => { element.placement = 'start'; });
  expect((await side()).left).toBe(-8);
  expect((await side()).corner).toBe(-8);
  await page.locator('body').evaluate(element => { element.dir = 'rtl'; });
  expect((await side()).right).toBe(8);
  expect((await side()).corner).toBe(320);
  await host.evaluate(element => { element.placement = 'end'; });
  expect((await side()).left).toBe(-8);
  await host.evaluate(element => { element.setAttribute('placement', 'unknown'); });
  await expect(host).toHaveJSProperty('placement', 'end');
  expect((await side()).left).toBe(-8);
});

test('label updates use text, honor rich slots and hide only the empty ribbon', async ({ page }) => {
  const host = page.locator('#ribbon');
  const label = host.locator('[part="ribbon"]');
  await host.evaluate(element => { element.text = '<img src=x onerror=alert(1)>'; });
  await expect(label).toHaveText('<img src=x onerror=alert(1)>');
  await expect(label.locator('img')).toHaveCount(0);
  await host.evaluate(element => { element.text = ''; });
  await expect(label).toBeHidden();
  await expect(page.locator('#name')).toBeVisible();

  const rich = page.locator('#rich');
  await expect(page.locator('#rich-text')).toBeVisible();
  await rich.evaluate(element => { element.text = 'New fallback'; });
  await expect(page.locator('#rich-text')).toHaveText('★ Recommended');
  await page.locator('#rich-text').evaluate(element => element.remove());
  await expect(rich.locator('[part="ribbon"]')).toHaveText('New fallback');
  await rich.evaluate(element => { element.removeAttribute('text'); });
  await expect(rich.locator('[part="ribbon"]')).toBeHidden();
});

test('theme tokens and valid custom colors update ribbon and folded corner', async ({ page }) => {
  const host = page.locator('#ribbon');
  const label = host.locator('[part="ribbon"]');
  const fold = host.locator('[part="fold"]');
  await expect(label).toHaveCSS('background-color', 'rgb(85, 180, 218)');
  const lightFold = await fold.evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('html').evaluate(element => { element.dataset.hyTheme = 'dark'; });
  await expect(label).toHaveCSS('background-color', 'rgb(129, 119, 242)');
  expect(await fold.evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(lightFold);
  await host.evaluate(element => {
    element.style.setProperty('--hy-ribbon-bg-color', '#123456');
    element.style.setProperty('--hy-ribbon-text-color', '#ffffff');
    element.style.setProperty('--hy-space-6', '16px');
    element.style.setProperty('--hy-radius-sm', '10px');
  });
  await expect(label).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await expect(label).toHaveCSS('color', 'rgb(255, 255, 255)');
  await expect(label).toHaveCSS('padding-left', '16px');
  await expect(label).toHaveCSS('border-top-left-radius', '10px');
  await host.evaluate(element => { element.color = '#a44932'; });
  await expect(label).toHaveCSS('background-color', 'rgb(164, 73, 50)');
  await host.evaluate(element => { element.color = 'var(--hy-success-color)'; });
  await expect(label).toHaveCSS('background-color', 'rgb(99, 215, 161)');
  await host.evaluate(element => { element.color = 'invalid-color'; });
  await expect(label).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await host.evaluate(element => { element.color = ''; });
  await expect(host).not.toHaveAttribute('color');
});

test('content keeps focus, input state and actions across updates and reconnection', async ({ page }) => {
  const host = page.locator('#ribbon');
  const input = page.locator('#name');
  await input.fill('Edited name');
  await input.focus();
  await host.evaluate(element => { element.text = 'Updated'; element.color = '#123456'; element.placement = 'start'; });
  await expect(input).toBeFocused();
  await expect(input).toHaveValue('Edited name');
  await host.evaluate(element => { const parent = element.parentElement; element.remove(); parent.append(element); });
  await expect(input).toHaveValue('Edited name');
  await page.locator('#collect').click();
  await expect(page.locator('#actions')).toHaveText('1');
  await host.evaluate(element => { element.hidden = true; });
  await expect(host).toBeHidden();
});

test('long labels wrap within narrow content', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  const host = page.locator('#ribbon');
  await host.evaluate(element => { element.text = 'Recommended'.repeat(30); });
  const label = host.locator('[part="ribbon"]');
  expect(await label.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  const wrapper = await host.boundingBox();
  const ribbon = await label.boundingBox();
  expect(ribbon.width).toBeLessThanOrEqual(wrapper.width + 16);
});

test('gallery exposes text, color, placement, rich labels and working card actions', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#ribbon');
  const ribbon = page.locator('#ribbon-live');
  await page.locator('#ribbon-text').fill('限时推荐');
  await expect(ribbon.locator('[part="ribbon"]')).toHaveText('限时推荐');
  await page.locator('#ribbon-placement').selectOption('start');
  await expect(ribbon).toHaveJSProperty('placement', 'start');
  await page.locator('#ribbon-color').selectOption('#a44932');
  await expect(ribbon.locator('[part="ribbon"]')).toHaveCSS('background-color', 'rgb(164, 73, 50)');
  await page.getByText('使用 text 插槽', { exact: true }).click();
  await expect(ribbon.locator('[slot="text"]')).toBeVisible();
  await page.getByText('使用 text 插槽', { exact: true }).click();
  await expect(ribbon.locator('[part="ribbon"]')).toHaveText('限时推荐');
  await page.getByText('RTL', { exact: true }).click();
  await expect(ribbon).toHaveAttribute('dir', 'rtl');
  await page.locator('#ribbon-collect').click();
  await expect(page.locator('#ribbon-event')).toHaveText('已收藏星海素材包');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ribbon-text').fill('移动端推荐');
  await expect(ribbon.locator('[part="ribbon"]')).toHaveText('移动端推荐');
  await page.getByText('使用 text 插槽', { exact: true }).click();
  await expect(ribbon.locator('[slot="text"]')).toBeVisible();
  expect(errors).toEqual([]);
});
