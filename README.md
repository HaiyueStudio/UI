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
import { defineButtonGroupComponents } from '@haiyue/ui/button-group';
import { defineTreeComponents } from '@haiyue/ui/tree';
import { defineVirtualListComponents } from '@haiyue/ui/virtual-list';

defineButtonComponents();
defineButtonGroupComponents();
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

## Tag and toast

Tags provide compact semantic labels with optional checked and close interactions. Toasts are an imperative,
lightweight feedback surface for short-lived messages; use Notification when a message also needs a description
or richer stacked content.

```ts
import { defineTagComponents } from '@haiyue/ui/tag';
import { defineToastComponents } from '@haiyue/ui/toast';

defineTagComponents();
defineToastComponents();
```

```html
<hy-tag variant="success" icon="✓" closable>Synced</hy-tag>
<hy-tag variant="primary" checkable value="featured">Featured</hy-tag>
<hy-toast id="feedback" placement="top" duration="3" closable></hy-toast>
<script type="module">
  feedback.success('Saved successfully');
  const key = feedback.loading('Exporting…');
  // Reusing a key replaces the persistent loading toast.
  feedback.success({ key, message: 'Export complete' });
</script>
```

## Button icons, loading, and groups

Buttons accept a text `icon` or a richer `icon` slot. Set `icon-position="end"` to place it after the label.
The boolean `loading` attribute replaces the configured icon with a spinner, marks the native button busy, and
temporarily disables activation so an asynchronous request cannot be submitted twice.

```html
<hy-button label="Publish" icon="↥"></hy-button>
<hy-button label="Continue" icon="→" icon-position="end"></hy-button>
<hy-button loading label="Syncing"></hy-button>
<hy-button label="Upload"><svg slot="icon" aria-hidden="true">…</svg></hy-button>

<hy-button-group aria-label="History actions">
  <hy-button label="Undo" icon="↶"></hy-button>
  <hy-button label="Redo" icon="↷"></hy-button>
</hy-button-group>
```

Use `orientation="vertical"` for a stacked group. Button styling is exposed through the `button`, `content`,
`icon`, and `spinner` parts; the group exposes its container as the `group` part.

## Input and search

`HYInput` supports plain-text `prefix` and `suffix` attributes as well as named slots for icons or richer
content. Use `type="search"` to add an accessible search action button:

```html
<hy-input type="search" prefix="⌕" suffix="assets"
  placeholder="Search…" search-label="Search assets"></hy-input>

<hy-input placeholder="Amount">
  <span slot="prefix">¥</span>
  <span slot="suffix">CNY</span>
</hy-input>
```

Search inputs emit a composed, cancelable `search` event when the user presses Enter, activates the search
button, or the application calls `search()`. Its detail contains `{ value, valid, source }`, where `source` is
`enter`, `button`, or `api`. Existing `value-change`, validation, number, and color input behavior remains
available. Style the `control`, `input`, `prefix`, `suffix`, and `search-button` parts or the
`--hy-input-affix-*` and `--hy-input-search-*` tokens.

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

## Virtual keyboard

Import the on-screen keyboard independently and bind it to a text input or textarea:

```ts
import { defineVirtualKeyboardComponents } from '@haiyue/ui/virtual-keyboard';

defineVirtualKeyboardComponents();
const keyboard = document.querySelector('hy-virtual-keyboard');
keyboard.target = document.querySelector('textarea');
keyboard.physicalSync = true;
keyboard.mode = 'numeric'; // switch back with 'qwerty'
await keyboard.type('Haiyue UI', { interval: 45 });
```

The default exported `HY_VIRTUAL_KEYBOARD_QWERTY_LAYOUT` includes digits, letters, Shift, Caps Lock, editing,
all four arrow directions, caret, and navigation keys. Set `mode` to `qwerty` or `numeric`; the numeric mode uses
the exported `HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT` with digits, decimal, minus, deletion, and Enter keys. Assign
`layout` with rows of typed key descriptors for shortcut or product-specific keyboards. Pointer and native keyboard activation edit the bound target and emit its normal
`input` event; `physicalSync` mirrors real key state without duplicating native input. `press()`, `release()`,
`tap()`, `type()`, and `clear()` support guided playback. Observe `virtual-keyboard-down`,
`virtual-keyboard-up`, and `virtual-keyboard-input`, or style `keyboard`, `row`, `key`, and per-code key parts
with the `--hy-virtual-keyboard-*` tokens.

