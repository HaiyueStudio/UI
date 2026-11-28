import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/test/browser/drag-drop.html'); await page.waitForFunction(() => window.ready);
});

async function start(page, mode) {
  const source = page.locator('#source'); await source.evaluate((element, value) => { element.preview = value; }, mode);
  const box = await source.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 8); await page.mouse.down(); await page.mouse.move(box.x + 28, box.y + 8);
  await expect(source).toHaveAttribute('dragging'); return box;
}
async function cancel(page) { await page.keyboard.press('Escape'); await page.mouse.up(); }

async function probe(page, slot = '') {
  await page.evaluate(slotName => {
    window.probeConnected = 0; window.probeDisconnected = 0;
    customElements.define('hy-preview-probe', class extends HTMLElement {
      constructor() {
        super(); this.attachShadow({ mode: 'open' }).innerHTML = '<style>:host{display:block;background:rgb(22,80,120);color:white;padding:12px;border-radius:8px}:host::before{content:"★";color:gold}button{pointer-events:auto}</style><strong>Original component</strong><input name="probe" value="Initial"><button>Inspect</button><div data-scroll style="height:30px;overflow:auto"><div style="height:120px">Scrollable content</div></div>';
      }
      connectedCallback() { window.probeConnected++; }
      disconnectedCallback() { window.probeDisconnected++; }
    });
    const source = document.querySelector('#source'); const item = document.createElement('hy-preview-probe'); item.id = 'probe'; item.slot = slotName;
    if (!slotName) source.replaceChildren(item); else source.append(item);
    item.shadowRoot.querySelector('input').value = 'Edited value'; window.originalProbe = item;
    item.shadowRoot.querySelector('[data-scroll]').scrollTop = 50;
  }, slot);
}

test('clone is a translucent styled snapshot of open-shadow content and current form values', async ({ page }) => {
  await probe(page);
  const before = await start(page, 'clone'); const preview = page.locator('[data-hy-drag-preview="clone"]');
  await expect(preview).toBeVisible(); await expect(preview).toHaveCSS('opacity', '0.65');
  await expect(preview.locator('input')).toHaveValue('Edited value'); await expect(preview.locator('input')).not.toHaveAttribute('name');
  await expect(preview).toContainText('★');
  expect(await preview.locator('[data-scroll]').evaluate(element => element.scrollTop)).toBe(50);
  await expect(preview.locator('hy-preview-probe')).toHaveCount(0);
  await expect(preview.locator('[id]')).toHaveCount(0);
  const bounds = await preview.boundingBox(); expect(Math.abs(bounds.width - before.width)).toBeLessThan(2);
  expect(Math.abs(bounds.x - before.x - 20)).toBeLessThan(2);
  await cancel(page); await expect(preview).toHaveCount(0);
  expect(await page.evaluate(() => [window.probeConnected, window.probeDisconnected, document.querySelector('#probe') === window.originalProbe])).toEqual([1, 0, true]);
});

test('a named preview slot uses the supplied component without reparenting or reconnecting it', async ({ page }) => {
  await probe(page, 'preview'); await expect(page.locator('#probe')).toBeHidden();
  await start(page, 'custom'); await expect(page.locator('#probe')).toBeVisible();
  expect(await page.locator('#probe').evaluate(element => element.parentElement.id)).toBe('source');
  await expect(page.locator('[data-hy-drag-preview="custom"]')).toHaveAttribute('inert');
  await cancel(page); await expect(page.locator('#probe')).toBeHidden();
  expect(await page.evaluate(() => [window.probeConnected, window.probeDisconnected])).toEqual([1, 0]);
});

test('a preview renderer mounts a custom component with the original data and cleans it up once', async ({ page }) => {
  await probe(page, 'preview');
  await page.locator('#source').evaluate(element => {
    element.renderPreview = payload => { window.renderDataMatches = payload.data === element.data; const result = document.createElement('hy-preview-probe'); result.id = 'rendered-preview'; window.rendered = result; return result; };
  });
  await start(page, 'custom'); await expect(page.locator('#rendered-preview')).toBeVisible(); await expect(page.locator('#probe')).toBeHidden();
  expect(await page.evaluate(() => window.renderDataMatches)).toBe(true);
  await cancel(page); await expect(page.locator('#rendered-preview')).toHaveCount(0);
  expect(await page.evaluate(() => [window.probeConnected, window.probeDisconnected, window.rendered.getAttribute('slot')])).toEqual([2, 1, null]);
});

