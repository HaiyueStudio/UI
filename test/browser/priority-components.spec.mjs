import { test, expect } from '@playwright/test';
test.beforeEach(async ({ page }) => { await page.goto('/test/browser/priority-components.html'); });

test('switch has native keyboard behavior, silent properties, and loading guards', async ({ page }) => {
  expect(await page.evaluate(() => window.explicitRegistration)).toBe(true);
  const host = page.locator('#switch'); const control = host.getByRole('switch', { name: 'Auto save' });
  await control.focus(); await control.press('Space'); await expect(control).toBeChecked();
  await control.press('Enter'); await expect(control).not.toBeChecked();
  await host.evaluate(element => { element.checked = true; element.loading = true; element.size = 'small'; });
  await expect(control).toBeDisabled(); await expect(control).toHaveAttribute('aria-busy', 'true');
  await host.evaluate(element => element.click()); await expect(control).toBeChecked();
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.id === 'switch').length)).toBe(2);
});

test('existing controls and switch submit native FormData and reset defaults', async ({ page }) => {
  const data = () => page.locator('#native-form').evaluate(form => Object.fromEntries(new FormData(form)));
  expect(await data()).toEqual({ title: 'Initial title', tags: 'featured', enabled: 'on', quality: 'high', comment: 'Initial comment', mode: 'first' });
  await page.locator('#native-input input').fill('Changed');
  await page.locator('#native-checkbox').evaluate(element => { element.checked = false; });
  await page.locator('#native-switch').evaluate(element => { element.checked = false; });
  await page.locator('#native-select').evaluate(element => { element.value = 'low'; });
  await page.locator('#native-mentions textarea').fill('Changed comment');
  await page.locator('hy-radio[value="second"]').evaluate(element => { element.checked = true; });
  expect(await data()).toEqual({ title: 'Changed', quality: 'low', comment: 'Changed comment', mode: 'second' });
  await page.locator('#native-form').evaluate(form => form.reset());
  expect(await data()).toEqual({ title: 'Initial title', tags: 'featured', enabled: 'on', quality: 'high', comment: 'Initial comment', mode: 'first' });
  await page.locator('#fieldset').evaluate(element => { element.disabled = true; });
  await expect(page.locator('#native-input input')).toBeDisabled(); expect(await data()).toEqual({});
  await page.locator('#fieldset').evaluate(element => { element.disabled = false; });
  await expect(page.locator('#native-input input')).toBeEnabled(); expect((await data()).enabled).toBe('on');
});

test('native constraints and custom validity are reflected by the form-associated input', async ({ page }) => {
  await page.locator('#native-input input').fill('');
  expect(await page.locator('#native-form').evaluate(form => form.checkValidity())).toBe(false);
  await page.locator('#native-input').evaluate(element => { element.value = 'Valid'; element.setCustomValidity('Unavailable title'); });
  expect(await page.locator('#native-input').evaluate(element => element.validationMessage)).toBe('Unavailable title');
  await page.locator('#native-form').evaluate(form => form.reset());
  expect(await page.locator('#native-form').evaluate(form => form.checkValidity())).toBe(true);
});

test('progress normalizes numbers and provides determinate and indeterminate semantics', async ({ page }) => {
  const host = page.locator('#progress'); const meter = host.getByRole('progressbar');
  await expect(meter).toHaveAttribute('aria-valuenow', '35');
  await host.evaluate(element => { element.percent = 180; element.type = 'circle'; element.status = 'success'; element.size = 80; });
  await expect(meter).toHaveAttribute('aria-valuenow', '100'); await expect(host.locator('svg')).toBeVisible();
  await expect(host.locator('.arc')).toHaveAttribute('stroke-dashoffset', '0');
  await host.evaluate(element => { element.indeterminate = true; element.showInfo = false; });
  await expect(meter).not.toHaveAttribute('aria-valuenow'); await expect(host.locator('[part="info"]')).toBeHidden();
  await page.emulateMedia({ reducedMotion: 'reduce' }); await expect(host.locator('svg')).toHaveCSS('animation-name', 'none');
});

test('spin delays its indicator, blocks content, cancels stale timers, and reconnects', async ({ page }) => {
  await page.clock.install(); const host = page.locator('#spin'); const status = host.getByRole('status');
  await host.evaluate(element => { element.spinning = true; });
  await expect(status).toBeHidden(); expect(await page.locator('#spin-action').evaluate(element => element.matches(':disabled') || element.closest('hy-spin').shadowRoot.querySelector('.content').inert)).toBe(true);
  await page.clock.fastForward(110); await expect(status).toBeVisible();
  await host.evaluate(element => { element.spinning = false; }); await expect(status).toBeHidden();
  await host.evaluate(element => { element.spinning = true; element.spinning = false; });
  await page.clock.fastForward(200); await expect(status).toBeHidden();
  await host.evaluate(element => { const parent = element.parentElement; element.remove(); element.spinning = true; parent.append(element); });
  await page.clock.fastForward(110); await expect(status).toBeVisible();
});

