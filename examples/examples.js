import { defineHaiyueUI } from '../dist/index.js';
import { installCodeEditors } from './vendor/codemirror.js';

defineHaiyueUI();

const byId = id => document.getElementById(id);
const setBoolean = (element, name, value) => element.toggleAttribute(name, Boolean(value));
const writeEvent = (target, name, detail) => {
  target.textContent = `${name}  ${JSON.stringify(detail)}`;
  target.title = target.textContent;
};

// The gallery itself dogfoods Split: one instance owns the navigation/content shell,
// while eligible preview/control cards are progressively upgraded to resizable panes.
const galleryShell = byId('gallery-shell');
let desktopSidebarRatio = galleryShell.ratio;
const compactGallery = window.matchMedia('(max-width: 660px)');
const syncGallerySplit = () => {
  if (compactGallery.matches) {
    galleryShell.minFirst = 0;
    galleryShell.minSecond = 280;
    galleryShell.barSize = 1;
    galleryShell.ratio = 0;
    return;
  }
  galleryShell.minFirst = 224;
  galleryShell.minSecond = 480;
  galleryShell.barSize = 5;
  galleryShell.ratio = desktopSidebarRatio;
};
galleryShell.addEventListener('ratio-change', event => {
  if (!compactGallery.matches) desktopSidebarRatio = event.detail.ratio;
});
compactGallery.addEventListener('change', syncGallerySplit);
syncGallerySplit();

const horizontalCardClasses = [
  'two-column', 'tree-card', 'virtual-list-card', 'virtual-mouse-card',
  'virtual-keyboard-card', 'draggable-card', 'resizable-card', 'table-card',
];
const responsiveCardSplit = window.matchMedia('(max-width: 900px)');
const cardSplits = [];

for (const card of document.querySelectorAll('.demo-card:not(.overflow-visible)')) {
  const [preview, controls, ...extra] = card.children;
  if (extra.length || !preview?.classList.contains('preview') || !controls?.classList.contains('controls')) continue;

  const bounds = card.getBoundingClientRect();
  const split = document.createElement('hy-split');
  for (const attribute of card.attributes) split.setAttribute(attribute.name, attribute.value);
  split.classList.add('demo-split');
  split.setAttribute('aria-label', '示例预览与参数分栏');
  split.barSize = 3;
  split.dataset.desktopDirection = horizontalCardClasses.some(name => card.classList.contains(name)) ? 'horizontal' : 'vertical';
  split.dataset.desktopHeight = String(Math.ceil(bounds.height));
  preview.slot = 'first';
  controls.slot = 'second';
  split.append(preview, controls);
  card.replaceWith(split);
  cardSplits.push(split);
}

const syncCardSplits = () => {
  for (const split of cardSplits) {
    const preview = split.querySelector('[slot="first"]');
    const controls = split.querySelector('[slot="second"]');
    const stack = responsiveCardSplit.matches || split.dataset.desktopDirection === 'vertical';
    split.direction = stack ? 'vertical' : 'horizontal';
    split.ratio = stack ? 0.68 : 0.64;
    split.minFirst = stack ? 150 : 220;
    split.minSecond = stack ? 74 : 220;
    const desktopHeight = Number(split.dataset.desktopHeight);
    split.style.height = stack
      ? `${Math.max(desktopHeight, Math.min(620, (preview?.scrollHeight ?? 0) + (controls?.scrollHeight ?? 0) + 6))}px`
      : `${Math.max(260, desktopHeight)}px`;
  }
};
responsiveCardSplit.addEventListener('change', syncCardSplits);
syncCardSplits();
installCodeEditors();

// Modal.
const modalLive = byId('modal-live');
let modalConfirmTimer = 0;
byId('modal-open').addEventListener('click', () => modalLive.showModal());
byId('modal-heading').addEventListener('input', event => { modalLive.heading = event.target.value; });
byId('modal-width').addEventListener('input', event => { modalLive.width = Number(event.target.value); });
for (const [control, property] of [['centered', 'centered'], ['closable', 'closable'], ['mask', 'maskClosable'], ['keyboard', 'keyboard'], ['footer', 'showFooter'], ['destroy', 'destroyOnHidden']]) {
  byId('modal-' + control).addEventListener('change', event => { modalLive[property] = event.target.checked; });
}
modalLive.addEventListener('modal-ok', event => {
  if (!byId('modal-async').checked) return;
  event.preventDefault(); modalLive.confirmLoading = true;
  modalConfirmTimer = window.setTimeout(() => { modalConfirmTimer = 0; modalLive.confirmLoading = false; modalLive.close('ok'); }, 900);
});
for (const name of ['modal-open', 'modal-ok', 'modal-cancel', 'modal-close']) modalLive.addEventListener(name, event => {
  if (name === 'modal-close') { window.clearTimeout(modalConfirmTimer); modalConfirmTimer = 0; modalLive.confirmLoading = false; }
  writeEvent(byId('modal-event'), name, event.detail);
});

// QR Code.
const qrCodeLive = byId('qr-code-live');
const qrCodeSlotIcon = qrCodeLive.querySelector('[slot="icon"]');
const qrCodeImage = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" rx="8" fill="#554cc6"/><path d="M10 10v20m20-20v20M10 20h20" fill="none" stroke="white" stroke-width="4"/></svg>');
byId('qr-code-icon-url').value = qrCodeImage;
const syncQRCodeIcon = () => {
  const mode = byId('qr-code-icon-mode').value;
  if (mode === 'slot') { qrCodeLive.icon = ''; if (!qrCodeSlotIcon.isConnected) qrCodeLive.append(qrCodeSlotIcon); }
  else { qrCodeSlotIcon.remove(); qrCodeLive.icon = mode === 'image' ? byId('qr-code-icon-url').value : ''; }
  byId('qr-code-level').value = qrCodeLive.errorCorrectionLevel;
  byId('qr-code-icon-url').disabled = mode !== 'image';
};
byId('qr-code-value').addEventListener('input', event => { qrCodeLive.value = event.target.value; });
byId('qr-code-size').addEventListener('input', event => { qrCodeLive.size = Number(event.target.value); });
byId('qr-code-icon-mode').addEventListener('change', syncQRCodeIcon);
byId('qr-code-icon-url').addEventListener('change', syncQRCodeIcon);
byId('qr-code-icon-size').addEventListener('input', event => { qrCodeLive.iconSize = Number(event.target.value); });
byId('qr-code-icon-margin').addEventListener('input', event => { qrCodeLive.iconMargin = Number(event.target.value); });
byId('qr-code-level').addEventListener('change', event => { qrCodeLive.errorCorrectionLevel = event.target.value; });
byId('qr-code-color').addEventListener('input', event => { qrCodeLive.color = event.target.value; });
for (const name of ['qr-render', 'qr-error', 'qr-icon-error']) qrCodeLive.addEventListener(name, event => writeEvent(byId('qr-code-event'), name, event.detail));
syncQRCodeIcon();

// Carousel.
const carouselLive = byId('carousel-live');
byId('carousel-direction').addEventListener('change', event => { carouselLive.direction = event.target.value; });
byId('carousel-style').addEventListener('change', event => {
  carouselLive.indicatorStyle = event.target.value === 'custom' ? 'dot' : event.target.value;
  carouselLive.indicatorRenderer = event.target.value === 'custom' ? (index, active) => {
    const label = document.createElement('span'); label.className = 'carousel-custom-indicator'; label.textContent = String(index + 1).padStart(2, '0');
    label.style.cssText = 'padding:3px 8px;border-radius:4px;border:1px solid currentColor;font:11px ui-monospace,monospace;opacity:' + (active ? '1' : '.45');
    return label;
  } : null;
});
byId('carousel-position').addEventListener('change', event => { carouselLive.indicatorPosition = event.target.value; });
byId('carousel-interval').addEventListener('change', event => { carouselLive.interval = Number(event.target.value); });
for (const property of ['autoplay', 'draggable', 'loop']) byId('carousel-' + property).addEventListener('change', event => { carouselLive[property] = event.target.checked; });
byId('carousel-previous').addEventListener('click', () => carouselLive.previous());
byId('carousel-next').addEventListener('click', () => carouselLive.next());
carouselLive.addEventListener('change', event => writeEvent(byId('carousel-event'), 'change', event.detail));