test('move lifts the real source, keeps a faded placeholder and restores its original state on Escape', async ({ page }) => {
  await page.locator('#source').evaluate(element => { const form = document.createElement('form'); form.id = 'preview-form'; element.before(form); form.append(element); });
  await probe(page);
  await page.locator('#source').evaluate(element => { const field = document.createElement('input'); field.name = 'drag-value'; field.value = 'Remembered'; element.append(field); });
  await page.locator('#source').evaluate(element => { element.sourceOpacity = .3; window.originalParent = element.parentNode; window.originalStyle = element.getAttribute('style'); });
  const before = await start(page, 'move');
  await expect(page.locator('#source')).toHaveAttribute('data-hy-live-drag');
  expect(await page.locator('#preview-form').evaluate(element => [...new FormData(element).entries()])).toEqual([['drag-value', 'Remembered']]);
  const placeholder = page.locator('[data-hy-drag-placeholder]'); await expect(placeholder).toBeVisible(); await expect(placeholder).toHaveCSS('opacity', '0.3');
  const position = await placeholder.boundingBox(); expect(Math.abs(position.x - before.x)).toBeLessThan(2); expect(Math.abs(position.y - before.y)).toBeLessThan(2);
  await page.mouse.move(before.x + 90, before.y + 45);
  const moving = await page.locator('#source').boundingBox(); expect(Math.abs(moving.x - before.x - 82)).toBeLessThan(2);
  expect(await page.evaluate(() => document.querySelector('#source').parentNode === window.originalParent)).toBe(true);
  await cancel(page); await expect(placeholder).toHaveCount(0); await expect(page.locator('#source')).not.toHaveAttribute('popover');
  expect(await page.locator('#source').getAttribute('style')).toBe(await page.evaluate(() => window.originalStyle));
  const after = await page.locator('#source').boundingBox(); expect(Math.abs(after.x - before.x)).toBeLessThan(2); expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  expect(await page.evaluate(() => [window.probeConnected, window.probeDisconnected, document.querySelector('#probe') === window.originalProbe])).toEqual([1, 0, true]);
  await expect(page.locator('#probe input')).toHaveValue('Edited value');
  expect(await page.locator('#preview-form').evaluate(element => [...new FormData(element).entries()])).toEqual([['drag-value', 'Remembered']]);
});

test('move previews do not block drop hit testing, and the receiver sees restored DOM', async ({ page }) => {
  await probe(page);
  await page.locator('#source').evaluate(element => { element.style.padding = '0px'; element.shadowRoot.querySelector('[part="surface"]').style.pointerEvents = 'auto'; });
  await page.locator('#zone').evaluate(element => element.addEventListener('data-drop', event => { window.restoredAtDrop = !event.detail.source.hasAttribute('popover') && !document.querySelector('[data-hy-drag-placeholder]'); }));
  await start(page, 'move'); const zone = await page.locator('#zone').boundingBox();
  await page.mouse.move(zone.x + 40, zone.y + 30, { steps: 4 }); await expect(page.locator('#zone')).toHaveAttribute('dragover'); await page.mouse.up();
  expect(await page.evaluate(() => window.restoredAtDrop)).toBe(true);
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'drag-end').at(-1).accepted)).toBe(true);
  await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
});

test('preview attributes clamp opacity and changing settings or disabling cancels a live preview', async ({ page }) => {
  expect(await page.locator('#source').evaluate(element => [element.preview, element.previewOpacity, element.sourceOpacity])).toEqual(['text', 1, .55]);
  await page.locator('#source').evaluate(element => { element.previewOpacity = 2; element.sourceOpacity = -1; });
  expect(await page.locator('#source').evaluate(element => [element.previewOpacity, element.sourceOpacity])).toEqual([1, 0]);
  await start(page, 'move'); await page.locator('#source').evaluate(element => { element.preview = 'clone'; }); await page.mouse.up();
  await expect(page.locator('#source')).not.toHaveAttribute('popover'); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
  await start(page, 'move'); await page.locator('#source').evaluate(element => { element.disabled = true; }); await page.mouse.up();
  await expect(page.locator('#source')).not.toHaveAttribute('data-hy-live-drag'); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
});

test('connected renderer elements remain owned by the app and invalid renderers fall back safely', async ({ page }) => {
  await page.evaluate(() => {
    const external = document.createElement('div'); external.id = 'external-preview'; external.textContent = 'External content'; document.body.append(external);
    document.querySelector('#source').renderPreview = () => external;
  });
  await start(page, 'custom');
  await expect(page.locator('#source > [slot="hy-drag-render-preview"]')).toContainText('External content');
  expect(await page.locator('#external-preview').evaluate(element => element.parentElement === document.body)).toBe(true);
  await cancel(page); await expect(page.locator('#external-preview')).toHaveCount(1);
  await page.locator('#source').evaluate(element => { element.renderPreview = () => { throw new Error('Custom preview unavailable'); }; });
  await start(page, 'custom'); await expect(page.locator('[data-hy-drag-preview="clone"]')).toBeVisible(); await cancel(page);
  await expect(page.locator('[data-hy-drag-preview]')).toHaveCount(0);
});

