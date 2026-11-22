import { test, expect } from '@playwright/test';

const host = page => page.locator('#mentions');
const input = page => host(page).getByRole('combobox');
test.beforeEach(async ({ page }) => { await page.goto('/test/browser/mentions.html'); });

test('registers explicitly and navigates enabled suggestions while preserving textarea focus', async ({ page }) => {
  expect(await page.evaluate(() => window.unregisteredOnImport)).toBe(true);
  await input(page).fill('@');
  await expect(host(page).getByRole('option')).toHaveCount(4);
  await expect(host(page).getByRole('option', { name: 'Alice Chen' })).toHaveAttribute('aria-selected', 'true');
  await input(page).press('ArrowDown');
  await expect(host(page).getByRole('option', { name: 'Bob Lin' })).toHaveAttribute('aria-selected', 'true');
  await input(page).press('ArrowUp');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('@alice ');
  await expect(input(page)).toBeFocused();
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => window.outerEnter)).toBe(0);
  const selected = await page.evaluate(() => window.events.filter(event => event.name === 'mention-select'));
  expect(selected).toEqual([{ name: 'mention-select', detail: { value: '@alice ', option: { value: 'alice', label: 'Alice Chen' }, prefix: '@' }, composed: true, bubbles: true }]);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'value-change').length)).toBe(2);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'input').length)).toBe(2);
});

test('filters labels and values and inserts at a middle caret without losing surrounding text', async ({ page }) => {
  await input(page).fill('Hello @alix world');
  await input(page).evaluate(element => { element.setSelectionRange(9, 9); element.dispatchEvent(new Event('click')); });
  await expect(host(page).getByRole('option')).toHaveCount(1);
  await host(page).getByRole('option', { name: 'Alice Chen' }).click();
  await expect(input(page)).toHaveValue('Hello @alice world');
  expect(await input(page).evaluate(element => element.selectionStart)).toBe(13);
  await input(page).fill('@CHEN');
  await expect(host(page).getByRole('option', { name: 'Alice Chen' })).toBeVisible();
});

test('supports multiple and overlapping prefixes and custom split strings', async ({ page }) => {
  await host(page).evaluate(element => { element.prefixes = ['@', '#', '::', ':']; element.split = ','; });
  await input(page).fill('#bo');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('#bob,');
  await input(page).pressSequentially('::ali');
  await input(page).press('Enter');
  await expect(input(page)).toHaveValue('#bob,::alice,');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'search').at(-1).detail.prefix)).toBe('::');
  await host(page).evaluate(element => { element.prefix = '$'; element.split = ''; });
  await input(page).fill('$bo'); await input(page).press('Enter');
  await expect(input(page)).toHaveValue('$bob');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('ignores email addresses, completed tokens, and selected text; rechecks cursor movement', async ({ page }) => {
  for (const value of ['mail@example.com', '@alice ', 'hello\nworld']) {
    await input(page).fill(value); await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  }
  await input(page).fill('@ali');
  await input(page).evaluate(element => { element.setSelectionRange(0, 4); element.dispatchEvent(new Event('select')); });
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await input(page).press('ArrowRight');
  await expect(host(page).getByRole('option', { name: 'Alice Chen' })).toBeVisible();
  await input(page).press('Control+A'); await input(page).press('Backspace');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('supports synchronous search consumers, async loading, empty content, and custom filtering', async ({ page }) => {
  await host(page).evaluate(element => {
    element.notFoundContent = 'Nobody found'; element.loadingText = 'Searching';
    element.addEventListener('search', () => { element.loading = true; element.options = [{ value: 'remote', label: 'Remote result' }]; });
  });
  await input(page).fill('@remote');
  await expect(host(page).getByRole('status')).toHaveText('Searching');
  await expect(input(page)).not.toHaveAttribute('aria-activedescendant');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'search').length)).toBe(1);
  await host(page).evaluate(element => { element.loading = false; });
  await expect(host(page).getByRole('option')).toHaveText('Remote result');
  await host(page).evaluate(element => { element.options = []; });
  await expect(host(page).getByRole('status')).toHaveText('Nobody found');
  await host(page).evaluate(element => { element.filterOption = false; element.options = [{ value: 'server', label: 'Unrelated result' }]; });
  await expect(host(page).getByRole('option')).toHaveText('Unrelated result');
  await host(page).evaluate(element => { element.filterOption = (_text, option) => option.value === 'chosen'; element.options = [{ value: 'other' }, { value: 'chosen' }]; });
  await expect(host(page).getByRole('option')).toHaveText('chosen');
});

