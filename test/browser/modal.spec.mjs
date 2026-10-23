import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/modal.html');
  await page.waitForFunction(() => customElements.get('hy-modal') && customElements.get('hy-button'));
});
const modal = page => page.locator('#modal');
const open = page => page.getByRole('button', { name: 'Open modal', exact: true }).click();

test('explicit registration, constructor contract, native modality, autofocus, Tab containment and shadow return focus', async ({ page }) => {
  expect(await page.evaluate(() => window.registeredOnImport)).toBe(false);
  expect(await page.evaluate(() => document.createElement('hy-modal').attributes.length)).toBe(0);
  await expect(modal(page).locator('dialog')).toBeHidden();
  await open(page);
  await expect(page.getByRole('dialog', { name: 'Publish project', exact: true })).toBeVisible();
  await expect(modal(page).locator('dialog')).toHaveAttribute('aria-modal', 'true');
  await expect(page.locator('#name')).toBeFocused();
  await page.locator('#outside').evaluate(element => element.focus());
  await expect(page.locator('#outside')).not.toBeFocused();
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await modal(page).evaluate(element => element.contains(document.activeElement) || document.activeElement === element)).toBe(true);
  }
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal(page)).not.toHaveAttribute('open');
  await expect(page.getByRole('button', { name: 'Open modal', exact: true })).toBeFocused();
  expect(await page.evaluate(() => window.modalEvents.map(event => event.type))).toEqual(['modal-open', 'modal-cancel', 'modal-close']);
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('cancel');
});

test('confirmation and cancellation requests can be prevented, and close emits exactly once', async ({ page }) => {
  await open(page);
  await modal(page).evaluate(element => {
    element.addEventListener('modal-ok', event => event.preventDefault(), { once: true });
    element.addEventListener('modal-cancel', event => event.preventDefault(), { once: true });
  });
  await modal(page).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(modal(page)).toHaveAttribute('open');
  await page.keyboard.press('Escape'); await expect(modal(page)).toHaveAttribute('open');
  await modal(page).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(modal(page)).not.toHaveAttribute('open');
  await modal(page).evaluate(element => element.close());
  expect(await page.evaluate(() => window.modalEvents.filter(event => event.type === 'modal-close'))).toEqual([{ type: 'modal-close', reason: 'ok' }]);
});