test('popover supports interactive content, top-layer clipping escape, Escape and return focus', async ({ page }) => {
  const host = page.locator('#popover'); const trigger = page.locator('#popover-trigger');
  await trigger.click(); await expect(host.getByRole('dialog', { name: 'Settings' })).toBeVisible();
  await expect(page.locator('#popover-input')).toBeFocused(); await page.locator('#popover-input').fill('Ocean');
  expect(await host.locator('[part="panel"]').evaluate(element => element.matches(':popover-open'))).toBe(true);
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await trigger.click(); await page.locator('#outside').click(); await expect(host.getByRole('dialog')).toBeHidden(); await expect(page.locator('#outside')).toBeFocused();
});

test('popover fits narrow viewports and restores trigger attributes on disconnect', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 }); const host = page.locator('#popover');
  await host.evaluate(element => { element.placement = 'right-end'; element.open = true; });
  const bounds = await host.getByRole('dialog').boundingBox(); expect(bounds.x).toBeGreaterThanOrEqual(8); expect(bounds.x + bounds.width).toBeLessThanOrEqual(367);
  expect(await host.evaluate(element => { const trigger = element.querySelector('button'); element.remove(); return { expanded: trigger.getAttribute('aria-expanded'), visible: element.shadowRoot.querySelector('[part="panel"]').matches(':popover-open') }; })).toEqual({ expanded: null, visible: false });
});

test('focus-triggered popovers stay closed when Escape returns focus to the trigger', async ({ page }) => {
  const host = page.locator('#popover'); await host.evaluate(element => { element.trigger = 'focus'; });
  await page.locator('#popover-trigger').focus(); await expect(host.getByRole('dialog')).toBeVisible();
  await page.locator('#popover-input').click(); await page.keyboard.press('Escape');
  await expect(host.getByRole('dialog')).toBeHidden(); await expect(page.locator('#popover-trigger')).toBeFocused();
});

test('hover and manual triggers own delayed opening and disabled state', async ({ page }) => {
  await page.clock.install(); const host = page.locator('#popover');
  await host.evaluate(element => { element.trigger = 'hover'; });
  await page.locator('#popover-trigger').hover(); await page.clock.fastForward(110); await expect(host.getByRole('dialog')).toBeVisible();
  await page.locator('#outside').hover(); await page.clock.fastForward(160); await expect(host.getByRole('dialog')).toBeHidden();
  await host.evaluate(element => { element.trigger = 'manual'; }); await page.locator('#popover-trigger').click(); await expect(host.getByRole('dialog')).toBeHidden();
  await host.evaluate(element => { element.show(); element.disabled = true; element.show(); }); await expect(host.getByRole('dialog')).toBeHidden();
});

test('popconfirm confirms, cancels, and preserves an async prevented action while loading', async ({ page }) => {
  const host = page.locator('#popconfirm'); await page.locator('#confirm-trigger').click();
  await host.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(host.getByRole('dialog')).toBeHidden();
  await page.locator('#confirm-trigger').click(); await host.getByRole('button', { name: 'Confirm', exact: true }).click(); await expect(host.getByRole('dialog')).toBeHidden();
  await host.evaluate(element => { element.addEventListener('confirm', event => { event.preventDefault(); element.confirmLoading = true; }); });
  await page.locator('#confirm-trigger').click(); await host.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(host.getByRole('dialog')).toHaveAttribute('aria-busy', 'true'); await page.keyboard.press('Escape'); await expect(host.getByRole('dialog')).toBeVisible();
  await host.evaluate(element => { element.confirmLoading = false; element.hide(); }); await expect(page.locator('#confirm-trigger')).toBeFocused();
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'confirm').length)).toBe(2);
});

test('form validates required fields, labels inputs, and emits values without navigating', async ({ page }) => {
  const form = page.locator('#form'); const title = page.locator('#form-title input');
  await expect(title).toHaveAccessibleName('Project title');
  await page.locator('#submit').click(); await expect(page.locator('#title-item').getByRole('alert')).toContainText('required');
  await expect(title).toBeFocused(); await expect(title).toHaveAttribute('aria-invalid', 'true');
  await title.fill('Ocean project'); await page.locator('#submit').click();
  await expect(title).toHaveAccessibleName('Project title');
  await expect(page.locator('#title-item').getByRole('alert')).toBeHidden();
  await expect.poll(() => page.evaluate(() => window.componentEvents.filter(event => event.name === 'form-submit').length)).toBe(1);
  const submitted = await page.evaluate(() => window.componentEvents.find(event => event.name === 'form-submit'));
  expect(submitted.detail.values).toEqual({ title: 'Ocean project', owner: 'Alice', public: 'on' }); expect(submitted.composed).toBe(true);
  expect(page.url()).toContain('priority-components.html');
  await form.evaluate(element => { element.setValues({ title: 'Set by API', public: false }); });
  await expect(title).toHaveValue('Set by API');
  await page.locator('#reset').click(); await expect(title).toHaveValue(''); await expect(page.locator('#title-item').getByRole('alert')).toBeHidden();
});

