import { hyNode as node } from '../../../src/core/index.js';

// Compile-time checks only, never executed as a page example.
function rejectedShapes(): void {
  // @ts-expect-error TextInput does not accept a boolean value.
  node('TextInput','invalid',{value:true});
  // @ts-expect-error CSS width percentages are outside portable layout.
  node('Row','invalid',{layout:{width:'50%'}});
  // @ts-expect-error Unknown capabilities are not silently enabled.
  node('Text','invalid',{text:'x'},{requires:['invented.capability']});
}
