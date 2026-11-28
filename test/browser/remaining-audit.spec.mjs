import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  page.auditErrors = []; page.on('pageerror', error => page.auditErrors.push(error.message));
  await page.goto('/test/browser/remaining-audit.html');
  await page.waitForFunction(() => window.auditReady);
});
test.afterEach(async ({ page }) => expect(page.auditErrors).toEqual([]));

test('numeric attributes distinguish defaults, empty values, removal and explicit zero', async ({ page }) => {
  const result = await page.evaluate(() => {
    const cases = [
      ['hy-toast', 'duration', 'duration', 3, 0], ['hy-toast', 'maxCount', 'max-count', 5, 1],
      ['hy-notification', 'duration', 'duration', 4.5, 0], ['hy-watermark', 'rotate', 'rotate', -22, 0],
      ['hy-watermark', 'markWidth', 'mark-width', 120, 16], ['hy-table', 'pageSize', 'page-size', 10, 1],
      ['hy-tour', 'gap', 'gap', 8, 0], ['hy-tour', 'zIndex', 'z-index', 1000, 0],
      ['hy-tooltip', 'delay', 'delay', 1000, 0], ['hy-anchor', 'bounds', 'bounds', 5, 0],
      ['hy-virtual-mouse', 'duration', 'duration', 320, 0],
    ];
    return cases.map(([tag, prop, attr, fallback, zero]) => {
      const el = document.createElement(tag);
      const initial = el[prop]; el.setAttribute(attr, ' '); const empty = el[prop];
      el.setAttribute(attr, '0'); const explicit = el[prop]; el.removeAttribute(attr);
      return { tag, prop, initial, empty, explicit, removed: el[prop], fallback, zero };
    });
  });
  for (const row of result) {
    expect(row.initial, `${row.tag}.${row.prop}`).toBe(row.fallback);
    expect(row.empty).toBe(row.fallback); expect(row.explicit).toBe(row.zero);
    expect(row.removed).toBe(row.fallback);
  }
});

test('table retains focused headers and processes one snapshot per operation', async ({ page }) => {
  await page.evaluate(() => {
    const table = document.createElement('hy-table'); window.calls = 0; window.lastChange = null;
    table.columns = [{ key: 'value', title: 'Value', sortable: true, filter: (_, record) => { window.calls++; return record.value >= 0; } }];
    table.dataSource = Array.from({ length: 1000 }, (_, value) => ({ value }));
    table.setFilter('value', 'yes'); document.body.append(table);
    table.addEventListener('table-change', event => { window.lastChange = event.detail; });
    window.header = table.shadowRoot.querySelector('.sort-button');
  });
  const button = page.locator('hy-table .sort-button');
  for (const sort of ['ascending', 'descending', 'none']) {
    await page.evaluate(() => { window.calls = 0; }); await button.press('Enter');
    await expect(page.locator('hy-table th')).toHaveAttribute('aria-sort', sort); await expect(button).toBeFocused();
    expect(await page.evaluate(() => header === document.querySelector('hy-table').shadowRoot.querySelector('.sort-button'))).toBe(true);
    expect(await page.evaluate(() => calls)).toBe(1000);
  }
  const result = await page.evaluate(() => {
    const table = document.querySelector('hy-table'); calls = 0; table.goToPage(2);
    const pageCalls = calls, rows = [...table.shadowRoot.querySelectorAll('tbody td')].map(el => Number(el.textContent));
    const event = lastChange.visibleData.map(r => r.value); table.dataSource[10].value = -1;
    table.attributeChangedCallback(); // Preserve the existing no-argument lifecycle method contract.
    return { pageCalls, rows, event, freshTotal: table.filteredData.length };
  });
  expect(result).toMatchObject({ pageCalls: 1000, freshTotal: 999 }); expect(result.rows).toEqual(result.event);
});

