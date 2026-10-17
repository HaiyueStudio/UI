import test from 'node:test';
import assert from 'node:assert/strict';
import { hyNode as n, hyValidateNode, hySupports, hyValidateCapabilities, HY_COMPONENTS, HY_FEATURES, HYUIError } from '../../dist/core/index.js';
import { HYPage, hyNativeTheme, hyThemeVariables, HY_THEME_TOKENS } from '../../dist/portable/index.js';
import { RecordingRenderer } from './recording.mjs';
const caps={contract:1,backend:'web',components:HY_COMPONENTS,features:HY_FEATURES};
const props={Row:{},Column:{},Grid:{layout:{columns:['auto',{grow:1},40],rows:['auto'],padding:[1,2,3,4]}},Overlay:{},
  Scroll:{axis:'vertical'},Text:{text:'label'},Image:{resource:{id:'art:logo',alt:'Logo'}},Icon:{resource:{id:'icon:play',alt:'Play'}},
  Button:{text:'Save'},Toggle:{checked:false},Select:{value:'a',options:[{value:'a',label:'A'}]},Tabs:{value:'a',options:[{value:'a',label:'A'}]},
  TextInput:{value:''},TextArea:{value:''},Slider:{value:1,min:0,max:2,step:.5},Dialog:{open:false,title:'Settings'},FormGroup:{label:'Name'},PlatformView:{slot:'preview',resourceId:'scene:1'}};
test('all frozen baseline kinds accept typed plain data and snapshots are immutable', () => {
  assert.deepEqual(Object.keys(props).sort(),[...HY_COMPONENTS].sort());assert.equal(HY_COMPONENTS.length,18);
  for(const [kind,properties] of Object.entries(props)) {
    const node=hyValidateNode({kind,key:'example',props:properties},caps);assert.ok(Object.isFrozen(node));assert.ok(Object.isFrozen(node.props));
  }
});
test('duplicate keys include source, parent and slot; different slots share sibling identity', () => {
  const node={kind:'Column',key:'root',props:{},source:{file:'settings.ts',line:12},children:[n('Text','dup',{text:'a'})],slots:{footer:[n('Text','dup',{text:'b'})]}};
  assert.throws(()=>hyValidateNode(node),e=>{assert.equal(e.code,'duplicate-key');assert.match(e.message,/settings.ts:12.*\/root.*slots.footer/);return true;});
});
test('unknown capabilities and unsupported component/secure/icon features are explicit errors', () => {
  assert.throws(()=>hyValidateCapabilities({...caps,features:['made.up']}),/Unknown capability/);
  assert.throws(()=>hySupports(caps,'made.up'),/Unknown capability/);
  const limited={...caps,features:[]};
  assert.equal(hySupports(limited,'icons.system'),false);
  assert.throws(()=>hyValidateNode(n('TextInput','password',{value:'',secure:true}),limited),/text.secure/);
  assert.throws(()=>hyValidateNode(n('Icon','icon',{...props.Icon,systemName:'play'}),limited),/icons.system/);
  assert.doesNotThrow(()=>hyValidateNode(n('Icon','icon',props.Icon),limited));
  assert.throws(()=>hyValidateNode(n('TextArea','ime',{value:''},{requires:['text.composition']}),limited),/text.composition/);
  assert.throws(()=>hyValidateNode(n('Text','text',{text:'a'}),{...caps,components:[]}),/Unsupported component Text/);
});
test('invalid props reject unsupported CSS/layout, handles, non-finite sizes and unknown data fields', () => {
  const invalid=[['Row',{style:{color:'red'}}],['Row',{layout:{width:'50%'}}],['Grid',{layout:{rows:[{grow:0}]}}],
    ['Text',{text:9}],['Image',{resource:{id:'x',alt:'',handle:()=>{}}}],['Slider',{value:1,min:0,max:2,step:0}],
    ['Slider',{value:3,min:0,max:2,step:1}],['Row',{layout:{gap:NaN}}],['Row',{layout:{minWidth:10,maxWidth:2}}],
    ['Row',{layout:{padding:[1,2]}}],['TextArea',{value:'',secure:true}],['Text',{text:'a',layout:{rows:[10]}}]];
  for(const [kind,properties] of invalid) assert.throws(()=>n(kind,'bad',properties),HYUIError);
});
test('dynamic invalid props diagnose file/key/property before committing any write', () => {
  const renderer=new RecordingRenderer(),page=new HYPage(renderer);
  page.mount(n('Column','root',{}, {children:[n('Text','label',{text:'Hello'},{source:{file:'app.ts',line:22}})]}));
  assert.throws(()=>page.setProps('/root/label','Text',{text:'Hello',layout:{width:'100%'}}),e=>{assert.match(e.message,/app.ts:22.*\/root\/label.*layout.width/);return true;});
  assert.equal(renderer.batches.length,1);
});
test('cycles, empty stable keys and implicit complex child views are rejected', () => {
  const cyclic={kind:'Column',key:'a',props:{}};cyclic.children=[cyclic];
  assert.throws(()=>hyValidateNode(cyclic),/Cyclic/);assert.throws(()=>n('Row','',{}),/identifier/);
  assert.throws(()=>n('PlatformView','p',props.PlatformView,{children:[n('Text','t',{text:'x'})]}),/Leaf component/);
  assert.throws(()=>hyValidateNode({kind:'Text',key:'a',props:{text:'x'},requires:null}),/Expected array/);
  assert.throws(()=>hyValidateNode({kind:'Text',key:'a',props:{text:'x'},source:false}),/plain data/);
  assert.throws(()=>hyValidateNode({kind:'Text',key:'a',get props(){throw new Error('should not evaluate');}}),/Accessors/);
});
test('theme maps frozen semantic tokens for Web/native and font scaling excludes spacing', () => {
  const theme={color:Object.fromEntries(['text','muted','surface','input','accent','danger','border','focus'].map((key,i)=>[key,`#${i}${i}${i}${i}${i}${i}`])),fontSize:16,lineHeight:24,gap:8,radius:6};
  const css=hyThemeVariables(theme,1.5),native=hyNativeTheme(theme,1.5);
  assert.equal(css['--hy-text-color'],theme.color.text);assert.equal(css['--hy-secondary-text-color'],theme.color.muted);
  assert.equal(css['--hy-font-size'],'24px');assert.equal(css['--hy-line-height'],'36px');assert.equal(css['--hy-gap'],'8px');
  assert.deepEqual(native,{...theme,fontSize:24,lineHeight:36});assert.ok(Object.isFrozen(native.color));
  assert.equal(Object.keys(css).length,12);assert.equal(HY_THEME_TOKENS.focus,'--hy-focus-ring-color');
  assert.throws(()=>hyNativeTheme(theme,0),/fontScale/);assert.throws(()=>hyNativeTheme({...theme,gap:Infinity}),/gap/);
  assert.throws(()=>hyThemeVariables({...theme,color:{...theme.color,text:'var(--custom)'}}),/color.text/);
});
