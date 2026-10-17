import type { HYBounds, HYPlatformView } from './types.js';
import { equalData, snapshot } from './data.js';
import { HYUIError } from './validation.js';

/** Backend-owned resource lifetime. No GPU acquire/present or platform handles in page state. */
export class HYPlatformViewController {
  #view: HYPlatformView | undefined; #disposed = false; #suspended = false;
  #bounds: HYBounds | undefined;
  constructor(private readonly factory: () => HYPlatformView, private resourceId: string, private shown = true) {
    this.#validateId(resourceId);
  }
  #validateId(id: string): void { if (typeof id !== 'string' || !id.trim()) throw new HYUIError('invalid-props', 'PlatformView needs a resourceId'); }
  mount(): void {
    if (this.#disposed || this.#view) throw new HYUIError('lifecycle', 'PlatformView disposed or already mounted');
    this.#view = this.factory();
    try {
      this.#view.mount(); this.#view.update(this.resourceId);
      if (this.#bounds) this.#view.layout(this.#bounds);
      this.#view.visible(this.shown && !this.#suspended);
    } catch (error) { this.dispose(); throw error; }
  }
  update(resourceId: string): void {
    if (this.#disposed) return;
    this.#validateId(resourceId);
    if (resourceId === this.resourceId) return;
    this.resourceId = resourceId; this.#view?.update(resourceId);
  }
  layout(bounds: HYBounds): void {
    if (this.#disposed) return;
    if (![bounds.x, bounds.y, bounds.width, bounds.height, bounds.scale].every(Number.isFinite)
      || bounds.width < 0 || bounds.height < 0 || bounds.scale <= 0) throw new HYUIError('invalid-props', 'Invalid PlatformView bounds');
    if (equalData(bounds, this.#bounds)) return;
    this.#bounds = snapshot(bounds); this.#view?.layout(this.#bounds);
  }
  visible(value: boolean): void {
    if (this.#disposed || this.shown === value) return;
    this.shown = value;
    if (!this.#suspended) this.#view?.visible(value);
  }
  focus(): void { if (!this.#disposed && !this.#suspended && this.shown) this.#view?.focus(); }
  suspend(): void { if (!this.#disposed && !this.#suspended) { this.#suspended = true; if (this.shown) this.#view?.visible(false); } }
  resume(): void { if (!this.#disposed && this.#suspended) { this.#suspended = false; if (this.shown) this.#view?.visible(true); } }
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    const view = this.#view; this.#view = undefined; view?.dispose();
  }
}
