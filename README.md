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

## Alert, Anchor, and Segmented

The three components have isolated, side-effect-free entry points and are also included in the opt-in root registration:

```ts
import { defineAlertComponents } from '@haiyue/ui/alert';
import { defineAnchorComponents } from '@haiyue/ui/anchor';
import { defineSegmentedComponents } from '@haiyue/ui/segmented';

defineAlertComponents();
defineAnchorComponents();
defineSegmentedComponents();
```

`<hy-alert>` supports `success`, `info`, `warning`, and `error`, optional built-in/custom icons, message and description
content, an `action` slot, banner presentation, and cancelable `alert-close` dismissal. `<hy-anchor>` accepts nested
`items`, tracks `active-href` against the viewport or an assigned `scrollContainer`, and exposes offsets, vertical or
horizontal layout, smooth scrolling, `scrollToAnchor()`, and composed click/change events. `<hy-segmented>` accepts
string or object options, uses an accessible radiogroup with roving focus, skips disabled choices during arrow-key
navigation, and supports three sizes, full-width layout, icons, group disable, `select()`, and `value-change`.

## Modal

Import `defineModalComponents` from `@haiyue/ui/modal` and register once. `HYModal` is also exported by the root
and included in `defineHaiyueUI()`. It provides default confirmation/cancel actions around a native modal
`<dialog>`, with top-layer rendering, background inertness, focus containment and return focus through shadow roots.
The existing Dialog entry remains available for surfaces with application-supplied footer actions.

```html
<hy-modal id="publish" heading="Publish project" width="560" ok-text="Publish">
  <p>Review the project before publishing.</p>
</hy-modal>
```

Call `showModal()` / `close(reason?)`, or set the reflected boolean `open` property/attribute.
`heading` defaults to “Modal”; the `heading` slot overrides its content and the default slot supplies the body.
`width` defaults to 520 CSS pixels (240–2000), constrained to the viewport. `centered`, `closable`,
`mask-closable` / `maskClosable`, `keyboard` (Escape), and `show-footer` / `showFooter` all default to true;
set their attributes to `"false"` or properties to false to disable them independently.
`ok-text` / `okText` and `cancel-text` / `cancelText` default to “OK” and “Cancel”.
Use the `footer` slot for application-owned custom actions, replacing both default buttons.

Bubbling/composed events are `modal-open`, `modal-ok`, `modal-cancel` and `modal-close`.
The cancelable `modal-ok` and `modal-cancel` events carry `{ reason }`. Preventing either event keeps the modal open.
Close reasons are `ok`, `cancel`, `close-button`, `mask`, `escape` and `programmatic`; `close(reason)` also accepts
an application-specific string. `modal-close` fires once after an actual close, with `{ reason }`.
With `controlled`, default user actions only emit requests; the application updates `open` or calls `close()`.

```js
publish.addEventListener('modal-ok', async event => {
  event.preventDefault();
  publish.confirmLoading = true;
  try {
    await saveProject();
    publish.close('ok');
  } finally {
    publish.confirmLoading = false;
  }
});
publish.showModal();
```

`confirm-loading` / `confirmLoading` disables the default actions and user dismissal, shows a spinner and marks the
surface busy; application `close()` remains available. `confirm-disabled` / `confirmDisabled` only disables confirmation.
`destroy-on-hidden` / `destroyOnHidden` unmounts light DOM content while closed, retaining the same nodes, values and
listeners for reopening. It defaults to false. Disconnecting removes modality and scroll locks without emitting a
close event; a retained `open` attribute reopens on reconnection. Nested modals retain scroll locking until the last closes.

Style parts `panel`, `header`, `heading`, `body`, `footer`, `actions`, `ok-button`, `cancel-button`,
`close-button`, `spinner`. Tokens include `--hy-modal-width`, `--hy-modal-radius`, `--hy-modal-body-padding`,
`--hy-modal-duration`, `--hy-modal-bg-color`, `--hy-modal-mask-color`, `--hy-modal-mask-blur`, `--hy-modal-shadow-color`,
`--hy-modal-footer-bg-color` and `--hy-modal-button-radius`; colors inherit semantic theme tokens. Reduced-motion
preferences suppress the entrance and spinner animations. No sibling component import or automatic registration is needed.

## QR Code

Import `defineQRCodeComponents` from `@haiyue/ui/qr-code` and call it once. The root registration path also includes
`<hy-qr-code>`. Values are encoded locally into SVG; no runtime dependency or remote QR generation service is used.

```html
<hy-qr-code value="https://haiyuestudio.github.io/UI/" size="220"
  icon="/brand.svg" icon-size="32" icon-margin="2" aria-label="Open Haiyue UI"></hy-qr-code>

<hy-qr-code value="https://haiyuestudio.github.io/UI/">
  <img slot="icon" src="/brand.svg" alt="" />
</hy-qr-code>
```