// Masonry.
const masonryLive = byId('masonry-live');
byId('masonry-columns').addEventListener('change', event => { masonryLive.columns = Number(event.target.value); });
byId('masonry-min-width').addEventListener('input', event => { masonryLive.minColumnWidth = Number(event.target.value); });
byId('masonry-gap').addEventListener('input', event => { masonryLive.gap = Number(event.target.value); });
let masonrySequence = masonryLive.children.length;
byId('masonry-add').addEventListener('click', () => {
  const card = document.createElement('article');
  card.className = 'masonry-tile';
  const title = document.createElement('h3');
  title.textContent = 'New idea ' + ++masonrySequence;
  const description = document.createElement('p');
  description.textContent = masonrySequence % 2 ? '一张新的灵感卡片。' : '记录一个更完整的想法，让不同高度的卡片自动填补列中的空间。';
  card.append(title, description);
  masonryLive.append(card);
});
byId('masonry-remove').addEventListener('click', () => masonryLive.lastElementChild?.remove());
masonryLive.addEventListener('layout-change', event => writeEvent(byId('masonry-event'), 'layout-change', event.detail));

// Theme preview. Theme styles are independent package exports and flow into component shadow roots via tokens.
const themeButtons = [...document.querySelectorAll('.theme-picker hy-button')];
function setTheme(theme) {
  document.documentElement.dataset.hyTheme = theme;
  document.querySelector('meta[name="theme-color"]').content = theme === 'light' ? '#edf8ff' : '#080b21';
  for (const button of themeButtons) button.setAttribute('aria-pressed', String(button.dataset.theme === theme));
}
for (const button of themeButtons) button.addEventListener('click', () => setTheme(button.dataset.theme));

// Navigation, filtering and the quick component switcher.
const navLinks = [...document.querySelectorAll('#component-nav a')];
const sections = [...document.querySelectorAll('.component-section')];
const search = byId('component-search');

function filterNavigation(query) {
  const normalized = query.trim().toLocaleLowerCase();
  for (const link of navLinks) {
    link.hidden = Boolean(normalized) && !link.dataset.name.includes(normalized);
  }
  for (const label of document.querySelectorAll('.nav-label')) {
    const links = [];
    let item = label.nextElementSibling;
    while (item && !item.classList.contains('nav-label')) {
      if (item.matches('a')) links.push(item);
      item = item.nextElementSibling;
    }
    label.hidden = links.every(link => link.hidden);
  }
}

search.addEventListener('input', () => filterNavigation(search.value.toLocaleLowerCase()));
document.addEventListener('keydown', event => {
  const editing = event.composedPath().some(node => node instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA|HY-INPUT|HY-SELECT)$/.test(node.tagName));
  if (event.key === '/' && !editing) {
    event.preventDefault();
    search.focus();
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLocaleLowerCase() === 'k') {
    event.preventDefault();
    openCommand();
  }
});

const observer = new IntersectionObserver(entries => {
  const visible = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (!visible) return;
  for (const link of navLinks) link.classList.toggle('active', link.hash === `#${visible.target.id}`);
}, { rootMargin: '-18% 0px -66% 0px', threshold: [0, 0.15, 0.5] });
sections.forEach(section => observer.observe(section));

const command = byId('command');
const commandInput = byId('command-input');
const commandResults = byId('command-results');
let commandIndex = 0;

function getCommandItems() {
  const query = commandInput.value.trim().toLocaleLowerCase();
  return sections.filter(section => !query || `${section.dataset.title} ${section.id}`.toLocaleLowerCase().includes(query));
}

function renderCommand() {
  const items = getCommandItems();
  commandIndex = Math.max(0, Math.min(commandIndex, items.length - 1));
  commandResults.replaceChildren(...items.map((section, index) => {
    const button = document.createElement('hy-button');
    button.classList.toggle('active', index === commandIndex);
    const title = document.createElement('span');
    const tag = document.createElement('code');
    title.textContent = section.dataset.title;
    tag.textContent = `hy-${section.id}`;
    button.append(title, tag);
    button.addEventListener('click', () => selectCommand(section));
    return button;
  }));
}

function openCommand() {
  command.hidden = false;
  commandInput.value = '';
  commandIndex = 0;
  renderCommand();
  requestAnimationFrame(() => commandInput.focus());
}

function closeCommand() {
  command.hidden = true;
}

function selectCommand(section) {
  closeCommand();
  section.scrollIntoView({ block: 'start' });
  history.replaceState(null, '', `#${section.id}`);
}

commandInput.addEventListener('input', () => { commandIndex = 0; renderCommand(); });
commandInput.addEventListener('keydown', event => {
  const items = getCommandItems();
  if (event.key === 'ArrowDown') { event.preventDefault(); commandIndex = (commandIndex + 1) % Math.max(items.length, 1); renderCommand(); }
  if (event.key === 'ArrowUp') { event.preventDefault(); commandIndex = (commandIndex - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1); renderCommand(); }
  if (event.key === 'Enter' && items[commandIndex]) { event.preventDefault(); selectCommand(items[commandIndex]); }
  if (event.key === 'Escape') closeCommand();
});
command.querySelector('.command-backdrop').addEventListener('click', closeCommand);

// Button.
const buttonLive = byId('button-live');
byId('button-label').addEventListener('input', event => { buttonLive.setAttribute('label', event.target.value); });
byId('button-icon').addEventListener('input', event => { buttonLive.icon = event.target.value; });
byId('button-icon-position').addEventListener('change', event => { buttonLive.iconPosition = event.target.value; });
byId('button-loading').addEventListener('change', event => { buttonLive.loading = event.target.checked; });
byId('button-disabled').addEventListener('change', event => { setBoolean(buttonLive, 'disabled', event.target.checked); });
buttonLive.addEventListener('click', () => writeEvent(byId('button-event'), 'click', { label: buttonLive.getAttribute('label') }));
const requestButton = byId('button-request');
requestButton.addEventListener('click', async () => {
  requestButton.loading = true;
  writeEvent(byId('button-event'), 'request', { loading: true });
  await new Promise(resolve => setTimeout(resolve, 900));
  requestButton.loading = false;
  writeEvent(byId('button-event'), 'request', { loading: false, status: 200 });
});

// Button group.
const buttonGroupLive = byId('button-group-live');
byId('button-group-orientation').addEventListener('change', event => {
  buttonGroupLive.orientation = event.target.value;
  byId('button-group-event').textContent = `${buttonGroupLive.orientation} · 3 buttons`;
});

// Alert.
const alertLive = byId('alert-live');
byId('alert-type').addEventListener('change', event => { alertLive.type = event.target.value; });
byId('alert-message').addEventListener('input', event => { alertLive.message = event.target.value; });
byId('alert-icon').addEventListener('change', event => { alertLive.showIcon = event.target.checked; });
byId('alert-closable').addEventListener('change', event => { alertLive.closable = event.target.checked; });
byId('alert-banner').addEventListener('change', event => { alertLive.banner = event.target.checked; });
byId('alert-reset').addEventListener('click', () => { alertLive.hidden = false; });
alertLive.addEventListener('alert-close', event => writeEvent(byId('alert-event'), 'alert-close', event.detail));

