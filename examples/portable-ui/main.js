import {hyNode as n,hyKey} from '../../dist/core/index.js';
import {HYPage} from '../../dist/portable/index.js';
import {HYWebRenderer,definePortableWebComponents} from '../../dist/adapters/web/index.js';
definePortableWebComponents();
export const options=[{value:'1',label:'100% · 完整画质'},{value:'.75',label:'75% · 平衡'},{value:'.5',label:'50% · 流畅'}];
const tabs=[{value:'appearance',label:'外观设置'},{value:'notes',label:'创作笔记'}];
const state={title:'星海漫游',scale:'1',enabled:true,exposure:.5,tab:'appearance',description:'从一束光开始，记录你的灵感。',password:'',dialog:false};
let dark=true,fontScale=1,direction='ltr';
const theme=()=>({color:dark?{text:'#E7EDFF',muted:'#A6B4D0',surface:'#172239',input:'#0F192C',accent:'#7CA6FF',danger:'#FF91A0',border:'#425276',focus:'#9ABBFF'}:{text:'#1D304A',muted:'#5D7090',surface:'#F4F7FF',input:'#FFFFFF',accent:'#305FA6',danger:'#AA2941',border:'#9DAFC9',focus:'#315FA6'},fontSize:15,lineHeight:24,gap:8,radius:6});
const preview={mounted:0,disposed:0,layouts:0,visible:[]};
const image='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="160" height="60"><rect width="160" height="60" rx="12" fill="#243f70"/><path d="m18 43 32-28 29 22 28-20 34 26" fill="none" stroke="#9ec7ff" stroke-width="3"/></svg>');
const renderer=new HYWebRenderer(document.querySelector('#app'),{
  environment:{theme:theme(),safeArea:[20,20,20,20]},resolveResource:()=>image,
  platformViews:{preview(host){const canvas=document.createElement('canvas');canvas.style.cssText='width:100%;height:100%;display:block;border-radius:12px';canvas.setAttribute('role','img');canvas.setAttribute('aria-label','星海预览');
    return {mount(){preview.mounted++;host.append(canvas);},update(){},layout({width,height,scale}){preview.layouts++;canvas.width=Math.max(1,Math.round(width*scale));canvas.height=Math.max(1,Math.round(height*scale));
      const c=canvas.getContext('2d');const w=canvas.width,h=canvas.height;const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'#122540');g.addColorStop(1,'#2d2460');c.fillStyle=g;c.fillRect(0,0,w,h);
      for(let i=0;i<28;i++){c.beginPath();c.arc(w*(.12+((i*37)%79)/100),h*(.13+((i*23)%73)/100),scale*(1+(i%3)),0,7);c.fillStyle=i%3?'#d0e5ff':'#b6a2ff';c.fill();}
      c.strokeStyle='#8caaff';c.lineWidth=scale*1.5;c.beginPath();c.ellipse(w*.5,h*.55,w*.28,h*.25,-.25,0,Math.PI*2);c.stroke();
      c.fillStyle='#d0e5ff';c.font=`${12*scale}px system-ui`;c.fillText('STARFIELD / 01',16*scale,24*scale);},visible(value){preview.visible.push(value);},focus(){canvas.tabIndex=-1;canvas.focus();},dispose(){preview.disposed++;canvas.remove();}};
  }},onError(error){document.querySelector('#status').textContent=`预览暂不可用：${error.message}`;},
});
const key=(...parts)=>hyKey('studio',...parts);
function tree(){return n('Column','studio',{layout:{gap:18}},{children:[
  n('Row','heading',{layout:{gap:12,align:'center'}},{children:[n('Icon','mark',{resource:{id:'mark',alt:''},layout:{width:36,height:24}}),n('Text','title',{text:'把灵感变成一幅画',layout:{grow:1}}),n('Button','settings',{text:'预览设置'})]}),
  n('Overlay','stage',{layout:{height:180,clip:true}},{children:[n('PlatformView','preview',{slot:'preview',resourceId:'scene:stars'})]}),
  n('Grid','summary',{layout:{columns:[{grow:1},{grow:1}],gap:14}},{children:[
    n('FormGroup','name',{label:'作品名称'},{children:[n('TextInput','input',{value:state.title,placeholder:'给作品起个名字'},{requires:['text.composition']})]}),
    n('FormGroup','scale',{label:'预览清晰度'},{children:[n('Select','input',{value:state.scale,options})]}),
  ]}),
  n('Tabs','tabs',{value:state.tab,options:tabs,a11y:{label:'工作区'}},{slots:{
    appearance:[n('Column','appearance',{layout:{gap:14,padding:[16,0,4,0]}},{children:[n('Toggle','enabled',{checked:state.enabled,a11y:{label:'启用柔和光晕'}}),
      n('FormGroup','exposure',{label:'光照强度'},{children:[n('Slider','input',{value:state.exposure,min:0,max:1,step:.1,layout:{width:260}})]}),
      n('Row','art',{layout:{gap:12,align:'center'}},{children:[n('Image','thumbnail',{resource:{id:'thumbnail',alt:'山脉配色参考'},fit:'contain',layout:{width:120,height:45}}),n('Text','description',{text:'浅深色、长文案与不同字号，都保留编辑状态。',wrap:true,layout:{grow:1}})]}),
    ]})],
    notes:[n('Scroll','notes',{axis:'vertical',layout:{height:180}},{children:[n('FormGroup','memo',{label:'创作笔记'},{children:[n('TextArea','input',{value:state.description,placeholder:'写下灵感…',layout:{height:140}},{requires:['text.composition']})]})]})],
  }}),
  n('Row','actions',{layout:{gap:12,align:'center'}},{children:[n('Text','hint',{text:'所有编辑保留在当前会话中。',layout:{grow:1}}),n('Button','save',{text:'保存作品'})]}),
  n('Dialog','settings',{open:state.dialog,title:'预览设置',dismissible:true},{children:[n('FormGroup','access',{label:'访问口令（可选）'},{children:[n('TextInput','password',{value:state.password,secure:true})]})],slots:{footer:[n('Button','close',{text:'完成'})]}}),
]});}
const events=[];
const page=new HYPage(renderer,{defaultFocus:key('heading','settings'),onEvent(event){events.push(event);
  if(event.type==='commit'){
    const routes={[key('summary','name','input')]:'title',[key('summary','scale','input')]:'scale',[key('tabs')]:'tab',[key('tabs','appearance','enabled')]:'enabled',[key('tabs','appearance','exposure','input')]:'exposure',[key('tabs','notes','memo','input')]:'description',[key('settings','access','password')]:'password'};
    if(routes[event.key]){state[routes[event.key]]=event.value;page.render(tree());document.querySelector('#status').textContent='设置已更新';}
  }
  if(event.type==='activate'&&event.key===key('heading','settings')){state.dialog=true;page.render(tree());}
  if((event.type==='cancel'&&event.key===key('settings'))||(event.type==='activate'&&event.key===key('settings','close'))){state.dialog=false;page.render(tree());}
  if(event.type==='activate'&&event.key===key('actions','save'))document.querySelector('#status').textContent=`已保存「${state.title}」`;
}});
page.mount(tree());
function environment(){renderer.setEnvironment({theme:theme(),fontScale,direction,safeArea:[20,20,20,20]});}
document.querySelector('#theme').onclick=()=>{dark=!dark;environment();document.querySelector('#theme').textContent=dark?'切换浅色':'切换深色';};
document.querySelector('#direction').onclick=()=>{direction=direction==='ltr'?'rtl':'ltr';environment();};
document.querySelector('#font').onclick=()=>{fontScale=fontScale===1?1.4:1;environment();};
// This exported harness is for the example and browser regression, never part of the npm API.
window.demo={page,renderer,state,events,preview,tree,key,refresh:()=>page.render(tree()),dispose:()=>page.dispose()};
