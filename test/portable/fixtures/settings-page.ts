import { hyNode as node, hyKey, hySupports, type HYStore, type HYRenderer } from '../../../src/core/index.js';
import { HYPage, type HYBinding } from '../../../src/portable/index.js';

interface State { readonly title: string; readonly scale: string; readonly playing: boolean; readonly sceneId: string; }
type Action = { readonly type: 'scale'; readonly value: string } | { readonly type: 'toggle' };
const scales = [{ value: '1', label: '100%' }, { value: '.75', label: '75%' }];

/** Typed page composition, without an application store implementation or platform globals. */
export function mountSettings(renderer: HYRenderer, store: HYStore<State, Action>): HYPage {
  const s = store.getSnapshot();
  const page = new HYPage(renderer, {
    defaultFocus: hyKey('settings','controls','play'),
    onEvent(event) {
      if (event.key === hyKey('settings','controls','scale') && event.type === 'commit' && typeof event.value === 'string') store.dispatch({ type: 'scale', value: event.value });
      if (event.key === hyKey('settings','controls','play') && event.type === 'activate') store.dispatch({ type: 'toggle' });
    },
  });
  page.mount(node('Column','settings',{layout:{gap:12,padding:[8,8,8,8]}},{children:[
    node('Text','title',{text:s.title}),
    node('Row','controls',{layout:{gap:8}},{children:[
      node('Select','scale',{value:s.scale,options:scales}),
      node('Button','play',{text:s.playing?'Pause':'Play'}),
      node('Icon','playIcon',{resource:{id:'icons/play',alt:'Play'},...(hySupports(renderer.capabilities,'icons.system') ? {systemName:'play.fill'} : {})}),
    ]}),
    node('PlatformView','preview',{slot:'gpu-preview',resourceId:s.sceneId,layout:{grow:1}}, {source:{file:'settings-page.ts',line:28}}),
  ]}));
  const bindings: readonly HYBinding<State>[] = [
    {key:hyKey('settings','title'),kind:'Text',select:s=>({text:s.title})},
    {key:hyKey('settings','controls','scale'),kind:'Select',select:s=>({value:s.scale,options:scales})},
    {key:hyKey('settings','controls','play'),kind:'Button',select:s=>({text:s.playing?'Pause':'Play'})},
    {key:hyKey('settings','preview'),kind:'PlatformView',select:s=>({slot:'gpu-preview',resourceId:s.sceneId,layout:{grow:1}})},
  ];
  page.bind(store, bindings);
  return page; // Shell forwards suspend/resume/back and disposes this page, not the store.
}