// Badge.
const badgeLive = byId('badge-live');
const badgeStatusText = { success: 'Online', processing: 'Rendering', warning: 'Review', error: 'Failed', default: 'Idle' };
const renderBadgeState = () => {
  const status = badgeLive.status;
  byId('badge-state').textContent = status ? `${status} · ${badgeLive.text}` : badgeLive.dot ? 'dot notification' : `count · ${badgeLive.count ?? 'empty'}`;
};
byId('badge-count').addEventListener('input', event => { badgeLive.count = event.target.value === '' ? null : Number(event.target.value); renderBadgeState(); });
byId('badge-overflow').addEventListener('input', event => { badgeLive.overflowCount = Number(event.target.value); });
byId('badge-status').addEventListener('change', event => { badgeLive.status = event.target.value || null; badgeLive.text = badgeStatusText[event.target.value] ?? ''; renderBadgeState(); });
byId('badge-color').addEventListener('input', event => { badgeLive.color = event.target.value; });
byId('badge-dot').addEventListener('change', event => { badgeLive.dot = event.target.checked; renderBadgeState(); });
byId('badge-zero').addEventListener('change', event => { badgeLive.showZero = event.target.checked; });
byId('badge-small').addEventListener('change', event => { badgeLive.size = event.target.checked ? 'small' : 'default'; });

const tagLive = byId('tag-live');
byId('tag-label').addEventListener('input', event => { tagLive.label = event.target.value; });
byId('tag-variant').addEventListener('change', event => { tagLive.variant = event.target.value; });
byId('tag-size').addEventListener('change', event => { tagLive.size = event.target.value; });
byId('tag-closable').addEventListener('change', event => { tagLive.closable = event.target.checked; });
byId('tag-checkable').addEventListener('change', event => { tagLive.checkable = event.target.checked; });
byId('tag-checked').addEventListener('change', event => { tagLive.checked = event.target.checked; });
byId('tag-reset').addEventListener('click', () => { tagLive.hidden = false; });
tagLive.addEventListener('tag-close', event => writeEvent(byId('tag-event'), 'tag-close', event.detail));
tagLive.addEventListener('checked-change', event => {
  byId('tag-checked').checked = event.detail.checked;
  writeEvent(byId('tag-event'), 'checked-change', event.detail);
});

// Input.
const inputText = byId('input-text');
const inputValue = byId('input-value');
byId('input-type').addEventListener('change', event => {
  const type = event.target.value;
  inputText.type = type;
  if (type === 'color') inputText.value = '#68a8ff';
  else if (type === 'number') inputText.value = '1';
  else inputText.value = inputValue.value;
  inputValue.value = inputText.value;
});
inputValue.addEventListener('input', event => { inputText.value = event.target.value; });
byId('input-prefix').addEventListener('input', event => { inputText.prefix = event.target.value; });
byId('input-suffix').addEventListener('input', event => { inputText.suffix = event.target.value; });
byId('input-disabled').addEventListener('change', event => { inputText.disabled = event.target.checked; });
byId('input-readonly').addEventListener('change', event => { inputText.readOnly = event.target.checked; });
byId('input-required').addEventListener('change', event => { setBoolean(inputText, 'required', event.target.checked); });
inputText.addEventListener('value-change', event => {
  inputValue.value = event.detail.value;
  writeEvent(byId('input-event'), 'value-change', event.detail);
});
for (const id of ['input-number', 'input-color']) {
  byId(id).addEventListener('value-change', event => writeEvent(byId('input-event'), 'value-change', event.detail));
}
byId('input-search').addEventListener('search', event => writeEvent(byId('input-event'), 'search', event.detail));

// Range.
const rangeSingle = byId('range-single');
const rangeLive = byId('range-live');
const writeRangeValue = (target, value) => {
  target.textContent = Array.isArray(value) ? `${value[0]} — ${value[1]}` : String(value);
};
rangeSingle.addEventListener('value-input', event => writeRangeValue(byId('range-single-value'), event.detail.value));
rangeSingle.addEventListener('value-change', event => writeEvent(byId('range-event'), 'value-change', event.detail));
rangeLive.addEventListener('value-input', event => {
  writeRangeValue(byId('range-live-value'), event.detail.value);
  writeEvent(byId('range-event'), 'value-input', event.detail);
});
rangeLive.addEventListener('value-change', event => writeEvent(byId('range-event'), 'value-change', event.detail));
byId('range-handle-size').addEventListener('input', event => {
  rangeLive.style.setProperty('--hy-range-handle-size', `${event.target.value}px`);
  byId('range-handle-size-value').textContent = `${event.target.value} px`;
});
byId('range-handle-radius').addEventListener('input', event => {
  rangeLive.style.setProperty('--hy-range-handle-radius', `${event.target.value}%`);
  byId('range-handle-radius-value').textContent = `${event.target.value} %`;
});
byId('range-rail-height').addEventListener('input', event => {
  rangeLive.style.setProperty('--hy-range-rail-height', `${event.target.value}px`);
  byId('range-rail-height-value').textContent = `${event.target.value} px`;
});
byId('range-track-color').addEventListener('input', event => {
  rangeLive.style.setProperty('--hy-range-track-color', event.target.value);
  rangeLive.style.setProperty('--hy-range-handle-border-color', event.target.value);
});

// Checkbox and radio.
const checkboxLive = byId('checkbox-live');
byId('checkbox-label').addEventListener('input', event => { checkboxLive.label = event.target.value; });
byId('checkbox-checked').addEventListener('change', event => { checkboxLive.checked = event.target.checked; });
byId('checkbox-mixed').addEventListener('change', event => { checkboxLive.indeterminate = event.target.checked; });
byId('checkbox-disabled').addEventListener('change', event => { checkboxLive.disabled = event.target.checked; });
checkboxLive.addEventListener('checked-change', event => {
  byId('checkbox-checked').checked = event.detail.checked;
  byId('checkbox-mixed').checked = false;
  writeEvent(byId('checkbox-event'), 'checked-change', event.detail);
});
document.querySelector('#radio .preview').addEventListener('checked-change', event => writeEvent(byId('radio-event'), 'checked-change', event.detail));

// Rate.
const rateLive = byId('rate-live');
rateLive.tooltips = ['Poor', 'Fair', 'Good', 'Very good', 'Excellent'];
byId('rate-count').addEventListener('change', event => { rateLive.count = Number(event.target.value); });
byId('rate-character').addEventListener('change', event => { rateLive.character = event.target.value; });
byId('rate-half').addEventListener('change', event => { rateLive.allowHalf = event.target.checked; });
byId('rate-clear').addEventListener('change', event => { rateLive.allowClear = event.target.checked; });
byId('rate-disabled').addEventListener('change', event => { rateLive.disabled = event.target.checked; });
byId('rate-readonly').addEventListener('change', event => { rateLive.readOnly = event.target.checked; });
rateLive.addEventListener('value-change', event => { byId('rate-value').textContent = `${event.detail.value} / ${rateLive.count}`; writeEvent(byId('rate-event'), 'value-change', event.detail); });
rateLive.addEventListener('hover-change', event => { if (event.detail.value != null) byId('rate-value').textContent = `${event.detail.value} / ${rateLive.count}`; });

// Divider.
const dividerLive = byId('divider-live');
byId('divider-label').addEventListener('input', event => { dividerLive.label = event.target.value; });
byId('divider-style').addEventListener('change', event => { dividerLive.lineStyle = event.target.value; });
byId('divider-placement').addEventListener('change', event => { dividerLive.textPlacement = event.target.value; });
byId('divider-thickness').addEventListener('input', event => { dividerLive.thickness = Number(event.target.value); byId('divider-thickness-value').textContent = `${event.target.value} px`; });
byId('divider-color').addEventListener('input', event => { dividerLive.color = event.target.value; });