test('keeps IME confirmation and modified Enter as native editing keys', async ({ page }) => {
  await input(page).focus();
  await input(page).dispatchEvent('compositionstart');
  await input(page).fill('@海');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await input(page).dispatchEvent('compositionend', { data: '海' });
  await expect(host(page).getByRole('option')).toHaveText('海月 Studio');
  expect(await input(page).evaluate(element => !element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, cancelable: true, bubbles: true })))).toBe(false);
  await expect(input(page)).toHaveValue('@海');
  await input(page).press('Shift+Enter');
  await expect(input(page)).toHaveValue('@海\n');
  await input(page).fill('@海'); await input(page).press('Enter');
  await expect(input(page)).toHaveValue('@海月 ');
});

test('dismisses with Escape, Tab, blur, and outside clicks without stealing focus', async ({ page }) => {
  await input(page).fill('@'); await input(page).press('Escape');
  await expect(input(page)).toBeFocused();
  await input(page).dispatchEvent('select');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await input(page).pressSequentially('a');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
  await input(page).press('Tab');
  await expect(page.locator('#outside')).toBeFocused();
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await host(page).evaluate(element => element.focus());
  await expect(input(page)).toHaveAttribute('aria-expanded', 'true');
  await page.locator('#outside').click();
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  await host(page).evaluate(element => { element.focus(); element.blur(); });
  await expect(input(page)).not.toBeFocused();
});

test('forwards editing constraints and keeps programmatic writes silent', async ({ page }) => {
  await host(page).evaluate(element => {
    element.value = '@al'; element.rows = 5; element.placeholder = 'Mention people';
    element.setAttribute('name', 'comment'); element.setAttribute('required', ''); element.setAttribute('maxlength', '5');
    element.readOnly = true;
  });
  await expect(input(page)).toHaveValue('@al'); await expect(input(page)).toHaveAttribute('rows', '5');
  await expect(input(page)).toHaveAttribute('name', 'comment'); await expect(input(page)).toHaveAttribute('readonly', '');
  await input(page).focus(); await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'value-change').length)).toBe(0);
  await host(page).evaluate(element => { element.readOnly = false; });
  await input(page).press('Enter'); await expect(input(page)).toHaveValue('@al'); // @alice exceeds maxlength.
  await host(page).evaluate(element => { element.disabled = true; });
  await expect(input(page)).toBeDisabled(); await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('parses JSON options safely and never selects disabled results', async ({ page }) => {
  await host(page).evaluate(element => {
    element.setAttribute('options', JSON.stringify([{ value: 'safe', label: '<img src=x onerror=alert(1)>' }, { value: 'blocked', disabled: true }, null, 3]));
    element.setAttribute('prefixes', '["#"]');
  });
  await input(page).fill('#');
  await expect(host(page).getByRole('option')).toHaveCount(2);
  await expect(host(page).locator('img')).toHaveCount(0);
  await host(page).getByRole('option', { name: 'blocked' }).click({ force: true });
  await expect(input(page)).toHaveValue('#');
  await host(page).evaluate(element => { element.options = [{ value: 'blocked', disabled: true }]; });
  await expect(input(page)).not.toHaveAttribute('aria-activedescendant');
  await input(page).press('Enter'); await expect(input(page)).toHaveValue('#\n');
  await host(page).evaluate(element => { element.setAttribute('options', '{bad'); element.setAttribute('prefixes', '{bad'); element.removeAttribute('value'); });
  await input(page).fill('@'); await expect(host(page).getByRole('status')).toHaveText('No results');
});

