import type * as Frozen from '../../../review/m24-ui/g01/contract/index.js';
import type * as Current from '../../../src/core/index.js';
type Accepts<New, Old extends New> = Old;
export type HYBaselineCompatibility = [
  Accepts<Current.HYNode,Frozen.HYNode>, Accepts<Current.HYMutation,Frozen.HYMutation>,
  Accepts<Current.HYRenderer,Frozen.HYRenderer>, Accepts<Current.HYCapabilities,Frozen.HYCapabilities>,
  Accepts<Current.HYTheme,Frozen.HYTheme>, Accepts<Current.HYPlatformView,Frozen.HYPlatformView>,
  Accepts<Current.HYSelectionProps,Frozen.HYSelectionProps>, Accepts<Current.HYUIEvent,Frozen.HYUIEvent>,
  Accepts<Frozen.HYSelectionController,Current.HYSelectionController>,
  Accepts<Current.HYStore<{value:string},string>,Frozen.HYStore<{value:string},string>>,
];
