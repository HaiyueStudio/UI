import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';

const value = 'https://haiyuestudio.github.io/UI/';
const icon = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><rect width="40" height="40" rx="4" fill="#554cc6"/><path d="M10 10v20m20-20v20M10 20h20" stroke="white" stroke-width="4"/></svg>');
test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/qr-code.html');
  await expect(page.locator('#qr')).toHaveJSProperty('status', 'ready');
});

async function decode(page, element = page.locator('#qr')) {
  const png = await element.locator('.frame').screenshot();
  const image = await page.evaluate(async base64 => {
    const image = new Image(); image.src = `data:image/png;base64,${base64}`; await image.decode();
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0);
    return { width: image.width, height: image.height, data: Array.from(context.getImageData(0, 0, image.width, image.height).data) };
  }, png.toString('base64'));
  return jsQR(new Uint8ClampedArray(image.data), image.width, image.height)?.data;
}

test('explicit registration, constructor contract, accessible SVG and independently decoded values', async ({ page }) => {
  expect(await page.evaluate(() => window.registeredOnImport)).toBe(false);
  expect(await page.evaluate(() => document.createElement('hy-qr-code').attributes.length)).toBe(0);
  await expect(page.getByRole('img', { name: 'Open Haiyue UI' })).toHaveCount(1);
  expect(await decode(page)).toBe(value);
  for (const text of ['海月工作室 · 二维码 🙂', '01234567890123456789012345']) {
    await page.locator('#qr').evaluate((element, text) => { element.value = text; }, text);
    expect(await decode(page)).toBe(text);
  }
  expect(await page.evaluate(() => window.qrEvents.at(-1).detail.value)).toBe('01234567890123456789012345');
});

test('center image defaults to H correction and remains scannable with bounded size and margin', async ({ page }) => {
  const qr = page.locator('#qr');
  await qr.evaluate((element, icon) => { element.icon = icon; element.iconSize = 512; element.iconMargin = 32; }, icon);
  await expect(qr.locator('.icon')).toBeVisible();
  await expect(qr).toHaveJSProperty('errorCorrectionLevel', 'H');
  const dimensions = await qr.evaluate(element => {
    const svg = element.shadowRoot.querySelector('svg'); const frame = svg.getBoundingClientRect(); const overlay = element.shadowRoot.querySelector('.icon').getBoundingClientRect();
    return { centeredX: overlay.x + overlay.width / 2 - (frame.x + frame.width / 2), centeredY: overlay.y + overlay.height / 2 - (frame.y + frame.height / 2), ratio: overlay.width / (frame.width * (svg.viewBox.baseVal.width - 8) / svg.viewBox.baseVal.width) };
  });
  expect(dimensions.centeredX).toBeCloseTo(0, 1); expect(dimensions.centeredY).toBeCloseTo(0, 1); expect(dimensions.ratio).toBeLessThanOrEqual(.201);
  expect(await decode(page)).toBe(value);
});

test('explicit correction levels apply with image and slotted icons and removal restores defaults', async ({ page }) => {
  const qr = page.locator('#qr');
  for (const mode of ['image', 'slot']) {
    await qr.evaluate((element, { mode, icon }) => {
      element.icon = mode === 'image' ? icon : '';
      if (mode === 'slot') {
        const brand = document.createElement('span'); brand.slot = 'icon'; brand.textContent = 'HY'; element.append(brand);
      }
    }, { mode, icon });
    await expect(qr.locator('.icon')).toBeVisible();
    for (const level of ['L', 'M', 'Q', 'H']) {
      await qr.evaluate((element, level) => { element.errorCorrectionLevel = level; }, level);
      await expect(qr).toHaveJSProperty('errorCorrectionLevel', level);
      await expect.poll(() => page.evaluate(() => window.qrEvents.filter(event => event.type === 'qr-render').at(-1).detail.errorCorrectionLevel)).toBe(level);
    }
    await qr.evaluate(element => element.removeAttribute('error-correction-level'));
    await expect(qr).toHaveJSProperty('errorCorrectionLevel', 'H');
  }
  await qr.evaluate(element => { element.icon = ''; element.querySelector('[slot="icon"]').remove(); });
  await expect(qr).toHaveJSProperty('errorCorrectionLevel', 'M');
});

test('custom icon slot takes precedence over the image, is decorative, and updates when removed', async ({ page }) => {
  const qr = page.locator('#qr');
  await qr.evaluate(element => {
    const brand = document.createElement('span'); brand.slot = 'icon'; brand.className = 'brand'; brand.textContent = 'HY'; element.append(brand);
    element.icon = '/should-not-be-loaded.svg';
  });
  await expect(qr.locator('.icon')).toBeVisible();
  await expect(qr.locator('img')).not.toHaveAttribute('src');
  await expect(qr.locator('.icon')).toHaveAttribute('aria-hidden', 'true');
  expect(await decode(page)).toBe(value);
  await qr.evaluate(element => { element.icon = ''; element.querySelector('[slot="icon"]').remove(); });
  await expect(qr.locator('.icon')).toBeHidden();
  await expect(qr).toHaveJSProperty('errorCorrectionLevel', 'M');
  expect(await decode(page)).toBe(value);
});

