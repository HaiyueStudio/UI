export type HYUploadStatus = 'ready' | 'uploading' | 'done' | 'error';
export type HYUploadChangeReason = 'select' | 'remove' | 'start' | 'progress' | 'success' | 'error' | 'abort';
export type HYUploadRejectReason = 'type' | 'size' | 'count' | 'before-upload' | 'error';
export interface HYUploadFile {
  uid: string;
  name: string;
  status: HYUploadStatus;
  percent?: number;
  size?: number;
  type?: string;
  file?: File;
  response?: unknown;
  error?: string;
}
export interface HYUploadChangeDetail { file: HYUploadFile; fileList: HYUploadFile[]; reason: HYUploadChangeReason; }
export interface HYUploadRejectDetail { file: File; reason: HYUploadRejectReason; message: string; }
export interface HYUploadRemoveDetail { file: HYUploadFile; }
export interface HYUploadRequestOptions { file: File; signal: AbortSignal; onProgress: (percent: number) => void; }
export type HYUploadRequest = (options: HYUploadRequestOptions) => Promise<unknown>;
export type HYUploadBeforeUpload = (file: File, files: readonly File[]) => boolean | Promise<boolean>;
let uploadFileId = 0;

export class HYUpload extends HTMLElement {
  static readonly formAssociated = true;
  private readonly _internals = this.attachInternals();
  private readonly _input = document.createElement('input');
  private readonly _zone = document.createElement('div');
  private readonly _button = document.createElement('button');
  private readonly _slot = document.createElement('slot');
  private readonly _list = document.createElement('ul');
  private readonly _message = document.createElement('div');
  private _files: HYUploadFile[] = [];
  private _initialFiles: HYUploadFile[] | null = null;
  private _request: HYUploadRequest | null = null;
  private _beforeUpload: HYUploadBeforeUpload | null = null;
  private _requests = new Map<string, AbortController>();
  private _rows = new Map<string, { row: HTMLLIElement; name: HTMLElement; status: HTMLElement; progress: HTMLProgressElement; remove: HTMLButtonElement; retry: HTMLButtonElement }>();
  private _listeners: AbortController | null = null;
  private _formDisabled = false;
  private _selection = 0;
  private _dragDepth = 0;
  static get observedAttributes(): string[] { return ['name', 'accept', 'multiple', 'disabled', 'drag', 'required', 'max-count', 'max-size', 'auto-upload', 'label', 'aria-label', 'show-file-list']; }

