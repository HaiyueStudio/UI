import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/medium-components.html'); });

async function prepareImage(page, width = 400, height = 200) {
  const host = page.locator('#image');
  await host.evaluate((element, size) => {
    const canvas = document.createElement('canvas'); canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext('2d');
    context.fillStyle = '#e44b4b'; context.fillRect(0, 0, size.width / 2, size.height);
    context.fillStyle = '#327ad6'; context.fillRect(size.width / 2, 0, size.width / 2, size.height);
    context.fillStyle = '#31a36a'; context.fillRect(0, 0, size.width, size.height / 10);
    context.fillStyle = '#fff'; context.beginPath(); context.arc(size.width / 2, size.height / 2, size.height * .15, 0, Math.PI * 2); context.fill();
    element.preview = false; element.width = 100; element.height = 100; element.src = canvas.toDataURL();
  }, { width, height });
  await expect(host).toHaveJSProperty('status', 'loaded');
  return host;
}

test('CSS dimensions reach the image box so fit uses both configured axes', async ({ page }) => {
  const host = await prepareImage(page);
  await host.evaluate(element => { element.removeAttribute('width'); element.removeAttribute('height'); element.style.width = '100px'; element.style.height = '100px'; });
  const frame = await host.locator('[part="frame"]').boundingBox(); const image = await host.locator('[part="image"]').boundingBox();
  expect(frame.width).toBeCloseTo(100); expect(frame.height).toBeCloseTo(100);
  expect(image.width).toBeCloseTo(100); expect(image.height).toBeCloseTo(100);
  await host.evaluate(element => { element.style.width = '140px'; element.style.height = '80px'; });
  await expect(host.locator('[part="image"]')).toHaveCSS('width', '140px');
  await expect(host.locator('[part="image"]')).toHaveCSS('height', '80px');
});

test('contain, cover, fill and none produce distinct painted results without reloading the image', async ({ page }) => {
  const host = await prepareImage(page); const picture = host.locator('[part="frame"]');
  await host.evaluate(element => { window.fitImage = element.shadowRoot.querySelector('[part="image"]'); });
  const screenshots = new Map();
  for (const fit of ['contain', 'cover', 'fill', 'none', 'scale-down']) {
    await host.evaluate((element, value) => { element.fit = value; }, fit);
    await expect(host.locator('[part="image"]')).toHaveCSS('object-fit', fit);
    screenshots.set(fit, await picture.screenshot({ animations: 'disabled' }));
    expect(await host.evaluate(element => element.shadowRoot.querySelector('[part="image"]') === window.fitImage)).toBe(true);
  }
  const distinct = ['contain', 'cover', 'fill', 'none'];
  for (let i = 0; i < distinct.length; i++) for (let j = i + 1; j < distinct.length; j++) {
    expect(screenshots.get(distinct[i]).equals(screenshots.get(distinct[j])), `${distinct[i]} and ${distinct[j]} should paint differently`).toBe(false);
  }
  expect(screenshots.get('scale-down').equals(screenshots.get('contain'))).toBe(true);
});

test('scale-down preserves small images while contain scales them up', async ({ page }) => {
  const host = await prepareImage(page, 40, 20); const frame = host.locator('[part="frame"]');
  await host.evaluate(element => { element.fit = 'none'; }); const none = await frame.screenshot();
  await host.evaluate(element => { element.fit = 'scale-down'; }); const down = await frame.screenshot();
  await host.evaluate(element => { element.fit = 'contain'; }); const contain = await frame.screenshot();
  expect(down.equals(none)).toBe(true); expect(down.equals(contain)).toBe(false);
});

test('natural aspect ratio is retained when only width is constrained', async ({ page }) => {
  const host = await prepareImage(page); await host.evaluate(element => { element.removeAttribute('height'); });
  await expect(host.locator('[part="frame"]')).toHaveCSS('width', '100px');
  await expect(host.locator('[part="frame"]')).toHaveCSS('height', '50px');
});

test('gallery fit selector produces visibly different containment, cropping and stretching', async ({ page }) => {
  await page.goto('/examples/#image'); const host = page.locator('#image-live');
  await expect(host).toHaveJSProperty('status', 'loaded');
  const modes = ['contain', 'cover', 'fill', 'none']; const pictures = [];
  for (const mode of modes) { await page.locator('#image-fit').selectOption(mode); pictures.push(await host.locator('[part="frame"]').screenshot()); }
  for (let i = 0; i < pictures.length; i++) for (let j = i + 1; j < pictures.length; j++) expect(pictures[i].equals(pictures[j])).toBe(false);
  await page.locator('#image-fit').selectOption('scale-down');
  expect((await host.locator('[part="frame"]').screenshot()).equals(pictures[0])).toBe(true);
});
