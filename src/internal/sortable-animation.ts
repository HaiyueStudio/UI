interface OwnedOrder { original: string; priority: string; value: string; hadStyle: boolean; }
interface Motion { animation: Animation; x: number; y: number; }

/** Temporary visual ordering and FLIP motion leave DOM order and app transforms intact. */
export class HYSortableAnimation {
  private readonly _orders = new Map<HTMLElement, OwnedOrder>();
  private readonly _motions = new Map<HTMLElement, Motion>();

  capture(items: readonly HTMLElement[]): Map<HTMLElement, DOMRect> {
    const rects = new Map(items.map(item => [item, item.getBoundingClientRect()]));
    this.cancel(); return rects;
  }

  rect(item: HTMLElement): DOMRect {
    const rect = item.getBoundingClientRect(); const motion = this._motions.get(item);
    const progress = motion?.animation.effect?.getComputedTiming().progress;
    if (!motion || progress == null) return rect;
    return new DOMRect(rect.x - motion.x * (1 - progress), rect.y - motion.y * (1 - progress), rect.width, rect.height);
  }

  order(items: readonly HTMLElement[]): void {
    items.forEach((item, index) => {
      const saved = this._orders.get(item);
      const original = saved?.original ?? item.style.getPropertyValue('order');
      const priority = saved?.priority ?? item.style.getPropertyPriority('order');
      const hadStyle = saved?.hadStyle ?? item.hasAttribute('style');
      item.style.setProperty('order', String(index), 'important');
      this._orders.set(item, { original, priority, value: item.style.getPropertyValue('order'), hadStyle });
    });
  }

  restore(): void {
    this.cancel();
    for (const [item, saved] of this._orders) {
      if (item.style.getPropertyValue('order') === saved.value && item.style.getPropertyPriority('order') === 'important') {
        if (saved.original) item.style.setProperty('order', saved.original, saved.priority); else item.style.removeProperty('order');
      }
      if (!saved.hadStyle && !item.style.length) item.removeAttribute('style');
    }
    this._orders.clear();
  }

  animate(before: ReadonlyMap<HTMLElement, DOMRect>, items: readonly HTMLElement[], duration: number): void {
    if (!duration) return;
    for (const item of items) {
      const previous = before.get(item);
      if (!previous || !item.isConnected || item.hasAttribute('data-hy-live-drag')) continue;
      const rect = item.getBoundingClientRect(); const x = previous.x - rect.x; const y = previous.y - rect.y;
      if (Math.abs(x) < .5 && Math.abs(y) < .5) continue;
      const animation = item.animate([{ transform: `translate(${x}px, ${y}px)` }, { transform: 'translate(0px, 0px)' }], { duration, easing: 'ease', composite: 'add' });
      const motion = { animation, x, y }; this._motions.set(item, motion);
      animation.onfinish = () => { if (this._motions.get(item) === motion) this._motions.delete(item); };
    }
  }

  cancel(): void {
    for (const { animation } of this._motions.values()) animation.cancel();
    this._motions.clear();
  }
}