test('form supports Enter submission, dynamic fields, repeated values, and prototype-safe names', async ({ page }) => {
  await page.locator('#form-title input').fill('Enter project'); await page.locator('#form-title input').press('Enter');
  await expect.poll(() => page.evaluate(() => window.componentEvents.filter(event => event.name === 'form-submit').length)).toBe(1);
  await page.locator('#form').evaluate(form => {
    for (const [name, value] of [['tag','a'],['tag','b'],['__proto__','safe']]) { const input = document.createElement('input'); input.name = name; input.value = value; form.append(input); }
  });
  await expect.poll(() => page.locator('#form').evaluate(form => form.values.tag)).toEqual(['a','b']);
  expect(await page.locator('#form').evaluate(form => form.values.__proto__)).toBe('safe');
});

test('form rules support patterns and async validation; stale validations cannot submit', async ({ page }) => {
  await page.locator('#title-item').evaluate(item => { item.validateTrigger = 'submit'; item.rules = [{ min: 3, message: 'At least 3 characters' }, { pattern: /^[A-Z]/, message: 'Start with uppercase' }]; });
  await page.locator('#form-title input').fill('ab'); await page.locator('#submit').click(); await expect(page.locator('#title-item').getByRole('alert')).toHaveText('At least 3 characters');
  await page.locator('#form-title input').fill('ocean'); await page.locator('#submit').click(); await expect(page.locator('#title-item').getByRole('alert')).toHaveText('Start with uppercase');
  await page.locator('#title-item').evaluate(item => { item.rules = [{ validator: (_value, signal) => new Promise(resolve => { window.finishValidation = () => resolve(signal.aborted ? '' : 'Already used'); }) }]; });
  await page.locator('#form-title input').fill('Ocean'); await page.locator('#submit').click();
  await expect(page.locator('#title-item').getByRole('status')).toBeVisible();
  await page.locator('#form-title input').fill('New value'); await page.evaluate(() => window.finishValidation());
  await expect(page.locator('#title-item').getByRole('alert')).toBeHidden();
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'form-submit').length)).toBe(0);
});

test('upload selects files with native picker semantics and supports cancelable removal', async ({ page }) => {
  const host = page.locator('#upload'); await host.locator('input[type=file]').setInputFiles([{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('notes') }]);
  await expect(host.locator('[part="file-name"]')).toHaveText('notes.txt');
  await host.evaluate(element => { element.addEventListener('file-remove', event => event.preventDefault(), { once: true }); });
  await host.getByRole('button', { name: 'Remove notes.txt' }).click(); await expect(host.locator('li')).toHaveCount(1);
  await host.getByRole('button', { name: 'Remove notes.txt' }).click(); await expect(host.locator('li')).toHaveCount(0);
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'upload-change').map(event => event.detail.reason))).toEqual(['select','remove']);
});

test('upload validates type, size and count before adding a file', async ({ page }) => {
  const host = page.locator('#upload'); await host.evaluate(element => { element.maxCount = 1; });
  await host.locator('input[type=file]').setInputFiles([
    { name: 'image.png', mimeType: 'image/png', buffer: Buffer.from('image') },
    { name: 'large.txt', mimeType: 'text/plain', buffer: Buffer.alloc(101) },
    { name: 'first.txt', mimeType: 'text/plain', buffer: Buffer.from('a') },
    { name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('b') },
  ]);
  await expect(host.locator('[part="file-name"]')).toHaveText('first.txt');
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'file-reject').map(event => event.detail.reason))).toEqual(['type','size','count']);
});

test('upload request receives progress and AbortSignal; failures can be retried', async ({ page }) => {
  const host = page.locator('#upload');
  await host.evaluate(element => { window.attempts = 0; element.request = ({ signal, onProgress }) => new Promise((resolve, reject) => { window.attempts++; window.uploadSignal = signal; window.uploadProgress = onProgress; window.uploadResolve = resolve; window.uploadReject = reject; }); });
  await host.locator('input[type=file]').setInputFiles([{ name: 'asset.txt', mimeType: 'text/plain', buffer: Buffer.from('asset') }]);
  await host.evaluate(element => { void element.upload(); }); await page.evaluate(() => window.uploadProgress(150));
  await expect(host.getByRole('progressbar')).toHaveJSProperty('value', 100);
  await page.evaluate(() => window.uploadReject(new Error('Network error'))); await expect(host.locator('[part="file-status"]')).toHaveText('Network error');
  await host.getByRole('button', { name: 'Retry asset.txt' }).click(); expect(await page.evaluate(() => window.attempts)).toBe(2);
  await page.evaluate(() => window.uploadResolve({ assetId: 'a1' })); await expect(host.locator('[part="file-status"]')).toHaveText('done');
});

