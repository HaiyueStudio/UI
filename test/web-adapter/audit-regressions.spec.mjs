import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.auditErrors = []; page.on('pageerror', e => page.auditErrors.push(e.message));
  await page.goto('/test/browser/remaining-audit.html'); await page.waitForFunction(() => window.auditReady);
  await page.evaluate(async () => {
    const { HYWebRenderer } = await import('/dist/adapters/web/index.js');
    const { HYPage } = await import('/dist/portable/index.js');
    const { hyNode } = await import('/dist/core/index.js');
    const host = document.createElement('div'); document.body.append(host);
    window.n = hyNode; window.events = []; window.accept = true;
    window.auditPage = new HYPage(new HYWebRenderer(host), { onEvent(event) {
      events.push(event); if (accept && event.type === 'commit' && event.key === '/root/choices') {
        auditPage.setProps(event.key, 'RadioGroup', { value: event.value, options: window.options });
      }
    } });
    window.options = [{ value: 'a', label: 'A' }, { value: 'locked', label: 'Locked', disabled: true }, { value: 'b', label: 'B' }, { value: 'c', label: 'C' }];
  });
});
test.afterEach(async ({ page }) => {
  await page.evaluate(() => auditPage.dispose()); expect(page.auditErrors).toEqual([]);
});

test('radio group roves, skips disabled choices, wraps, mirrors RTL and preserves controlled rejection', async ({ page }) => {
  await page.evaluate(() => auditPage.mount(n('Column', 'root', {}, { children: [n('RadioGroup', 'choices', { value: 'a', options })] })));
  const radios = page.locator('hy-radio input'); const a = page.getByRole('radio', { name: 'A', exact: true }), b = page.getByRole('radio', { name: 'B', exact: true });
  expect(await radios.evaluateAll(nodes => nodes.map(n => n.tabIndex))).toEqual([0, -1, -1, -1]);
  await a.focus(); await a.press('ArrowRight'); await expect(b).toBeFocused(); await expect(b).toBeChecked();
  expect(await page.evaluate(() => events.filter(e => ['valueChange', 'commit'].includes(e.type)).map(e => [e.type, e.reason, e.value]))).toEqual([['valueChange', 'keyboard', 'b'], ['commit', 'keyboard', 'b']]);
  await b.press('End'); await expect(page.getByRole('radio', { name: 'C', exact: true })).toBeFocused();
  await page.keyboard.press('ArrowRight'); await expect(a).toBeFocused();
  await page.evaluate(() => { document.querySelector('[role="radiogroup"]').dir = 'rtl'; });
  await a.press('ArrowLeft'); await expect(b).toBeFocused();
  await page.evaluate(() => { accept = false; events.length = 0; }); await b.press('ArrowLeft');
  await expect(b).toBeFocused(); await expect(b).toBeChecked();
  expect(await page.evaluate(() => events.filter(e => ['valueChange', 'commit'].includes(e.type)).map(e => e.value))).toEqual(['c', 'c']);
  await page.evaluate(() => {
    window.nativeB = document.querySelector('hy-radio[value="b"]').shadowRoot.querySelector('input');
    options = [options[2], options[0], options[3]];
    auditPage.setProps('/root/choices', 'RadioGroup', { value: 'b', options });
  });
  await expect(b).toBeFocused(); expect(await b.evaluate(el => el === nativeB)).toBe(true);
  expect(await radios.evaluateAll(nodes => nodes.map(n => n.tabIndex))).toEqual([0, -1, -1]);
});

for (const [kind, props, selector] of [
  ['Checkbox', { checked: false, text: 'Accept' }, 'hy-checkbox input'],
  ['RadioGroup', { value: 'a', options: [{ value: 'a', label: 'A' }] }, 'hy-radio input'],
  ['Rate', { value: 2, count: 5 }, 'hy-rate [role="slider"]'],
]) test(`${kind} receives actual initial focus in a dialog`, async ({ page }) => {
  await page.evaluate(({ kind, props }) => auditPage.mount(n('Column', 'root', {}, { children: [
    n('Dialog', 'dialog', { title: 'Choice', open: true }, { children: [n(kind, 'first', props), n('Button', 'later', { text: 'Later' })] }),
  ] })), { kind, props });
  await expect(page.locator(selector)).toBeFocused();
});

test('rating descriptions and errors are attached to the accessible slider and clear cleanly', async ({ page }) => {
  await page.evaluate(() => auditPage.mount(n('Column', 'root', {}, { children: [
    n('FormGroup', 'group', { label: 'Score', description: 'Choose stars', error: 'Required' }, { children: [n('Rate', 'rating', { value: 0, count: 5 })] }),
  ] })));
  const slider = page.locator('hy-rate [role="slider"]');
  await expect(slider).toHaveAccessibleDescription(/Choose stars.*Required/); await expect(slider).toHaveAttribute('aria-invalid', 'true');
  expect(await page.locator('hy-rate .star').evaluateAll(nodes => nodes.every(n => !n.hasAttribute('aria-describedby')))).toBe(true);
  await page.evaluate(() => auditPage.setProps('/root/group', 'FormGroup', { label: 'Score' }));
  await expect(slider).not.toHaveAttribute('aria-describedby'); await expect(slider).not.toHaveAttribute('aria-invalid');
});
