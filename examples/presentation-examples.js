export function initializePresentationExamples() {
  const byId = id => document.getElementById(id);
  const bind = (id, target, property, event = 'input', read = element => element.value) => {
    byId(id).addEventListener(event, event => { target[property] = read(event.target); });
  };
  const avatar = byId('avatar-live');
  bind('avatar-text', avatar, 'text'); bind('avatar-shape', avatar, 'shape', 'change'); bind('avatar-size', avatar, 'size', 'input', element => Number(element.value));
  byId('avatar-source').addEventListener('change', event => {
    avatar.src = event.target.value === 'image' ? new URL('./assets/haiyue-logo.png', import.meta.url).href : event.target.value === 'broken' ? 'data:image/png;base64,broken' : '';
  });
  for (const name of ['avatar-load', 'avatar-error']) avatar.addEventListener(name, event => {
    byId('avatar-event').textContent = name === 'avatar-load' ? `avatar-load · ${event.detail.naturalWidth} × ${event.detail.naturalHeight}` : 'avatar-error · 已回退到文字';
  });
  const card = byId('card-live');
  bind('card-heading', card, 'heading'); bind('card-size', card, 'size', 'change');
  for (const property of ['bordered', 'hoverable', 'loading']) bind(`card-${property}`, card, property, 'change', element => element.checked);
  byId('card-collect').addEventListener('click', () => { byId('card-event').textContent = '已收藏月光计划'; });
  const ribbon = byId('ribbon-live');
  bind('ribbon-text', ribbon, 'text');
  bind('ribbon-placement', ribbon, 'placement', 'change');
  bind('ribbon-color', ribbon, 'color', 'change');
  const ribbonText = document.createElement('strong');
  ribbonText.slot = 'text';
  ribbonText.textContent = '★ 编辑推荐';
  byId('ribbon-rich').addEventListener('change', event => {
    if (event.target.checked) ribbon.append(ribbonText);
    else ribbonText.remove();
  });
  byId('ribbon-rtl').addEventListener('change', event => { ribbon.dir = event.target.checked ? 'rtl' : 'ltr'; });
  byId('ribbon-collect').addEventListener('click', () => { byId('ribbon-event').textContent = '已收藏星海素材包'; });
  const descriptions = byId('descriptions-live');
  descriptions.items = [
    { key: 'name', label: '名称', value: '月光计划' }, { key: 'owner', label: '负责人', value: 'Lin' },
    { key: 'status', label: '状态', value: '已同步' }, { key: 'files', label: '文件数', value: 24 },
    { key: 'pending', label: '待处理', value: 0 }, { key: 'updated', label: '版本', value: 'v1.0' },
    { key: 'notes', label: '备注', value: '一份用来收集、整理和分享创作灵感的计划。', span: 'filled' },
  ];
  bind('descriptions-column', descriptions, 'column', 'input', element => Number(element.value)); bind('descriptions-layout', descriptions, 'layout', 'change');
  for (const property of ['bordered', 'responsive']) bind(`descriptions-${property}`, descriptions, property, 'change', element => element.checked);
  bind('descriptions-small', descriptions, 'size', 'change', element => element.checked ? 'small' : 'default');
  const empty = byId('empty-live');
  bind('empty-description', empty, 'description'); bind('empty-image', empty, 'image', 'change'); bind('empty-size', empty, 'size', 'change');
  byId('empty-create').addEventListener('click', () => { byId('empty-event').textContent = '已触发创建作品操作'; });
  const result = byId('result-live');
  bind('result-status', result, 'status', 'change'); bind('result-heading', result, 'heading'); bind('result-description', result, 'description');
  byId('result-retry').addEventListener('click', () => {
    result.status = 'success'; byId('result-status').value = 'success'; byId('result-event').textContent = '已重新完成操作';
  });
}