// Select.
const selectLive = byId('select-live');
selectLive.options = [
  { label: 'Low — fast preview', value: 'low' },
  { label: 'Medium — balanced', value: 'medium' },
  { label: 'High — production', value: 'high' },
  { label: 'Ultra — unavailable', value: 'ultra', disabled: true },
];
byId('select-value').addEventListener('change', event => { selectLive.value = event.target.value; });
byId('select-searchable').addEventListener('change', event => { selectLive.searchable = event.target.checked; });
byId('select-disabled').addEventListener('change', event => { selectLive.disabled = event.target.checked; });
selectLive.addEventListener('value-change', event => {
  byId('select-value').value = event.detail.value;
  writeEvent(byId('select-event'), 'value-change', event.detail);
});

// Segmented.
const segmentedLive = byId('segmented-live');
segmentedLive.options = [
  { label: 'Preview', value: 'preview', icon: '◉' },
  { label: 'Code', value: 'code', icon: '</>' },
  { label: 'Compare', value: 'compare', icon: '◫' },
  { label: 'Deploy', value: 'deploy', disabled: true },
];
byId('segmented-size').addEventListener('change', event => { segmentedLive.size = event.target.value; });
byId('segmented-block').addEventListener('change', event => { segmentedLive.block = event.target.checked; });
byId('segmented-disabled').addEventListener('change', event => { segmentedLive.disabled = event.target.checked; });
byId('segmented-next').addEventListener('click', () => { segmentedLive.select('code'); });
segmentedLive.addEventListener('value-change', event => writeEvent(byId('segmented-event'), 'value-change', event.detail));

// Cascader.
const cascaderLive = byId('cascader-live');
cascaderLive.options = [
  { label: 'Project', value: 'project', children: [
    { label: 'Scenes', value: 'scenes', children: [
      { label: 'Moon Temple', value: 'temple' },
      { label: 'Crystal Shore', value: 'shore' },
    ] },
    { label: 'Assets', value: 'assets', children: [
      { label: 'Characters', value: 'characters' },
      { label: 'Materials', value: 'materials' },
    ] },
  ] },
  { label: 'Packages', value: 'packages', children: [
    { label: 'Built-in', value: 'builtin' },
    { label: 'Remote', value: 'remote', disabled: true },
  ] },
];
byId('cascader-separator').addEventListener('change', event => { cascaderLive.displaySeparator = event.target.value; });
byId('cascader-clearable').addEventListener('change', event => { cascaderLive.clearable = event.target.checked; });
byId('cascader-parent').addEventListener('change', event => { cascaderLive.changeOnSelect = event.target.checked; });
byId('cascader-disabled').addEventListener('change', event => { cascaderLive.disabled = event.target.checked; });
byId('cascader-reset').addEventListener('click', () => { cascaderLive.value = ['project', 'scenes', 'temple']; });
cascaderLive.addEventListener('value-change', event => writeEvent(byId('cascader-event'), 'value-change', {
  value: event.detail.value,
  labels: event.detail.options.map(option => option.label),
}));
cascaderLive.addEventListener('open-change', event => {
  if (!event.detail.open) return;
  writeEvent(byId('cascader-event'), 'open-change', event.detail);
});

// Date picker.
const datePickerLive = byId('date-picker-live');
byId('date-picker-week').addEventListener('change', event => { datePickerLive.weekStart = Number(event.target.value); });
byId('date-picker-clearable').addEventListener('change', event => { datePickerLive.clearable = event.target.checked; });
byId('date-picker-disabled').addEventListener('change', event => { datePickerLive.disabled = event.target.checked; });
byId('date-picker-reset').addEventListener('click', () => { datePickerLive.value = '2026-10-14'; });
datePickerLive.addEventListener('value-change', event => writeEvent(byId('date-picker-event'), 'value-change', { value: event.detail.value }));

// Time picker.
const timePickerLive = byId('time-picker-live');
byId('time-picker-step').addEventListener('change', event => { timePickerLive.minuteStep = Number(event.target.value); });
byId('time-picker-seconds').addEventListener('change', event => { timePickerLive.showSeconds = event.target.checked; });
byId('time-picker-clearable').addEventListener('change', event => { timePickerLive.clearable = event.target.checked; });
byId('time-picker-disabled').addEventListener('change', event => { timePickerLive.disabled = event.target.checked; });
byId('time-picker-reset').addEventListener('click', () => { timePickerLive.value = timePickerLive.showSeconds ? '10:30:00' : '10:30'; });
timePickerLive.addEventListener('value-change', event => writeEvent(byId('time-picker-event'), 'value-change', event.detail));

// Skeleton.
const skeletonLive = byId('skeleton-live');
const renderSkeletonState = () => { byId('skeleton-state').textContent = `${skeletonLive.loading ? 'skeleton' : 'content'} · ${skeletonLive.rows} rows · ${skeletonLive.size}`; };
byId('skeleton-loading').addEventListener('change', event => { skeletonLive.loading = event.target.checked; renderSkeletonState(); });
byId('skeleton-active').addEventListener('change', event => { skeletonLive.active = event.target.checked; });
byId('skeleton-avatar').addEventListener('change', event => { skeletonLive.avatar = event.target.checked; });
byId('skeleton-round').addEventListener('change', event => { skeletonLive.round = event.target.checked; });
byId('skeleton-size').addEventListener('change', event => { skeletonLive.size = event.target.value; renderSkeletonState(); });
byId('skeleton-rows').addEventListener('input', event => { skeletonLive.rows = Number(event.target.value); byId('skeleton-rows-value').textContent = event.target.value; renderSkeletonState(); });

// Watermark.
const watermarkLive = byId('watermark-live');
byId('watermark-content').addEventListener('input', event => { watermarkLive.content = event.target.value; });
byId('watermark-rotate').addEventListener('input', event => { watermarkLive.rotate = Number(event.target.value); byId('watermark-rotate-value').textContent = `${event.target.value}°`; });
byId('watermark-gap').addEventListener('input', event => { watermarkLive.gapX = Number(event.target.value); watermarkLive.gapY = Number(event.target.value) * 0.8; byId('watermark-gap-value').textContent = `${event.target.value} px`; });
byId('watermark-opacity').addEventListener('input', event => { watermarkLive.opacity = Number(event.target.value); byId('watermark-opacity-value').textContent = event.target.value; });
byId('watermark-color').addEventListener('input', event => { watermarkLive.color = event.target.value; });

// Timeline.
const timelineLive = byId('timeline-live');
const timelineItems = [
  { key: 'open', label: '10:18', title: 'Scene opened', description: 'Moon Temple loaded from local project.', status: 'default' },
  { key: 'light', label: '10:21', title: 'Lighting updated', description: 'Moon key light intensity changed.', status: 'info' },
  { key: 'save', label: '10:24', title: 'Scene saved', description: 'All local changes persisted.', status: 'success', dot: '✓' },
  { key: 'build', label: '10:26', title: 'Build completed', description: 'Web target compiled in 1.8 seconds.', status: 'success' },
  { key: 'review', label: '10:27', title: 'Asset warning', description: 'One texture can be optimized.', status: 'warning', color: '#f2b84b' },
];
const renderTimeline = () => { const count = Number(byId('timeline-count').value); timelineLive.items = timelineItems.slice(0, count); byId('timeline-state').textContent = `${count} events · ${timelineLive.mode}${timelineLive.reverse ? ' · reversed' : ''}`; };
byId('timeline-mode').addEventListener('change', event => { timelineLive.mode = event.target.value; renderTimeline(); });
byId('timeline-reverse').addEventListener('change', event => { timelineLive.reverse = event.target.checked; renderTimeline(); });
byId('timeline-pending').addEventListener('change', event => { timelineLive.pending = event.target.checked ? 'Rendering next frame' : ''; });
byId('timeline-count').addEventListener('change', renderTimeline);
renderTimeline();