test('empty and over-capacity values clear stale codes; broken icons leave a valid plain code', async ({ page }) => {
  const qr = page.locator('#qr');
  await qr.evaluate(element => { element.value = ''; });
  await expect(qr).toHaveJSProperty('status', 'empty');
  await expect(qr.locator('path')).not.toHaveAttribute('d');
  await qr.evaluate(element => { element.value = 'a'.repeat(8000); });
  await expect(qr).toHaveJSProperty('status', 'error');
  await expect(qr.getByRole('alert')).toContainText('too long');
  expect(await page.evaluate(() => window.qrEvents.at(-1).type)).toBe('qr-error');
  await page.route('**/missing-qr-icon.png', route => route.fulfill({ status: 404, body: '' }));
  await qr.evaluate((element, value) => { element.value = value; element.icon = '/missing-qr-icon.png'; }, value);
  await expect.poll(() => page.evaluate(() => window.qrEvents.at(-1).type)).toBe('qr-icon-error');
  await expect(qr.locator('.icon')).toBeHidden(); await expect(qr).toHaveJSProperty('status', 'ready');
  expect(await decode(page)).toBe(value);
});

test('colors, quiet zone and responsive scaling retain correct icon proportions', async ({ page }) => {
  const qr = page.locator('#qr');
  await qr.evaluate((element, icon) => {
    element.color = '#17324d'; element.backgroundColor = '#ffffff'; element.margin = 0; element.size = 300; element.icon = icon;
    element.style.maxWidth = '160px';
  }, icon);
  await expect(qr.locator('.icon')).toBeVisible();
  await expect(qr).toHaveJSProperty('margin', 4);
  const dimensions = await qr.evaluate(element => ({ width: element.shadowRoot.querySelector('.frame').getBoundingClientRect().width, icon: element.shadowRoot.querySelector('.icon').getBoundingClientRect().width }));
  expect(dimensions.width).toBe(160); expect(dimensions.icon).toBeLessThan(32);
  expect(await decode(page)).toBe(value);
  const normalized = await qr.evaluate(element => { element.size = NaN; element.iconSize = Infinity; return { size: element.size, iconSize: element.iconSize }; });
  expect(normalized).toEqual({ size: 200, iconSize: 32 });
});

test('disconnect and reconnect retain the original icon content and reload image presentation', async ({ page }) => {
  const qr = page.locator('#qr');
  await qr.evaluate((element, icon) => { element.icon = icon; }, icon);
  await expect(qr.locator('.icon')).toBeVisible();
  await qr.evaluate(element => { window.detachedQR = element; element.remove(); });
  expect(await page.evaluate(() => window.detachedQR.shadowRoot.querySelector('img').hasAttribute('src'))).toBe(false);
  await page.evaluate(() => document.body.append(window.detachedQR));
  await expect(qr.locator('.icon')).toBeVisible(); expect(await decode(page)).toBe(value);
});

test('gallery changes payload, switches icon modes and maintains alphabetical category order', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#qr-code'); const qr = page.locator('#qr-code-live');
  const level = page.locator('#qr-code-level');
  await expect(level).toHaveValue('H'); await expect(level).toBeEnabled();
  await expect(qr.locator('.icon')).toBeVisible(); expect(await decode(page, qr)).toBe(value);
  await page.locator('#qr-code-icon-mode').selectOption('image');
  await expect(qr.locator('img')).toHaveAttribute('src', /^data:image/); await expect(qr.locator('.icon')).toBeVisible();
  expect(await decode(page, qr)).toBe(value);
  for (const mode of ['slot', 'image', 'none']) {
    await page.locator('#qr-code-icon-mode').selectOption(mode);
    await expect(level).toBeEnabled();
    for (const choice of ['L', 'M', 'Q', 'H']) {
      await level.selectOption(choice);
      await expect(qr).toHaveJSProperty('errorCorrectionLevel', choice);
      await expect(page.locator('#qr-code-event')).toContainText('"errorCorrectionLevel":"' + choice + '"');
    }
    await level.selectOption('M');
  }
  await page.locator('#qr-code-icon-mode').selectOption('none'); await expect(qr.locator('.icon')).toBeHidden();
  await expect(page.locator('#qr-code-level')).toHaveValue('M'); await expect(page.locator('#qr-code-level')).toBeEnabled();
  await page.locator('#qr-code-value').fill('海月 UI'); expect(await decode(page, qr)).toBe('海月 UI');
  const links = await page.locator('#component-nav a').evaluateAll(links => links.map(link => link.hash.slice(1)));
  expect(links.slice(links.indexOf('input'), links.indexOf('radio') + 1)).toEqual(['input', 'qr-code', 'radio']);
  expect(await page.locator('.component-section').evaluateAll(sections => sections.map(section => section.id))).toEqual(links);
  expect(errors).toEqual([]);
});
