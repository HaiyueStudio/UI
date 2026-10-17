# @haiyue/ui

Dependency-free Web Components for HaiyueStudio products. Components own presentation and local interaction;
they do not depend on Engine, Editor, Games, or AIStudio state.

**Online component gallery:** <https://haiyuestudio.github.io/UI/>

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

## Portable component semantics (M24 G03/G05, unreleased)

`@haiyue/ui/core` provides platform-independent component types, validation, selection/input/action
controllers and the `PlatformView` lifetime contract. `@haiyue/ui/portable` provides `HYPage`, selector
bindings, keyed updates, transactions, focus/modal policy and semantic theme conversion. Both entries
can be imported without DOM, NativeScript or Engine. They do not register existing Web Components.

```ts
import { hyNode, hyKey, type HYRenderer } from '@haiyue/ui/core';
import { HYPage } from '@haiyue/ui/portable';

export function mountPage(renderer: HYRenderer) {
  const page = new HYPage(renderer);
  page.mount(hyNode('Column', 'settings', { layout: { gap: 8 } }, {
    children: [hyNode('Text', 'title', { text: 'Settings' })],
  }));
  page.setProps(hyKey('settings', 'title'), 'Text', { text: 'Preview settings' });
  return page; // The shell forwards suspend/resume and calls dispose on exit.
}
```

Author keys are stable and unique within each parent, including its named slots. `hyKey()` builds
scoped keys for bindings, events and focus. `setProps()` completely replaces a node's props; use
`transaction()` for one synchronous batch. Group all selectors for a given store in one `bind(store,
bindings)` call so an application transaction produces one renderer commit. Identical props produce
no writes; reordering preserves instances. Applications persist values on `commit`, not `valueChange`.

The Web backend is available from `@haiyue/ui/adapters/web`: explicitly call
`definePortableWebComponents()`, construct `new HYWebRenderer(connectedElement, options)`, then pass it
to `HYPage`. It reuses seven existing Web Components and maps the other semantic kinds to browser
elements. It introduces no runtime package dependencies or automatic registration. See the
[Web adapter guide](docs/web-adapter.md) and [interactive example](examples/portable-ui/index.html).
Run `npm run test:web-adapter` for Chromium/WebKit regression coverage.

These APIs are under development and have not been published. Mobile mapping is G06, desktop mapping
G08, and ShaderLab shared-page migration G07. Existing Web component APIs below remain independent. See the
[portable UI guide](docs/portable-ui.md) and [typed composition example](test/portable/fixtures/settings-page.ts).
Run `npm run verify:portable` for semantics, no-DOM types, and an isolated offline tarball consumer.

## Tabs

`@haiyue/ui/tabs` retains its existing `HYTabs`, `HYTabOption`, `HYTabChangeDetail`, and
`defineTabsComponents` exports; the 0.1.3 fix adds no new public exports. Assign `options`
and `value`, provide children with matching `slot` names, and listen for `tab-change`.
Property-assigned options and the selected value survive reconnection. Set `aria-label`
to name the tablist. Arrow keys, Home and End both move focus and activate the next
enabled tab with roving focus; the active tab labels its panel within the component's
shadow tree. The generated `aria-controls` and tabpanel ids are per-instance opaque
values and should not be treated as stable application selectors.

The existing `@haiyue/ui/border-beam` exports are also unchanged. Its constructor only
builds shadow content; host appearance is applied after creation, avoiding browser
custom-element construction errors during repeated `document.createElement` calls.

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

## Breadcrumb

Import and register breadcrumb navigation independently:

```ts
import { defineBreadcrumbComponents } from '@haiyue/ui/breadcrumb';

defineBreadcrumbComponents();
const breadcrumb = document.querySelector('hy-breadcrumb');
breadcrumb.items = [
  { key: 'projects', title: 'Projects', href: '/projects' },
  { key: 'scene', title: 'Ocean World' },
  { key: 'lighting', title: 'Lighting' },
];
breadcrumb.separator = '›';
```

Item text may use the Ant Design-compatible `title` field or its `label` alias. The final item is exposed as
the current page with `aria-current="page"`. Earlier items render as links when
they provide `href`, or as action buttons otherwise; disabled items remain readable but cannot be activated.
Listen for the composed, cancelable `breadcrumb-click` event to handle actions or prevent link navigation.
Use `renderItem` for custom item content, and `ariaLabel` when rendered content needs an explicit accessible
name. Styling hooks include the `nav`, `list`, `item`, `link`, `button`, `current`, `disabled`, and `separator`
shadow parts plus the `--hy-breadcrumb-*` CSS variables.

## Cascader

Use the focused `@haiyue/ui/cascader` entry for hierarchical selection:

