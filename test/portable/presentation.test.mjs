import test from 'node:test';
import assert from 'node:assert/strict';
import {hyNode} from '../../dist/core/index.js';
import {hyNativeTheme,hyThemeVariables,HY_ICONS,hyIconSvg} from '../../dist/portable/index.js';
const theme={color:{text:'#eeeeee',muted:'#999999',surface:'#151515',input:'#222222',accent:'#7777ff',danger:'#ff5555',border:'#444444',focus:'#9999ff'},fontSize:14,lineHeight:20,gap:8,radius:8};
test('additive presentation props preserve legacy nodes and validate names and icon accessibility',()=>{
 assert.doesNotThrow(()=>hyNode('Button','legacy',{text:'Save'}));
 assert.doesNotThrow(()=>hyNode('Button','save',{text:'',icon:'save',variant:'primary',size:'compact',a11y:{label:'Save'}}));
 assert.throws(()=>hyNode('Button','bad',{text:'',icon:'save'}),/accessible label/);
 for(const [kind,props] of [['Button',{text:'x',variant:'random'}],['Button',{text:'x',icon:'emoji'}],['Text',{text:'x',textStyle:'huge'}],['Tabs',{value:'a',options:[{value:'a',label:'A'}],variant:'random'}],['Select',{value:'a',options:[{value:'a',label:'A'}],presentation:'random'}]])assert.throws(()=>hyNode(kind,'bad',props));
});
test('state colors and typography scale consistently without mutating the input',()=>{
 const input={...theme,color:{...theme.color,selected:'#5555bb',pressed:'#444488',disabled:'#666666',elevated:'#292929',onAccent:'#ffffff'},typography:{title:{fontSize:24,lineHeight:32,weight:'bold'},caption:{fontSize:12,lineHeight:18}}};
 const native=hyNativeTheme(input,1.5),web=hyThemeVariables(input,1.5);
 assert.equal(native.typography.title.fontSize,36);assert.equal(web['--hy-title-font-size'],'36px');assert.equal(web['--hy-title-font-weight'],'700');assert.equal(web['--hy-selected-bg-color'],'#5555bb');assert.equal(input.typography.title.fontSize,24);assert.ok(Object.isFrozen(native.typography));
 for(const invalid of [{typography:{title:{fontSize:-1,lineHeight:32}}},{typography:{bogus:{fontSize:24,lineHeight:32}}},{color:{...theme.color,pressed:'red'}}])assert.throws(()=>hyNativeTheme({...theme,...invalid}));
 assert.deepEqual(hyNativeTheme(theme),theme);
});
test('vector button icons are shared numeric geometry and generate decorative SVG',()=>{
 for(const name of Object.keys(HY_ICONS)){assert.match(hyIconSvg(name),/aria-hidden="true"/);for(const path of HY_ICONS[name])for(const point of path)assert.ok(point.every(n=>Number.isFinite(n)&&n>=0&&n<=24));}
});
test('settings gear and center hole keep rotational symmetry in the shared square viewport',()=>{
 for(const path of HY_ICONS.settings){
  assert.deepEqual(path[0],path.at(-1));
  const xs=path.map(p=>p[0]),ys=path.map(p=>p[1]);assert.ok(Math.abs((Math.max(...xs)-Math.min(...xs))-(Math.max(...ys)-Math.min(...ys)))<0.002);
  for(const [x,y] of path){const a=Math.PI/4,rx=12+(x-12)*Math.cos(a)-(y-12)*Math.sin(a),ry=12+(x-12)*Math.sin(a)+(y-12)*Math.cos(a);assert.ok(path.some(([px,py])=>Math.hypot(px-rx,py-ry)<0.002),'gear must be symmetric at every eighth turn');}
 }
});
