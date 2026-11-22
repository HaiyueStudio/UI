type NativeControl = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
type ControlHost = HTMLElement & { value: string; checked?: boolean; indeterminate?: boolean };

/** Shared native form participation; never registers a component or imports a public entry. */
export class HYFormControl {
  readonly internals: ElementInternals;
  disabled = false;
  private _initial: { value: string; checked?: boolean } | null = null;

  constructor(private readonly _host: ControlHost, private readonly _control: NativeControl) {
    this.internals = _host.attachInternals();
  }

  connect(): void {
    this._initial ??= { value: this._host.value, ...('checked' in this._host ? { checked: Boolean(this._host.checked) } : {}) };
    this.sync();
  }

  sync(): void {
    const control = this._control;
    const checkable = control instanceof HTMLInputElement && ['checkbox', 'radio'].includes(control.type);
    this.internals.setFormValue(control.disabled || (checkable && !control.checked) ? null : control.value,
      JSON.stringify({ value: this._host.value, ...(checkable ? { checked: control.checked } : {}) }));
    this.internals.setValidity(control.disabled ? {} : control.validity, control.disabled ? '' : control.validationMessage, control);
  }

  reset(): void {
    if (!this._initial) return;
    this._restore(this._initial);
    this._control.setCustomValidity('');
    this.sync();
  }

  restore(state: string | File | FormData | null): void {
    if (typeof state !== 'string') return;
    try {
      const parsed: unknown = JSON.parse(state);
      if (parsed && typeof parsed === 'object' && 'value' in parsed && typeof parsed.value === 'string') this._restore(parsed as { value: string; checked?: boolean });
    } catch { this._host.value = state; }
    this.sync();
  }

  setCustomValidity(message: string): void { this._control.setCustomValidity(message); this.sync(); }

  private _restore(state: { value: string; checked?: boolean }): void {
    this._host.value = state.value;
    if (state.checked !== undefined) this._host.checked = state.checked;
    if ('indeterminate' in this._host) this._host.indeterminate = false;
  }
}
