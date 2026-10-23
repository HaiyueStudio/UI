import { test, expect } from '@playwright/test';

const open = async page => {
  await page.goto('/test/browser/carousel.html');
  await expect(page.locator('#carousel')).toHaveAttribute('index', '0');
};
const index = page => page.locator('#carousel');
const swipe = async (page, direction = 'horizontal') => {
  const box = await page.locator('#carousel').boundingBox();
  const vertical = direction === 'vertical';
  await page.mouse.move(box.x + (vertical ? 150 : 300), box.y + (vertical ? 190 : 90));
  await page.mouse.down();
  await page.mouse.move(box.x + (vertical ? 150 : 80), box.y + (vertical ? 40 : 90), { steps: 8 });
  await page.mouse.up();
};

test('explicit registration, empty constructor, inert inactive panels and composed change events', async ({ page }) => {
  await open(page);
  expect(await page.evaluate(() => window.registeredOnImport)).toBe(false);
  expect(await page.evaluate(() => document.createElement('hy-carousel').attributes.length)).toBe(0);
  await expect(index(page)).toHaveAttribute('role', 'region');
  await expect(index(page)).toHaveAttribute('aria-roledescription', 'carousel');
  await expect(page.locator('#b')).toHaveAttribute('inert', '');
  await expect(page.locator('#b')).toHaveAttribute('aria-hidden', 'true');
  await page.locator('#second-action').evaluate(button => button.focus());
  await expect(page.locator('#second-action')).not.toBeFocused();
  await page.locator('#action').focus();
  await index(page).evaluate(element => element.next());
  await expect(index(page).locator('.viewport')).toBeFocused();
  await expect(page.locator('#a')).toHaveAttribute('inert', '');
  await expect(page.locator('#b')).not.toHaveAttribute('inert');
  expect(await page.evaluate(() => window.changes.at(-1))).toEqual({ index: 1, previousIndex: 0, source: 'api' });
});

test('API and arrows wrap or clamp at both boundaries, including invalid configuration', async ({ page }) => {
  await open(page);
  await index(page).evaluate(element => element.previous());
  await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).getByRole('button', { name: 'Next slide', exact: true }).click();
  await expect(index(page)).toHaveAttribute('index', '0');
  await index(page).evaluate(element => { element.loop = false; element.previous(); });
  await expect(index(page)).toHaveAttribute('index', '0');
  await expect(index(page).getByRole('button', { name: 'Previous slide', exact: true })).toBeDisabled();
  await index(page).evaluate(element => element.goTo(99));
  await expect(index(page)).toHaveAttribute('index', '2');
  await expect(index(page).getByRole('button', { name: 'Next slide', exact: true })).toBeDisabled();
  const normalized = await index(page).evaluate(element => {
    element.index = NaN; element.interval = Infinity;
    element.setAttribute('autoplay', 'false'); element.autoplay = true;
    const enabled = element.autoplay; element.autoplay = false;
    return { index: element.index, interval: element.interval, enabled };
  });
  expect(normalized).toEqual({ index: 0, interval: 3000, enabled: true });
});