test('anchor active and label updates preserve links and focus', async ({ page }) => {
  await page.evaluate(() => {
    const anchor = document.createElement('hy-anchor'); anchor.items = [{ href: '#a', title: 'A' }, { href: '#b', title: 'B' }];
    document.body.append(anchor); window.link = anchor.shadowRoot.querySelector('a'); link.focus();
    anchor.activeHref = '#a'; anchor.setAttribute('aria-label', 'Sections'); anchor.activeHref = '#b';
  });
  await expect(page.locator('hy-anchor a').first()).toBeFocused();
  expect(await page.evaluate(() => link === document.querySelector('hy-anchor').shadowRoot.querySelector('a'))).toBe(true);
  await expect(page.locator('hy-anchor a').last()).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('hy-anchor nav')).toHaveAttribute('aria-label', 'Sections');
});

test('virtual list reuses overlap and transfers focus only when a row leaves', async ({ page }) => {
  await page.evaluate(() => {
    const list = document.createElement('hy-virtual-list'); list.height = 120; list.itemHeight = 30; list.overscan = 1;
    list.items = Array.from({ length: 100 }, (_, i) => i); window.renderCalls = 0;
    list.renderItem = (item, index) => { renderCalls++; const input = document.createElement('input'); input.value = String(index); return input; };
    document.body.append(list); window.retained = list.shadowRoot.querySelector('[data-index="2"]');
    retained.querySelector('input').focus(); retained.querySelector('input').value = 'draft';
    renderCalls = 0; list.scrollToIndex(1, 'start');
  });
  await expect(page.locator('hy-virtual-list [data-index="2"] input')).toBeFocused();
  await expect(page.locator('hy-virtual-list [data-index="2"] input')).toHaveValue('draft');
  expect(await page.evaluate(() => retained === document.querySelector('hy-virtual-list').shadowRoot.querySelector('[data-index="2"]'))).toBe(true);
  expect(await page.evaluate(() => renderCalls)).toBeLessThanOrEqual(2);
  await page.evaluate(() => document.querySelector('hy-virtual-list').scrollToIndex(50, 'start'));
  await expect(page.locator('hy-virtual-list .viewport')).toBeFocused();
  expect(await page.evaluate(() => retained.isConnected)).toBe(false);
  const fresh = await page.evaluate(() => {
    const list = document.querySelector('hy-virtual-list'), old = list.shadowRoot.querySelector('[data-index="50"]');
    list.refresh(); const replaced = old !== list.shadowRoot.querySelector('[data-index="50"]'); list.remove();
    return { replaced, rows: list.shadowRoot.querySelectorAll('[data-index]').length };
  });
  expect(fresh).toEqual({ replaced: true, rows: 0 });
});

for (const tag of ['hy-date-picker', 'hy-time-picker', 'hy-cascader']) {
  test(`${tag} closes an open picker when disabled and rejects stale activation`, async ({ page }) => {
    const result = await page.evaluate(tag => {
      const picker = document.createElement(tag); if (tag === 'hy-cascader') picker.options = [{ value: 'one', label: 'One' }];
      document.body.append(picker); picker.open = true;
      const stale = picker.shadowRoot.querySelector('button[data-value], button[data-date], .cell, .option');
      let changes = 0; picker.addEventListener('value-change', () => changes++);
      const before = picker.value; picker.disabled = true; stale?.click();
      return { open: picker.open, before, after: picker.value, changes };
    }, tag);
    expect(result.open).toBe(false); expect(result.changes).toBe(0); expect(result.after).toEqual(result.before);
  });
}

test('fieldset disables input search and radio selection clears disabled checked peers', async ({ page }) => {
  await page.evaluate(() => {
    document.body.innerHTML += '<fieldset disabled><hy-input type="search" value="query"></hy-input></fieldset><hy-radio name="audit" value="a" checked disabled>A</hy-radio><hy-radio name="audit" value="b">B</hy-radio>';
    window.searches = 0; document.querySelector('hy-input').addEventListener('search', () => searches++);
  });
  await expect(page.locator('hy-input button')).toBeDisabled();
  await page.locator('hy-input button').evaluate(el => el.click());
  await page.locator('hy-radio').last().locator('input').press('Space');
  expect(await page.evaluate(() => [searches, ...[...document.querySelectorAll('hy-radio')].map(el => el.checked)])).toEqual([0, false, true]);
});

