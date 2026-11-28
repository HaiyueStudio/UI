import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/high-priority-regressions.html');
  await page.waitForFunction(() => window.highPriorityReady);
});

test('tree leaves editing and interactive keys in nested shadow controls', async ({ page }) => {
  await page.evaluate(() => {
    const tree = document.querySelector('hy-tree');
    tree.data = [{ id: 'editor', renderer: 'audit-keyboard-editor' }, { id: 'other', label: 'Other' }];
    tree.selectedId = 'editor';
    window.treeActions = [];
    tree.addEventListener('data-change', event => window.treeActions.push(event.detail.action));
    return new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  const tree = page.locator('hy-tree');
  const input = tree.locator('audit-keyboard-editor input');
  await input.press('End'); await input.press('Backspace');
  await expect(input).toHaveValue('ab');
  expect(await tree.evaluate(element => element.data.map(node => node.id))).toEqual(['editor', 'other']);
  await tree.locator('audit-keyboard-editor button').press('Delete');
  await tree.locator('[contenteditable]').press('ArrowDown');
  expect(await tree.evaluate(element => element.selectedId)).toBe('editor');
  expect(await page.evaluate(() => window.treeActions)).toEqual([]);

  // Container shortcuts still operate when the tree itself owns focus.
  await tree.focus(); await tree.press('Delete');
  expect(await tree.evaluate(element => element.data.map(node => node.id))).toEqual(['other']);
  expect(await page.evaluate(() => window.treeActions)).toEqual(['delete']);
});

for (const tag of ['hy-draggable', 'hy-resizable']) {
  test(`${tag} preserves child editing keys and consumed shortcuts`, async ({ page }) => {
    await page.evaluate(tag => {
      const host = document.createElement(tag); host.id = 'container'; host.setAttribute('x', '20'); host.setAttribute('y', '20');
      const editor = document.createElement('audit-keyboard-editor'); host.append(editor); document.body.append(host);
    }, tag);
    const host = page.locator('#container');
    const input = host.locator('input');
    await input.press('End'); await input.press('ArrowLeft');
    expect(await input.evaluate(element => element.selectionStart)).toBe(2);
    await input.press('Home');
    expect(await input.evaluate(element => element.selectionStart)).toBe(0);
    await host.locator('button').press('ArrowRight');
    await expect(host).toHaveAttribute('x', '20'); await expect(host).toHaveAttribute('y', '20');
    await host.locator('audit-keyboard-editor').evaluate(element => {
      const owned = document.createElement('span'); owned.tabIndex = 0; owned.textContent = 'Owned shortcut';
      owned.addEventListener('keydown', event => event.preventDefault()); element.shadowRoot.append(owned);
    });
    await host.locator('audit-keyboard-editor span[tabindex]').press('ArrowRight');
    await expect(host).toHaveAttribute('x', '20');
  });
}

test('resizable movable=false blocks keyboard move/reset while keeping resize handles active', async ({ page }) => {
  await page.evaluate(() => {
    const host = document.createElement('hy-resizable'); host.id = 'resize'; host.setAttribute('x', '20');
    host.setAttribute('y', '30'); host.setAttribute('width', '200'); host.setAttribute('height', '120');
    host.movable = false; document.body.append(host); host.moveTo(40, 50);
  });
  const host = page.locator('#resize'); const frame = host.locator('[part="frame"]');
  await frame.press('ArrowRight'); await frame.press('Home');
  await expect(host).toHaveAttribute('x', '40'); await expect(host).toHaveAttribute('y', '50');
  await host.locator('[data-resize-handle="e"]').press('ArrowRight');
  await expect(host).toHaveAttribute('width', '201');
});

const dataComponents = [
  { tag: 'hy-tree', property: 'data', attribute: 'data', value: [{ id: 'programmatic', label: 'Programmatic' }] },
  { tag: 'hy-dropdown', property: 'items', attribute: 'items', value: [{ value: 'programmatic', label: 'Programmatic' }] },
  { tag: 'hy-context-menu', property: 'items', attribute: 'items', value: [{ value: 'programmatic', label: 'Programmatic' }] },
];

test('tree retains selected-ids precedence over selected-id on connection', async ({ page }) => {
  const result = await page.evaluate(() => {
    const tree = document.createElement('hy-tree');
    tree.setAttribute('data', JSON.stringify([{ id: 'one' }, { id: 'two' }]));
    tree.setAttribute('selected-ids', '["one","two"]');
    tree.setAttribute('selected-id', 'one');
    document.body.append(tree);
    return { ids: tree.selectedIds, selected: tree.selectedId };
  });
  expect(result).toEqual({ ids: ['one', 'two'], selected: 'two' });
});

for (const config of dataComponents) {
  test(`${config.tag} retains preconnection properties and edited state on reconnection`, async ({ page }) => {
    const result = await page.evaluate(({ tag, property, value }) => {
      const host = document.createElement(tag); host[property] = value;
      if (tag === 'hy-tree') host.selectedId = 'programmatic';
      document.body.append(host);
      const connected = host[property].map(item => item.label);
      if (host[property][0]) host[property][0].label = 'Edited';
      host.remove(); document.body.append(host);
      return { connected, reconnected: host[property].map(item => item.label), selected: tag === 'hy-tree' ? host.selectedId : null };
    }, config);
    expect(result.connected).toEqual(['Programmatic']); expect(result.reconnected).toEqual(['Edited']);
    if (config.tag === 'hy-tree') expect(result.selected).toBe('programmatic');
  });

  test(`${config.tag} keeps declarative initialization and explicit later attribute updates`, async ({ page }) => {
    const result = await page.evaluate(({ tag, property, attribute, value }) => {
      const host = document.querySelector(tag); const initial = host[property].map(item => item.label);
      const initialSelection = tag === 'hy-tree' ? host.selectedId : null;
      host[property] = value; host.remove(); document.body.append(host);
      const reconnected = host[property].map(item => item.label);
      host.setAttribute(attribute, JSON.stringify(value.map(item => ({ ...item, label: 'Attribute update' }))));
      const updated = host[property].map(item => item.label);
      host.removeAttribute(attribute);
      return { initial, initialSelection, reconnected, updated, cleared: host[property].length };
    }, config);
    expect(result.initial).toEqual(['Seed']); expect(result.reconnected).toEqual(['Programmatic']);
    expect(result.updated).toEqual(['Attribute update']); expect(result.cleared).toBe(0);
    if (config.tag === 'hy-tree') expect(result.initialSelection).toBe('seed');
  });
}

async function createUploadForm(page, trigger = 'change') {
  await page.evaluate(trigger => {
    const form = document.createElement('hy-form'); form.id = 'upload-form';
    const item = document.createElement('hy-form-item'); item.id = 'upload-item'; item.name = 'assets'; item.required = true; item.validateTrigger = trigger;
    const upload = document.createElement('hy-upload'); upload.id = 'upload'; upload.drag = true; upload.autoUpload = false;
    item.append(upload); form.append(item); document.body.append(form);
    window.uploadChanges = []; window.validatedValues = []; window.submissions = [];
    form.addEventListener('change', event => window.uploadChanges.push({ target: event.target.tagName, composed: event.composed, names: upload.files.map(file => file.name) }));
    form.addEventListener('form-submit', event => window.submissions.push([...event.detail.formData.values()].map(file => file.name)));
    item.rules = [{ validator: value => { window.validatedValues.push(value.map(file => file.name)); } }];
  }, trigger);
}

const file = name => ({ name, mimeType: 'text/plain', buffer: Buffer.from(name) });

test('native upload validates the accepted list and emits one composed change per batch', async ({ page }) => {
  await createUploadForm(page);
  await page.locator('#upload-item').evaluate(item => item.validate());
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', 'error');
  await page.locator('#upload').evaluate(upload => { upload.multiple = true; });
  await page.locator('#upload input[type=file]').setInputFiles([file('one.txt'), file('two.txt')]);
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', 'success');
  expect(await page.evaluate(() => window.validatedValues)).toEqual([['one.txt', 'two.txt']]);
  expect(await page.evaluate(() => window.uploadChanges)).toEqual([{ target: 'HY-UPLOAD', composed: true, names: ['one.txt', 'two.txt'] }]);
});

test('upload waits for asynchronous acceptance before notifying or validating', async ({ page }) => {
  await createUploadForm(page);
  await page.locator('#upload').evaluate(upload => { upload.beforeUpload = () => new Promise(resolve => { window.acceptUpload = resolve; }); });
  await page.locator('#upload input[type=file]').setInputFiles(file('accepted.txt'));
  expect(await page.evaluate(() => window.uploadChanges)).toEqual([]);
  expect(await page.evaluate(() => window.validatedValues)).toEqual([]);
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', '');
  await page.evaluate(() => window.acceptUpload(true));
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', 'success');
  expect(await page.evaluate(() => window.validatedValues)).toEqual([['accepted.txt']]);
});

test('rejected selection and vetoed removal do not report a field edit', async ({ page }) => {
  await createUploadForm(page);
  await page.locator('#upload').evaluate(upload => { upload.beforeUpload = () => false; });
  await page.locator('#upload input[type=file]').setInputFiles(file('rejected.txt'));
  await expect(page.locator('#upload [part="message"]')).toContainText('rejected');
  expect(await page.evaluate(() => window.uploadChanges)).toEqual([]);
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', '');
  await page.locator('#upload').evaluate(upload => { upload.beforeUpload = null; });
  await page.locator('#upload input[type=file]').setInputFiles(file('kept.txt'));
  await page.locator('#upload').evaluate(upload => upload.addEventListener('file-remove', event => event.preventDefault(), { once: true }));
  await page.locator('#upload').getByRole('button', { name: 'Remove kept.txt' }).click();
  expect(await page.evaluate(() => window.uploadChanges.length)).toBe(1);
  await expect(page.locator('#upload [part="file-name"]')).toHaveText('kept.txt');
});

test('drag-drop validates the committed files through the same change contract', async ({ page }) => {
  await createUploadForm(page);
  await page.locator('#upload').evaluate(upload => {
    const transfer = new DataTransfer(); transfer.items.add(new File(['drop'], 'drop.txt', { type: 'text/plain' }));
    upload.shadowRoot.querySelector('[part="dropzone"]').dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: transfer }));
  });
  await expect(page.locator('#upload-item')).toHaveJSProperty('status', 'success');
  expect(await page.evaluate(() => window.validatedValues)).toEqual([['drop.txt']]);
  expect(await page.evaluate(() => window.uploadChanges.length)).toBe(1);
});

