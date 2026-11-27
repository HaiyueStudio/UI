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
  byId('sortable-disabled').addEventListener('change', event => {
    for (const list of lists) list.disabled = event.target.checked;
  });
  byId('sortable-api').addEventListener('click', () => {
    lists[0].move(0, lists[0].items.length - 1); renderOrder();
  });
  renderOrder();

  const sources = document.querySelectorAll('hy-drag-source');
  for (const source of sources) source.data = { name: source.getAttribute('value'), category: '素材' };
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