Set `value` to a URL or text (including UTF-8/Chinese/emoji). `size` defaults to 200 CSS pixels (64–2048).
`margin` is the quiet zone in modules (default/minimum 4, maximum 16).
`error-correction-level` / `errorCorrectionLevel` accepts `L`, `M`, `Q`, or `H`. Without an explicit level,
it defaults to `H` with an icon and `M` otherwise. An explicit level applies with or without an icon.
An `icon` image URL or content in the `icon` slot adds a center icon; the slot takes precedence over the URL.
`icon-size` / `iconSize` requests the content size in pixels (default 32), while `icon-margin` / `iconMargin`
sets its backing padding (default 2). The complete overlay is capped at 20% of the QR matrix width, including padding,
and scales with responsive sizing. Icon content is decorative and inert. A failed image leaves the plain QR visible.

`color` and `background-color` / `backgroundColor` customize the QR colors. The inherited tokens
`--hy-qr-code-color` and `--hy-qr-code-background-color` default to dark modules on white for both themes.
Other styling hooks are `--hy-qr-code-icon-radius`, `--hy-qr-code-radius` and parts `frame`, `code`,
`background`, `modules`, `icon`, `icon-image`, `message`. Keep sufficient contrast and verify your final payload,
size, colors and icon with the intended scanner; arbitrary custom styling can affect readability.

The read-only `status` is `empty`, `ready`, or `error`. Empty values and over-capacity payloads clear the previous code.
Bubbling, composed events are `qr-render` with `{ value, version, moduleCount, errorCorrectionLevel }` after encoding,
`qr-error` with `{ message }` on encoding failure, and `qr-icon-error` with `{ src }` on image failure.
SVG is decorative beneath a labelled image role; set `aria-label` to describe the QR's purpose.