test('cleans up on detach and reconnects without duplicate events or registration', async ({ page }) => {
  await input(page).fill('@');
  await host(page).evaluate(element => {
    const parent = element.parentElement; element.remove();
    window.closedOnDetach = !element.open && !element.shadowRoot.querySelector(':popover-open');
    element.options = [{ value: 'reconnected' }]; parent.append(element);
  });
  expect(await page.evaluate(() => window.closedOnDetach)).toBe(true);
  await input(page).fill('@re'); await input(page).press('Enter');
  await expect(input(page)).toHaveValue('@reconnected ');
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'mention-select').length)).toBe(1);
  await page.evaluate(async () => { const { defineHaiyueUI } = await import('../../dist/index.js'); defineHaiyueUI(); });
});

test('anchors to wrapped lines, escapes clipping, fits a narrow viewport, and inherits themes', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 600 });
  await input(page).fill('@');
  const first = await host(page).locator('[part="panel"]').boundingBox();
  await input(page).fill('First line\nSecond line\n@');
  const panel = host(page).locator('[part="panel"]');
  const wrapped = await panel.boundingBox();
  expect(wrapped.y).toBeGreaterThan(first.y);
  expect(wrapped.x).toBeGreaterThanOrEqual(0);
  expect(wrapped.x + wrapped.width).toBeLessThanOrEqual(375);
  expect(await panel.evaluate(element => element.matches(':popover-open'))).toBe(true);
  await host(page).getByRole('option', { name: 'Bob Lin' }).click();
  await expect(input(page)).toHaveValue('First line\nSecond line\n@bob ');
  const light = await input(page).evaluate(element => getComputedStyle(element).backgroundColor);
  await page.locator('html').evaluate(element => { element.dataset.hyTheme = 'dark'; });
  expect(await input(page).evaluate(element => getComputedStyle(element).backgroundColor)).not.toBe(light);
  await host(page).evaluate(element => { element.parentElement.style.overflow = 'visible'; element.parentElement.style.height = 'auto'; element.placement = 'top'; element.style.marginTop = '220px'; });
  await input(page).fill('@');
  const above = await panel.boundingBox(); const control = await input(page).boundingBox();
  expect(above.y + above.height).toBeLessThan(control.y + 10);
});

test('preserves native undo grouping for ordinary typing', async ({ page }) => {
  await host(page).evaluate(element => { element.addEventListener('search', () => { element.options = element.options; }); });
  await input(page).focus(); await input(page).pressSequentially('Hello @ali');
  await input(page).press('Control+z');
  await expect(input(page)).toHaveValue('');
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('updates the popup when the textarea scrolls and hides suggestions for an offscreen caret', async ({ page }) => {
  await input(page).fill('One\nTwo\nThree\nFour\nFive\n@');
  await input(page).press('End'); await input(page).pressSequentially('a');
  await expect(host(page).getByRole('option', { name: 'Alice Chen' })).toBeVisible();
  await input(page).evaluate(element => { element.scrollTop = 0; element.dispatchEvent(new Event('scroll')); });
  await expect(input(page)).toHaveAttribute('aria-expanded', 'false');
});

test('selects suggestions on a touch screen', async ({ browser }) => {
  const context = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 700 } });
  try {
    const page = await context.newPage(); await page.goto('/test/browser/mentions.html');
    await input(page).fill('@bo'); await host(page).getByRole('option', { name: 'Bob Lin' }).tap();
    await expect(input(page)).toHaveValue('@bob '); await expect(input(page)).toBeFocused();
  } finally { await context.close(); }
});

test('gallery exposes live prefix selection and async search', async ({ page }) => {
  await page.goto('/examples/#mentions');
  const mentions = page.locator('#mentions-live'); const textarea = mentions.getByRole('combobox');
  await page.locator('label').filter({ has: page.locator('#mentions-async') }).click();
  await textarea.fill('@ali');
  await expect(mentions.getByRole('status')).toHaveText('正在搜索…');
  await expect(mentions.getByRole('option', { name: 'Alice Chen · Design' })).toBeVisible();
  await textarea.press('Enter');
  await expect(page.locator('#mentions-event')).toContainText('mention-select');
  await page.locator('#mentions-prefixes').selectOption('#');
  await textarea.fill('#oce');
  await expect(mentions.getByRole('option', { name: 'Ocean scene' })).toBeVisible();
  await textarea.press('Enter'); await expect(textarea).toHaveValue('#ocean ');
});