test('loading retains the modal after confirmation and blocks default dismissal until the application closes', async ({ page }) => {
  await open(page);
  await modal(page).evaluate(element => element.addEventListener('modal-ok', () => { element.confirmLoading = true; }, { once: true }));
  await modal(page).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(modal(page)).toHaveAttribute('open');
  await expect(modal(page).getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await expect(modal(page).getByRole('button', { name: 'Cancel', exact: true })).toBeDisabled();
  await expect(modal(page).getByRole('button', { name: 'Close modal', exact: true })).toBeDisabled();
  await expect(modal(page).locator('dialog')).toHaveAttribute('aria-busy', 'true');
  await page.keyboard.press('Escape'); await page.mouse.click(5, 5); await expect(modal(page)).toHaveAttribute('open');
  expect(await page.evaluate(() => window.modalEvents.some(event => event.type === 'modal-cancel'))).toBe(false);
  await modal(page).evaluate(element => element.close('saved'));
  await expect(modal(page)).not.toHaveAttribute('open');
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('saved');
});

test('controlled state and disabled confirmation leave the application in charge', async ({ page }) => {
  await modal(page).evaluate(element => { element.controlled = true; element.confirmDisabled = true; });
  await open(page);
  await expect(modal(page).getByRole('button', { name: 'Publish', exact: true })).toBeDisabled();
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(modal(page)).toHaveAttribute('open');
  await modal(page).evaluate(element => { element.confirmDisabled = false; });
  await modal(page).getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(modal(page)).toHaveAttribute('open');
  await modal(page).evaluate(element => { element.open = false; });
  await expect(modal(page).locator('dialog')).toBeHidden();
});

test('mask, Escape and close-button policies are independent, and a drag ending on the mask does not dismiss', async ({ page }) => {
  await modal(page).evaluate(element => { element.closable = false; element.maskClosable = false; element.keyboard = false; });
  await open(page);
  await expect(modal(page).locator('[part="close-button"]')).toBeHidden();
  await page.keyboard.press('Escape'); await page.mouse.click(5, 5); await expect(modal(page)).toHaveAttribute('open');
  await modal(page).evaluate(element => { element.maskClosable = true; });
  const rect = await modal(page).locator('h2').boundingBox();
  await page.mouse.move(rect.x + 30, rect.y + 10); await page.mouse.down(); await page.mouse.move(5, 5, { steps: 4 }); await page.mouse.up();
  await expect(modal(page)).toHaveAttribute('open');
  await page.mouse.click(5, 5); await expect(modal(page)).not.toHaveAttribute('open');
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('mask');
  await modal(page).evaluate(element => { element.keyboard = true; }); await open(page); await page.keyboard.press('Escape');
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('escape');
  await modal(page).evaluate(element => { element.closable = true; }); await open(page);
  await modal(page).getByRole('button', { name: 'Close modal', exact: true }).click();
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('close-button');
});

test('custom heading and footer slots replace defaults, and the footer can be hidden', async ({ page }) => {
  await modal(page).evaluate(element => {
    const heading = document.createElement('span'); heading.slot = 'heading'; heading.textContent = 'Custom title';
    const action = document.createElement('hy-button'); action.slot = 'footer'; action.setAttribute('label', 'Custom action'); action.addEventListener('click', () => element.close('custom'));
    element.append(heading, action);
  });
  await open(page);
  await expect(page.getByRole('dialog', { name: 'Custom title', exact: true })).toBeVisible();
  await expect(modal(page).locator('[part="ok-button"]')).toBeHidden();
  await modal(page).getByRole('button', { name: 'Custom action', exact: true }).focus();
  await page.keyboard.press('Tab'); await expect(modal(page).getByRole('button', { name: 'Close modal', exact: true })).toBeFocused();
  await page.keyboard.press('Shift+Tab'); await expect(modal(page).getByRole('button', { name: 'Custom action', exact: true })).toBeFocused();
  await modal(page).getByRole('button', { name: 'Custom action', exact: true }).click();
  expect(await page.evaluate(() => window.modalEvents.at(-1).reason)).toBe('custom');
  await modal(page).evaluate(element => { element.showFooter = false; }); await open(page);
  await expect(modal(page).locator('footer')).toBeHidden();
});

test('nested modals retain scroll locks and restore the original overflow value and priority', async ({ page }) => {
  await page.evaluate(() => document.documentElement.style.setProperty('overflow', 'auto', 'important'));
  await open(page);
  await modal(page).evaluate(element => {
    const nested = document.createElement('hy-modal'); nested.id = 'nested'; nested.heading = 'Nested'; nested.style.setProperty('--hy-modal-duration', '0ms');
    const input = document.createElement('input'); nested.append(input); element.append(nested); nested.showModal();
  });
  await expect(page.getByRole('dialog', { name: 'Nested', exact: true })).toBeVisible();
  await page.locator('#nested').evaluate(element => element.close());
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await expect(page.locator('#name')).toBeFocused();
  await page.locator('#nested').evaluate(element => element.showModal());
  await modal(page).evaluate(element => element.close());
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await page.locator('#nested').evaluate(element => element.close());
  expect(await page.evaluate(() => ({ value: document.documentElement.style.overflow, priority: document.documentElement.style.getPropertyPriority('overflow') }))).toEqual({ value: 'auto', priority: 'important' });
});

test('rapid close/reopen ignores queued native close, and close handlers may reopen without stale cleanup', async ({ page }) => {
  await modal(page).evaluate(async element => {
    element.showModal(); element.close('first'); element.showModal();
    await new Promise(resolve => requestAnimationFrame(resolve));
  });
  await expect(modal(page)).toHaveAttribute('open'); await expect(modal(page).locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => window.modalEvents.filter(event => event.type === 'modal-close').length)).toBe(1);
  await modal(page).evaluate(element => {
    element.addEventListener('modal-close', () => element.showModal(), { once: true }); element.close('second');
  });
  await expect(modal(page)).toHaveAttribute('open');
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await modal(page).evaluate(element => element.close());
  await page.getByRole('button', { name: 'Open modal', exact: true }).focus();
  await modal(page).evaluate(element => element.showModal());
  await page.locator('#opener').locator('button').evaluate(button => button.addEventListener('focus', () => document.querySelector('#modal').showModal(), { once: true }));
  await modal(page).evaluate(element => element.close('focus-reopen'));
  await expect(modal(page)).toHaveAttribute('open');
  await expect(modal(page).locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await modal(page).evaluate(element => element.close());
  await page.locator('#name').evaluate(input => input.addEventListener('focus', () => document.querySelector('#modal').close('from-focus'), { once: true }));
  await modal(page).evaluate(element => element.showModal());
  await expect(modal(page)).not.toHaveAttribute('open');
  await expect(modal(page).locator('dialog')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('destroy-on-hidden unmounts and restores the same content, values and listeners', async ({ page }) => {
  await modal(page).evaluate(element => { window.savedInput = element.querySelector('input'); element.destroyOnHidden = true; });
  await expect(page.locator('#name')).toHaveCount(0);
  await open(page); await page.locator('#name').fill('Retained');
  await modal(page).getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.locator('#name')).toHaveCount(0);
  await open(page); await expect(page.locator('#name')).toHaveValue('Retained');
  expect(await page.evaluate(() => window.savedInput === document.querySelector('#name'))).toBe(true);
});

test('disconnect releases modality and scroll without a close event, and retained open state reconnects', async ({ page }) => {
  await open(page);
  await modal(page).evaluate(element => { window.detachedModal = element; element.remove(); });
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
  expect(await page.evaluate(() => window.modalEvents.filter(event => event.type === 'modal-close').length)).toBe(0);
  await page.evaluate(() => document.body.append(window.detachedModal));
  await expect(modal(page).locator('dialog')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('hidden');
  await modal(page).evaluate(element => element.close());
  expect(await page.evaluate(() => document.documentElement.style.overflow)).toBe('');
});

test('small screens constrain the modal, body content scrolls, and width normalizes invalid values', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 640 });
  await modal(page).evaluate(element => {
    element.width = 900;
    const tall = document.createElement('div'); tall.style.height = '1800px'; element.append(tall);
  });
  await open(page);
  const box = await modal(page).locator('dialog').boundingBox();
  expect(box.width).toBeLessThanOrEqual(358); expect(box.height).toBeLessThanOrEqual(608); expect(box.x).toBeGreaterThanOrEqual(16);
  expect(await modal(page).locator('.body').evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  const width = await modal(page).evaluate(element => { element.width = NaN; return element.width; }); expect(width).toBe(520);
});

test('gallery exposes configuration and async confirmation and preserves category order', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#modal');
  await page.locator('label:has(#modal-async)').click();
  await page.locator('#modal-open').click();
  const live = page.locator('#modal-live'); await expect(live.locator('dialog')).toBeVisible();
  await live.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(live).toHaveJSProperty('confirmLoading', true);
  await expect(live.locator('dialog')).toBeHidden();
  await expect(page.locator('#modal-event')).toContainText('"reason":"ok"');
  const links = await page.locator('#component-nav a').evaluateAll(links => links.map(link => link.hash.slice(1)));
  expect(links.slice(links.indexOf('history-controls'), links.indexOf('notification') + 1)).toEqual(['history-controls', 'modal', 'notification']);
  expect(await page.locator('.component-section').evaluateAll(sections => sections.map(section => section.id))).toEqual(links);
  expect(errors).toEqual([]);
});