  constructor() {
    super(); const root = this.attachShadow({ mode: 'open' }); const style = document.createElement('style');
    style.textContent = `
      :host { display: block; min-width: 0; color: var(--hy-text-color, #d8e2f2); font: var(--hy-font-size-sm, 12px)/1.5 var(--hy-font-family, system-ui, sans-serif); }
      input { display: none; } .zone { display: flex; align-items: center; gap: var(--hy-space-4, 8px); }
      :host([drag]) .zone { flex-direction: column; padding: var(--hy-space-12, 24px); border: 1px dashed var(--hy-border-color, #303746); border-radius: var(--hy-radius-md, 6px); background: var(--hy-surface-color, #121822); }
      :host([drag]) .zone.dragover { border-color: var(--hy-accent-color, #8177f2); background: var(--hy-hover-bg-color, #273241); }
      button { min-height: var(--hy-control-height-sm, 28px); padding: 0 var(--hy-space-5, 10px); border: 1px solid var(--hy-border-color, #303746); border-radius: var(--hy-radius-sm, 4px); color: inherit; background: var(--hy-surface-elevated-color, #202733); font: inherit; cursor: pointer; }
      button:hover:not(:disabled) { background: var(--hy-hover-bg-color, #273241); } button:focus-visible { outline: 2px solid var(--hy-focus-border-color, #79a8ff); outline-offset: 2px; }
      button:disabled { opacity: .55; cursor: not-allowed; } ul { list-style: none; margin: var(--hy-space-4, 8px) 0 0; padding: 0; }
      li { display: grid; grid-template-columns: minmax(0,1fr) auto auto auto; align-items: center; gap: var(--hy-space-3, 6px); padding: var(--hy-space-3, 6px) 0; border-bottom: 1px solid var(--hy-border-color, #303746); }
      .name { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; } .status { color: var(--hy-muted-text-color, #8290a3); } li.error .status { color: var(--hy-error-color, #d95d72); }
      progress { grid-column: 1 / -1; width: 100%; height: 5px; accent-color: var(--hy-accent-color, #8177f2); }
      .message { margin-top: var(--hy-space-3, 6px); color: var(--hy-error-color, #d95d72); } [hidden] { display: none !important; }
    `;
    this._input.type = 'file'; this._input.tabIndex = -1; this._input.part.add('input');
    this._zone.className = 'zone'; this._zone.part.add('dropzone'); this._button.type = 'button'; this._button.part.add('trigger');
    this._list.part.add('list'); this._list.setAttribute('aria-label', 'Selected files');
    this._message.className = 'message'; this._message.part.add('message'); this._message.setAttribute('role', 'status');
    this._zone.append(this._button, this._slot); root.append(style, this._input, this._zone, this._list, this._message);
  }
  connectedCallback(): void {
    this._initialFiles ??= this.fileList;
    this._listeners?.abort(); this._listeners = new AbortController(); const { signal } = this._listeners;
    this._button.addEventListener('click', () => this.openFileDialog(), { signal });
    this._input.addEventListener('change', () => { const files = [...(this._input.files ?? [])]; this._input.value = ''; void this.selectFiles(files); }, { signal });
    this._zone.addEventListener('dragenter', this._onDragEnter, { signal }); this._zone.addEventListener('dragleave', this._onDragLeave, { signal });
    this._zone.addEventListener('dragover', this._onDragOver, { signal }); this._zone.addEventListener('drop', this._onDrop, { signal });
    this._list.addEventListener('click', this._onListClick, { signal }); this._sync();
  }
  disconnectedCallback(): void { this._listeners?.abort(); this._listeners = null; this._selection++; this.abort(); this._dragDepth = 0; this._zone.classList.remove('dragover'); }
  attributeChangedCallback(name: string, previous: string | null, next: string | null): void {
    if (previous === next) return;
    if (name === 'disabled' && this.disabled) { this._selection++; this.abort(); }
    this._sync();
  }
  get fileList(): HYUploadFile[] { return this._files.map(file => ({ ...file })); }
  set fileList(value: HYUploadFile[]) {
    const seen = new Set<string>();
    const files = (Array.isArray(value) ? value : []).filter(file => file && typeof file.uid === 'string' && file.uid && typeof file.name === 'string' && !seen.has(file.uid) && Boolean(seen.add(file.uid)))
      .map(file => ({ ...file, status: file.status === 'uploading' || file.status === 'done' || file.status === 'error' ? file.status : 'ready' } as HYUploadFile));
    this.abort(); this._selection++; this._files = files; this._sync();
  }
  get files(): File[] { return this._files.flatMap(file => file.file ? [file.file] : []); }
  get request(): HYUploadRequest | null { return this._request; }
  set request(value: HYUploadRequest | null) { this.abort(); this._request = typeof value === 'function' ? value : null; }
  get beforeUpload(): HYUploadBeforeUpload | null { return this._beforeUpload; }
  set beforeUpload(value: HYUploadBeforeUpload | null) { this._selection++; this._beforeUpload = typeof value === 'function' ? value : null; }
  get name(): string { return this.getAttribute('name') ?? ''; }
  set name(value: string) { this.setAttribute('name', value); }
  get accept(): string { return this.getAttribute('accept') ?? ''; }
  set accept(value: string) { this.setAttribute('accept', value); }
  get multiple(): boolean { return this.hasAttribute('multiple'); }
  set multiple(value: boolean) { this.toggleAttribute('multiple', value); }
  get disabled(): boolean { return this.hasAttribute('disabled'); }
  set disabled(value: boolean) { this.toggleAttribute('disabled', value); }
  get drag(): boolean { return this.hasAttribute('drag'); }
  set drag(value: boolean) { this.toggleAttribute('drag', value); }
  get maxCount(): number { return nonnegative(this.getAttribute('max-count')); }
  set maxCount(value: number) { this.setAttribute('max-count', String(value)); }
  get maxSize(): number { return nonnegative(this.getAttribute('max-size')); }
  set maxSize(value: number) { this.setAttribute('max-size', String(value)); }
  get autoUpload(): boolean { return this.getAttribute('auto-upload') !== 'false'; }
  set autoUpload(value: boolean) { this.setAttribute('auto-upload', String(value)); }
  get showFileList(): boolean { return this.getAttribute('show-file-list') !== 'false'; }
  set showFileList(value: boolean) { this.setAttribute('show-file-list', String(value)); }
  get form(): HTMLFormElement | null { return this._internals.form; }
  get validity(): ValidityState { return this._internals.validity; }
  get validationMessage(): string { return this._internals.validationMessage; }
  checkValidity(): boolean { return this._internals.checkValidity(); }
  reportValidity(): boolean { return this._internals.reportValidity(); }
  formDisabledCallback(disabled: boolean): void { this._formDisabled = disabled; if (disabled) { this._selection++; this.abort(); } this._sync(); }
  formResetCallback(): void { this.fileList = this._initialFiles ?? []; this._message.textContent = ''; }
  override focus(options?: FocusOptions): void { this._button.focus(options); }
  openFileDialog(): void { if (!this.disabled && !this._formDisabled) this._input.click(); }

