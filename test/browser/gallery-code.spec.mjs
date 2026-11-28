import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/examples/'); });

async function openCode(page, section) {
  const details = page.locator(`${section} details.code`).first();
  const source = await details.locator('pre code').textContent();
  await details.locator('summary').click();
  await expect(details.locator('.cm-editor')).toBeVisible();
  return { details, source };
}

test('mixed HTML and setup JavaScript both receive highlighting without changing the source', async ({ page }) => {
  const { details, source } = await openCode(page, '#drag-source');
  await expect(details.locator('.code-editor-host')).toHaveAttribute('data-code-language', 'html-javascript');
  await expect(details.locator('.hy-code-tag').filter({ hasText: 'hy-drag-source' }).first()).toBeVisible();
  await expect(details.locator('.hy-code-keyword').filter({ hasText: /^const$/u }).first()).toBeVisible();
  await expect(details.locator('.hy-code-string').filter({ hasText: "'asset'" }).first()).toBeVisible();
  expect((await details.locator('.cm-line').allTextContents()).join('\n')).toBe(source);
  await details.locator('summary').click(); await details.locator('summary').click();
  await expect(details.locator('.cm-editor')).toHaveCount(1);
  const content = details.locator('.cm-content');
  await expect(details.locator('.cm-scroller')).toHaveCSS('font-family', /monospace/u);
  await expect(content).toHaveCSS('white-space', /pre|break-spaces/u);
  await expect(content).toHaveAttribute('aria-readonly', 'true');
  await content.focus(); await page.keyboard.press('x');
  expect((await details.locator('.cm-line').allTextContents()).join('\n')).toBe(source);
});

test('a JavaScript sample with an HTML + JavaScript label uses the JavaScript parser', async ({ page }) => {
  await page.locator('#masonry pre code').evaluate(element => { element.textContent = "import { defineMasonryComponents } from '@haiyue/ui/masonry';\nconst label = '<hy-button>';"; });
  const { details } = await openCode(page, '#masonry');
  await expect(details.locator('.code-editor-host')).toHaveAttribute('data-code-language', 'javascript');
  await expect(details.locator('.hy-code-keyword').filter({ hasText: /^import$/u })).toBeVisible();
  expect(await details.locator('.hy-code-string').count()).toBeGreaterThan(0);
});

test('JavaScript before HTML markup is highlighted as well as trailing setup code', async ({ page }) => {
  const { details } = await openCode(page, '#masonry');
  await expect(details.locator('.code-editor-host')).toHaveAttribute('data-code-language', 'html-javascript');
  await expect(details.locator('.hy-code-keyword').filter({ hasText: /^import$/u })).toBeVisible();
  expect(await details.locator('.hy-code-tag').filter({ hasText: 'hy-masonry' }).count()).toBeGreaterThan(0);
});

test('CSS skin variables and nested script/style content receive their own syntax colors', async ({ page }) => {
  const { details } = await openCode(page, '#design-tokens');
  await expect(details.locator('.code-editor-host')).toHaveAttribute('data-code-language', 'css');
  expect(await details.locator('.hy-code-property').count()).toBeGreaterThan(0);
  await expect(details.locator('.hy-code-property').filter({ hasText: /^--hy-accent-color$/u })).toHaveCount(1);
  expect(await details.locator('.hy-code-string').filter({ hasText: '#a44932' }).count()).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const { installCodeEditors } = await import('/examples/vendor/codemirror.js');
    const details = document.createElement('details'); details.className = 'code'; details.id = 'nested-code';
    const summary = document.createElement('summary'); const label = document.createElement('span'); label.textContent = 'HTML + JavaScript'; summary.append(label);
    const pre = document.createElement('pre'); const code = document.createElement('code');
    code.textContent = '<style>.card { color: red; }</style>\n<hy-button>Plain content</hy-button>\n<script>const total = 42;</script>\nconst active = true;';
    pre.append(code); details.append(summary, pre); document.querySelector('#design-tokens').append(details); installCodeEditors(details.parentElement);
  });
  const nested = page.locator('#nested-code'); await nested.locator('summary').click();
  await expect(nested.locator('.hy-code-property').filter({ hasText: /^color$/u })).toBeVisible();
  await expect(nested.locator('.hy-code-number').filter({ hasText: /^42$/u })).toBeVisible();
  await expect(nested.locator('.hy-code-keyword').filter({ hasText: /^const$/u })).toHaveCount(2);
});

test('syntax colors follow built-in and custom skins with readable contrast', async ({ page }) => {
  const { details } = await openCode(page, '#drag-source');
  await details.evaluate(element => { window.originalCodeEditor = element.querySelector('.cm-editor'); });
  const colors = [];
  for (const skin of ['dark', 'light', 'custom']) {
    await page.locator(`.theme-picker [data-theme="${skin}"]`).click();
    const result = await details.evaluate(element => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1; const context = canvas.getContext('2d');
      const rgb = value => { context.fillStyle = value; context.fillRect(0, 0, 1, 1); return [...context.getImageData(0, 0, 1, 1).data].slice(0, 3); };
      const luminance = values => values.map(value => value / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0);
      const keyword = getComputedStyle(element.querySelector('.hy-code-keyword')).color;
      const string = getComputedStyle(element.querySelector('.hy-code-string')).color;
      const background = getComputedStyle(element).backgroundColor;
      const foregroundLight = luminance(rgb(keyword)); const backgroundLight = luminance(rgb(background));
      return { keyword, string, contrast: (Math.max(foregroundLight, backgroundLight) + .05) / (Math.min(foregroundLight, backgroundLight) + .05), sameEditor: window.originalCodeEditor === element.querySelector('.cm-editor') };
    });
    expect(result.keyword).not.toBe(result.string); expect(result.contrast).toBeGreaterThanOrEqual(4.5); expect(result.sameEditor).toBe(true);
    colors.push(result.keyword);
    await details.screenshot({ path: `.artifacts/gallery-highlight-${skin}.png` });
  }
  expect(new Set(colors).size).toBe(3);
});

test('short snippets fit their contents and long code stays inside a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const short = await openCode(page, '#button');
  expect((await short.details.locator('.code-editor-host').boundingBox()).height).toBeLessThan(250);
  const long = await openCode(page, '#design-tokens');
  const scroller = long.details.locator('.cm-scroller');
  expect((await scroller.boundingBox()).height).toBeLessThanOrEqual(421);
  await expect.poll(() => scroller.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(await page.locator('#content').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await long.details.scrollIntoViewIfNeeded();
  await scroller.hover(); await page.mouse.wheel(0, 240);
  await expect.poll(() => scroller.evaluate(element => element.scrollTop)).toBeGreaterThan(0);
  await page.screenshot({ path: '.artifacts/gallery-highlight-mobile.png' });
});
