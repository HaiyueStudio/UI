import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/test/browser/collapse.html'); });

test('supports multiple expanded panels and emits composed state details', async ({ page }) => {
  const collapse = page.locator('#collapse'); const triggers = collapse.getByRole('button'); const regions = collapse.getByRole('region');
  await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true'); await expect(regions.nth(0)).toBeVisible();
  await triggers.nth(1).click(); await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'true'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await expect(collapse).toHaveAttribute('active-keys', '["scene","assets"]'); await expect(page.locator('#events')).toContainText('"changedKey":"assets"');
  await expect(triggers.nth(2)).toBeDisabled();
});

test('accordion and icon-only modes keep native keyboard disclosure semantics', async ({ page }) => {
  const collapse = page.locator('#collapse'); const triggers = collapse.getByRole('button');
  await collapse.evaluate(element => { element.accordion = true; element.activeKeys = ['scene']; });
  await triggers.nth(1).focus(); await page.keyboard.press('Enter'); await expect(triggers.nth(0)).toHaveAttribute('aria-expanded', 'false'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await collapse.evaluate(element => { element.collapsible = 'icon'; }); await triggers.nth(1).click({ position: { x: 100, y: 20 } }); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
  await triggers.nth(1).focus(); await page.keyboard.press('Enter'); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'false');
  await collapse.locator('[part="arrow"]').nth(1).click(); await expect(triggers.nth(1)).toHaveAttribute('aria-expanded', 'true');
});

test('destroy-on-hidden removes inactive body content', async ({ page }) => {
  const collapse = page.locator('#collapse'); await collapse.evaluate(element => { element.destroyOnHidden = true; });
  const first = collapse.getByRole('button').nth(0); await first.click();
  await expect(collapse.locator('[part="body"]').nth(0)).toBeEmpty(); await first.click(); await expect(collapse.locator('[part="body"]').nth(0)).toContainText('Camera');
});

test('component gallery demonstrates accordion and appearance controls', async ({ page }) => {
  await page.goto('/examples/#collapse'); const collapse = page.locator('#collapse-live');
  await collapse.getByRole('button').nth(1).click(); await expect(page.locator('#collapse-state')).toContainText('assets');
  await page.locator('#collapse-accordion').evaluate(input => { input.checked = true; input.dispatchEvent(new Event('change', { bubbles: true })); });
  await collapse.getByRole('button').nth(2).click(); await expect(collapse.getByRole('button').nth(1)).toHaveAttribute('aria-expanded', 'false');
  await expect(collapse.getByRole('button').nth(2)).toHaveAttribute('aria-expanded', 'true');
});

test('opt-in height animations open and close with immediate accessibility state and configurable duration', async ({ page }) => {
  const collapse = page.locator('#collapse');
  expect(await collapse.evaluate(element => element.animated)).toBe(false);
  const opening = await collapse.evaluate(element => {
    element.animated = true; element.animationDuration = 400; element.toggle('assets', true);
    const region = element.shadowRoot.querySelectorAll('.region')[1];
    const animation = region.getAnimations()[0]; animation.pause(); animation.currentTime = 200;
    const frames = animation.effect.getKeyframes();
    return { duration: animation.effect.getTiming().duration, start: frames[0].height, end: parseFloat(frames[1].height), height: region.getBoundingClientRect().height, expanded: element.shadowRoot.querySelectorAll('.trigger')[1].getAttribute('aria-expanded'), hidden: region.hidden };
  });
  expect(opening.duration).toBe(400); expect(opening.start).toBe('0px');
  expect(opening.height).toBeGreaterThan(0); expect(opening.height).toBeLessThan(opening.end);
  expect(opening.expanded).toBe('true'); expect(opening.hidden).toBe(false);
  await collapse.evaluate(async element => {
    const region = element.shadowRoot.querySelectorAll('.region')[1];
    const animation = region.getAnimations()[0]; animation.finish(); await animation.finished; await Promise.resolve();
  });
  const closing = await collapse.evaluate(element => {
    const region = element.shadowRoot.querySelectorAll('.region')[1];
    const input = document.createElement('input'); region.querySelector('.body').append(input); input.focus();
    element.toggle('assets', false);
    const animation = region.getAnimations()[0]; animation.pause(); animation.currentTime = 200;
    return { hidden: region.hidden, inert: region.inert, aria: region.getAttribute('aria-hidden'), focused: element.shadowRoot.activeElement === element.shadowRoot.querySelectorAll('.trigger')[1], height: region.getBoundingClientRect().height };
  });
  expect(closing.hidden).toBe(false); expect(closing.inert).toBe(true); expect(closing.aria).toBe('true'); expect(closing.focused).toBe(true); expect(closing.height).toBeGreaterThan(0);
  await collapse.evaluate(async element => {
    const animation = element.shadowRoot.querySelectorAll('.region')[1].getAnimations()[0]; animation.finish(); await animation.finished;
  });
  await expect(collapse.locator('.region').nth(1)).toHaveAttribute('hidden');
  expect(await collapse.locator('.region').nth(1).evaluate(region => ({ height: region.style.height, overflow: region.style.overflow }))).toEqual({ height: '', overflow: '' });
});

