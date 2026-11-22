import { HYPopoverBase } from './internal/popover-base.js';
export type { HYPopoverPlacement, HYPopoverTrigger, HYPopoverCloseReason, HYPopoverOpenChangeDetail } from './internal/popover-base.js';
export class HYPopover extends HYPopoverBase { constructor() { super(false); } }
export function definePopoverComponents(): void { if (!customElements.get('hy-popover')) customElements.define('hy-popover', HYPopover); }