test('indicator presets, four positions, CSS parts and arbitrary content preserve native button behavior', async ({ page }) => {
  await open(page);
  for (const position of ['top', 'right', 'bottom', 'left']) {
    await index(page).evaluate((element, value) => { element.indicatorPosition = value; }, position);
    const boxes = await index(page).evaluate(element => ({ host: element.getBoundingClientRect().toJSON(), dots: element.shadowRoot.querySelector('.indicators').getBoundingClientRect().toJSON() }));
    if (position === 'top') expect(boxes.dots.top - boxes.host.top).toBe(12);
    if (position === 'bottom') expect(boxes.host.bottom - boxes.dots.bottom).toBe(12);
    if (position === 'left') expect(boxes.dots.left - boxes.host.left).toBe(12);
    if (position === 'right') expect(boxes.host.right - boxes.dots.right).toBe(12);
  }
  await index(page).evaluate(element => { element.indicatorStyle = 'number'; element.indicatorPosition = 'bottom'; });
  await expect(index(page).locator('.indicator-content')).toHaveText(['1', '2', '3']);
  await index(page).getByRole('button', { name: 'Go to slide 3', exact: true }).click();
  await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.indicatorStyle = 'line'; });
  expect(await index(page).locator('.indicator-content').first().evaluate(element => getComputedStyle(element).width)).toBe('24px');
  await page.addStyleTag({ content: '#carousel::part(indicator-active) { border: 2px solid rgb(255, 0, 0); }' });
  expect(await index(page).locator('[part~="indicator-active"]').evaluate(element => getComputedStyle(element).borderTopColor)).toBe('rgb(255, 0, 0)');
  await index(page).evaluate(element => { element.indicatorRenderer = (i, active) => `${active ? 'Current' : 'Page'} ${i + 1}`; });
  await expect(index(page).locator('.indicator-content')).toHaveText(['Page 1', 'Page 2', 'Current 3']);
  await index(page).getByRole('button', { name: 'Go to slide 1', exact: true }).click();
  await expect(index(page).locator('.indicator-content').first()).toHaveText('Current 1');
  await index(page).evaluate(element => { element.indicatorRenderer = () => '<b>Safe text</b>'; });
  await expect(index(page).locator('.indicator-content').first()).toHaveText('<b>Safe text</b>');
  expect(await index(page).locator('.indicator-content b').count()).toBe(0);
  await index(page).evaluate(element => { element.indicatorRenderer = i => { const span = document.createElement('em'); span.textContent = `Custom ${i}`; return span; }; });
  await expect(index(page).locator('.indicator-content em')).toHaveCount(3);
});

test('keyboard follows orientation and RTL, roves indicators, and preserves input editing keys', async ({ page }) => {
  await open(page);
  const viewport = index(page).locator('.viewport');
  await viewport.focus(); await page.keyboard.press('ArrowRight');
  await expect(index(page)).toHaveAttribute('index', '1');
  await page.keyboard.press('End'); await expect(index(page)).toHaveAttribute('index', '2');
  await page.keyboard.press('Home'); await expect(index(page)).toHaveAttribute('index', '0');
  await page.getByRole('textbox', { name: 'Caption' }).fill('abc');
  await page.keyboard.press('ArrowRight'); await expect(index(page)).toHaveAttribute('index', '0');
  const first = index(page).getByRole('button', { name: 'Go to slide 1', exact: true });
  await first.focus(); await page.keyboard.press('ArrowRight');
  await expect(index(page).getByRole('button', { name: 'Go to slide 2', exact: true })).toBeFocused();
  await index(page).evaluate(element => { element.direction = 'vertical'; });
  await viewport.focus(); await page.keyboard.press('ArrowDown'); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.direction = 'horizontal'; element.dir = 'rtl'; });
  await page.keyboard.press('ArrowRight'); await expect(index(page)).toHaveAttribute('index', '1');
});

test('dragging works in both directions, can be disabled, resists nonloop boundaries and excludes controls', async ({ page }) => {
  await open(page);
  await swipe(page); await expect(index(page)).toHaveAttribute('index', '1');
  expect(await page.evaluate(() => window.changes.at(-1).source)).toBe('drag');
  await index(page).evaluate(element => { element.direction = 'vertical'; });
  await swipe(page, 'vertical'); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.draggable = false; });
  await swipe(page, 'vertical'); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.draggable = true; element.loop = false; });
  await swipe(page, 'vertical'); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.goTo(0); element.direction = 'horizontal'; });
  const box = await page.locator('#action').boundingBox();
  await page.mouse.move(box.x + 5, box.y + 5); await page.mouse.down();
  await page.mouse.move(box.x + 220, box.y + 5, { steps: 5 }); await page.mouse.up();
  await expect(index(page)).toHaveAttribute('index', '0');
});

