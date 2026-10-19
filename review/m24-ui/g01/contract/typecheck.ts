import {HYSelectionController, type HYNode, type HYStore, type HYRenderer} from './index.js';
const nodes: HYNode[]=[{key:'scale',kind:'Select',props:{value:'1',options:[{value:'1',label:'100%'}]}},
  {key:'preview',kind:'PlatformView',props:{slot:'shader-preview',resourceId:'project-1'}}];
// @ts-expect-error Select value is a portable string, not an arbitrary object.
const bad: HYNode={key:'bad',kind:'Select',props:{value:{nativeView:true},options:[]}};
declare const store: HYStore<{scale:number},{type:'scale';value:number}>;
declare const renderer: HYRenderer;
const controller=new HYSelectionController('scale',{value:'1',options:[]},event=>{
  if(event.type==='commit') store.dispatch({type:'scale',value:Number(event.value)});
});
renderer.commit(1,nodes.map(node=>({type:'create',node})));
controller.dispose();void bad;
