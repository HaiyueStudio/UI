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
