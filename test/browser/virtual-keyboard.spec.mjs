import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/virtual-keyboard.html'); });

test('pointer keys edit a bound target with one-shot Shift, Caps Lock, and Backspace', async ({ page }) => {
  const keyboard = page.locator('#keyboard'); const editor = page.locator('#editor'); await editor.focus();
  await keyboard.locator('[data-code="KeyH"]').click(); await keyboard.locator('[data-code="KeyI"]').click(); await expect(editor).toHaveValue('hi');
  await keyboard.locator('[data-code="ShiftLeft"]').click(); await expect(keyboard.locator('[data-code="ShiftLeft"]')).toHaveAttribute('aria-pressed', 'true');
  await keyboard.locator('[data-code="KeyA"]').click(); await expect(editor).toHaveValue('hiA'); await expect(keyboard.locator('[data-code="ShiftLeft"]')).toHaveAttribute('aria-pressed', 'false');
  await keyboard.locator('[data-code="CapsLock"]').click(); await keyboard.locator('[data-code="KeyB"]').click(); await expect(editor).toHaveValue('hiAB');
  await keyboard.locator('[data-code="Backspace"]').click(); await expect(editor).toHaveValue('hiA'); await expect(page.locator('#events')).toContainText('deleteContentBackward');
});

test('tap and type APIs preserve exact text and emit composed key/input details', async ({ page }) => {
  const editor = page.locator('#editor');
  await page.evaluate(async () => { const keyboard = document.querySelector('#keyboard'); keyboard.clear(); await keyboard.type('Hi!', { interval: 0 }); await keyboard.tap('Space', { holdDuration: 0 }); await keyboard.type('月', { interval: 0 }); });
  await expect(editor).toHaveValue('Hi! 月'); await expect(page.locator('#events')).toContainText('"source":"api"'); await expect(page.locator('#events')).toContainText('virtual-keyboard-input');
});

test('physical keyboard sync highlights keys without duplicating native input', async ({ page }) => {
  const keyboard = page.locator('#keyboard'); const editor = page.locator('#editor'); await editor.focus();
  await page.keyboard.down('x'); await expect(keyboard.locator('[data-code="KeyX"]')).toHaveClass(/pressed/); await expect(page.locator('#events')).toContainText('"source":"physical"');
  await page.keyboard.up('x'); await expect(keyboard.locator('[data-code="KeyX"]')).not.toHaveClass(/pressed/); await expect(editor).toHaveValue('x');
});

test('custom layouts and disabled keys rebuild the public keyboard surface', async ({ page }) => {
  const keyboard = page.locator('#keyboard'); await keyboard.evaluate(element => { element.layout = [[{ code: 'Confirm', label: 'Confirm', value: '✓', width: 2 }, { code: 'Blocked', label: 'Blocked', disabled: true }]]; });
  await expect(keyboard.getByRole('button')).toHaveCount(2); await expect(keyboard.locator('[data-code="Blocked"]')).toBeDisabled(); await keyboard.locator('[data-code="Confirm"]').click(); await expect(page.locator('#editor')).toHaveValue('✓');
});

test('component gallery demonstrates typing, layout, and physical sync controls', async ({ page }) => {
  await page.goto('/examples/#virtual-keyboard'); const keyboard = page.locator('#virtual-keyboard-live');
  await keyboard.locator('[data-code="KeyH"]').click(); await expect(page.locator('#virtual-keyboard-target')).toHaveValue(/h$/);
  await page.locator('#virtual-keyboard-type').click(); await expect(page.locator('#virtual-keyboard-target')).toHaveValue(/Haiyue UI 2\.0!$/);
  await page.locator('#virtual-keyboard-compact').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); }); await expect(keyboard.getByRole('button')).toHaveCount(12);
});