test('drawer traverses slotted shadow controls in both directions', async ({ page }) => {
  await page.evaluate(() => {
    const drawer = document.createElement('hy-drawer'); drawer.innerHTML = '<hy-input></hy-input><hy-button>Next</hy-button><hy-button disabled>Disabled</hy-button><button hidden>Hidden</button><button slot="footer">Done</button>';
    document.body.append(drawer); drawer.open = true;
  });
  const close = page.locator('hy-drawer button[aria-label="Close drawer"]'); await close.focus();
  const targets = [page.locator('hy-drawer hy-input input'), page.locator('hy-drawer hy-button button').first(), page.locator('hy-drawer > button[slot="footer"]'), close];
  for (const target of targets) { await page.keyboard.press('Tab'); await expect(target).toBeFocused(); }
  await page.keyboard.press('Shift+Tab'); await expect(targets[2]).toBeFocused();
});

test('dialog reconnect restores modal state and ignores queued closes after reopening', async ({ page }) => {
  await page.evaluate(() => {
    document.body.innerHTML += '<button id="outside">Outside</button><hy-dialog dismissible><input></hy-dialog>';
    const dialog = document.querySelector('hy-dialog'); window.closes = []; dialog.addEventListener('dialog-close', e => closes.push(e.detail.reason));
    document.querySelector('#outside').focus(); dialog.showModal(); dialog.remove(); document.body.append(dialog);
  });
  expect(await page.locator('hy-dialog dialog').evaluate(el => el.matches(':modal'))).toBe(true);
  await page.evaluate(() => document.querySelector('#outside').focus()); await expect(page.locator('#outside')).not.toBeFocused();
  await page.evaluate(() => { const dialog = document.querySelector('hy-dialog'); dialog.close(); dialog.showModal(); });
  await page.waitForTimeout(50); await expect(page.locator('hy-dialog')).toHaveAttribute('open', '');
  expect(await page.evaluate(() => closes)).toEqual(['programmatic']);
  await page.evaluate(() => { const dialog = document.querySelector('hy-dialog'); dialog.addEventListener('dialog-close', () => dialog.showModal(), { once: true }); dialog.close('action'); });
  await page.waitForTimeout(50); expect(await page.locator('hy-dialog dialog').evaluate(el => el.matches(':modal'))).toBe(true);
  expect(await page.evaluate(() => closes)).toEqual(['programmatic', 'action']);
});

test('tour keeps its target interactive and closes cleanly when steps become empty', async ({ page }) => {
  await page.evaluate(() => {
    document.body.innerHTML += '<button id="target">Target</button><hy-tour></hy-tour>';
    window.clicks = 0; document.querySelector('#target').onclick = () => clicks++;
    const tour = document.querySelector('hy-tour'); tour.steps = [{ title: 'Step', target: '#target' }]; tour.open = true;
    window.reasons = []; tour.addEventListener('tour-close', e => reasons.push(e.detail.reason));
  });
  await expect(page.locator('hy-tour [role="dialog"]')).not.toHaveAttribute('aria-modal', 'true');
  await page.locator('#target').click(); expect(await page.evaluate(() => clicks)).toBe(1);
  await page.evaluate(() => { document.querySelector('hy-tour').steps = []; document.querySelector('#target').focus(); });
  await expect(page.locator('hy-tour')).not.toHaveAttribute('open'); await expect(page.locator('#target')).toBeFocused();
  expect(await page.evaluate(() => reasons)).toEqual(['programmatic']);
  const attributeUpdate = await page.evaluate(() => {
    const tour = document.createElement('hy-tour'); tour.setAttribute('steps', '[{"title":"Again"}]');
    document.body.append(tour); tour.open = true; const wasOpen = tour.open; tour.setAttribute('steps', '[]');
    return { wasOpen, open: tour.open };
  });
  expect(attributeUpdate).toEqual({ wasOpen: true, open: false });
});

