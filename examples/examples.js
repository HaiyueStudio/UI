import { defineHaiyueUI } from '../dist/index.js';

defineHaiyueUI();

const byId = id => document.getElementById(id);
const setBoolean = (element, name, value) => element.toggleAttribute(name, Boolean(value));
const writeEvent = (target, name, detail) => {
  target.textContent = `${name}  ${JSON.stringify(detail)}`;
  target.title = target.textContent;
};

// Theme preview. Theme styles are independent package exports and flow into component shadow roots via tokens.
const themeButtons = [...document.querySelectorAll('.theme-picker button')];
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
  if (event.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? '')) {
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
    const button = document.createElement('button');
    button.classList.toggle('active', index === commandIndex);
    button.innerHTML = `<span>${section.dataset.title}</span><code>hy-${section.id}</code>`;
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
byId('button-disabled').addEventListener('change', event => { setBoolean(buttonLive, 'disabled', event.target.checked); });
buttonLive.addEventListener('click', () => writeEvent(byId('button-event'), 'click', { label: buttonLive.getAttribute('label') }));

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