```ts
import { defineCascaderComponents } from '@haiyue/ui/cascader';

defineCascaderComponents();
const cascader = document.querySelector('hy-cascader');
cascader.options = [
  { label: 'Project', value: 'project', children: [
    { label: 'Scenes', value: 'scenes', children: [
      { label: 'Moon Temple', value: 'temple' },
    ] },
  ] },
];
cascader.value = ['project', 'scenes', 'temple'];
```

Selecting a leaf commits the complete value path and emits `value-change` with both values and resolved option
objects. Enable `changeOnSelect` (or `change-on-select`) when parent paths should also be committed. The component
supports string and number values, disabled options, clearing, a custom `displaySeparator`, controlled `open`
state, outside-pointer and Escape closing, and arrow/Home/End keyboard navigation. `open-change` reports panel
visibility. Shadow parts expose `control`, `trigger`, `label`, `arrow`, `clear`, `panel`, `column`, `option`,
`option-item`, and `empty` for product-specific styling.

## Date and time pickers

Date and time selection remain independently importable, so an application only ships the picker it uses:

```ts
import { defineDatePickerComponents } from '@haiyue/ui/date-picker';
import { defineTimePickerComponents } from '@haiyue/ui/time-picker';

defineDatePickerComponents();
defineTimePickerComponents();
```

`<hy-date-picker>` emits ISO `YYYY-MM-DD` values and provides a locale-aware month calendar, `min` / `max`
constraints, Monday or Sunday `weekStart`, Today, clearing, outside-pointer and Escape closing, and arrow,
Home/End, and PageUp/PageDown keyboard navigation.

`<hy-time-picker>` emits 24-hour `HH:mm` or `HH:mm:ss` values. Enable `showSeconds`, configure
`minuteStep` / `secondStep`, and constrain selection with `min` / `max`. Its scrollable hour, minute, and second
columns support keyboard traversal, Now, explicit confirmation, clearing, and controlled `open` state. Both
components emit composed `value-change` and `open-change` events and expose their controls through shadow parts.

## Skeleton

Import the loading placeholder independently and place the real content in its default slot:

```ts
import { defineSkeletonComponents } from '@haiyue/ui/skeleton';

defineSkeletonComponents();
```

`<hy-skeleton>` defaults to a title and three paragraph rows. Enable `active` for the shimmer animation, add
`avatar`, choose `avatarShape`, `avatarSize`, `size`, and `round`, or tune `rows`, `titleWidth`, and the
`paragraphWidths` property. Set `loading = false` to remove placeholder DOM and reveal the slotted content.
The host exposes `aria-busy`, honors reduced-motion preferences, inherits both Haiyue themes, and provides
`placeholder`, `content`, `avatar`, `body`, `title`, `paragraph`, and `row` shadow parts.

## Steps

Use `@haiyue/ui/steps` to show task, form, or publishing progress. Assign `items` with a required `title` and
optional `description`, `subtitle`, `icon`, `status`, and `disabled` state. `current` is zero-based and derives
`finish`, `process`, and `wait` states automatically unless an item provides an explicit status. Set
`direction` to `horizontal` or `vertical`, use `size="small"` for compact layouts, and enable `clickable` when
users may navigate between steps. Click navigation updates `current` and emits the composed `step-change` event.
The ordered list exposes `aria-current="step"` and shadow parts for every structural and status element.

## Badge

Import `@haiyue/ui/badge` to decorate slotted content with a count or notification dot, or to render a standalone
semantic status. Numeric counts are capped by `overflowCount` (99 by default); use `showZero`, `dot`, `size`,
`color`, `title`, and the `[x, y]` `offset` property for display control. The `default`, `success`, `processing`,
`warning`, and `error` statuses accept accompanying `text`, expose status semantics, and honor reduced-motion
preferences. Structural styling hooks include `wrapper`, `badge`, `badge-content`, `status`, `status-dot`, and
`status-text` shadow parts.

## Collapse

Import `@haiyue/ui/collapse` and assign typed `items` containing `key`, `title`, optional `content`, `extra`,
`disabled`, and `showArrow` values. `activeKeys` supports multiple open panels, while `accordion` limits the
group to one. Configure `iconPosition`, `collapsible`, `bordered`, `ghost`, and `destroyOnHidden`; call
`toggle(key, expanded?)` for imperative control. Each header is a native keyboard-accessible button connected
to a labelled region, and user changes emit the composed `collapse-change` event with the active keys and
changed panel. The component exposes structural shadow parts from `collapse` and `panel` through `body`.

## Affix

