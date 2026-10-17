import test from 'node:test';
import assert from 'node:assert/strict';
import {RecordingRenderer} from '../portable/recording.mjs';
import {exercise} from './scenario.js';
import {hyNode as n} from '../../dist/core/index.js';
import {HYPage} from '../../dist/portable/index.js';
test('shared Web scenario: no-op is silent, 100 edits batch once, move and resume preserve identity',()=>{
  const renderer=new RecordingRenderer(),{page,batches}=exercise(renderer);
  assert.equal(batches.length,4);
  assert.deepEqual(batches[1].mutations.map(m=>[m.type,m.node.key,m.node.props.text]),[['update','/fixture/fields/a','99']]);
  assert.equal(batches[2].mutations.every(m=>m.type==='move'),true);
  assert.equal(renderer.props('/fixture/fields/a').text,'resumed');
  assert.equal(renderer.nodes.get('/fixture/preview').instance,2);
  page.dispose();assert.equal(renderer.nodes.size,0);
});
test('inactive tab slots cannot receive page focus or consume modal back',()=>{
  const renderer=new RecordingRenderer(),page=new HYPage(renderer);
  page.mount(n('Tabs','tabs',{value:'active',options:[{value:'active',label:'Active'},{value:'hidden',label:'Hidden'}]},{
    slots:{active:[n('Button','button',{text:'Active'})],hidden:[n('Dialog','dialog',{open:true,title:'Hidden'})]}}));
  assert.equal(page.focus('/tabs/dialog'),false);assert.equal(page.back(),false);
  assert.equal(page.focus('/tabs/button'),true);page.dispose();
});