## Draggable container

Import the transform-based container independently, then use any slotted element as its handle:

```ts
import { defineDraggableComponents } from '@haiyue/ui/draggable';

defineDraggableComponents();
const panel = document.querySelector('hy-draggable');
panel.bounds = 'parent';
panel.axis = 'both';
panel.grid = 8;
panel.moveTo(24, 24);
```

`bounds` accepts `none`, `parent`, `viewport`, or an `HTMLElement`; `axis` accepts `both`, `x`, or `y`.
Use `handle` to restrict pointer starts to a selector and `cancel` to exclude interactive content. The default
cancel selector protects inputs, buttons, links, editable content, and `[data-no-drag]`. Arrow keys move by one
grid step, Shift multiplies that step by ten, and Home resets the position. `moveTo()`, `moveBy()`, `reset()`,
and `refresh()` provide imperative control. Observe cancelable `drag-start`, followed by `drag-move` and
`drag-end`; style the exported `surface` part and `--hy-draggable-*` tokens.

## Resizable container

Import the eight-handle transform frame independently. Its four corner points and four edge-midpoint handles
resize the rectangle; dragging the content surface moves it:

```ts
import { defineResizableComponents } from '@haiyue/ui/resizable';

defineResizableComponents();
const frame = document.querySelector('hy-resizable');
frame.bounds = 'parent';
frame.grid = 8;
frame.aspectRatio = 16 / 9;
frame.setRect({ x: 48, y: 48, width: 240, height: 135 });
```

Configure `minWidth`, `minHeight`, `maxWidth`, and `maxHeight`, or use the matching kebab-case attributes.
`bounds` accepts `none`, `parent`, `viewport`, or an `HTMLElement`; `movable="false"` keeps content stationary
while preserving resize handles. The focused frame and handles support arrows, Shift acceleration, and Home
reset. Imperative APIs include `setRect()`, `moveTo()`, `moveBy()`, `resizeTo()`, `reset()`, and `refresh()`.
Observe cancelable `resize-start`, continuous `resize`, and `resize-end` events. Shadow parts expose `frame`,
`content`, `handle`, and every directional handle such as `handle-nw`; appearance uses `--hy-resizable-*` tokens.

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
every exported component, including editable parameters and event output. The gallery shell itself dogfoods
Haiyue UI: theme actions, component search, command results, status, and example action controls use the
published Web Components rather than parallel page-only widgets. The navigation/content shell and eligible
preview/control cards use `hy-split` for keyboard- and pointer-adjustable sizing. Usage blocks are rendered as
read-only CodeMirror editors with HTML, JavaScript, and CSS syntax highlighting.

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

### 共享组件目录（开发中）

`@haiyue/ui/core` 的 `HYComponentProps` 增加五种节点，Web 适配复用对应组件子模块，Native 适配使用原生控件；不新增根导出，也不自动注册全部组件。现有 18 种节点保持兼容，支持范围由 renderer 的 `capabilities.components` 声明。

| 节点 | 对应 WebComponent | 当前共享属性 |
| --- | --- | --- |
| `Checkbox` | `hy-checkbox` | `text`, `checked`, `disabled`；区别于原生开关 `Toggle` |
| `RadioGroup` | 一组 `hy-radio` | `value`, `options`, `disabled`；值必须出现在选项中 |
| `Rate` | `hy-rate` | `value`（0 到 count 的整数）, `count`（1–10）, `disabled`, `readOnly` |
| `Badge` | `hy-badge` | 独立文本 `text`，计数截断由应用决定 |
| `Divider` | `hy-divider` | 水平分隔线，可选 `text` |

交互节点受应用状态控制，通过同一 transaction 的 `valueChange` / `commit` 提议变更；应用拒绝时保留已接受值。评分的半星、悬浮效果，徽标的圆点、动画、悬挂计数，分隔线的垂直/虚线模式尚未纳入共享协议。请勿把 WebComponent 的所有属性直接传入通用节点。

Native 仓库的 `examples/ui-validation/mobile` 提供独立「Haiyue UI」组件实验室；折叠内容、步骤导航与按钮组是基础节点组合示例，不是新增协议节点。

Web 的 `hy-badge` 新增可选 `literal` 属性（默认为 false）：启用后 `count` 按原始文字显示，保留 0、前导零和大数字。普通计数的隐藏零值、截断，以及 status/text 模式保持原行为；共享 Badge 适配显式启用此模式。