  async selectFiles(value: readonly File[] | FileList): Promise<void> {
    if (this.disabled || this._formDisabled || !this.isConnected) return;
    const selection = ++this._selection; const files = [...value].filter(file => file instanceof File); const accepted: HYUploadFile[] = [];
    this._message.textContent = '';
    for (const file of files) {
      if (this.maxSize && file.size > this.maxSize) { this._reject(file, 'size', 'File exceeds the size limit'); continue; }
      if (!matchesAccept(file, this.accept)) { this._reject(file, 'type', 'File type is not accepted'); continue; }
      const limit = this.multiple ? this.maxCount : 1;
      if (limit && (this.multiple ? this._files.length : 0) + accepted.length >= limit) { this._reject(file, 'count', 'Too many files'); continue; }
      try {
        if (this._beforeUpload && !await this._beforeUpload(file, files)) { if (selection !== this._selection) return; this._reject(file, 'before-upload', 'File was rejected'); continue; }
      } catch (cause) { if (selection !== this._selection) return; this._reject(file, 'error', cause instanceof Error ? cause.message : 'File validation failed'); continue; }
      if (selection !== this._selection || !this.isConnected || this.disabled || this._formDisabled) return;
      accepted.push({ uid: `hy-upload-${++uploadFileId}`, name: file.name, size: file.size, type: file.type, file, status: 'ready', percent: 0 });
    }
    if (selection !== this._selection || !this.isConnected || !accepted.length) return;
    if (!this.multiple) { this.abort(); this._files = []; }
    this._files.push(...accepted); this._sync();
    for (const file of accepted) this._emit(file, 'select');
    if (this.autoUpload && this._request) await Promise.all(accepted.map(file => this._upload(file.uid)));
  }