test('automatic rotation pauses on hover and focus, resumes explicitly and stops at the nonloop end', async ({ page }) => {
  await page.clock.install(); await open(page);
  await index(page).evaluate(element => { element.interval = 1000; element.autoplay = true; });
  await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '1');
  await index(page).hover(); await page.clock.fastForward(5000); await expect(index(page)).toHaveAttribute('index', '1');
  await page.mouse.move(900, 600); await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).locator('.viewport').focus(); await page.clock.fastForward(5000); await expect(index(page)).toHaveAttribute('index', '2');
  await expect(index(page).getByRole('button', { name: 'Start automatic slide rotation' })).toBeVisible();
  await index(page).evaluate(element => element.play()); await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '0');
  await index(page).evaluate(element => { element.loop = false; element.goTo(1); });
  await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '2');
  await page.clock.fastForward(5000); await expect(index(page)).toHaveAttribute('index', '2');
  await index(page).evaluate(element => { element.pause(); element.goTo(0); });
  await page.clock.fastForward(5000); await expect(index(page)).toHaveAttribute('index', '0');
});

test('reduced motion suppresses initial rotation and transitions while allowing explicit play', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' }); await page.clock.install(); await open(page);
  await index(page).evaluate(element => { element.autoplay = true; element.interval = 1000; });
  await page.clock.fastForward(5000); await expect(index(page)).toHaveAttribute('index', '0');
  await index(page).evaluate(element => element.play());
  await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '1');
  expect(await page.locator('#b').evaluate(element => element.getAnimations().length)).toBe(0);
});

test('the first pointer click pauses playback, and the start button resumes after hover ends', async ({ page }) => {
  await page.clock.install(); await open(page);
  await index(page).evaluate(element => { element.interval = 1000; element.autoplay = true; });
  await index(page).getByRole('button', { name: 'Pause automatic slide rotation' }).click();
  await expect(index(page).getByRole('button', { name: 'Start automatic slide rotation' })).toBeVisible();
  await page.mouse.move(900, 600); await page.clock.fastForward(3000); await expect(index(page)).toHaveAttribute('index', '0');
  await index(page).getByRole('button', { name: 'Start automatic slide rotation' }).click();
  await page.mouse.move(900, 600); await page.clock.fastForward(1000); await expect(index(page)).toHaveAttribute('index', '1');
});

test('touch swipes change panels and a cancelled gesture leaves no pending drag state', async ({ page }) => {
  await open(page);
  const cdp = await page.context().newCDPSession(page);
  const touch = (type, x) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: x == null ? [] : [{ x, y: 100, id: 1 }] });
  await touch('touchStart', 330);
  for (const x of [300, 260, 220, 180, 130, 90]) await touch('touchMove', x);
  await touch('touchEnd');
  await expect(index(page)).toHaveAttribute('index', '1');
  await touch('touchStart', 300); await touch('touchMove', 230); await touch('touchCancel');
  await expect(index(page)).toHaveAttribute('index', '1');
  await index(page).evaluate(element => { element.draggable = false; });
  await touch('touchStart', 330); await touch('touchMove', 90); await touch('touchEnd');
  await expect(index(page)).toHaveAttribute('index', '1');
  await cdp.detach();
});

test('wrap transitions have only incoming/outgoing panels and no clones, including rapid navigation', async ({ page }) => {
  await open(page);
  await index(page).evaluate(element => { element.goTo(2); element.style.setProperty('--hy-carousel-duration', '200ms'); element.next(); });
  await expect(index(page)).toHaveAttribute('index', '0');
  expect(await index(page).evaluate(element => element.children.length)).toBe(3);
  expect(await page.locator('#a').evaluate(element => element.getAnimations().length)).toBe(1);
  await expect.poll(() => page.locator('#c').evaluate(element => getComputedStyle(element).visibility)).toBe('hidden');
  await index(page).evaluate(element => { element.next(); element.next(); element.previous(); });
  await expect(index(page)).toHaveAttribute('index', '1');
  await expect.poll(() => page.locator('#a').evaluate(element => getComputedStyle(element).visibility)).toBe('hidden');
});