test('move cleanup preserves app style changes and handles removal of the real source', async ({ page }) => {
  await start(page, 'move');
  await page.locator('#source').evaluate(element => { element.style.color = 'rgb(12, 34, 56)'; element.style.left = '123px'; element.preview = 'move'; });
  await expect(page.locator('#source')).toHaveAttribute('dragging'); await cancel(page);
  await expect(page.locator('#source')).toHaveCSS('color', 'rgb(12, 34, 56)');
  expect(await page.locator('#source').evaluate(element => element.style.left)).toBe('123px');
  await start(page, 'move'); await page.locator('#source').evaluate(element => { window.removedSource = element; element.remove(); }); await page.mouse.up();
  await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
  expect(await page.evaluate(() => [window.removedSource.hasAttribute('popover'), window.removedSource.style.position, window.removedSource.hasAttribute('data-hy-live-drag')])).toEqual([false, '', false]);
});

test('a source already using a native popover retains its original popover state', async ({ page }) => {
  await page.locator('#source').evaluate(element => { element.popover = 'manual'; element.showPopover(); });
  const before = await start(page, 'move'); await page.mouse.move(before.x + 80, before.y + 40); await cancel(page);
  expect(await page.locator('#source').evaluate(element => element.matches(':popover-open'))).toBe(true);
  await expect(page.locator('#source')).toHaveAttribute('popover', 'manual');
  const after = await page.locator('#source').boundingBox(); expect(Math.abs(after.x - before.x)).toBeLessThan(2); expect(Math.abs(after.y - before.y)).toBeLessThan(2);
});

test('touch move escapes a clipped transformed container and restores it on pointer cancellation', async ({ page, browserName }) => {
  test.skip(browserName !== 'chromium', 'CDP touch input is Chromium-specific');
  await page.locator('#source').evaluate(element => {
    const stage = document.createElement('div'); stage.id = 'touch-stage'; stage.style.cssText = 'width:200px;height:100px;overflow:hidden;transform:translate(5px,0)';
    element.before(stage); stage.append(element); element.preview = 'move';
  });
  const before = await page.locator('#source').boundingBox(); const zone = await page.locator('#zone').boundingBox();
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y, id: 1 }] });
  await touch('touchStart', before.x + 8, before.y + 8); await touch('touchMove', before.x + 30, before.y + 8);
  await expect(page.locator('#source')).toHaveAttribute('data-hy-live-drag');
  await touch('touchMove', zone.x + 40, zone.y + 30); await expect(page.locator('#zone')).toHaveAttribute('dragover');
  await touch('touchCancel'); await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
  const after = await page.locator('#source').boundingBox(); expect(Math.abs(after.x - before.x)).toBeLessThan(2); expect(Math.abs(after.y - before.y)).toBeLessThan(2);
  await cdp.detach();
});

test('keyboard dragging retains focus and makes no floating DOM or placeholders for any mode', async ({ page }) => {
  for (const mode of ['clone', 'custom', 'move']) {
    await page.locator('#source').evaluate((element, value) => { element.preview = value; element.focus(); }, mode); await page.keyboard.press('Space');
    await expect(page.locator('#source')).toHaveAttribute('dragging'); await expect(page.locator('[data-hy-drag-preview]')).toHaveCount(0);
    await page.locator('#zone').evaluate(element => element.focus()); await page.keyboard.press('Enter');
    await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
  }
  expect(await page.evaluate(() => window.events.filter(event => event.name === 'data-drop').length)).toBe(3);
});

test('gallery offers all preview modes and opacity controls at desktop and mobile widths', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 }); await page.goto(`/examples/?drag-preview-width=${width}#drag-source`);
    const source = page.locator('#drag-source-live');
    for (const mode of ['clone', 'custom', 'move']) {
      await page.locator('#drag-source-preview').selectOption(mode); await source.scrollIntoViewIfNeeded();
      await expect(source).toHaveAttribute('preview', mode);
      const bounds = await source.boundingBox();
      await page.mouse.move(bounds.x + 8, bounds.y + 8); await page.mouse.down(); await page.mouse.move(bounds.x + 28, bounds.y + 8);
      await expect(page.locator(`[data-hy-drag-preview="${mode}"]`)).toBeVisible();
      await page.mouse.move(Math.min(width - 270, bounds.x + 70), bounds.y + 70);
      await page.screenshot({ path: `.artifacts/drag-preview-${mode}-${width}.png` }); await cancel(page);
      await expect(page.locator('[data-hy-drag-placeholder]')).toHaveCount(0);
    }
    await page.locator('#drag-source-preview-opacity').fill('0.4'); await page.locator('#drag-source-source-opacity').fill('0.25');
    expect(await source.evaluate(element => [element.previewOpacity, element.sourceOpacity])).toEqual([.4, .25]);
    expect(await page.locator('#content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  }
  expect(errors).toEqual([]);
});