for (const edit of ['remove', 'replace']) {
  test(`upload ${edit} invalidates an outstanding form submission`, async ({ page }) => {
    await createUploadForm(page, 'submit');
    await page.locator('#upload input[type=file]').setInputFiles(file('original.txt'));
    await page.locator('#upload-item').evaluate(item => {
      item.rules = [{ validator: (_value, signal) => new Promise(resolve => { window.validationSignal = signal; window.finishValidation = resolve; }) }];
      window.submission = document.querySelector('#upload-form').submit();
    });
    await expect(page.locator('#upload-item')).toHaveJSProperty('status', 'validating');
    if (edit === 'remove') await page.locator('#upload').getByRole('button', { name: 'Remove original.txt' }).click();
    else await page.locator('#upload input[type=file]').setInputFiles(file('replacement.txt'));
    expect(await page.evaluate(() => window.validationSignal.aborted)).toBe(true);
    expect(await page.evaluate(async () => { window.finishValidation(''); return window.submission; })).toBe(false);
    expect(await page.evaluate(() => window.submissions)).toEqual([]);
  });
}

test('upload progress and completion do not invalidate an unchanged validated file list', async ({ page }) => {
  await createUploadForm(page, 'submit');
  await page.locator('#upload input[type=file]').setInputFiles(file('asset.txt'));
  await page.locator('#upload-item').evaluate(item => {
    item.rules = [{ validator: (_value, signal) => new Promise(resolve => { window.validationSignal = signal; window.finishValidation = resolve; }) }];
    window.submission = document.querySelector('#upload-form').submit();
    const upload = document.querySelector('#upload');
    upload.request = ({ onProgress }) => new Promise(resolve => { window.reportProgress = onProgress; window.finishUpload = resolve; });
    window.uploading = upload.upload();
  });
  await page.evaluate(async () => { window.reportProgress(50); window.finishUpload('saved'); await window.uploading; });
  expect(await page.evaluate(() => window.validationSignal.aborted)).toBe(false);
  expect(await page.evaluate(() => window.uploadChanges.length)).toBe(1);
  expect(await page.evaluate(async () => { window.finishValidation(''); return window.submission; })).toBe(true);
  expect(await page.evaluate(() => window.submissions)).toEqual([['asset.txt']]);
});
