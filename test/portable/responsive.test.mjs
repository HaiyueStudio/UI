import test from 'node:test';import assert from 'node:assert/strict';
import {hyResponsiveGrid,hyResponsiveWorkspace} from '../../dist/portable/index.js';
import {hyNode} from '../../dist/core/index.js';
test('responsive cards fit phones, split windows and wide displays without overflow',()=>{
 for(const width of [0,240,320,390,600,820,1180,1440,4000]){const {columns,gap,cardWidth}=hyResponsiveGrid(width);assert.ok(columns>=1&&columns<=4);assert.ok(cardWidth>=0);assert.ok(cardWidth*columns+gap*(columns-1)<=width+.001);}
 assert.equal(hyResponsiveGrid(820).columns,3);assert.equal(hyResponsiveGrid(390).columns,1);assert.equal(hyResponsiveGrid(1180,{maxColumns:3}).columns,3);
 for(const width of [-1,NaN,Infinity])assert.throws(()=>hyResponsiveGrid(width));assert.throws(()=>hyResponsiveGrid(300,{maxColumns:1.5}));
});
test('workspace split respects the available window and height, including keyboard resizing',()=>{
 assert.equal(hyResponsiveWorkspace(1180,760).split,true);assert.equal(hyResponsiveWorkspace(820,1100).split,false);assert.equal(hyResponsiveWorkspace(1180,350).split,false);assert.equal(hyResponsiveWorkspace(500,760).split,false);assert.throws(()=>hyResponsiveWorkspace(NaN,700));
});
test('form descriptions are optional protocol data',()=>{assert.doesNotThrow(()=>hyNode('FormGroup','field',{label:'Name',description:'Visible help',error:'Required'}));assert.throws(()=>hyNode('FormGroup','field',{label:'Name',description:12}));});
