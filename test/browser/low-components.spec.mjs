import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/test/browser/low-components.html'); await page.waitForFunction(() => window.ready); });

test('focused entries require explicit registration and the root registration stays idempotent', async ({ page }) => {
  expect(await page.evaluate(() => window.registrationIsExplicit)).toBe(true);
  await page.evaluate(async () => { const { defineHaiyueUI } = await import('/dist/index.js'); defineHaiyueUI(); defineHaiyueUI(); });
  await expect(page.locator('#empty [part="description"]')).toHaveText('No matching assets');
});

test('empty states support custom content, hidden illustrations and keyboard actions', async ({ page }) => {
  const empty = page.locator('#empty');
  await expect(empty.locator('[part="image"] svg')).toBeVisible();
  await empty.evaluate(element => { element.image = 'none'; element.description = ''; });
  await expect(empty.locator('[part="image"]')).toBeHidden(); await expect(empty.locator('[part="description"]')).toBeHidden();
  await empty.evaluate(element => { const text = document.createElement('span'); text.slot = 'description'; text.textContent = 'Nothing here yet'; element.append(text); });
  await expect(empty.locator('[part="description"]')).toBeVisible();
  await page.locator('#create').focus(); await expect(page.locator('#create')).toBeFocused();
  await empty.evaluate(element => { element.image = 'simple'; element.size = 'small'; });
  await expect(empty.locator('[part="image"]')).toHaveCSS('width', '40px');
  await page.locator('#create').evaluate(element => element.remove()); await expect(empty.locator('[part="actions"]')).toBeHidden();
});

test('result statuses update icons and retain rich content and accessible actions', async ({ page }) => {
  const result = page.locator('#result');
  await expect(result.getByRole('region', { name: 'Export completed' })).toBeVisible();
  for (const status of ['success', 'info', 'warning', 'error', '403', '404', '500']) {
    await result.evaluate((element, status) => { element.status = status; }, status);
    if (/^\d/.test(status)) await expect(result.locator('[part="icon"]')).toHaveText(status);
    else await expect(result.locator('[part="icon"] svg')).toHaveCount(1);
    await expect(page.locator('#result-detail')).toHaveText('3 assets exported');
  }
  await page.locator('#download').focus(); await expect(page.locator('#download')).toBeFocused();
  await result.evaluate(element => { const heading = document.createElement('span'); heading.slot = 'heading'; heading.textContent = 'Custom heading'; element.append(heading); });
  await expect(result.getByRole('region', { name: 'Custom heading' })).toBeVisible();
  await result.evaluate(element => { element.heading = '<img src=x onerror=alert(1)>'; element.description = ''; });
  await expect(result.locator('h2 img')).toHaveCount(0); await expect(result.locator('[part="description"]')).toBeHidden();
});

test('avatar loads images, exposes one accessible name and falls back on errors', async ({ page }) => {
  const avatar = page.locator('#avatar');
  await expect(avatar.getByRole('img', { name: 'Haiyue user' })).toHaveCount(1);
  await expect(avatar.locator('[part="text"]')).toHaveText('HY');
  await avatar.evaluate(element => { element.src = window.artwork; });
  await expect(avatar).toHaveJSProperty('status', 'loaded'); await expect(avatar.locator('[part="image"]')).toBeVisible();
  await expect(avatar.locator('[part="fallback"]')).toBeHidden();
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'avatar-load').at(-1).detail.naturalWidth)).toBe(100);
  await avatar.evaluate(element => { element.src = 'data:image/png;base64,broken'; });
  await expect(avatar).toHaveJSProperty('status', 'error'); await expect(avatar.locator('[part="text"]')).toBeVisible();
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'avatar-error').at(-1).composed)).toBe(true);
  await expect(page.locator('#slotted-avatar')).toContainText('林');
  await expect(page.locator('#decorative-avatar').getByRole('img')).toHaveCount(0);
});

test('avatar ignores stale resources and reconnects without duplicate listeners', async ({ page }) => {
  const avatar = page.locator('#avatar');
  await avatar.evaluate(element => { element.src = window.artwork; }); await expect(avatar).toHaveJSProperty('status', 'loaded');
  await avatar.evaluate(element => {
    const stale = element.shadowRoot.querySelector('img'); element.src = '';
    stale.dispatchEvent(new Event('error')); stale.dispatchEvent(new Event('load'));
  });
  await expect(avatar).toHaveJSProperty('status', 'empty');
  const before = await page.evaluate(() => window.componentEvents.length);
  await avatar.evaluate(element => {
    const parent = element.parentElement; element.remove(); element.src = window.artwork; parent.append(element);
  });
  await expect(avatar).toHaveJSProperty('status', 'loaded');
  expect(await page.evaluate(() => window.componentEvents.length)).toBe(before + 1);
  await avatar.evaluate(element => { element.size = 72; element.shape = 'square'; element.fit = 'contain'; element.text = 'ABCDE'; });
  await expect(avatar.locator('[part="avatar"]')).toHaveCSS('width', '72px');
  await expect(avatar.locator('img')).toHaveCSS('object-fit', 'contain');
  await avatar.evaluate(element => { element.size = Number.NaN; }); await expect(avatar.locator('[part="avatar"]')).toHaveCSS('width', '40px');
});