Import `@haiyue/ui/affix` to pin actions, navigation, or status content after it crosses a viewport threshold.
Use the `offset-top` or `offset-bottom` attributes, or the `topOffset` / `bottomOffset` properties, and assign an
element to `target` when the scroll container is not the browser window. The component preserves the original
layout with an internal placeholder, exposes the read-only `affixed` state, and emits the composed
`affix-change` event. Call `refresh()` after layout changes that do not trigger resize observation.

## Tour

Import `@haiyue/ui/tour` for step-by-step product guidance. Assign `steps` with a title, optional description,
target selector, element, or resolver function, and an optional `top`, `right`, `bottom`, `left`, or `center`
placement. The component can render a spotlight mask, scroll targets into view, close from Escape or mask
interaction, and is controlled through `open` and zero-based `current`. Use `start()`, `next()`, `previous()`,
and `close()` from application code; observe `tour-change`, `tour-close`, `tour-finish`, and `tour-open-change`
for lifecycle state. Focus returns to the launch control when the tour ends.

## Divider

Import `@haiyue/ui/divider` for semantic horizontal or vertical separators. Text can be supplied through the
default slot or the `label` property. Choose `solid`, `dashed`, `dotted`, or `double` with `lineStyle`, and place
text at `start`, `center`, or `end` with `textPlacement`. `thickness`, `color`, and `spacing` provide direct
appearance controls, while the `divider`, `line`, `line-before`, `line-after`, `text`, and `fallback` shadow
parts support product-specific styling. The internal separator exposes the correct `aria-orientation`.

## Timeline

Use `@haiyue/ui/timeline` for ordered activity, history, and process displays. Assign typed `items` containing
`title`, optional `label` and `description`, semantic `status`, custom `color` or `dot`, and an optional per-item
`position`. The `left`, `right`, and `alternate` modes control placement; `reverse` flips the order and moves an
optional `pending` node to the leading edge. `renderItem` and `renderDot` provide DOM customization without
changing the data contract. The ordered list automatically collapses to a readable single-column layout on
narrow screens and its pending animation honors reduced-motion preferences.

## Rate

Import and register the star rating independently:

```ts
import { defineRateComponents } from '@haiyue/ui/rate';

defineRateComponents();
```

`<hy-rate>` exposes a controlled numeric `value` and defaults to five stars. Add `allow-half` (or set
`allowHalf = true`) for 0.5 increments. Configure `count`, `allowClear`, `character`, and `tooltips`, or set
`disabled` / `readOnly` for non-editable states. The component exposes slider semantics, arrow/Home/End keyboard
control, `value-change` and `hover-change` composed events, plus `group`, `star`, and `fill` shadow parts.

## Watermark

Wrap any content and render a non-interactive repeated text or image mark above it:

```ts
import { defineWatermarkComponents } from '@haiyue/ui/watermark';

defineWatermarkComponents();
const watermark = document.querySelector('hy-watermark');
watermark.content = ['HAIYUE', 'INTERNAL'];
```

Use `content` for one or more text lines, or set `image` to prefer an image mark. Geometry is controlled by
`rotate`, `gapX`, `gapY`, `offsetX`, `offsetY`, `markWidth`, and `markHeight`; typography and appearance use
`fontSize`, `fontFamily`, `fontWeight`, `color`, `opacity`, and `zIndex`. The SVG pattern lives inside the
component shadow root, is hidden from assistive technology, and uses `pointer-events: none`, so links, buttons,
and other slotted content remain interactive. Shadow parts expose `content`, `overlay`, `mark`, `text`, and
`image` for targeted styling.

## Table

Import the data table from its focused entry. It applies local filters first, then stable sorting, and finally
pagination, so only the current page is rendered as rows:

```ts
import { defineTableComponents } from '@haiyue/ui/table';

defineTableComponents();
const table = document.querySelector('hy-table');
table.columns = [
  { key: 'name', title: 'Name', sortable: true, filterable: true },
  { key: 'role', title: 'Role', filterOptions: roles },
  { key: 'score', title: 'Score', sortable: true, align: 'right' },
];
table.dataSource = records;
table.pageSize = 20;
```

Use `page`, `pageSize`, `pageSizeOptions`, and `pagination` for paging; `filters`, `setFilter()`, and
`clearFilters()` for filtering; and `sort`, `sortBy()`, and `clearSort()` for ordering. Columns may provide a
custom `filter`, `sorter`, or `render` function. `table-change` reports the complete processed state after a
user or API change, while `row-click` returns the source record and its original absolute index. The `empty`
slot, semantic theme tokens, and exported shadow parts support content and visual customization.

Filterable columns show a funnel control beside the title. Set `table.showFilters = false` or
`show-filters="false"` to hide all filter controls while keeping programmatic filtering active. Set
`showFilter: false` on an individual column to hide only that column's funnel. The filter menu, trigger, panel,
input, and clear action are exposed through the `filter-menu`, `filter-trigger`, `filter-panel`, `filter`, and
`filter-clear` shadow parts.

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

