import type { HYPlatformView, HYResource, HYTheme, HYUIEvent } from '../../core/types.js';
import type { HYUIError } from '../../core/validation.js';

export interface HYWebEnvironment {
  readonly theme?: HYTheme;
  readonly fontScale?: number;
  readonly direction?: 'ltr' | 'rtl';
  readonly reducedMotion?: boolean;
  /** Logical top/right/bottom/left insets, applied once outside the authored page. */
  readonly safeArea?: readonly [number, number, number, number] | 'environment';
}
export interface HYWebPlatformContext { readonly key: string; readonly slot: string; }
export interface HYWebRendererOptions {
  readonly environment?: HYWebEnvironment;
  readonly resolveResource?: (resource: HYResource, context: { readonly key: string; readonly kind: 'Image' | 'Icon' }) => string;
  readonly platformViews?: Readonly<Record<string, (host: HTMLElement, context: HYWebPlatformContext) => HYPlatformView>>;
  /** Async resource layout failures stop this renderer. The shell disposes/recreates its page. */
  readonly onError?: (error: HYUIError) => void;
}
export interface HYWebDiagnostics {
  readonly commits: number; readonly created: number; readonly updated: number;
  readonly moved: number; readonly removed: number; readonly measurements: number;
  readonly activeNodes: number; readonly activeResources: number; readonly activeListeners: number;
}
export interface HYWebControl {
  update(node: import('../../core/types.js').HYNode, revision: number): void;
  focus(): void;
  dispose(): void;
}
export interface HYWebControlContext {
  readonly host: HTMLElement;
  readonly listen: (target: EventTarget, type: string, listener: (event: Event) => void, capture?: boolean) => () => void;
  readonly emit: (event: HYUIEvent) => void;
  readonly interactive: () => boolean;
}