test('card slots react to content changes and loading retains input values while hiding actions', async ({ page }) => {
  const card = page.locator('#card');
  await expect(card.getByRole('article', { name: 'Asset details' })).toBeVisible();
  await page.locator('#card-input').fill('keep me');
  await card.evaluate(element => { element.loading = true; element.bordered = false; element.size = 'small'; });
  await expect(card.getByRole('article')).toHaveAttribute('aria-busy', 'true');
  await expect(card.locator('[part="loading"]')).toBeVisible(); await expect(page.locator('#card-input')).toBeHidden(); await expect(page.locator('#save')).toBeHidden();
  await card.evaluate(element => { element.loading = false; }); await expect(page.locator('#card-input')).toHaveValue('keep me');
  await expect(card.locator('[part="body"]')).toHaveJSProperty('inert', false); await page.locator('#save').focus(); await expect(page.locator('#save')).toBeFocused();
  await card.evaluate(element => { element.heading = ''; element.querySelector('[slot="extra"]').remove(); }); await expect(card.locator('[part="header"]')).toBeHidden();
  await card.evaluate(element => { const cover = document.createElement('img'); cover.slot = 'cover'; cover.src = window.artwork; element.append(cover); });
  await expect(card.locator('[part="cover"]')).toBeVisible();
});

test('descriptions expose semantic labels, primitive values and safe text content', async ({ page }) => {
  const host = page.locator('#descriptions');
  await expect(host.locator('dt')).toHaveCount(6); await expect(host.locator('dd')).toHaveCount(6);
  await expect(host.locator('[data-key="zero"] dd')).toHaveText('0'); await expect(host.locator('[data-key="boolean"] dd')).toHaveText('false'); await expect(host.locator('[data-key="blank"] dd')).toHaveText('—');
  await host.evaluate(element => { element.items = [{ key: 'html', label: '<b>Label</b>', value: '<img src=x onerror=alert(1)>' }]; });
  await expect(host.locator('dt')).toHaveText('<b>Label</b>'); await expect(host.locator('dd img')).toHaveCount(0);
  await host.evaluate(element => { element.items = [{ key:'missing',label:'Unknown' }]; element.emptyText = 'Not set'; }); await expect(host.locator('dd')).toHaveText('Not set');
  expect(await host.evaluate(element => { const snapshot = element.items; snapshot[0].label = 'Changed'; return element.items[0].label; })).toBe('Unknown');
});

test('descriptions clamp spans, respond to container size and preserve rich value focus', async ({ page }) => {
  const host = page.locator('#descriptions'); const owner = page.locator('#owner');
  await expect(host.locator('dl')).toHaveCSS('grid-template-columns', /\S+ \S+ \S+/);
  await expect(host.locator('[data-key="owner"]')).toHaveCSS('grid-column', '2 / span 2');
  await owner.fill('Bob'); await owner.focus();
  await host.evaluate(element => { element.layout = 'vertical'; element.size = 'small'; element.bordered = false; }); await expect(owner).toBeFocused(); await expect(owner).toHaveValue('Bob');
  await host.evaluate(element => { element.style.width = '360px'; });
  await expect(host.locator('[data-key="owner"]')).toHaveCSS('grid-column', '1 / span 1');
  await expect(owner).toBeFocused();
  await host.evaluate(element => { element.responsive = false; element.column = 2; }); await expect(host.locator('[data-key="owner"]')).toHaveCSS('grid-column', '1 / span 2');
  await host.evaluate(element => { const parent = element.parentElement; element.remove(); element.style.width = '800px'; parent.append(element); });
  await expect(host.locator('[data-key="owner"]')).toHaveCSS('grid-column', '1 / span 2');
});

test('all new components inherit light, dark and local semantic overrides', async ({ page }) => {
  await page.locator('html').evaluate(element => { element.dataset.hyTheme = 'dark'; });
  await expect(page.locator('#card [part="card"]')).toHaveCSS('background-color', 'rgb(24, 26, 64)');
  await page.locator('#card').evaluate(element => element.style.setProperty('--hy-surface-elevated-color', '#123456'));
  await expect(page.locator('#card [part="card"]')).toHaveCSS('background-color', 'rgb(18, 52, 86)');
  await page.locator('#result').evaluate(element => { element.status = 'success'; element.style.setProperty('--hy-success-color', '#287d65'); });
  await expect(page.locator('#result [part="icon"]')).toHaveCSS('color', 'rgb(40, 125, 101)');
  await page.locator('#avatar').evaluate(element => element.style.setProperty('--hy-avatar-size', '64px')); await expect(page.locator('#avatar [part="avatar"]')).toHaveCSS('width', '64px');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.locator('#descriptions').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
});
