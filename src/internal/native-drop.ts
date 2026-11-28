interface NativeDropOptions {
  enabled(): boolean;
  accepts(transfer: DataTransfer): boolean;
  active(value: boolean): void;
  drop(event: DragEvent): void;
}

/** Shared depth tracking prevents child dragenter/dragleave events from flickering a drop zone. */
export class HYNativeDrop {
  private _depth = 0;
  constructor(private readonly _element: HTMLElement, private readonly _options: NativeDropOptions) {}

  connect(signal: AbortSignal): void {
    const options = this._options;
    this._element.addEventListener('dragenter', event => {
      if (!options.enabled()) return;
      event.preventDefault();
      if (event.dataTransfer && options.accepts(event.dataTransfer)) { event.stopPropagation(); this._depth++; options.active(true); }
    }, { signal });
    this._element.addEventListener('dragleave', event => {
      if (!options.enabled()) return;
      event.preventDefault();
      if (this._depth > 0) event.stopPropagation();
      if (--this._depth <= 0) this.reset();
    }, { signal });
    this._element.addEventListener('dragover', event => {
      if (!options.enabled()) return;
      event.preventDefault();
      const accepted = Boolean(event.dataTransfer && options.accepts(event.dataTransfer));
      if (accepted) event.stopPropagation();
      if (event.dataTransfer) event.dataTransfer.dropEffect = accepted ? 'copy' : 'none';
      if (!accepted) this.reset();
    }, { signal });
    this._element.addEventListener('drop', event => {
      if (!options.enabled()) return;
      event.preventDefault(); this.reset();
      if (event.dataTransfer && options.accepts(event.dataTransfer)) { event.stopPropagation(); options.drop(event); }
    }, { signal });
    this._element.ownerDocument.defaultView?.addEventListener('dragend', () => this.reset(), { signal });
    this._element.ownerDocument.defaultView?.addEventListener('blur', () => this.reset(), { signal });
    signal.addEventListener('abort', () => this.reset(), { once: true });
  }

  reset(): void { this._depth = 0; this._options.active(false); }
}

export function hasFiles(transfer: DataTransfer): boolean {
  return transfer.types.includes('Files') || transfer.files.length > 0;
}
