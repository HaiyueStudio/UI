export function initializeDragDropExamples() {
  const byId = id => document.getElementById(id);
  const lists = [byId('sortable-backlog'), byId('sortable-ready')];
  const renderOrder = () => {
    byId('sortable-order').textContent = lists.map(list => `${list.getAttribute('aria-label')} · ${list.order.join(' → ') || '空'}`).join('\n');
  };
  for (const list of lists) {
    list.addEventListener('sort-change', renderOrder);
    list.addEventListener('sort-end', event => {
      byId('sortable-event').textContent = event.detail.accepted ? `已将 ${event.detail.item.dataset.id} 放到第 ${event.detail.newIndex + 1} 项` : '已结束排序';
    });
  }
  byId('sortable-direction').addEventListener('change', event => {
    for (const list of lists) list.direction = event.target.value;
  });
  byId('sortable-preview').addEventListener('change', event => {
    for (const list of lists) list.preview = event.target.value;
    byId('sortable-preview-opacity').value = String(lists[0].previewOpacity); byId('sortable-preview-opacity-value').textContent = String(lists[0].previewOpacity);
  });
  for (const [id, property] of [['animation', 'animation'], ['preview-opacity', 'previewOpacity'], ['source-opacity', 'sourceOpacity']]) {
    byId('sortable-' + id).addEventListener('input', event => {
      for (const list of lists) list[property] = Number(event.target.value);
      byId('sortable-' + id + '-value').textContent = event.target.value + (id === 'animation' ? ' ms' : '');
    });
  }
  byId('sortable-disabled').addEventListener('change', event => {
    for (const list of lists) list.disabled = event.target.checked;
  });
  byId('sortable-api').addEventListener('click', () => {
    lists[0].move(0, lists[0].items.length - 1); renderOrder();
  });
  renderOrder();

  const sources = document.querySelectorAll('hy-drag-source');
  for (const source of sources) source.data = { name: source.getAttribute('value'), category: '素材' };
  byId('drag-source-custom').renderPreview = ({ data }) => {
    const card = document.createElement('hy-card'); card.className = 'dnd-custom-preview';
    card.heading = '自定义拖拽组件'; card.textContent = `${data.name} · ${data.category}`; return card;
  };
  const sourceLive = byId('drag-source-live');
  byId('drag-source-preview').addEventListener('change', event => {
    sourceLive.preview = event.target.value;
    sourceLive.querySelector('.dnd-asset p').textContent = { clone: 'clone · 半透明原样预览', custom: 'custom · 使用 preview 插槽', move: 'move · 原组件跟随指针', text: 'text · 紧凑文字预览' }[event.target.value];
    byId('drag-source-preview-opacity').value = String(sourceLive.previewOpacity); byId('drag-source-preview-opacity-value').textContent = String(sourceLive.previewOpacity);
  });
  for (const [id, property] of [['preview-opacity', 'previewOpacity'], ['source-opacity', 'sourceOpacity']]) {
    byId('drag-source-' + id).addEventListener('input', event => { sourceLive[property] = Number(event.target.value); byId('drag-source-' + id + '-value').textContent = event.target.value; });
  }
  byId('drag-source-disabled').addEventListener('change', event => {
    for (const source of document.querySelectorAll('#drag-source hy-drag-source')) source.disabled = event.target.checked;
  });
  byId('drag-source-target').addEventListener('data-drop', event => {
    byId('drag-source-result').textContent = `已接收 ${event.detail.data.name} · ${event.detail.input}`;
  });
  const target = byId('dropzone-live');
  target.addEventListener('data-drop', event => {
    const { type, data, files, input } = event.detail;
    byId('dropzone-result').textContent = files.length ? files.map(file => file.name).join('、') : `${type} · ${typeof data === 'object' && data ? data.name : data}`;
    byId('dropzone-event').textContent = `data-drop · ${input}`;
  });
  byId('dropzone-disabled').addEventListener('change', event => { target.disabled = event.target.checked; });
  byId('dropzone-accept').addEventListener('change', event => { target.accept = event.target.value; });
  byId('drag-source-event').textContent = '拖到接收区，或按 Space 拿起、Tab 到接收区、Enter 放下';
  for (const source of sources) source.addEventListener('drag-end', event => {
    byId('drag-source-event').textContent = event.detail.accepted ? '放置成功' : event.detail.cancelled ? '已取消' : '未放入接收区';
  });
}
