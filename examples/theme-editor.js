const STORAGE_KEY = 'haiyue-gallery-theme-v1';

const colors = [
  ['accent', '强调色'], ['accent-strong', '强调色 · 深'], ['canvas', '页面背景'],
  ['surface', '基础表面'], ['surface-elevated', '浮起表面'], ['panel-bg', '面板背景'],
  ['input-bg', '输入框背景'], ['menu-bg', '菜单背景'], ['text', '主要文字'],
  ['secondary-text', '次要文字'], ['muted', '弱化文字'], ['disabled-text', '禁用文字'],
  ['border', '边框'], ['border-strong', '强调边框'], ['hover-border', '悬停边框'],
  ['hover-bg', '悬停背景'], ['menu-item-hover-bg', '菜单项悬停'],
  ['selected-bg', '选中背景'], ['selected-text', '选中文字'], ['active-text', '激活文字'],
  ['focus-border', '焦点边框'], ['focus-ring', '焦点光环'], ['invalid-border', '校验错误边框'],
  ['info', '信息'], ['success', '成功'], ['warning', '警告'], ['error', '错误'],
  ['on-status', '状态上的文字'], ['on-accent', '强调色上的文字'],
  ['menu-shadow', '菜单阴影'], ['dialog-shadow', '对话框阴影'], ['dialog-backdrop', '对话框遮罩'],
  ['dialog-bg', '对话框背景'], ['dialog-body', '对话框正文'], ['dialog-footer-bg', '对话框页脚'],
  ['tooltip-bg', '提示背景'], ['tooltip-text', '提示文字'], ['tooltip-border', '提示边框'],
  ['tooltip-shadow', '提示阴影'], ['drop-indicator', '拖放指示'], ['drop-target-bg', '拖放目标背景'],
  ['theme-glow', '背景光晕'], ['theme-highlight', '点缀色'], ['shadow', '通用阴影'],
].map(([name, label]) => ({ token: `--hy-${name}-color`, label, type: 'color', group: 'colors' }));

const numbers = (group, prefix, entries, min, max, unit = 'px', step = 1) => entries.map(([name, label]) => ({
  token: `--hy-${prefix}-${name}`, label, type: 'number', group, min, max, unit, step,
}));
const sizes = ['xs', 'sm', 'md', 'lg', 'xl', '2xl'];
const catalog = [
  ...colors,
  { token: '--hy-font-family', label: '正文字体', type: 'font', group: 'type' },
  { token: '--hy-font-family-mono', label: '等宽字体', type: 'font', group: 'type' },
  ...numbers('type', 'font-size', sizes.map(size => [size, `字号 · ${size.toUpperCase()}`]), 8, 96),
  ...numbers('type', 'line-height', ['tight', 'compact', 'snug', 'relaxed', 'loose'].map(size => [size, `行高 · ${size}`]), 1, 3, '', .05),
  ...numbers('type', 'font-weight', ['normal', 'semibold', 'bold', 'heavy'].map(size => [size, `字重 · ${size}`]), 100, 900, '', 100),
  ...numbers('spacing', 'space', [1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 16, 32].map(size => [size, `间距 · ${size}`]), 0, 192),
  ...numbers('radius', 'radius', [...sizes.slice(0, 5), 'full'].map(size => [size, `圆角 · ${size.toUpperCase()}`]), 0, 999),
  ...numbers('controls', 'control-height', sizes.slice(0, 4).map(size => [size, `控件高度 · ${size.toUpperCase()}`]), 20, 96),
];
const groups = { colors: '颜色', type: '字体', spacing: '间距', radius: '圆角', controls: '尺寸' };

