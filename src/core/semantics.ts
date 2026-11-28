import type { HYComponentKind } from './types.js';

/** Exhaustive semantic focus policy, independent of any platform's control implementation. */
export const componentInteraction = Object.freeze({
  Row: false, Column: false, Grid: false, Overlay: false, Scroll: false,
  Text: false, Image: false, Icon: false, Badge: false, Divider: false, FormGroup: false,
  Button: true, Checkbox: true, Toggle: true, RadioGroup: true, Rate: true,
  Select: true, Tabs: true, TextInput: true, TextArea: true, Slider: true, Dialog: false, PlatformView: true,
} satisfies Record<HYComponentKind, boolean>);
