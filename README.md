# @haiyue/ui

Dependency-free Web Components for HaiyueStudio products. Components own presentation and local interaction;
they do not depend on Engine, Editor, Games, or AIStudio state.

Public classes use the `HY` prefix and custom-element tags use `hy-`:

```html
<hy-button label="Publish"></hy-button>
<hy-tree allow-drag></hy-tree>
```

```bash
npm install @haiyue/ui
```

## Import only what a product uses

Each component has an isolated package subpath. Importing a subpath loads only that component and its direct
helpers, and registration stays explicit:

```ts
import { defineButtonComponents } from '@haiyue/ui/button';
import { defineTreeComponents } from '@haiyue/ui/tree';
import { defineVirtualListComponents } from '@haiyue/ui/virtual-list';

defineButtonComponents();
defineTreeComponents();
defineVirtualListComponents();
```

Component JavaScript does not register custom elements during module evaluation, and every component subpath
publishes matching JavaScript and type declarations. Only `themes/*.css` is marked as a package side effect so
bundlers retain an imported skin while excluding component JavaScript that is not reachable from selected imports.

The root entry remains available when an application intentionally wants every component:

```ts
import { defineHaiyueUI } from '@haiyue/ui';

defineHaiyueUI();
```

Because `defineHaiyueUI()` references the complete component set, prefer focused subpaths in bundle-sensitive
product entry points.

## Virtual list

`<hy-virtual-list>` renders only the visible fixed-height rows plus a configurable overscan buffer. The full
collection stays in the `items` property, while `renderItem` is called only for rows that currently need DOM:

```ts
import { defineVirtualListComponents } from '@haiyue/ui/virtual-list';

defineVirtualListComponents();
const list = document.querySelector('hy-virtual-list');
list.items = records;
list.itemHeight = 40;
list.overscan = 3;
list.renderItem = (record, index) => `${index + 1}. ${record.name}`;
list.scrollToIndex(50_000, 'center');
```

Use the `height` property (or `height` attribute) for the internal viewport. `visible-range-change` reports
exclusive `endIndex` / `visibleEndIndex` values, and `item-click` reports the source item and absolute index.
The scrollbar can be themed with inherited semantic tokens and `--hy-virtual-list-scrollbar-size`.

## Drawer

Import and register the drawer independently when a product needs an off-canvas panel:

```ts
import { defineDrawerComponents } from '@haiyue/ui/drawer';

defineDrawerComponents();
```

`<hy-drawer>` supports `top`, `right`, `bottom`, and `left` placement. The mask defaults to enabled; set
`mask="false"` or `drawer.mask = false` to keep the underlying page visible and interactive. Escape, the close
button, and mask clicks close the drawer and emit `drawer-close` with an `action`, `mask`, `escape`, or
`programmatic` reason. With `destroy-on-hidden`, slotted children are unmounted after the exit transition and
restored when the drawer opens again, allowing nested custom elements to run their disconnect/connect cleanup.

## Notification

`<hy-notification>` is an imperative notification center with isolated package entry `@haiyue/ui/notification`:

```ts
import { defineNotificationComponents } from '@haiyue/ui/notification';

defineNotificationComponents();
const center = document.querySelector('hy-notification');
center.success({
  message: 'Export complete',
  description: 'The project package is ready.',
  placement: 'topRight',
  duration: 4,
  showProgress: true,
});
```

Types are `success`, `info`, `warning`, and `error`. Placements are `topLeft`, `top`, `topRight`, `bottomLeft`,
`bottom`, and `bottomRight`. Each notice may override the host defaults for placement, duration in seconds, and
progress visibility; duration `0` disables automatic closing. Notices at the same placement form a perspective
stack and expand on hover or keyboard focus. Use `close(key)` for one notice or `destroy()` for all notices.

## Border beam

`<hy-border-beam>` wraps arbitrary content with an animated SVG beam that stays aligned to the element's live
rounded border. Import it from `@haiyue/ui/border-beam` and register it explicitly:

```ts
import { defineBorderBeamComponents } from '@haiyue/ui/border-beam';

defineBorderBeamComponents();
```

Use `thickness` for stroke width, `color` for any valid CSS color, and `count` for 1–12 evenly phased beams.
`speed` is a multiplier: `1` completes the default loop in six seconds, while `2` runs twice as fast. The
component observes its own size and keeps the SVG view box and corner radius synchronized automatically.
Consumers may override `--hy-border-beam-radius` and `--hy-border-beam-track-color`.

## Themes

Two optional CSS theme entries are provided. Import only the skin a product needs, or import both when the
product offers runtime switching:

```ts
import '@haiyue/ui/themes/light.css';
import '@haiyue/ui/themes/dark.css';
```

Apply a theme to the document or to a component subtree. Tokens inherit through component shadow roots:

```html
<html data-hy-theme="light">…</html>
<section data-hy-theme="dark">…</section>
```

- `light` / Haiyue Moonlight: moon white, pale ice blue, cyan and a soft violet highlight.
- `dark` / Haiyue Nightfall: deep navy, blue violet, cool white and a restrained gold highlight.

All theme tokens use the `--hy-` prefix and may be overridden by consuming products.

## Component examples

Run the interactive component gallery locally:

```bash
npm run examples
```

Then open <http://localhost:4173/>. The gallery provides a left-side component index and live examples for
every exported component, including editable parameters and event output.