// Steps.
const stepsLive = byId('steps-live');
const stepItems = [
  { key: 'scene', title: 'Scene', description: 'Prepare content' },
  { key: 'build', title: 'Build', description: 'Compile assets', subtitle: '1.8s' },
  { key: 'review', title: 'Review', description: 'Validate output' },
  { key: 'publish', title: 'Publish', description: 'Upload release' },
];
const renderSteps = () => { stepsLive.items = stepItems.map((item, index) => index === 2 && byId('steps-error').checked ? { ...item, status: 'error' } : item); const current = stepsLive.current; byId('steps-current').value = String(current); byId('steps-state').textContent = `${stepItems[current].title} · step ${current + 1} of ${stepItems.length}`; };
byId('steps-direction').addEventListener('change', event => { stepsLive.direction = event.target.value; });
byId('steps-current').addEventListener('change', event => { stepsLive.current = Number(event.target.value); renderSteps(); });
byId('steps-size').addEventListener('change', event => { stepsLive.size = event.target.value; });
byId('steps-clickable').addEventListener('change', event => { stepsLive.clickable = event.target.checked; });
byId('steps-error').addEventListener('change', renderSteps);
stepsLive.addEventListener('step-change', event => { writeEvent(byId('steps-state'), 'step-change', { current: event.detail.current, key: event.detail.item.key }); byId('steps-current').value = String(event.detail.current); });
renderSteps();

// Anchor.
const anchorLive = byId('anchor-live');
const anchorScroll = byId('anchor-scroll');
anchorLive.items = [
  { title: 'Overview', href: '#anchor-overview' },
  { title: 'Assets', href: '#anchor-assets', children: [{ title: 'Lighting', href: '#anchor-lighting' }] },
  { title: 'Publish', href: '#anchor-publish' },
];
anchorLive.scrollContainer = anchorScroll;
byId('anchor-direction').addEventListener('change', event => { anchorLive.direction = event.target.value; });
byId('anchor-offset').addEventListener('input', event => {
  anchorLive.offsetTop = Number(event.target.value);
  byId('anchor-offset-value').textContent = `${event.target.value} px`;
});
byId('anchor-smooth').addEventListener('change', event => { anchorLive.smooth = event.target.checked; });
byId('anchor-publish-button').addEventListener('click', () => { anchorLive.scrollToAnchor('#anchor-publish'); });
anchorLive.addEventListener('anchor-change', event => { byId('anchor-event').textContent = `active · ${event.detail.href}`; });
anchorLive.addEventListener('anchor-click', event => writeEvent(byId('anchor-event'), 'anchor-click', { href: event.detail.href }));

// Affix.
const affixLive = byId('affix-live');
const affixScroll = byId('affix-scroll');
affixLive.target = affixScroll;
byId('affix-position').addEventListener('change', event => {
  if (event.target.value === 'bottom') { affixLive.topOffset = null; affixLive.bottomOffset = Number(byId('affix-offset').value); }
  else { affixLive.bottomOffset = null; affixLive.topOffset = Number(byId('affix-offset').value); }
  affixLive.refresh();
});
byId('affix-offset').addEventListener('input', event => {
  const value = Number(event.target.value);
  if (byId('affix-position').value === 'bottom') affixLive.bottomOffset = value;
  else affixLive.topOffset = value;
  byId('affix-offset-value').textContent = `${value} px`;
});
byId('affix-disabled').addEventListener('change', event => { affixLive.disabled = event.target.checked; });
byId('affix-reset').addEventListener('click', () => affixScroll.scrollTo({ top: 0, behavior: 'smooth' }));
affixLive.addEventListener('affix-change', event => { byId('affix-state').textContent = event.detail.affixed ? 'affixed inside custom target' : 'not affixed'; });

// Tour.
const tourLive = byId('tour-live');
tourLive.steps = [
  { title: 'Choose a scene', description: 'Start by selecting an object in the scene tree.', target: '#tour-target-scene' },
  { title: 'Adjust lighting', description: 'Tune color and intensity before the final render.', target: '#tour-target-light' },
  { title: 'Publish the build', description: 'Create a shareable version when everything is ready.', target: '#tour-target-publish' },
];
byId('tour-placement').addEventListener('change', event => { tourLive.placement = event.target.value; });
byId('tour-mask').addEventListener('change', event => { tourLive.mask = event.target.checked; });
byId('tour-mask-close').addEventListener('change', event => { tourLive.closeOnMask = event.target.checked; });
byId('tour-launch').addEventListener('click', () => tourLive.start());
tourLive.addEventListener('tour-change', event => { byId('tour-state').textContent = `step ${event.detail.current + 1} of ${tourLive.steps.length}`; });
tourLive.addEventListener('tour-close', event => { byId('tour-state').textContent = `closed · ${event.detail.reason}`; });
tourLive.addEventListener('tour-finish', () => { byId('tour-state').textContent = 'tour complete'; });

// Collapse.
const collapseLive = byId('collapse-live');
collapseLive.items = [
  { key: 'scene', title: 'Scene settings', content: 'Configure the active camera, world environment, and render target.', extra: '3 fields' },
  { key: 'assets', title: 'Asset pipeline', content: 'Review models, textures, materials, and their import settings.', extra: '12 assets' },
  { key: 'publish', title: 'Publish options', content: 'Select a target, optimize the bundle, and create a shareable build.', extra: 'Web' },
  { key: 'archive', title: 'Archived builds', content: 'Archived builds are read-only.', disabled: true },
];
byId('collapse-icon-position').addEventListener('change', event => { collapseLive.iconPosition = event.target.value; });
byId('collapse-trigger').addEventListener('change', event => { collapseLive.collapsible = event.target.value; });
byId('collapse-accordion').addEventListener('change', event => { collapseLive.accordion = event.target.checked; });
byId('collapse-bordered').addEventListener('change', event => { collapseLive.bordered = event.target.checked; });
byId('collapse-ghost').addEventListener('change', event => { collapseLive.ghost = event.target.checked; });
byId('collapse-destroy').addEventListener('change', event => { collapseLive.destroyOnHidden = event.target.checked; });
byId('collapse-animated').addEventListener('change', event => { collapseLive.animated = event.target.checked; });
byId('collapse-animation-duration').addEventListener('change', event => { collapseLive.animationDuration = Number(event.target.value); });
collapseLive.addEventListener('collapse-change', event => { byId('collapse-state').textContent = `active · ${event.detail.activeKeys.join(', ') || 'none'}`; });

// Tabs.
const tabsLive = byId('tabs-live');
tabsLive.options = [
  { label: 'Scene', value: 'scene' },
  { label: 'Assets', value: 'assets' },
  { label: 'Settings', value: 'settings' },
  { label: 'Build', value: 'build', disabled: true },
];
tabsLive.addEventListener('tab-change', event => writeEvent(byId('tabs-event'), 'tab-change', event.detail));

// Breadcrumb.
const breadcrumbLive = byId('breadcrumb-live');
const breadcrumbItems = [
  { key: 'projects', title: 'Projects', href: '#projects' },
  { key: 'ocean', title: 'Ocean World' },
  { key: 'scenes', title: 'Scenes', href: '#scenes' },
  { key: 'temple', title: 'Moon Temple', href: '#moon-temple' },
  { key: 'lighting', title: 'Lighting' },
];
const renderBreadcrumb = () => {
  const depth = Number(byId('breadcrumb-depth').value);
  breadcrumbLive.items = breadcrumbItems.slice(0, depth).map(item => (
    item.key === 'scenes' ? { ...item, disabled: byId('breadcrumb-disabled').checked } : item
  ));
};
byId('breadcrumb-separator').addEventListener('change', event => { breadcrumbLive.separator = event.target.value; });
byId('breadcrumb-depth').addEventListener('change', renderBreadcrumb);
byId('breadcrumb-disabled').addEventListener('change', renderBreadcrumb);
breadcrumbLive.addEventListener('breadcrumb-click', event => {
  event.preventDefault();
  writeEvent(byId('breadcrumb-event'), 'breadcrumb-click', { index: event.detail.index, key: event.detail.item.key });
});
renderBreadcrumb();