  async upload(uid?: string): Promise<void> {
    if (!this._request || this.disabled || this._formDisabled || !this.isConnected) return;
    await Promise.all(this._files.filter(file => (!uid || file.uid === uid) && file.status !== 'done').map(file => this._upload(file.uid)));
  }
  abort(uid?: string): void {
    for (const [id, controller] of this._requests) {
      if (uid && id !== uid) continue;
      controller.abort(); this._requests.delete(id);
      const file = this._files.find(file => file.uid === id);
      if (file) { file.status = 'ready'; file.percent = 0; this._emit(file, 'abort'); }
    }
    this._sync();
  }
  removeFile(uid: string): boolean {
    if (this.disabled || this._formDisabled) return false;
    const file = this._files.find(file => file.uid === uid); if (!file) return false;
    if (!this.dispatchEvent(new CustomEvent<HYUploadRemoveDetail>('file-remove', { detail: { file: { ...file } }, bubbles: true, composed: true, cancelable: true }))) return false;
    this.abort(uid); this._files = this._files.filter(file => file.uid !== uid); this._sync(); this._emit(file, 'remove'); return true;
  }
  private async _upload(uid: string): Promise<void> {
    const request = this._request; const file = this._files.find(file => file.uid === uid);
    if (!request || !file?.file || this._requests.has(uid) || !this.isConnected || this.disabled || this._formDisabled) return;
    const controller = new AbortController(); this._requests.set(uid, controller); file.status = 'uploading'; file.percent = 0; delete file.error;
    this._sync(); this._emit(file, 'start');
    if (controller.signal.aborted) return;
    try {
      const response = await request({ file: file.file, signal: controller.signal, onProgress: percent => {
        if (!controller.signal.aborted && this._requests.get(uid) === controller && Number.isFinite(percent)) { file.percent = Math.max(0, Math.min(100, percent)); this._sync(); this._emit(file, 'progress'); }
      } });
      if (controller.signal.aborted || this._requests.get(uid) !== controller) return;
      file.status = 'done'; file.percent = 100; file.response = response; this._sync(); this._emit(file, 'success');
    } catch (cause) {
      if (controller.signal.aborted || this._requests.get(uid) !== controller) return;
      file.status = 'error'; file.error = cause instanceof Error ? cause.message : 'Upload failed'; this._sync(); this._emit(file, 'error');
    } finally { if (this._requests.get(uid) === controller) this._requests.delete(uid); }
  }
  private _emit(file: HYUploadFile, reason: HYUploadChangeReason): void { this.dispatchEvent(new CustomEvent<HYUploadChangeDetail>('upload-change', { detail: { file: { ...file }, fileList: this.fileList, reason }, bubbles: true, composed: true })); }
  private _reject(file: File, reason: HYUploadRejectReason, message: string): void { this._message.textContent = `${file.name}: ${message}`; this.dispatchEvent(new CustomEvent<HYUploadRejectDetail>('file-reject', { detail: { file, reason, message }, bubbles: true, composed: true })); }
  private _sync(): void {
    const disabled = this.disabled || this._formDisabled;
    this._input.disabled = this._button.disabled = disabled; this._input.accept = this.accept; this._input.multiple = this.multiple;
    this._button.textContent = this.getAttribute('label') || 'Choose files'; this._button.setAttribute('aria-label', this.getAttribute('aria-label') || this.getAttribute('label') || 'Choose files');
    this._zone.setAttribute('aria-disabled', String(disabled)); this._list.hidden = !this.showFileList || !this._files.length;
    for (const [uid, row] of this._rows) if (!this._files.some(file => file.uid === uid)) { row.row.remove(); this._rows.delete(uid); }
    this._files.forEach((file, index) => {
      let record = this._rows.get(file.uid);
      if (!record) {
        const row = document.createElement('li'); row.part.add('file'); const name = document.createElement('span'); name.className = 'name'; name.part.add('file-name');
        const status = document.createElement('span'); status.className = 'status'; status.part.add('file-status');
        const progress = document.createElement('progress'); progress.max = 100; progress.part.add('progress');
        const remove = document.createElement('button'); remove.type = 'button'; remove.dataset.remove = file.uid; remove.textContent = '×'; remove.part.add('remove');
        const retry = document.createElement('button'); retry.type = 'button'; retry.dataset.retry = file.uid; retry.textContent = 'Retry'; retry.part.add('retry');
        row.append(name, status, retry, remove, progress); record = { row, name, status, progress, remove, retry }; this._rows.set(file.uid, record);
      }
      record.row.className = file.status; if (record.name.textContent !== file.name) record.name.textContent = file.name;
      record.name.title = file.name; record.status.textContent = file.status === 'uploading' ? `${Math.round(file.percent ?? 0)}%` : file.error || file.status;
      record.progress.hidden = file.status !== 'uploading'; record.progress.value = file.percent ?? 0; record.progress.setAttribute('aria-label', `Upload ${file.name}`);
      record.remove.disabled = disabled; record.remove.setAttribute('aria-label', `Remove ${file.name}`);
      record.retry.hidden = file.status !== 'error' || !this._request; record.retry.disabled = disabled; record.retry.setAttribute('aria-label', `Retry ${file.name}`);
      if (this._list.children[index] !== record.row) this._list.insertBefore(record.row, this._list.children[index] ?? null);
    });
    const data = new FormData(); for (const file of this.files) data.append(this.name, file);
    this._internals.setFormValue(disabled || !this.name ? null : data);
    const missing = !disabled && this.hasAttribute('required') && !this._files.length;
    this._internals.setValidity(missing ? { valueMissing: true } : {}, missing ? 'Choose a file' : '', this._button);
  }
  private _onListClick = (event: MouseEvent): void => {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button') : null;
    if (button?.dataset.remove) this.removeFile(button.dataset.remove); else if (button?.dataset.retry) void this.upload(button.dataset.retry);
  };
  private _onDragEnter = (event: DragEvent): void => { if (!this.drag) return; event.preventDefault(); if (!this.disabled && !this._formDisabled) { this._dragDepth++; this._zone.classList.add('dragover'); } };
  private _onDragLeave = (event: DragEvent): void => { if (!this.drag) return; event.preventDefault(); if (--this._dragDepth <= 0) { this._dragDepth = 0; this._zone.classList.remove('dragover'); } };
  private _onDragOver = (event: DragEvent): void => { if (this.drag) { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = this.disabled || this._formDisabled ? 'none' : 'copy'; } };
  private _onDrop = (event: DragEvent): void => { if (!this.drag) return; event.preventDefault(); this._dragDepth = 0; this._zone.classList.remove('dragover'); if (event.dataTransfer) void this.selectFiles(event.dataTransfer.files); };
}

function nonnegative(value: string | null): number { const number = Number(value); return Number.isFinite(number) ? Math.max(0, number) : 0; }
function matchesAccept(file: File, accept: string): boolean {
  const tokens = accept.toLowerCase().split(',').map(token => token.trim()).filter(Boolean);
  return !tokens.length || tokens.some(token => token === '*' || token === '*/*' || (token.startsWith('.') ? file.name.toLowerCase().endsWith(token) : token.endsWith('/*') ? file.type.toLowerCase().startsWith(token.slice(0, -1)) : file.type.toLowerCase() === token));
}
export function defineUploadComponents(): void { if (!customElements.get('hy-upload')) customElements.define('hy-upload', HYUpload); }
