import { HYPopoverBase } from './internal/popover-base.js';
export type { HYPopconfirmActionDetail } from './internal/popover-base.js';
export class HYPopconfirm extends HYPopoverBase { constructor() { super(true); } }
export function definePopconfirmComponents(): void { if (!customElements.get('hy-popconfirm')) customElements.define('hy-popconfirm', HYPopconfirm); }