// Dropdown.
const dropdownLive = byId('dropdown-live');
dropdownLive.items = [
  { label: 'Web project', value: 'web' },
  { label: 'Desktop bundle', value: 'desktop' },
  { separator: true },
  { label: 'Cloud build (offline)', value: 'cloud', disabled: true },
];
byId('dropdown-placement').addEventListener('change', event => { dropdownLive.placement = event.target.value; });
byId('dropdown-disabled').addEventListener('change', event => { dropdownLive.disabled = event.target.checked; });
dropdownLive.addEventListener('item-select', event => writeEvent(byId('dropdown-event'), 'item-select', event.detail));

// Tooltip.
const tooltipLive = byId('tooltip-live');
byId('tooltip-placement').addEventListener('change', event => { tooltipLive.placement = event.target.value; });
byId('tooltip-delay').addEventListener('input', event => {
  tooltipLive.delay = Number(event.target.value);
  byId('tooltip-delay-value').textContent = `${event.target.value} ms`;
});
byId('tooltip-arrow').addEventListener('change', event => { tooltipLive.arrow = event.target.checked; });
byId('tooltip-disabled').addEventListener('change', event => { setBoolean(tooltipLive, 'disabled', event.target.checked); });

// Dialog.
const dialogLive = byId('dialog-live');
byId('dialog-open').addEventListener('click', () => dialogLive.showModal());
byId('dialog-cancel').addEventListener('click', () => dialogLive.close('cancel'));
byId('dialog-confirm').addEventListener('click', () => dialogLive.close('confirm'));
byId('dialog-heading').addEventListener('input', event => { dialogLive.heading = event.target.value; });
byId('dialog-dismissible').addEventListener('change', event => { dialogLive.dismissible = event.target.checked; });
dialogLive.addEventListener('dialog-close', event => writeEvent(byId('dialog-event'), 'dialog-close', event.detail));

// Drawer.
const drawerLive = byId('drawer-live');
byId('drawer-open').addEventListener('click', () => drawerLive.show());
byId('drawer-placement').addEventListener('change', event => { drawerLive.placement = event.target.value; });
byId('drawer-mask').addEventListener('change', event => { drawerLive.mask = event.target.checked; });
byId('drawer-destroy').addEventListener('change', event => { drawerLive.destroyOnHidden = event.target.checked; });
drawerLive.addEventListener('click', event => {
  if (event.composedPath().some(target => target instanceof Element && target.id === 'drawer-close')) drawerLive.close('action');
});
drawerLive.addEventListener('drawer-close', event => {
  window.setTimeout(() => writeEvent(byId('drawer-event'), 'drawer-close', {
    ...event.detail,
    mountedChildren: drawerLive.childElementCount,
  }), drawerLive.destroyOnHidden ? 230 : 0);
});

// Notification.
const notificationLive = byId('notification-live');
const notificationMessages = {
  success: ['Export complete', 'The project package is ready to download.'],
  info: ['Build started', 'Shaders and assets are being processed.'],
  warning: ['Texture budget', 'The current scene is close to its memory budget.'],
  error: ['Upload failed', 'The remote asset service did not respond.'],
};
let notificationSequence = 0;
const showNotification = type => {
  const [message, description] = notificationMessages[type];
  return notificationLive.open({
    type,
    message: `${message} · ${++notificationSequence}`,
    description,
  });
};
byId('notification-show').addEventListener('click', () => showNotification(byId('notification-type').value));
byId('notification-stack').addEventListener('click', () => {
  ['success', 'info', 'warning', 'error'].forEach(type => showNotification(type));
});
byId('notification-placement').addEventListener('change', event => { notificationLive.placement = event.target.value; });
byId('notification-duration').addEventListener('input', event => {
  notificationLive.duration = Number(event.target.value);
  byId('notification-duration-value').textContent = `${Number(event.target.value).toFixed(1)} s`;
});
byId('notification-progress').addEventListener('change', event => { notificationLive.showProgress = event.target.checked; });
notificationLive.addEventListener('notification-open', event => writeEvent(byId('notification-event'), 'notification-open', event.detail));
notificationLive.addEventListener('notification-close', event => writeEvent(byId('notification-event'), 'notification-close', event.detail));

const toastLive = byId('toast-live');
const toastMessages = { success: 'Saved successfully', info: 'A new version is available', warning: 'Storage is almost full', error: 'Export failed', loading: 'Exporting project…' };
let toastSequence = 0;
const showToast = type => toastLive.open({ type, message: `${toastMessages[type]} · ${++toastSequence}`, duration: type === 'loading' ? 0 : toastLive.duration });
byId('toast-show').addEventListener('click', () => showToast(byId('toast-type').value));
byId('toast-stack').addEventListener('click', () => ['success', 'info', 'warning', 'error'].forEach((type, index) => window.setTimeout(() => showToast(type), index * 90)));
byId('toast-clear').addEventListener('click', () => toastLive.clear());
byId('toast-placement').addEventListener('change', event => { toastLive.placement = event.target.value; });
byId('toast-duration').addEventListener('input', event => { toastLive.duration = Number(event.target.value); byId('toast-duration-value').textContent = `${Number(event.target.value).toFixed(1)} s`; });
byId('toast-count').addEventListener('input', event => { toastLive.maxCount = Number(event.target.value); byId('toast-count-value').textContent = event.target.value; });
byId('toast-closable').addEventListener('change', event => { toastLive.closable = event.target.checked; });
toastLive.addEventListener('toast-open', event => writeEvent(byId('toast-event'), 'toast-open', event.detail));
toastLive.addEventListener('toast-close', event => writeEvent(byId('toast-event'), 'toast-close', event.detail));

// Border beam.
const borderBeamLive = byId('border-beam-live');
byId('border-beam-thickness').addEventListener('input', event => {
  borderBeamLive.thickness = Number(event.target.value);
  byId('border-beam-thickness-value').textContent = `${Number(event.target.value).toFixed(1)} px`;
});
byId('border-beam-speed').addEventListener('input', event => {
  borderBeamLive.speed = Number(event.target.value);
  byId('border-beam-speed-value').textContent = `${Number(event.target.value).toFixed(1)}×`;
});
byId('border-beam-color').addEventListener('input', event => { borderBeamLive.color = event.target.value; });
byId('border-beam-count').addEventListener('input', event => {
  borderBeamLive.count = Number(event.target.value);
  byId('border-beam-count-value').textContent = event.target.value;
});

