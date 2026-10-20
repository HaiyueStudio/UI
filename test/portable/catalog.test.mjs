import test from 'node:test';
import assert from 'node:assert/strict';
import {hyNode,HY_COMPONENTS} from '../../dist/core/index.js';
test('catalog contracts are additive, data-only and reject unsupported variants',()=>{
  for(const [kind,props] of Object.entries({Checkbox:{text:'Accept',checked:true},RadioGroup:{value:'a',options:[{value:'a',label:'A'}]},Rate:{value:0,count:5},Badge:{text:'99+'},Divider:{text:'Details'}})){
    assert.ok(HY_COMPONENTS.includes(kind));assert.equal(hyNode(kind,'sample',props).kind,kind);
  }
  for(const props of [{value:6,count:5},{value:.5,count:5},{value:-1,count:5},{value:0,count:11},{value:1,count:0}])assert.throws(()=>hyNode('Rate','rating',props));
  assert.throws(()=>hyNode('RadioGroup','radio',{value:'absent',options:[{value:'a',label:'A'}]}));
  assert.throws(()=>hyNode('Badge','badge',{text:'new',dot:true}));
  assert.throws(()=>hyNode('Divider','divider',{orientation:'vertical'}));
});