function isValid(field, value) {
  if (typeof value !== 'string' || !value.trim() || /[;{}<>]|var\s*\(/i.test(value)) return false;
  if (field.type === 'color') return CSS.supports('color', value);
  if (field.type === 'font') return value.length <= 200 && CSS.supports('font-family', value);
  const numeric = Number(value.replace(/px$/, ''));
  return (!field.unit || /^\d+(?:\.\d+)?px$/.test(value)) && Number.isFinite(numeric) && numeric >= field.min && numeric <= field.max;
}

export function initializeGalleryThemes() {
  const byId = id => document.getElementById(id);
  const root = document.documentElement;
  const buttons = [...document.querySelectorAll('.theme-picker [data-theme]')];
  const settings = byId('theme-settings');
  const trigger = byId('theme-settings-open');
  const triggerButton = trigger.shadowRoot.querySelector('button');
  triggerButton.setAttribute('aria-haspopup', 'dialog');
  triggerButton.ariaControlsElements = [settings];
  const setExpanded = expanded => {
    trigger.setAttribute('aria-expanded', String(expanded));
    triggerButton.setAttribute('aria-expanded', String(expanded));
  };
  setExpanded(false);
  const fields = byId('theme-editor-fields');
  const status = byId('theme-editor-status');

  // Read the actual theme files and the documented terracotta overrides, without duplicating their defaults.
  const probe = document.createElement('div');
  probe.hidden = true;
  probe.dataset.hyTheme = 'light';
  probe.dataset.designSkin = 'terracotta';
  document.body.append(probe);
  const computed = getComputedStyle(probe);
  const defaults = Object.fromEntries(catalog.map(field => [field.token, computed.getPropertyValue(field.token).trim()]));
  probe.remove();

  let skin = 'dark';
  let overrides = {};
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (['light', 'dark', 'custom'].includes(saved?.skin)) skin = saved.skin;
    for (const field of catalog) {
      const value = saved?.overrides?.[field.token];
      if (isValid(field, value)) overrides[field.token] = value.trim();
    }
  } catch { /* Storage may be unavailable or contain an older, invalid value. */ }

  const customStyle = document.createElement('style');
  customStyle.id = 'custom-theme-css';
  document.head.append(customStyle);
  customStyle.sheet.insertRule(':root[data-gallery-skin="custom"], [data-hy-theme="light"][data-design-skin="custom"] {}');
  const declaration = customStyle.sheet.cssRules[0].style;
  declaration.setProperty('color-scheme', 'light');
  declaration.setProperty('--hy-theme-name', '"Haiyue Custom"');
  function syncTokens() {
    for (const field of catalog) declaration.setProperty(field.token, overrides[field.token] ?? defaults[field.token]);
  }
  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ skin, overrides }));
      status.textContent = '已自动保存到当前浏览器';
    } catch { status.textContent = '当前浏览器无法保存，修改仅在本次页面生效'; }
  }
  function setTheme(next) {
    skin = next;
    root.dataset.hyTheme = skin === 'custom' ? 'light' : skin;
    root.dataset.gallerySkin = skin;
    document.querySelector('meta[name="theme-color"]').content = skin === 'custom'
      ? overrides['--hy-canvas-color'] ?? defaults['--hy-canvas-color']
      : skin === 'light' ? '#edf8ff' : '#080b21';
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.theme === skin));
  }
  for (const button of buttons) button.addEventListener('click', () => { setTheme(button.dataset.theme); persist(); });
  syncTokens();
  setTheme(skin);

  // Move the same controls into the hero on small screens where the sidebar is hidden.
  const picker = document.querySelector('.theme-picker');
  const sidebarHome = document.createComment('theme picker');
  picker.before(sidebarHome);
  const mobileHome = document.createElement('div');
  mobileHome.className = 'mobile-theme-slot';
  document.querySelector('.hero').prepend(mobileHome);
  const compact = matchMedia('(max-width: 660px)');
  const positionPicker = () => compact.matches ? mobileHome.append(picker) : sidebarHome.after(picker);
  compact.addEventListener('change', positionPicker);
  positionPicker();

  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  function colorHex(value) {
    context.clearRect(0, 0, 1, 1);
    context.fillStyle = value;
    context.fillRect(0, 0, 1, 1);
    return '#' + [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(byte => byte.toString(16).padStart(2, '0')).join('');
  }

  function renderFields(group) {
    fields.replaceChildren();
    const visible = catalog.filter(field => field.group === group);
    byId('theme-editor-category-title').textContent = groups[group];
    byId('theme-editor-count').textContent = `${visible.length} 项参数`;
    for (const button of byId('theme-editor-categories').children) button.setAttribute('aria-pressed', String(button.dataset.group === group));
    for (const field of visible) {
      const row = document.createElement('div');
      row.className = 'theme-editor-field';
      const label = document.createElement('label');
      const input = document.createElement('input');
      input.id = `theme-token-${field.token.slice(5)}`;
      input.dataset.themeToken = field.token;
      label.htmlFor = input.id;
      label.append(document.createTextNode(field.label));
      const token = document.createElement('small');
      token.textContent = field.token;
      label.append(token);
      const control = document.createElement('div');
      control.className = 'theme-editor-value';
      const current = overrides[field.token] ?? defaults[field.token];
      input.type = field.type === 'number' ? 'number' : 'text';
      input.value = field.type === 'number' ? String(parseFloat(current)) : current;
      input.autocomplete = 'off';
      input.spellcheck = false;
      if (field.type === 'number') {
        input.min = String(field.min); input.max = String(field.max); input.step = String(field.step);
      }
      const error = document.createElement('p');
      error.className = 'theme-editor-error';
      error.id = `${input.id}-error`;
      error.hidden = true;
      input.setAttribute('aria-describedby', error.id);
      let picker;
      if (field.type === 'color') {
        picker = document.createElement('input');
        picker.type = 'color';
        picker.value = colorHex(current);
        picker.setAttribute('aria-label', `${field.label}选色器`);
        picker.title = '选择颜色；透明度可在文本框中使用 HEX / RGBA 调整';
        control.append(picker);
        picker.addEventListener('input', () => { input.value = picker.value; input.dispatchEvent(new Event('input')); });
      }
      control.append(input);
      if (field.unit) {
        const unit = document.createElement('span');
        unit.className = 'theme-editor-unit'; unit.textContent = field.unit; control.append(unit);
      }
      input.addEventListener('input', () => {
        const value = input.value.trim() + (field.unit ?? '');
        const valid = input.value.trim() !== '' && isValid(field, value) && input.validity.valid;
        input.setAttribute('aria-invalid', String(!valid));
        error.hidden = valid;
        if (!valid) {
          status.textContent = '该参数未应用，请检查输入值';
          error.textContent = field.type === 'number' ? `请输入 ${field.min}–${field.max} 之间的有效数值。` : field.type === 'color' ? '请输入有效颜色，例如 #a44932 或 rgba(164, 73, 50, 0.25)。' : '请输入有效的 CSS 字体名称。';
          return;
        }
        if (value === defaults[field.token]) delete overrides[field.token];
        else overrides[field.token] = value;
        declaration.setProperty(field.token, value);
        if (picker) picker.value = colorHex(value);
        setTheme(skin);
        persist();
      });
      row.append(label, control, error);
      fields.append(row);
    }
  }
  for (const [group, label] of Object.entries(groups)) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.group = group; button.textContent = label;
    button.addEventListener('click', () => renderFields(group));
    byId('theme-editor-categories').append(button);
  }
  renderFields('colors');
  trigger.addEventListener('click', () => { settings.showModal(); setExpanded(true); });
  settings.addEventListener('modal-close', () => setExpanded(false));
  byId('theme-reset').addEventListener('click', () => {
    overrides = {}; syncTokens(); setTheme(skin);
    renderFields(byId('theme-editor-categories').querySelector('[aria-pressed="true"]').dataset.group);
    persist();
    status.textContent = '已恢复陶土初始配置';
  });
  byId('theme-apply').addEventListener('click', () => { setTheme('custom'); persist(); settings.close(); });
}