test('upload aborts removed and disconnected requests and ignores late success', async ({ page }) => {
  const host = page.locator('#upload');
  await host.evaluate(element => { element.autoUpload = true; element.request = ({ signal }) => new Promise(resolve => { window.uploadSignal = signal; window.uploadResolve = resolve; }); });
  await host.locator('input[type=file]').setInputFiles([{ name: 'asset.txt', mimeType: 'text/plain', buffer: Buffer.from('asset') }]);
  await host.getByRole('button', { name: 'Remove asset.txt' }).click(); expect(await page.evaluate(() => window.uploadSignal.aborted)).toBe(true);
  await page.evaluate(() => window.uploadResolve('late')); await expect(host.locator('li')).toHaveCount(0);
  await host.locator('input[type=file]').setInputFiles([{ name: 'second.txt', mimeType: 'text/plain', buffer: Buffer.from('second') }]);
  await host.evaluate(element => { element.remove(); }); expect(await page.evaluate(() => window.uploadSignal.aborted)).toBe(true);
  await page.evaluate(() => window.uploadResolve('late'));
  expect(await page.evaluate(() => window.componentEvents.filter(event => event.name === 'upload-change' && event.detail.reason === 'success').length)).toBe(0);
});

test('upload async beforeUpload cannot add stale files after reset or disable', async ({ page }) => {
  const host = page.locator('#upload');
  await host.evaluate(element => { element.beforeUpload = () => new Promise(resolve => { window.approveFile = resolve; }); });
  await host.locator('input[type=file]').setInputFiles([{ name: 'asset.txt', mimeType: 'text/plain', buffer: Buffer.from('asset') }]);
  await host.evaluate(element => { element.disabled = true; }); await page.evaluate(() => window.approveFile(true));
  await expect(host.locator('li')).toHaveCount(0);
  await expect(host.getByRole('button', { name: 'Choose files' })).toBeDisabled();
});

test('drag-drop selection and native upload FormData preserve real File objects', async ({ page }) => {
  const host = page.locator('#upload');
  await host.evaluate(element => {
    const form = document.createElement('form'); element.before(form); form.append(element);
    const transfer = new DataTransfer(); transfer.items.add(new File(['drop'], 'drop.txt', { type:'text/plain' }));
    element.shadowRoot.querySelector('[part="dropzone"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(host.locator('[part="file-name"]')).toHaveText('drop.txt');
  expect(await host.evaluate(element => new FormData(element.form).get('assets').name)).toBe('drop.txt');
  await host.evaluate(element => element.form.reset()); await expect(host.locator('li')).toHaveCount(0);
});

test('gallery controls demonstrate all priority components and form feedback', async ({ page }) => {
  await page.goto('/examples/#switch');
  await page.locator('#switch-live').getByRole('switch').focus(); await page.keyboard.press('Space'); await expect(page.locator('#switch-event')).toContainText('checked-change');
  await page.locator('#progress-percent').fill('68'); await expect(page.locator('#progress-line').getByRole('progressbar')).toHaveAttribute('aria-valuenow', '68');
  await page.locator('label').filter({ has: page.locator('#spin-spinning') }).click(); await expect(page.locator('#spin-live').getByRole('status')).toBeVisible();
  await page.locator('#popover-open').click(); await expect(page.locator('#popover-live').getByRole('dialog')).toBeVisible(); await page.keyboard.press('Escape');
  await page.locator('#popconfirm-live').getByRole('button', { name: '删除资源' }).click();
  await page.locator('#popconfirm-live').getByRole('button', { name: '保留', exact: true }).click(); await expect(page.locator('#popconfirm-event')).toContainText('cancel');
  await page.locator('#form-live').getByRole('button', { name: '保存设置' }).click(); await expect(page.locator('#form-name-item').getByRole('alert')).toBeVisible();
  await page.locator('#form-name-item input').fill('Ocean'); await page.locator('#form-live').getByRole('button', { name: '保存设置' }).click(); await expect(page.locator('#form-event')).toContainText('form-submit');
  await page.locator('#upload-live input[type=file]').setInputFiles([{ name:'demo.txt',mimeType:'text/plain',buffer:Buffer.from('demo') }]);
  await page.locator('#upload-start').click(); await expect(page.locator('#upload-live [part="file-status"]')).toHaveText('done');
});