test('tooltip describes real controls in their tree scope and cleans up only its own metadata', async ({ page }) => {
  await page.evaluate(() => {
    const tip = document.createElement('hy-tooltip'); tip.label = 'Helpful'; tip.delay = 100;
    tip.innerHTML = '<span id="existing" hidden>Existing</span><button aria-describedby="existing">Native</button><hy-button>Shadow</hy-button>';
    document.body.append(tip);
  });
  const native = page.locator('hy-tooltip > button'), shadow = page.locator('hy-tooltip hy-button button');
  await expect(native).toHaveAccessibleDescription('Existing Helpful'); await expect(shadow).toHaveAccessibleDescription('Helpful');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await native.focus(); await native.press('Escape'); await page.waitForTimeout(140);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.locator('hy-tooltip').evaluate(el => { el.label = 'Updated'; });
  await expect(shadow).toHaveAccessibleDescription('Updated');
  await page.locator('hy-tooltip').evaluate(el => { el.setAttribute('disabled', ''); });
  await expect(native).toHaveAttribute('aria-describedby', 'existing'); await expect(shadow).not.toHaveAttribute('aria-describedby');
  await page.locator('hy-tooltip').evaluate(el => { el.removeAttribute('disabled'); }); await expect(shadow).toHaveAccessibleDescription('Updated');
  const cleanup = await page.evaluate(() => {
    const tip = document.querySelector('hy-tooltip'), button = tip.querySelector('button'); tip.remove();
    return { description: button.getAttribute('aria-describedby'), proxies: document.querySelectorAll('[id^="hy-tooltip-description-"]').length };
  });
  expect(cleanup).toEqual({ description: 'existing', proxies: 0 });
});

for (const cluster of ['😀', 'e\u0301', '👨‍👩‍👧‍👦', '🇨🇳']) {
  test(`virtual keyboard edits complete graphemes: ${cluster}`, async ({ page }) => {
    const result = await page.evaluate(async cluster => {
      const input = document.createElement('textarea'), keyboard = document.createElement('hy-virtual-keyboard'); document.body.append(input, keyboard); keyboard.target = input;
      input.value = `a${cluster}b`; input.setSelectionRange(1 + cluster.length, 1 + cluster.length);
      await keyboard.tap('ArrowLeft', { holdDuration: 0 }); const left = input.selectionStart;
      await keyboard.tap('Delete', { holdDuration: 0 }); const forward = input.value;
      input.value = `a${cluster}b`; input.setSelectionRange(1 + cluster.length, 1 + cluster.length);
      await keyboard.tap('Backspace', { holdDuration: 0 }); const backward = input.value;
      input.value = `a${cluster}b`; input.setSelectionRange(1, 1 + cluster.length);
      await keyboard.tap('ArrowRight', { holdDuration: 0 }); const collapsed = input.selectionStart;
      return { left, forward, backward, collapsed };
    }, cluster);
    expect(result).toEqual({ left: 1, forward: 'ab', backward: 'ab', collapsed: cluster.length + 1 });
  });
}

test('virtual keyboard safely handles unsupported target types and all disabled typing paths', async ({ page }) => {
  const result = await page.evaluate(async () => {
    const input = document.createElement('input'), keyboard = document.createElement('hy-virtual-keyboard'); document.body.append(input, keyboard); keyboard.target = input;
    for (const type of ['number', 'email', 'date']) { input.type = type; await keyboard.type('月😀', { interval: 0 }); await keyboard.tap('Backspace', { holdDuration: 0 }); keyboard.clear(); }
    input.type = 'text'; input.value = 'original'; let edits = 0; input.addEventListener('input', () => edits++);
    keyboard.disabled = true; await keyboard.type('月😀a', { interval: 0 }); keyboard.clear();
    keyboard.disabled = false; input.readOnly = true; await keyboard.type('月😀', { interval: 0 });
    return { value: input.value, edits };
  });
  expect(result).toEqual({ value: 'original', edits: 0 });
});
