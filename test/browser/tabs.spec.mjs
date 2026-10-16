import { test, expect } from '@playwright/test';

test('tab content fills the available height and keeps scrolling inside the selected view', async ({ page }) => {
  await page.goto('/test/browser/tabs.html');
  for (const name of ['Graph', 'List', 'Graph']) {
    await page.getByRole('tab', { name, exact: true }).click();
    const view = page.getByRole('region', { name: `${name} viewport` });
    await expect(view).toBeVisible();
    const layout = await view.evaluate(element => {
      element.scrollTop = 120;
      element.scrollLeft = 100;
      const host = element.parentElement;
      const bounds = element.getBoundingClientRect();
      return { height: bounds.height, bottom: bounds.bottom, hostBottom: host.getBoundingClientRect().bottom,
        top: element.scrollTop, left: element.scrollLeft, panels: host.shadowRoot.querySelectorAll('[role="tabpanel"]:not([hidden])').length };
    });
    expect(layout.height).toBe(368);
    expect(layout.bottom).toBe(layout.hostBottom);
    expect(layout.top).toBe(120);
    expect(layout.left).toBe(100);
    expect(layout.panels).toBe(1);
  }
});