// Virtual mouse. It visualizes actions and emits events without synthesizing input on page elements.
const virtualMouseLive = byId('virtual-mouse-live');
const virtualMouseStage = byId('virtual-mouse-stage');
const virtualMouseEvent = byId('virtual-mouse-event');
const virtualMouseImage = (fill, label) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><path d="M3 2 31 25l-12 2 7 9-6 1-7-10-9 8Z" fill="${fill}" stroke="white" stroke-width="2"/><text x="22" y="14" fill="white" font-size="8" font-family="sans-serif">${label}</text></svg>`)}`;
const virtualMouseImages = {
  idle: virtualMouseImage('#397da6', ''),
  'left-down': virtualMouseImage('#35a9cc', 'L'),
  'middle-down': virtualMouseImage('#7654e8', 'M'),
  'right-down': virtualMouseImage('#9b55ce', 'R'),
};
const showVirtualMouseAtStage = async (animate = false) => {
  const rect = virtualMouseStage.getBoundingClientRect();
  virtualMouseLive.show();
  await virtualMouseLive.moveTo(rect.left + 55, rect.top + 72, { animate });
  return rect;
};
byId('virtual-mouse-play').addEventListener('click', async () => {
  const rect = await showVirtualMouseAtStage(false);
  const points = [
    [rect.right - 72, rect.top + 72],
    [rect.left + rect.width * 0.52, rect.bottom - 70],
    [rect.left + 70, rect.top + rect.height * 0.55],
  ];
  for (const [x, y] of points) await virtualMouseLive.moveTo(x, y);
  await virtualMouseLive.leftClick();
});
byId('virtual-mouse-left').addEventListener('click', async () => {
  await showVirtualMouseAtStage(false);
  await virtualMouseLive.leftClick();
});
byId('virtual-mouse-right').addEventListener('click', async () => {
  await showVirtualMouseAtStage(false);
  await virtualMouseLive.rightClick();
});
byId('virtual-mouse-hide').addEventListener('click', () => virtualMouseLive.hide());
byId('virtual-mouse-animated').addEventListener('change', event => { virtualMouseLive.animated = event.target.checked; });
byId('virtual-mouse-duration').addEventListener('input', event => {
  virtualMouseLive.duration = Number(event.target.value);
  byId('virtual-mouse-duration-value').textContent = `${event.target.value} ms`;
});
byId('virtual-mouse-color').addEventListener('input', event => {
  virtualMouseLive.style.setProperty('--hy-virtual-mouse-idle-background', event.target.value);
  virtualMouseLive.style.setProperty('--hy-virtual-mouse-left-down-background', `color-mix(in srgb, ${event.target.value} 72%, white)`);
});
byId('virtual-mouse-images').addEventListener('change', event => {
  virtualMouseLive.images = event.target.checked ? virtualMouseImages : {};
});
for (const name of ['virtual-mouse-move-end', 'virtual-mouse-down', 'virtual-mouse-up', 'virtual-mouse-click']) {
  virtualMouseLive.addEventListener(name, event => writeEvent(virtualMouseEvent, name, event.detail));
}

// Virtual keyboard. Pointer/API input edits a bound target; physical sync only mirrors native key state.
const virtualKeyboardLive = byId('virtual-keyboard-live');
const virtualKeyboardTarget = byId('virtual-keyboard-target');
const virtualKeyboardEvent = byId('virtual-keyboard-event');
virtualKeyboardLive.target = virtualKeyboardTarget;
virtualKeyboardTarget.setSelectionRange(virtualKeyboardTarget.value.length, virtualKeyboardTarget.value.length);
byId('virtual-keyboard-type').addEventListener('click', async () => { virtualKeyboardTarget.focus(); await virtualKeyboardLive.type('Haiyue UI 2.0!', { interval: 30 }); });
byId('virtual-keyboard-clear').addEventListener('click', () => virtualKeyboardLive.clear());
byId('virtual-keyboard-physical').addEventListener('change', event => { virtualKeyboardLive.physicalSync = event.target.checked; });
byId('virtual-keyboard-mode').addEventListener('change', event => { virtualKeyboardLive.mode = event.target.value; });
byId('virtual-keyboard-disabled').addEventListener('change', event => { virtualKeyboardLive.disabled = event.target.checked; });
byId('virtual-keyboard-color').addEventListener('input', event => { virtualKeyboardLive.style.setProperty('--hy-virtual-keyboard-active-bg', event.target.value); });
for (const name of ['virtual-keyboard-down', 'virtual-keyboard-up', 'virtual-keyboard-input']) {
  virtualKeyboardLive.addEventListener(name, event => writeEvent(virtualKeyboardEvent, name, event.detail));
}

// Context menu.
const contextLive = byId('context-live');
const contextTarget = byId('context-target');
contextLive.items = [
  { label: 'Open script', value: 'open' },
  { label: 'Rename', value: 'rename' },
  { label: 'Duplicate', value: 'duplicate' },
  { separator: true },
  { label: 'Delete', value: 'delete' },
  { label: 'Reveal in Explorer', value: 'reveal', disabled: true },
];
contextTarget.addEventListener('contextmenu', event => {
  event.preventDefault();
  contextLive.openAt(event.clientX, event.clientY);
});
byId('context-open').addEventListener('click', event => {
  const rect = event.currentTarget.getBoundingClientRect();
  contextLive.openAt(rect.left, rect.bottom + 6);
});
contextLive.addEventListener('item-select', event => writeEvent(byId('context-event'), 'item-select', event.detail));

// Draggable container. The preview is the parent constraint and the title is the only drag handle.
const draggableLive = byId('draggable-live');
const draggablePosition = byId('draggable-position');
const draggableEvent = byId('draggable-event');
const updateDraggablePosition = () => { draggablePosition.textContent = `${Math.round(draggableLive.x)}, ${Math.round(draggableLive.y)}`; };
byId('draggable-axis').addEventListener('change', event => { draggableLive.axis = event.target.value; });
byId('draggable-bounds').addEventListener('change', event => { draggableLive.bounds = event.target.value; });
byId('draggable-grid').addEventListener('input', event => {
  draggableLive.grid = Number(event.target.value);
  byId('draggable-grid-value').textContent = `${event.target.value} px`;
});
byId('draggable-disabled').addEventListener('change', event => { draggableLive.disabled = event.target.checked; });
byId('draggable-keyboard').addEventListener('change', event => { draggableLive.keyboard = event.target.checked; });
byId('draggable-move').addEventListener('click', () => { draggableLive.moveBy(48, 32); updateDraggablePosition(); });
byId('draggable-reset').addEventListener('click', () => { draggableLive.reset(); updateDraggablePosition(); });
for (const name of ['drag-start', 'drag-move', 'drag-end']) {
  draggableLive.addEventListener(name, event => { updateDraggablePosition(); writeEvent(draggableEvent, name, event.detail); });
}

// Resizable container. Eight handles resize while the content surface moves the rectangle.
const resizableLive = byId('resizable-live');
const resizableEvent = byId('resizable-event');
const renderResizableRect = () => {
  const { x, y, width, height } = resizableLive.rect;
  byId('resizable-rect').textContent = `${Math.round(x)}, ${Math.round(y)} · ${Math.round(width)} × ${Math.round(height)}`;
  byId('resizable-width').value = String(Math.round(width));
  byId('resizable-height').value = String(Math.round(height));
};
const applyResizableSize = () => { resizableLive.resizeTo(Number(byId('resizable-width').value), Number(byId('resizable-height').value)); renderResizableRect(); };
byId('resizable-width').addEventListener('change', applyResizableSize);
byId('resizable-height').addEventListener('change', applyResizableSize);
byId('resizable-bounds').addEventListener('change', event => { resizableLive.bounds = event.target.value; });
byId('resizable-grid-size').addEventListener('input', event => { resizableLive.grid = Number(event.target.value); byId('resizable-grid-value').textContent = `${event.target.value} px`; });
byId('resizable-aspect').addEventListener('change', event => { resizableLive.aspectRatio = event.target.checked ? 16 / 9 : null; });
byId('resizable-movable').addEventListener('change', event => { resizableLive.movable = event.target.checked; });
byId('resizable-disabled').addEventListener('change', event => { resizableLive.disabled = event.target.checked; });
byId('resizable-grow').addEventListener('click', () => { resizableLive.resizeTo(resizableLive.width + 64, resizableLive.height + 40); renderResizableRect(); });
byId('resizable-reset').addEventListener('click', () => { resizableLive.reset(); renderResizableRect(); });
for (const name of ['resize-start', 'resize', 'resize-end']) {
  resizableLive.addEventListener(name, event => { renderResizableRect(); writeEvent(resizableEvent, name, event.detail); });
}