test('rapid reversal preserves content and destroy-on-hidden waits for the final closing animation', async ({ page }) => {
  const collapse = page.locator('#collapse');
  const result = await collapse.evaluate(element => {
    element.items = [{ key: 'input', title: 'Editable', content: () => { const input = document.createElement('input'); input.value = 'Initial'; return input; } }];
    element.activeKeys = ['input']; element.animated = true; element.animationDuration = 1000; element.destroyOnHidden = true;
    const region = element.shadowRoot.querySelector('.region'); const input = region.querySelector('input'); input.value = 'Preserved';
    element.toggle('input', false);
    const closing = region.getAnimations()[0]; closing.pause(); closing.currentTime = 500;
    const partial = parseFloat(getComputedStyle(region).height);
    const duringClose = region.contains(input);
    element.toggle('input', true);
    const opening = region.getAnimations()[0]; opening.pause();
    return { partial, from: parseFloat(opening.effect.getKeyframes()[0].height), duringClose, sameInput: region.querySelector('input') === input, value: input.value };
  });
  expect(result.duringClose).toBe(true); expect(result.sameInput).toBe(true); expect(result.value).toBe('Preserved');
  expect(result.from).toBeCloseTo(result.partial, 1);
  await collapse.evaluate(async element => {
    const region = element.shadowRoot.querySelector('.region');
    element.toggle('input', false); const animation = region.getAnimations()[0]; animation.finish(); await animation.finished;
  });
  await expect(collapse.locator('.body')).toBeEmpty();
  await collapse.evaluate(element => element.toggle('input', true));
  await expect(collapse.locator('input')).toHaveValue('Initial');
});

test('zero duration, disabled animation and reduced motion settle without stale transitions', async ({ page }) => {
  const collapse = page.locator('#collapse');
  const duration = await collapse.evaluate(element => {
    element.animated = true; element.style.setProperty('--hy-collapse-animation-duration', '0.5s');
    element.toggle('assets', true);
    return element.shadowRoot.querySelectorAll('.region')[1].getAnimations()[0].effect.getTiming().duration;
  });
  expect(duration).toBe(500);
  await collapse.evaluate(element => { element.animated = false; });
  expect(await collapse.locator('.region').nth(1).evaluate(region => region.getAnimations().length)).toBe(0);
  await collapse.evaluate(element => { element.animated = true; element.animationDuration = 0; element.toggle('assets', false); });
  await expect(collapse.locator('.region').nth(1)).toHaveAttribute('hidden');
  await collapse.evaluate(element => { element.animationDuration = 1000; element.toggle('assets', true); });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(() => collapse.locator('.region').nth(1).evaluate(region => region.getAnimations().length)).toBe(0);
  await collapse.evaluate(element => element.toggle('assets', false));
  await expect(collapse.locator('.region').nth(1)).toHaveAttribute('hidden');
  const invalid = await collapse.evaluate(element => { element.animationDuration = NaN; return element.animationDuration; });
  expect(invalid).toBe(200);
});

test('content growth retargets an expanding panel, and completion restores natural sizing', async ({ page }) => {
  const collapse = page.locator('#collapse');
  const original = await collapse.evaluate(element => {
    element.animated = true; element.animationDuration = 1000; element.toggle('assets', true);
    const region = element.shadowRoot.querySelectorAll('.region')[1]; const animation = region.getAnimations()[0]; animation.pause(); animation.currentTime = 200;
    const original = parseFloat(animation.effect.getKeyframes()[1].height);
    const content = document.createElement('div'); content.style.height = '200px'; region.querySelector('.body').append(content);
    return original;
  });
  await expect.poll(() => collapse.locator('.region').nth(1).evaluate(region => parseFloat(region.getAnimations()[0]?.effect.getKeyframes()[1].height ?? '0'))).toBeGreaterThan(original + 190);
  await collapse.evaluate(async element => {
    const animation = element.shadowRoot.querySelectorAll('.region')[1].getAnimations()[0]; animation.finish(); await animation.finished;
  });
  const sizes = await collapse.locator('.region').nth(1).evaluate(region => {
    const before = region.offsetHeight; const content = document.createElement('div'); content.style.height = '50px'; region.querySelector('.body').append(content);
    return { before, after: region.offsetHeight, inline: region.style.height };
  });
  expect(sizes.after - sizes.before).toBe(50); expect(sizes.inline).toBe('');
});

test('disconnect and item replacement cancel outstanding animations; reconnect has no initial transition', async ({ page }) => {
  const result = await page.locator('#collapse').evaluate(element => {
    element.animated = true; element.animationDuration = 1000; element.toggle('assets', true);
    const first = element.shadowRoot.querySelectorAll('.region')[1];
    element.items = [{ key: 'assets', title: 'Replacement', content: 'Replaced content' }];
    const cancelledOnReplace = first.getAnimations().length;
    element.toggle('assets', false); const region = element.shadowRoot.querySelector('.region');
    element.remove(); const cancelledOnDisconnect = region.getAnimations().length;
    document.body.append(element);
    return { cancelledOnReplace, cancelledOnDisconnect, animations: element.shadowRoot.querySelector('.region').getAnimations().length };
  });
  expect(result).toEqual({ cancelledOnReplace: 0, cancelledOnDisconnect: 0, animations: 0 });
});

test('gallery exposes animation toggle and duration controls', async ({ page }) => {
  await page.goto('/examples/#collapse'); const collapse = page.locator('#collapse-live');
  await expect(collapse).toHaveJSProperty('animated', true);
  await page.locator('#collapse-animation-duration').fill('600'); await page.locator('#collapse-animation-duration').press('Tab');
  await expect(collapse).toHaveJSProperty('animationDuration', 600);
  await page.locator('label:has(#collapse-animated)').click();
  await expect(collapse).toHaveJSProperty('animated', false);
  await collapse.getByRole('button').nth(0).click();
  await expect(collapse.locator('.region').nth(0)).toHaveAttribute('hidden');
});
