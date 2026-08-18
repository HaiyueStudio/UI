import { defineHaiyueUI } from '../dist/index.js';

defineHaiyueUI();

const byId = id => document.getElementById(id);
const setBoolean = (element, name, value) => element.toggleAttribute(name, Boolean(value));
const writeEvent = (target, name, detail) => {
  target.textContent = `${name}  ${JSON.stringify(detail)}`;
  target.title = target.textContent;
};

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
    button.innerHTML = `<span>${section.dataset.title}</span><code>ge-${section.id}</code>`;
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
  inputText.type = event.target.value;
  inputText.value = event.target.value === 'color' ? '#68a8ff' : event.target.value === 'number' ? '1' : inputValue.value;
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

// History controls.
const historyLive = byId('history-live');
byId('history-can-undo').addEventListener('change', event => { historyLive.canUndo = event.target.checked; });
byId('history-can-redo').addEventListener('change', event => { historyLive.canRedo = event.target.checked; });
byId('history-busy').addEventListener('change', event => { historyLive.busy = event.target.checked; });
byId('history-locale').addEventListener('change', event => { historyLive.setAttribute('locale', event.target.value); });
historyLive.addEventListener('undo-request', () => writeEvent(byId('history-event'), 'undo-request', { label: historyLive.undoLabel }));
historyLive.addEventListener('redo-request', () => writeEvent(byId('history-event'), 'redo-request', { label: historyLive.redoLabel }));