// Split.
const splitLive = byId('split-live');
const splitRatio = byId('split-ratio');
byId('split-direction').addEventListener('change', event => { splitLive.direction = event.target.value; });
splitRatio.addEventListener('input', event => {
  splitLive.ratio = Number(event.target.value);
  byId('split-ratio-value').textContent = Number(event.target.value).toFixed(2);
});
byId('split-bar').addEventListener('input', event => {
  splitLive.barSize = Number(event.target.value);
  byId('split-bar-value').textContent = `${event.target.value} px`;
});
splitLive.addEventListener('ratio-change', event => {
  splitRatio.value = String(event.detail.ratio);
  byId('split-ratio-value').textContent = event.detail.ratio.toFixed(2);
  writeEvent(byId('split-event'), 'ratio-change', event.detail);
});

// Tree.
const treeLive = byId('tree-live');
const initialTreeData = [
  {
    id: 'scene', label: 'Scene', icon: '◇', expanded: true, children: [
      { id: 'camera', label: 'Main Camera', icon: 'C' },
      {
        id: 'lights', label: 'Lights', icon: 'L', expanded: true, children: [
          { id: 'sun', label: 'Sun', icon: 'D' },
          { id: 'fill', label: 'Fill Light', icon: 'P' },
        ],
      },
      {
        id: 'player', label: 'Player', icon: 'P', expanded: true, children: [
          { id: 'mesh', label: 'Character Mesh', icon: 'M' },
          { id: 'controller', label: 'Player Controller', icon: 'S' },
        ],
      },
    ],
  },
  { id: 'environment', label: 'Environment', icon: 'E' },
];
const resetTree = () => { treeLive.data = structuredClone(initialTreeData); treeLive.selectedIds = []; };
resetTree();
byId('tree-drag').addEventListener('change', event => { treeLive.allowDrag = event.target.checked; });
byId('tree-select').addEventListener('click', () => { treeLive.selectedIds = ['sun', 'fill']; writeEvent(byId('tree-event'), 'selectedIds', treeLive.selectedIds); });
byId('tree-reset').addEventListener('click', () => { resetTree(); writeEvent(byId('tree-event'), 'data', { reset: true }); });
treeLive.addEventListener('selection-change', event => writeEvent(byId('tree-event'), 'selection-change', { selectedIds: event.detail.selectedIds }));
treeLive.addEventListener('data-change', event => writeEvent(byId('tree-event'), 'data-change', { action: event.detail.action, sourceId: event.detail.sourceId, targetId: event.detail.targetId }));
treeLive.addEventListener('node-context-menu', event => writeEvent(byId('tree-event'), 'node-context-menu', { id: event.detail.id, selectedIds: event.detail.selectedIds }));

// Virtual list. The full array remains data; the renderer runs only for the current window.
const virtualListLive = byId('virtual-list-live');
const createVirtualItems = count => Array.from({ length: count }, (_, index) => ({
  id: index + 1,
  name: `Asset ${String(index + 1).padStart(6, '0')}`,
  type: ['Mesh', 'Material', 'Texture', 'Animation'][index % 4],
}));
virtualListLive.renderItem = (item, index) => {
  const row = document.createElement('div');
  row.className = 'virtual-list-row';
  const sequence = document.createElement('span');
  sequence.textContent = String(index + 1).padStart(6, '0');
  const name = document.createElement('b');
  name.textContent = item.name;
  const type = document.createElement('small');
  type.textContent = item.type;
  row.append(sequence, name, type);
  return row;
};
const setVirtualItemCount = count => {
  virtualListLive.items = createVirtualItems(count);
  byId('virtual-list-index').max = String(count - 1);
};
setVirtualItemCount(100_000);
byId('virtual-list-count').addEventListener('change', event => setVirtualItemCount(Number(event.target.value)));
byId('virtual-list-height').addEventListener('input', event => {
  virtualListLive.itemHeight = Number(event.target.value);
  byId('virtual-list-height-value').textContent = `${event.target.value} px`;
});
byId('virtual-list-overscan').addEventListener('input', event => {
  virtualListLive.overscan = Number(event.target.value);
  byId('virtual-list-overscan-value').textContent = event.target.value;
});
byId('virtual-list-jump').addEventListener('click', () => {
  virtualListLive.scrollToIndex(Number(byId('virtual-list-index').value), 'center');
});
virtualListLive.addEventListener('visible-range-change', event => {
  writeEvent(byId('virtual-list-event'), 'visible-range-change', event.detail);
});
virtualListLive.addEventListener('item-click', event => {
  writeEvent(byId('virtual-list-event'), 'item-click', { index: event.detail.index, id: event.detail.item.id });
});
virtualListLive.refresh();

// Table. Local filtering is applied before stable sorting and pagination.
const tableLive = byId('table-live');
const tableStatuses = ['Ready', 'Review', 'Blocked'];
tableLive.columns = [
  { key: 'name', title: 'Asset', width: '40%', sortable: true, filterable: true, filterPlaceholder: 'Filter assets' },
  { key: 'type', title: 'Type', sortable: true, filterable: true, showFilter: false },
  { key: 'status', title: 'Status', filterOptions: tableStatuses.map(value => ({ label: value, value })) },
  { key: 'progress', title: 'Progress', sortable: true, align: 'right', render: value => `${value}%` },
];
tableLive.dataSource = Array.from({ length: 37 }, (_, index) => ({
  name: `Scene Asset ${String(index + 1).padStart(2, '0')}`,
  type: ['Mesh', 'Texture', 'Material', 'Animation'][index % 4],
  status: tableStatuses[index % tableStatuses.length],
  progress: (index * 17 + 23) % 101,
}));
byId('table-page-size').addEventListener('change', event => { tableLive.pageSize = Number(event.target.value); });
byId('table-status').addEventListener('change', event => { tableLive.setFilter('status', event.target.value); });
byId('table-show-filters').addEventListener('change', event => { tableLive.showFilters = event.target.checked; });
byId('table-sort').addEventListener('click', () => tableLive.sortBy('progress'));
byId('table-clear').addEventListener('click', () => {
  tableLive.clearFilters();
  tableLive.clearSort();
  byId('table-status').value = '';
});
tableLive.addEventListener('table-change', event => writeEvent(byId('table-event'), 'table-change', {
  reason: event.detail.reason,
  page: event.detail.page,
  filteredTotal: event.detail.filteredTotal,
  sort: event.detail.sort,
}));
tableLive.addEventListener('row-click', event => writeEvent(byId('table-event'), 'row-click', {
  name: event.detail.record.name,
  index: event.detail.index,
}));

// History controls.
const historyLive = byId('history-live');
byId('history-can-undo').addEventListener('change', event => { historyLive.canUndo = event.target.checked; });
byId('history-can-redo').addEventListener('change', event => { historyLive.canRedo = event.target.checked; });
byId('history-busy').addEventListener('change', event => { historyLive.busy = event.target.checked; });
byId('history-locale').addEventListener('change', event => { historyLive.setAttribute('locale', event.target.value); });
historyLive.addEventListener('undo-request', () => writeEvent(byId('history-event'), 'undo-request', { label: historyLive.undoLabel }));
historyLive.addEventListener('redo-request', () => writeEvent(byId('history-event'), 'redo-request', { label: historyLive.redoLabel }));

const expandable = byId('expandable-live');
byId('expandable-width').addEventListener('change',event => { expandable.expandedWidth = event.target.value; });
byId('expandable-height').addEventListener('change',event => { expandable.expandedHeight = event.target.value; });
byId('expandable-position').addEventListener('change',event => { expandable.buttonPosition = event.target.value; });
expandable.addEventListener('expanded-change',event => writeEvent(byId('expandable-event'), 'expanded-change', event.detail));