The internal encoder is vendored from [Project Nayuki](https://www.nayuki.io/page/qr-code-generator-library),
upstream Git blob `c4191ac0b5f8a24d87fd9340ceaa2d3b07d0231a`, with its MIT notice retained in source and `LICENSE`.
Local edits only add an ES module export, strict indexed-access assertions and formatting. Independent decoding tests
use `jsqr` as a development-only dependency. Internal encoder symbols are excluded from the public component API.

## Carousel

`@haiyue/ui/carousel` exports `HYCarousel`, `defineCarouselComponents()` and the associated `HYCarousel*` types.
Registration is explicit; panels are HTML elements in the default slot and stay mounted between changes.

```html
<hy-carousel direction="horizontal" indicator-style="line" indicator-position="bottom"
  autoplay interval="4000" draggable="true" loop="true" aria-label="Featured projects">
  <article>First panel</article>
  <article>Second panel</article>
  <article>Third panel</article>
</hy-carousel>
```

| Attribute / property | Default | Behavior |
| --- | --- | --- |
| `index` | `0` | Active panel, zero based |
| `direction` | `horizontal` | `horizontal` or `vertical`; horizontal supports RTL |
| `indicator-style` / `indicatorStyle` | `dot` | `dot`, `line`, `number` |
| `indicator-position` / `indicatorPosition` | `bottom` | `top`, `right`, `bottom`, `left` |
| `show-indicators` / `showIndicators` | `true` | Set `false` to hide indicators |
| `show-arrows` / `showArrows` | `true` | Set `false` to hide previous/next buttons |
| `autoplay` | `false` | Opt-in automatic rotation with a pause/start button |
| `interval` | `3000` | Milliseconds, normalized to 100–86,400,000 |
| `draggable` | `true` | Mouse/touch swipe; set `false` to disable |
| `loop` | `true` | Wrap at the ends; `false` clamps and stops autoplay at the last panel |

Use `next()`, `previous()`, `goTo(index)`, `play()` and `pause()` for imperative control.
The bubbling, composed `change` event includes `{ index, previousIndex, source }`, with sources
`api`, `indicator`, `arrow`, `keyboard`, `drag`, `autoplay` and `content`.
Inactive panels are inert and hidden from assistive technology. Arrow keys (matching direction), Home and End
navigate the focused viewport or indicators; input fields keep their editing keys. Hover temporarily pauses rotation;
keyboard focus pauses until explicitly resumed. Reduced-motion preferences suppress transitions and initial automatic
rotation; `play()` permits explicit rotation. Disconnecting releases timers, pointer listeners and animations and restores panel attributes/styles.

Customize `::part(indicators)`, `::part(indicator)`, `::part(indicator-active)`, `::part(indicator-content)`,
`::part(previous)`, `::part(next)`, `::part(playback)` and `::part(viewport)`.
Tokens include `--hy-carousel-height` (240px), `--hy-carousel-duration` (320ms), `--hy-carousel-indicator-size`,
`--hy-carousel-indicator-gap`, `--hy-carousel-indicator-offset`, `--hy-carousel-indicator-radius`,
`--hy-carousel-indicator-color` and `--hy-carousel-indicator-active-color`; other colors inherit semantic theme tokens.
For arbitrary content, set `indicatorRenderer = (index, active) => Node | string | null` (strings are plain text).
The component retains the native accessible indicator buttons and click/keyboard behavior around your content.
Panels should not override the component's positioning, dimensions, visibility or transform.

## Masonry layout

Import `defineMasonryComponents` from `@haiyue/ui/masonry` and call it once to register `<hy-masonry>`.
Place HTML elements of varying heights in the default slot:

```html
<hy-masonry min-column-width="240" gap="16" aria-label="Project gallery">
  <article>First card…</article>
  <article>Another card with more content…</article>
  <article><img src="preview.jpg" alt="Project preview" style="width: 100%" /></article>
</hy-masonry>
```

`columns` defaults to `0` (automatic); positive values request a fixed number of columns.
`min-column-width` (default `240`) controls automatic sizing; `gap` (default `16`) sets both gaps in CSS pixels.
Columns shrink to fit narrow containers. Each item goes into the shortest column, starting at the inline start,
including RTL layouts. DOM, screen-reader and keyboard order remain the original slot order.
Items keep their own content, theme and semantics; the component supplies positioning, border-box width and zero outer margins.
Use padding inside cards and avoid overriding item positioning/width. Text nodes and named slots are not layout items.

Container resizing, item resizing (including image loads), adding/removing items and toggling `hidden` automatically
schedule a layout. Call `refresh()` after changes outside those observations (for example, a stylesheet rule that
reveals a previously hidden item). `layout-change` bubbles across shadow roots with `{ columns, itemCount, height }`
after geometry changes; `itemCount` excludes hidden items. Style the transparent container with `::part(layout)`.
Observers and queued frames are released on disconnect, and internal item CSS properties are restored.

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

## Mentions

```ts
import { defineMentionsComponents } from '@haiyue/ui/mentions';
defineMentionsComponents();

const mentions = document.querySelector('hy-mentions');
mentions.options = [
  { value: 'alice', label: 'Alice Chen' },
  { value: 'bob', label: 'Bob Lin' },
  { value: 'archived', label: 'Archived account', disabled: true },
];
mentions.prefixes = ['@', '#'];
mentions.addEventListener('mention-select', event => console.log(event.detail));
```

```html
<hy-mentions placeholder="Type @ to mention someone" rows="3"
  aria-label="Comment"></hy-mentions>
```

`<hy-mentions>` uses a native multiline textarea. `value`, `placeholder`, `rows`, `disabled`, and
`readOnly` are properties; `readonly`, `required`, `maxlength`, and `name` are also forwarded attributes.
The default trigger is `@`; set `prefix` for a single trigger or `prefixes` for multiple triggers
(the `prefixes` attribute accepts a JSON string array). Triggers start at the beginning of the text,
after whitespace, or after `split`. The default `split` is one space; it is inserted after a selection.
Selecting a suggestion replaces the current token and preserves the surrounding text.

Suggestions match the option's value or label without case sensitivity. Set `filterOption` to a
`(text, option) => boolean` function to customize matching, or `false` for server-filtered results.
The bubbling, composed `search` event exposes `{ text, prefix }`; use it to fetch options and set
`loading` while waiting. Consumers own request cancellation and stale-response handling.
`notFoundContent` and `loadingText` customize the empty/loading messages. `placement` prefers `top`
or `bottom`, and the popup automatically fits the viewport. Arrow keys skip disabled options,
Enter selects, Shift+Enter inserts a newline, and Escape/Tab dismiss. IME composition keeps its
native editing behavior. `focus()` and `blur()` target the textarea.

`value-change` emits `{ value }` on user edits and selections, while `mention-select` emits
`{ value, option, prefix }` after a selection. Programmatic value updates do not emit change events.
The native composed `input` event is also available. Style the `textarea`, `panel`, `list`, `option`,
and `status` parts; colors inherit the semantic theme tokens. Popup dimensions use
`--hy-mentions-popup-min-width`, `--hy-mentions-popup-max-width`, `--hy-mentions-popup-max-height`,
and `--hy-mentions-z-index`. `open` is a read-only property reflecting popup visibility.

## Switch, Progress, and Spin

```ts
import { defineSwitchComponents } from '@haiyue/ui/switch';
import { defineProgressComponents } from '@haiyue/ui/progress';
import { defineSpinComponents } from '@haiyue/ui/spin';
defineSwitchComponents();
defineProgressComponents();
defineSpinComponents();
```

```html
<hy-switch name="autosave" label="Auto save" checked checked-text="On" unchecked-text="Off"></hy-switch>
<hy-progress percent="42" aria-label="Build progress"></hy-progress>
<hy-progress type="circle" percent="75" status="active"></hy-progress>
<hy-spin spinning="false" delay="200" tip="Loading preview"><div>Preview content</div></hy-spin>
```

Switch has `checked`, `disabled`, `loading`, `size` (`small`/`default`), `value`, `name`, and `label`
properties. A default slot can supply its label. `checked-text`/`unchecked-text` customize the state text.
It uses a native checkbox with `role="switch"`; Space and Enter toggle it, while loading disables interaction.
User changes emit composed `checked-change` (`{ checked, value }`) and `change` events. Property updates
are silent. It participates in native forms, required validation, disabled fieldsets and reset.

Progress accepts `percent` (clamped to 0–100), `type` (`line`/`circle`), `status`
(`normal`/`active`/`success`/`exception`), `indeterminate`, `showInfo`, `strokeWidth`, and circle `size`.
The corresponding attributes are kebab-case. Indeterminate progress omits `aria-valuenow`.
Style `meter`, `trail`, `fill`, `circle` and `info` parts, or `--hy-progress-color`/`--hy-progress-trail-color`.

Spin is spinning by default; use `spinning="false"` or `.spinning = false` to stop it. `delay` in milliseconds
postpones the indicator (capped at 60 seconds), and `tip`/`size` (`small`/`default`/`large`) customize it.
With slotted content it displays an overlay and makes that content inert while loading, including during
the delay. Without content it is a standalone indicator. Owned timers are canceled on detach.
Both loading components respect reduced-motion preferences and inherit semantic theme colors.

## Popover and Popconfirm

The independent `@haiyue/ui/popover` and `@haiyue/ui/popconfirm` entries expose
`definePopoverComponents()` and `definePopconfirmComponents()` respectively.

```html
<hy-popover heading="Quick settings" placement="bottom-start">
  <button slot="trigger">Settings</button>
  <input aria-label="Preset name" />
</hy-popover>
<hy-popconfirm heading="Delete asset?" description="This removes the selected asset">
  <button slot="trigger">Delete</button>
</hy-popconfirm>
```

Both expose `open`, `disabled`, `heading`, `content`, `description`, `trigger`, `placement`, `show()` and
`hide()`. The `trigger` slot accepts a native button or a focusable custom control; the default slot supplies
interactive content, and the `heading` slot overrides the heading text. Triggers are `click` (default),
`hover`, `focus`, or `manual`. Hover delays use `show-delay`/`hide-delay` in milliseconds. Placement supports
top/bottom/left/right with optional `-start`/`-end`; popups flip and fit the viewport and use the native
popover top layer when available, escaping clipped ancestors. Escape, outside clicks and focus leaving
the surface close it; keyboard interaction inside remains available and closing restores owned focus.
`open-change` is composed and carries `{ open, reason }`. Disconnect releases listeners, timers and observers.

Popconfirm adds `okText`, `cancelText`, `confirmLoading`, `confirmDisabled`, `confirm()` and `cancel()`.
Its cancelable, composed `confirm`/`cancel` events carry `{ source: 'button' | 'api' }`. A prevented event
keeps the panel open; during `confirmLoading`, buttons, outside dismissal and Escape are blocked.

```ts
popconfirm.addEventListener('confirm', async event => {
  event.preventDefault();
  popconfirm.confirmLoading = true;
  try { await removeAsset(); popconfirm.hide(); }
  finally { popconfirm.confirmLoading = false; }
});
```

Style `trigger`, `panel`, `heading`, `description`, `content`, `footer`, `confirm`, and `cancel` parts.
`--hy-popover-width`, `--hy-popover-shadow` and `--hy-popover-z-index` customize the surface.

## Form and Form Item

```ts
import { defineFormComponents } from '@haiyue/ui/form';
import { defineFormItemComponents } from '@haiyue/ui/form-item';
import { defineInputComponents } from '@haiyue/ui/input';
defineFormComponents();
defineFormItemComponents();
defineInputComponents();
```

```html
<hy-form aria-label="Project settings">
  <hy-form-item name="project" label="Project name" required help="At least 3 characters">
    <hy-input></hy-input>
  </hy-form-item>
  <button type="submit">Save</button>
  <button type="reset">Reset</button>
</hy-form>
```

Form owns one real light-DOM `<form>` exposed as `formElement`. Children added to the host are moved into
that form, so native controls and form-associated custom controls share one owner. Do not nest forms.
`hy-input`, `hy-select`, `hy-checkbox`, `hy-radio`, `hy-mentions`, `hy-switch`, `hy-upload`,
`hy-auto-complete` and `hy-tree-select` participate
in native `FormData`, disabled fieldsets and reset, including inside an ordinary `<form>`. Other custom
components require an application-owned named native input if they need submission. Reset restores the
initial connected values silently. Existing input events and isolated component entry points are preserved.

`layout` is `vertical` (default), `horizontal`, or `inline`; `--hy-form-gap` and `--hy-form-label-width`
control spacing and horizontal labels. `values` and `formData` are fresh snapshots; repeated names become
arrays in `values`. `setValues(record)` updates supported native/value/checked fields silently.
Native and `hy-button` submit/reset actions work inside `hy-form`, as does Enter in single-line inputs.
`validate()` returns `Promise<boolean>`; `submit()` validates and emits the cancelable, composed
`form-submit` event with `{ values, formData }`. It resolves to the event's accepted status, and never
navigates or sends a network request. `form-invalid` carries `{ errors }`; `form-reset` signals reset.
Later edits, replacement submissions or disconnect prevent an old async validation from submitting.

Form Item owns one field. `name` supplies the field name when it has none; `label`, `required`, `help`,
and external `error` configure its presentation. Labels focus the field, and labels/error descriptions
are applied to the actual accessible control. `validateTrigger` (`validate-trigger`) is `blur` by default,
or `change`/`submit`. `rules` accepts `{ required, min, max, pattern, message, validator }`; min/max
measure string/array length or a numeric value. A validator receives `(value, signal)` and returns a
message or no message, synchronously or as a Promise. The signal cancels superseded validation.
`status` is read-only (`''`, `validating`, `success`, `error`); `clearValidation()` clears feedback.
`field-validate` emits `{ name, valid, error }`. Explicit native constraints remain in effect.

```ts
item.rules = [{ min: 3, message: 'Use at least 3 characters' }, {
  validator: async (value, signal) => {
    const available = await checkName(value, { signal });
    return available ? '' : 'Name already used';
  },
}];
form.addEventListener('form-submit', event => {
  event.preventDefault();
  saveProject(event.detail.values);
});
```

## Upload

Import `defineUploadComponents` from `@haiyue/ui/upload`. File transport stays application-owned;
the component never chooses a server or sends a request by itself.

```html
<hy-upload name="assets" drag multiple accept=".png,.jpg,.txt"
  max-count="3" max-size="1048576" auto-upload="false">Drop files here</hy-upload>
```

```ts
upload.beforeUpload = async (file, files) => file.size <= 1024 * 1024;
upload.request = ({ file, signal, onProgress }) => uploadAsset(file, { signal, onProgress });
await upload.upload();
```

`accept`, `multiple`, `disabled`, `drag`, `maxCount`, `maxSize` (bytes), `autoUpload`, and `showFileList`
configure selection; a zero limit means unlimited. The file input's type/size/count checks are applied
to both selection and drag/drop. `beforeUpload` can asynchronously veto a file; stale selection work is
discarded after disable, reset, replacement or disconnect. `autoUpload` defaults to true and only starts
work if an application `request` function exists. Input and drop content can be customized with `label`
and the default slot. `openFileDialog()` opens the picker; `focus()` targets its button.

`fileList` is a copied list of `{ uid, name, status, percent?, file?, size?, type?, response?, error? }`.
Statuses are `ready`, `uploading`, `done`, and `error`. `files` returns actual `File` instances.
`upload(uid?)` starts/retries files; `abort(uid?)` cancels and returns them to `ready`;
`removeFile(uid)` emits cancelable `file-remove` before removing and aborting a file.
`upload-change` carries `{ file, fileList, reason }`, including progress/success/error/abort, and
`file-reject` carries `{ file, reason, message }`. Request callbacks receive an AbortSignal and a
0–100 progress callback; removed/replaced/disconnected requests cannot report stale success.
Native form submission includes actual File objects under `name`; metadata-only preloaded entries
are displayed but do not fabricate files. `required` checks whether the list is empty.
Style `dropzone`, `trigger`, `list`, `file`, `file-name`, `file-status`, `progress`, `remove`, `retry`,
and `message` parts through the existing semantic theme tokens.

## AutoComplete

Import `defineAutoCompleteComponents` from `@haiyue/ui/auto-complete`.

```html
<hy-auto-complete name="asset" aria-label="Asset search" allow-clear search-delay="150"></hy-auto-complete>
```

```ts
autoComplete.options = [
  { value: 'ocean', label: 'Ocean scene' },
  { value: 'archived', label: 'Archived scene', disabled: true },
];
autoComplete.addEventListener('search', event => fetchSuggestions(event.detail.value));
autoComplete.addEventListener('option-select', event => console.log(event.detail.option));
```

Free text remains valid without selecting an option. `value`, `options`, `open`, `disabled`, `readOnly`,
`loading`, `allowClear`, `placeholder`, and `searchDelay` are properties. Options can also be supplied
as JSON in `options`. Default matching searches label/value without case sensitivity; `filterOption`
accepts a function or `false` for application-filtered results. Set `loading` while fetching and use
`not-found-content` to customize empty feedback. `search` emits `{ value }` after the configured delay;
superseded timers and IME intermediate searches are canceled. The application owns request cancellation
and stale network-response handling. Arrow keys skip disabled options, Enter selects, and Escape/Tab
dismiss. Native editing and composition keys are preserved.

`value-change` emits `{ value }` for user edits/selections; `option-select` emits `{ value, option }`;
`clear` and `open-change` are also composed events. Programmatic value assignments are silent.
Selection and clear preserve native input notifications. `name`, `required`, `minlength`, `maxlength`
and `pattern` support native forms and constraints; reset and disabled fieldsets work. `focus()`/`blur()`
target the real input. Parts are `control`, `input`, `clear`, `panel`, `list`, `option`, and `status`.

## Menu

The isolated `@haiyue/ui/menu` entry exposes `HYMenu` and `defineMenuComponents()`.

```ts
menu.items = [
  { key: 'home', label: 'Home', icon: '⌂' },
  { key: 'assets', label: 'Assets', children: [{ key: 'scenes', label: 'Scenes' }] },
  { key: 'divider', type: 'divider' },
  { key: 'settings', label: 'Settings', href: '/settings' },
];
menu.selectedKeys = ['home'];
```

Items have unique string keys and optional labels, text icons, hrefs, disabled state, children and
`type: 'group' | 'divider'`. Disabled parents disable their descendants. Cycles, duplicate keys and
invalid input are discarded. Link navigation permits http/https/mailto/tel and ordinary relative URLs.
`mode` is `inline` (default), `vertical`, or `horizontal`; `collapsed` provides a compact icon rail.
Inline children expand in place, while vertical/horizontal submenus use top-layer popups. `multiple`,
`selectedKeys` and `openKeys` control selection/expansion (array attributes use JSON). Programmatic updates
are silent; cancelable `menu-select` emits `{ key, item, selectedKeys }` before selection/navigation,
and `open-change` emits `{ openKeys }` for user expansion. Cancel a selection to prevent navigation.
Menus provide roving tab focus, arrow/Home/End navigation, Escape return to parent, and text typeahead.
Outside clicks close floating submenus. Parts are `menu`, `item`, `submenu`; width tokens include
`--hy-menu-width`, `--hy-menu-collapsed-width`, and `--hy-menu-popup-width`.

## Pagination

Import `definePaginationComponents` from `@haiyue/ui/pagination` for lists or server-side pages.

```html
<hy-pagination total="153" page="1" page-size="10" show-size-changer show-quick-jumper></hy-pagination>
```

`page`, `pageSize`, `total`, `pageSizeOptions`, `disabled`, `simple`, `showSizeChanger` and
`showQuickJumper` have properties and corresponding kebab-case attributes. `pageCount` is read-only;
empty data still uses page 1. Invalid pages/sizes normalize, and huge totals render a bounded page window.
`page-size-options` accepts comma-separated numbers or a JSON numeric array. `show-total="false"`
hides the range, `hide-on-single-page` hides unnecessary navigation, and `size="small"` makes it compact.
User actions emit composed `page-change` with `{ page, pageSize, total, source }`, where source is
`page`, `size`, or `jump`. Programmatic changes are silent. Page-size changes retain the first visible
record within the new page. Native buttons/selects and the Enter-committed jumper work with keyboard;
Left/Right follow writing direction and Home/End reach the boundaries. No data fetching is implicit.
Parts are `nav`, `pages`, `page`, `previous`, `next`, `total`, `page-size`, and `jumper`.

## TreeSelect

Import `defineTreeSelectComponents` from `@haiyue/ui/tree-select`. Its entry does not import/register Tree.

```ts
treeSelect.options = [{ value: 'assets', label: 'Assets', selectable: false, children: [
  { value: 'ocean', label: 'Ocean scene' },
  { value: 'locked', label: 'Archived', disabled: true },
] }];
treeSelect.multiple = true;
treeSelect.values = ['ocean'];
```

Options have unique `value`, `label`, optional `disabled`, `selectable`, `expanded`, and `children`.
`value` is a string in single mode and a string array in multiple mode; `values` always exposes an array.
The multiple `value` attribute uses JSON. Multiple selection is independent: selecting a parent does not
implicitly select its descendants. Selected values survive async option replacement; unknown labels
temporarily show their values. `expandedKeys` / `expanded-keys` controls expansion.
`searchable` and `clearable` default to true (use `="false"` to disable); `loading`, `disabled`,
`readOnly`, `open`, and `placeholder` control interaction. Search preserves matching ancestors and
temporarily expands paths; it does not change stored expansion. `search` emits `{ text }`; consumers
own async requests and option updates. `not-found-content` customizes empty feedback.

The input keeps focus while aria-activedescendant identifies the active tree item. Arrows expand,
collapse and navigate, Enter selects, and Escape/Tab close. IME confirmation does not select a node.
`value-change` carries `{ value, values, options }` and is followed by a composed `change` event;
`expand-change` carries `{ expandedKeys }`. Programmatic assignments are silent. Named values participate
in FormData (repeated names for multiple values), required/custom validation, reset and disabled fieldsets.
`HYForm.setValues()` accepts arrays for multiple TreeSelect and native multiple select fields.
Parts include `control`, `input`, `tags`, `tag`, `clear`, `panel`, `tree`, `option`, `toggle`, and `status`.
AutoComplete/TreeSelect inherit semantic theme tokens and `--hy-popup-max-height`/`--hy-popup-z-index`.

## Image and Image Preview

Use the independent `@haiyue/ui/image` and `@haiyue/ui/image-preview` entries to register
`defineImageComponents()` and `defineImagePreviewComponents()` respectively.

```html
<hy-image src="ocean.png" alt="Ocean scene" width="280" height="180"
  fit="cover" loading="lazy" fallback="placeholder.png"></hy-image>
```

Image supports native `srcset`/`sizes` attributes, `src`, `alt`, `width`, `height`, `fit`, `loading`,
`fallback`, `preview` (default true), and `previewSrc` (`preview-src`) for a higher-resolution source.
Width/height accept numbers or CSS lengths. `status` is read-only: `empty`, `loading`, `loaded`, or `error`.
The frame also follows CSS width/height set on the host. With both dimensions constrained, `fit` uses
native `object-fit` semantics: `contain` shows the complete image with letterboxing, `cover` crops to fill,
`fill` stretches, `none` keeps the original size, and `scale-down` never enlarges. For oversized images,
`scale-down` matches `contain`; for smaller images it matches `none`. Constraining only the width retains
the image's natural aspect ratio.
`placeholder` and `fallback` slots customize loading/error content; `fallback` URL is tried once after
the original fails. Source changes detach old listeners so stale resources cannot replace new state.
`image-load` carries `{ src, naturalWidth, naturalHeight }`, and `image-error` carries `{ src, fallback }`.
`showPreview()`/`hidePreview()` control the single-image viewer, with `preview-open-change` notifications.
Parts include `frame`, `image`, `placeholder`, `error`, and `preview-trigger`; the radius/background use
`--hy-image-radius`/`--hy-image-bg` and semantic tokens.

```ts
preview.images = [
  { src: 'ocean.png', alt: 'Ocean', caption: 'Ocean scene' },
  { src: 'moon.png', alt: 'Moon' },
];
preview.show(0);
```

Standalone Image Preview takes `images` (objects or URL strings; JSON attribute supported), `current`
(zero-based), `open`, `show(index?)`, and `hide()`. It uses a native modal dialog with keyboard focus
containment, Escape/backdrop dismissal and return focus. Toolbar controls provide previous/next,
zoom, rotation and reset; Left/Right switch images, wheel zooms, and dragging pans a zoomed image.
Navigation resets transforms. Loading and failures have visible feedback; empty lists close the viewer.
`open-change` carries `{ open, index }`; `preview-change` carries `{ index, item }`. Disconnect releases
modality and image listeners. Common preview parts are `preview`, `toolbar`, `stage`, `preview-image`,
`preview-status`, `caption`, `counter`, `previous`, `next`, `in`, `out`, `left`, `right`, `reset`, and `close`.
`--hy-image-preview-bg`, `--hy-image-preview-text-color` and `--hy-image-preview-mask-color`
customize its surface, overlay text and backdrop.

## Portable component semantics (M24 G03/G05)

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

These APIs are included in the package and remain under development. Mobile mapping is G06, desktop mapping
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

Enable `animated` / `animated = true` for smooth opening and closing. Animation is off by default;
initial rendering stays immediate. Set `animation-duration` / `animationDuration` in milliseconds
(default 200, range 0–10,000); zero disables animation. Without the attribute, the inherited
`--hy-collapse-animation-duration` token (for example `250ms`) supplies the duration.
`--hy-collapse-animation-easing` customizes the easing (default `ease`).

```html
<hy-collapse animated animation-duration="250" destroy-on-hidden></hy-collapse>
```

Rapid toggles reverse from the current height, and content resizing during expansion updates the target height.
Closed panels become inert and hidden from assistive technology immediately; focus returns to their header
when needed. With `destroyOnHidden`, content is removed after the closing animation finishes.
Disabling animation, setting duration to zero, or enabling reduced-motion preferences settles immediately.
Animations and content observers are released on disconnect. The existing `collapse-change` event still fires
when the expanded state changes, rather than waiting for animation completion. These options extend `HYCollapse`;
no new package exports or registration functions are required.

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

The two skins share the same design scales. Define overrides on the element that carries `data-hy-theme`
or on a descendant wrapper. For overrides on the same element, load product rules after the theme stylesheet
and match the theme selector's specificity.

| Category | Shared tokens | Examples |
| --- | --- | --- |
| Semantic colors | Surface, text, border, accent, focus and status | `--hy-surface-color`, `--hy-text-color`, `--hy-accent-color`, `--hy-success-color` |
| Spacing | `--hy-space-*` on a 2px scale | `--hy-space-2` = 4px, `--hy-space-4` = 8px, `--hy-space-8` = 16px |
| Typography | Font families, `--hy-font-size-*`, `--hy-line-height-*`, `--hy-font-weight-*` | `--hy-font-size-sm` = 12px, `--hy-font-size-md` = 14px, `--hy-line-height-relaxed` = 1.5 |
| Corner radius | `--hy-radius-xs` through `--hy-radius-xl` and `--hy-radius-full` | `--hy-radius-sm` = 4px, `--hy-radius-md` = 6px, `--hy-radius-lg` = 8px |
| Control height | `--hy-control-height-xs`, `-sm`, `-md`, `-lg` | 24px, 28px, 34px, 44px |

```html
<section data-hy-theme="light" class="product-skin">
  <hy-input aria-label="Project name"></hy-input>
  <hy-button>Save</hy-button>
</section>
```

```css
[data-hy-theme="light"].product-skin {
  --hy-accent-color: #a44932;
  --hy-space-4: 12px;
  --hy-space-5: 15px;
  --hy-font-size-sm: 15px;
  --hy-radius-sm: 10px;
  --hy-control-height-sm: 38px;
}
```

Components resolve their specific tokens first where available. For example, `--hy-input-radius` overrides
`--hy-radius-sm` for Input. Each component provides usable fallback values when no theme is applied.

## Component examples

Browse the published gallery at <https://haiyuestudio.github.io/UI/>.

Run the interactive component gallery locally:

```bash
npm run examples
```

Then open <http://localhost:4173/>. The gallery provides a left-side component index and live examples for
every exported component, including editable parameters and event output. Open **设计规范** to compare
Moonlight, Nightfall, and a custom skin on the same controls and inspect the CSS and current token values.
The compact skin picker also offers **自定义**, starting from Terracotta. Its gear button opens a live
preview panel for colors (including alpha values), fonts, spacing, radii, and control heights. Changes and
the selected skin are saved locally; **恢复陶土** resets the custom values, and **应用皮肤** applies them to the
gallery. The same picker remains available above the introduction on mobile screens.
The gallery shell itself dogfoods
Haiyue UI: theme actions, component search, command results, status, and example action controls use the
published Web Components rather than parallel page-only widgets. The navigation/content shell and eligible
preview/control cards use `hy-split` for keyboard- and pointer-adjustable sizing. Usage blocks are rendered as
read-only CodeMirror editors with HTML, JavaScript, and CSS syntax highlighting.

## Empty, Result, Avatar, Card and Descriptions

These five presentation components have focused, side-effect-free entries (`@haiyue/ui/empty`,
`/result`, `/avatar`, `/card`, `/descriptions`) and are included in `defineHaiyueUI()`.
Each entry exposes its `HY…` class and `define…Components()` registration function. Styling inherits
the semantic color, font, spacing and radius tokens; no runtime dependency is added.

| Component | Properties / attributes | Content slots |
| --- | --- | --- |
| `HYEmpty` / `hy-empty` | `description` (default `No data`), `image` (`default`, `simple`, `none`), `size` (`small`, `default`) | `image`, `description`, default actions |
| `HYResult` / `hy-result` | `status` (`success`, `info`, `warning`, `error`, `403`, `404`, `500`), `heading`, `description` | `icon`, `heading`, `description`, default details, `extra` actions |
| `HYAvatar` / `hy-avatar` | `src`, native `srcset`/`sizes` attributes, `alt`, `text`, `size` (`small`, `default`, `large`, or 16–256 pixels), `shape` (`circle`, `square`), `fit` (`cover`, `contain`, `fill`), read-only `status` | default image fallback |
| `HYCard` / `hy-card` | `heading`, `bordered` (default true; `bordered="false"` removes it), `hoverable`, `loading`, `size` (`small`, `default`) | `heading`, `extra`, `cover`, default body, `footer` |
| `HYDescriptions` / `hy-descriptions` | `items`, `heading`, `column` (1–6, default 3), `layout` (`horizontal`, `vertical`), `bordered`, `size`, `responsive` (default true), `emptyText` (`empty-text`) | `heading`, `extra`, `label-{key}`, `value-{key}` |

```js
import { defineDescriptionsComponents } from '@haiyue/ui/descriptions';
defineDescriptionsComponents();
const details = document.querySelector('hy-descriptions');
details.items = [
  { key: 'name', label: 'Project', value: 'Ocean' },
  { key: 'files', label: 'Files', value: 0 },
  { key: 'notes', label: 'Notes', value: 'More room for this value', span: 'filled' },
];
```

`HYDescriptionItem` uses optional unique string `key` (defaults to the item index), `label`, primitive
`value` and optional `span` (1–6 or `filled` to consume the remaining row). Items are copied; duplicate
keys reject a property update, while invalid JSON in the `items` attribute produces an empty list.
Values render as text; use the named value/label slots for links, tags or inputs. `0` and `false` remain
visible; null, missing and empty string values use `emptyText` (default `—`). Responsive layout follows
the component's container: one column below 480px, up to two below 720px, otherwise `column`.
Set `responsive="false"` to retain the configured columns. Resize observers disconnect on removal.

Avatar shows its default slot, `text`, or a person icon while loading and after failure. `status` is
`empty`, `loading`, `loaded` or `error`. `avatar-load` carries `{ src, naturalWidth, naturalHeight }` and
`avatar-error` carries `{ src }`; both bubble across shadow roots. Superseded requests and disconnected
instances ignore stale image events. Supply `alt` or `aria-label` for the user name; explicit `alt=""`
makes the avatar decorative. `--hy-avatar-size`, `--hy-avatar-font-size`, `--hy-avatar-radius`,
`--hy-avatar-bg-color` and `--hy-avatar-text-color` provide local overrides.

Card loading hides and makes its body inert without destroying inputs, and hides the footer until
loading ends. `hoverable` adds a visual hover treatment; use actual slotted links/buttons for actions.
Empty and Result preserve slotted controls, and Result exposes a labelled region without unsolicited
live announcements. All fallback strings render as text. Useful surface parts are `empty`, `image`,
`description`, `actions`; `result`, `icon`, `heading`, `content`, `extra`; `avatar`, `image`, `fallback`,
`text`; `card`, `header`, `heading`, `cover`, `body`, `loading`, `footer`; and `list`, `item`, `label`,
`value` respectively. Component CSS hooks also include `--hy-empty-padding`, `--hy-empty-image-size`,
`--hy-result-padding`, `--hy-result-icon-size`, `--hy-card-radius`, `--hy-card-bg-color`,
`--hy-card-body-padding`, `--hy-descriptions-label-width`, `--hy-descriptions-cell-padding` and gap tokens.

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
See [release review](review/release-0.2.2.md).

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

The portable presentation contract adds optional semantic `Button.variant`
(`primary`, `secondary`, `quiet`, `danger`), `size` and vector `icon` names;
`Text.textStyle` (`title`, `body`, `caption`) and `tone`; `Tabs.variant`
(`underline`, `segmented`); and native `Select.presentation`. Existing nodes stay
valid. `HYTheme.typography` scales with fontScale, and optional selected, pressed,
disabled, elevated and onAccent colors map to inherited `--hy-` properties.
`HYIconName`, `HYButtonVariant`, `HYTextStyle` and `HYTypography` are explicitly
exported from `@haiyue/ui/core`; `HY_ICONS` / `hyIconSvg` are explicitly exported
from `@haiyue/ui/portable`, with no platform access or registration at import time.

Portable forms accept optional `FormGroup.description`, rendered as visible helper
text and included in associated controls' accessible descriptions. Updating help
or validation errors preserves the existing input, selection and composition.
`@haiyue/ui/portable` explicitly exports `hyResponsiveGrid`,
`hyResponsiveWorkspace`, `HYResponsiveGridOptions` and
`HYResponsiveWorkspaceOptions`. These return logical-pixel layout data without
reading window or platform globals, so hosts can use actual split-window sizes.