## Range

Import the slider independently and opt into two-handle interval mode with the `range` attribute:

```ts
import { defineRangeComponents } from '@haiyue/ui/range';

defineRangeComponents();
const interval = document.querySelector('hy-range[range]');
interval.values = [20, 80];
interval.addEventListener('value-change', event => console.log(event.detail.value));
```

Single-value mode uses `value`; interval mode exposes `lowerValue`, `upperValue`, and `values`. Both modes honor
`min`, `max`, and `step`, and support pointer dragging, track clicks, arrows, Page Up/Down, Home, and End. Use
`--hy-range-handle-*`, `--hy-range-rail-*`, and `--hy-range-track-*` tokens for styling, or target the exported
`rail`, `track`, `handle`, `handle-lower`, and `handle-upper` shadow parts. `value-input` reports live movement and
`value-change` reports a committed pointer or keyboard change.

## Virtual mouse

Import the fixed-position cursor visual independently. It never intercepts pointer input or synthesizes clicks on
page elements; host applications receive composed events and decide how actions map to product behavior:

```ts
import { defineVirtualMouseComponents } from '@haiyue/ui/virtual-mouse';

defineVirtualMouseComponents();
const mouse = document.querySelector('hy-virtual-mouse');
mouse.images = {
  idle: '/cursor-idle.png',
  'left-down': '/cursor-left.png',
  'right-down': '/cursor-right.png',
};
mouse.show();
await mouse.moveTo(420, 280, { animate: true, duration: 600 });
await mouse.leftClick();
await mouse.rightClick();
```

Use `moveTo()` / `moveBy()` for coordinates, `press()` / `release()` for held-button states, and
`leftClick()` / `middleClick()` / `rightClick()` for timed click feedback. `animated`, `duration`, and `easing`
provide host defaults; every move may override them. State images may also be supplied through `idle-image`,
`left-down-image`, `middle-down-image`, and `right-down-image`. Style the exported `cursor`, `shape`, `image`,
and `indicator` parts or the `--hy-virtual-mouse-*` CSS variables. Events include `virtual-mouse-move-start`,
`virtual-mouse-move`, `virtual-mouse-move-end`, `virtual-mouse-down`, `virtual-mouse-up`, and
`virtual-mouse-click`.

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

Browse the published gallery at <https://haiyuestudio.github.io/UI/>.

Run the interactive component gallery locally:

```bash
npm run examples
```

Then open <http://localhost:4173/>. The gallery provides a left-side component index and live examples for
every exported component, including editable parameters and event output.

## Expandable container

Explicit export: `@haiyue/ui/expandable` → `HYExpandable`, `defineExpandableComponents`,
`HYExpandableButtonPosition`, `HYExpandableChangeDetail`. Also included in `defineHaiyueUI()`.

```html
<hy-expandable expanded-width="1200px" expanded-height="90dvh"
  button-position="top-right" expand-label="放大" restore-label="还原">
  <div>Your graph, editor, or other stateful content</div>
  <!-- Optional SVG elements: slot="expand-icon" / slot="restore-icon" -->
</hy-expandable>
```

`expanded` is a reflected boolean attribute/property; `toggle()` switches it.
`expandedWidth` / `expandedHeight` accept CSS lengths (defaults `90vw` / `90dvh`).
Sizes are clamped to the viewport with a margin; the normal size belongs to the host's layout/CSS.
`buttonPosition` supports `top-right`, `top-left`, `bottom-right`, `bottom-left`.
`expanded-change` bubbles with `{ expanded: boolean }`. `expand-icon` / `restore-icon` slots
replace the built-in SVG icons without accepting HTML strings. Labels also become tooltips.
Style through inherited `--hy-surface-color`, `--hy-border-color`, `--hy-text-color`,
`--hy-accent-color` and `--hy-expandable-{margin,padding,radius,shadow,button-size,button-offset}`;
`panel` and `toggle` are CSS parts.

Requires a browser supporting the Popover API. Expansion is non-modal and uses a fixed top-layer
panel so transformed/overflow ancestors cannot clip it. The same slotted DOM stays mounted;
normal-flow height is preserved while expanded. Keyboard activation uses the native button;
Escape restores the focused container. Disconnect closes the panel and releases event listeners.

## Independent release checks

UI releases independently of Engine.

```bash
npm ci
npx playwright install chromium
npm run release:check
```

Candidates: `.artifacts/packages/`. Review API changes before `npm run api:update`.
See [release review](review/release-0.1.2.md).