test('dynamic panel changes preserve active content, restore removed attributes and handle zero/one panel', async ({ page }) => {
  await open(page);
  await index(page).evaluate(element => { element.goTo(1); const panel = document.createElement('article'); panel.textContent = 'New'; element.prepend(panel); });
  await expect(index(page)).toHaveAttribute('index', '2');
  await page.locator('#b').evaluate(element => { window.removed = element; element.remove(); });
  expect(await page.evaluate(() => window.removed.hasAttribute('inert'))).toBe(false);
  await expect(index(page).locator('.indicator')).toHaveCount(3);
  expect(await page.evaluate(() => window.removed.hasAttribute('role'))).toBe(false);
  await index(page).evaluate(element => element.replaceChildren(element.querySelector('#a')));
  await expect(index(page)).toHaveAttribute('index', '0');
  await expect(index(page).locator('.indicators')).toBeHidden();
  await index(page).evaluate(element => element.replaceChildren());
  await expect(index(page).locator('.indicator')).toHaveCount(0);
  await index(page).evaluate(element => element.next());
  await expect(index(page)).toHaveAttribute('index', '0');
});

test('disconnect releases timers and drag state, restores authored attributes, and reconnects safely', async ({ page }) => {
  await page.clock.install(); await open(page);
  await index(page).evaluate(element => { element.autoplay = true; element.interval = 1000; window.detached = element; element.remove(); });
  await page.evaluate(() => { window.detached.pause(); window.detached.play(); });
  const count = await page.evaluate(() => window.changes.length);
  await page.clock.fastForward(5000);
  expect(await page.evaluate(() => window.changes.length)).toBe(count);
  expect(await page.evaluate(() => {
    const first = window.detached.firstElementChild;
    return { label: first.getAttribute('aria-label'), inert: first.hasAttribute('inert'), role: first.hasAttribute('role'), transform: first.style.getPropertyValue('--_hy-carousel-transform'), hostRole: window.detached.hasAttribute('role') };
  })).toEqual({ label: 'Alpha', inert: false, role: false, transform: '', hostRole: false });
  await page.evaluate(() => document.body.prepend(window.detached));
  await page.clock.fastForward(1000);
  await expect(index(page)).toHaveAttribute('index', '1');
});

test('gallery configures all requested features and keeps category and example order aligned', async ({ page }) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/examples/#carousel');
  const carousel = page.locator('#carousel-live');
  await page.locator('#carousel-direction').selectOption('vertical');
  await expect(carousel).toHaveJSProperty('direction', 'vertical');
  await page.locator('#carousel-style').selectOption('custom');
  await expect(carousel.locator('.indicator-content span')).toHaveCount(3);
  await page.locator('#carousel-position').selectOption('right');
  await expect(carousel).toHaveJSProperty('indicatorPosition', 'right');
  await page.locator('label:has(#carousel-draggable)').click(); await expect(carousel).toHaveJSProperty('draggable', false);
  await page.locator('label:has(#carousel-loop)').click(); await expect(carousel).toHaveJSProperty('loop', false);
  await page.locator('label:has(#carousel-autoplay)').click(); await expect(carousel).toHaveJSProperty('autoplay', true);
  await page.locator('#carousel-next').click(); await expect(carousel).toHaveAttribute('index', '1');
  await expect(page.locator('#carousel-event')).toContainText('"index":1');
  const links = await page.locator('#component-nav a').evaluateAll(links => links.map(link => link.hash.slice(1)));
  expect(links.slice(links.indexOf('breadcrumb'), links.indexOf('cascader') + 1)).toEqual(['breadcrumb', 'carousel', 'cascader']);
  expect(await page.locator('.component-section').evaluateAll(sections => sections.map(section => section.id))).toEqual(links);
  expect(errors).toEqual([]);
});
