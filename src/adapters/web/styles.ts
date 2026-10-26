/** Only the renderer-owned wrapper and owned ShadowRoots receive these rules. */
export const rootCSS = `
[data-hy-portable-root] { box-sizing:border-box; min-width:0; min-height:0; width:100%; height:100%;
 color:var(--hy-text-color,#d8e2f2); background:var(--hy-surface-color,#171d28);
 font:var(--hy-font-size,14px)/var(--hy-line-height,22px) system-ui,sans-serif; }
[data-hy-portable-root] [data-hy-key] { box-sizing:border-box; min-width:0; min-height:0; }
[data-hy-portable-root] [data-hy-key][hidden] { display:none !important; }
[data-hy-portable-root] [data-hy-kind=Row] { display:flex; flex-direction:row; }
[data-hy-portable-root] [data-hy-kind=RadioGroup] { display:flex; flex-wrap:wrap; gap:var(--hy-gap,8px); }
[data-hy-portable-root] [data-hy-kind=RadioGroup] hy-radio { font:inherit; min-height:44px; }
[data-hy-portable-root] [data-hy-kind=Column] { display:flex; flex-direction:column; }
[data-hy-portable-root] [data-hy-kind=Grid], [data-hy-portable-root] [data-hy-kind=Overlay] { display:grid; }
[data-hy-portable-root] [data-hy-kind=Text] { display:block; overflow-wrap:anywhere; white-space:pre-wrap; }
[data-hy-portable-root] [data-hy-kind=Icon] { width:1.25em; height:1.25em; object-fit:contain; }
[data-hy-portable-root] [data-hy-kind=FormGroup] { border:0; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--hy-gap,8px); }
[data-hy-portable-root] [data-hy-kind=FormGroup] > legend { padding:0; }
[data-hy-portable-root] [data-hy-help] { color:var(--hy-secondary-text-color); font-size:var(--hy-caption-font-size,12px); line-height:var(--hy-caption-line-height,18px); }
[data-hy-portable-root] [data-hy-error] { color:var(--hy-invalid-border-color,#d65c7c); font-size:.9em; }
[data-hy-portable-root] textarea { box-sizing:border-box; width:100%; min-height:5em; resize:vertical; padding:8px;
 color:var(--hy-text-color,#d8e2f2); background:var(--hy-input-bg-color,#121822); border:1px solid var(--hy-border-color,#303746);
 border-radius:var(--hy-radius,4px); font:inherit; }
[data-hy-portable-root] textarea:focus-visible { outline:2px solid var(--hy-focus-ring-color,#8177f2); outline-offset:1px; }
[data-hy-portable-root] [data-hy-text-style=title] { font-size:var(--hy-title-font-size,22px); line-height:var(--hy-title-line-height,30px); font-weight:var(--hy-title-font-weight,700); }
[data-hy-portable-root] [data-hy-text-style=caption] { font-size:var(--hy-caption-font-size,12px); line-height:var(--hy-caption-line-height,18px); font-weight:var(--hy-caption-font-weight,400); }
[data-hy-portable-root] [data-hy-text-style=body] { font-size:var(--hy-body-font-size,var(--hy-font-size,14px)); line-height:var(--hy-body-line-height,var(--hy-line-height,22px)); font-weight:var(--hy-body-font-weight,400); }
[data-hy-portable-root] [data-hy-tone=muted] { color:var(--hy-secondary-text-color); }
[data-hy-portable-root] [data-hy-tone=danger] { color:var(--hy-invalid-border-color); }
[data-hy-portable-root] [data-hy-kind=Button] [slot=icon] svg { display:block; width:20px; height:20px; }
[data-hy-portable-root] [data-hy-slot-group] { display:contents; }
[data-hy-portable-root][data-hy-reduced-motion] { --hy-portable-transition:none; }
@media(prefers-reduced-motion:reduce) { [data-hy-portable-root] { --hy-portable-transition:none; } }
`;
export const componentCSS = `
:host { --hy-input-font:var(--hy-font-size,14px)/var(--hy-line-height,22px) system-ui,sans-serif; --hy-input-radius:var(--hy-radius,8px); font:inherit;
 --hy-panel-bg-color:var(--hy-surface-color,#171d28);
 --hy-menu-bg-color:var(--hy-surface-color,#171d28); --hy-dialog-bg-color:var(--hy-surface-color,#171d28);
 --hy-dialog-body-color:var(--hy-text-color,#d8e2f2); --hy-dialog-footer-bg-color:var(--hy-surface-color,#171d28);
 --hy-accent-strong-color:var(--hy-accent-color,#8177f2);
 --hy-active-text-color:var(--hy-text-color,#d8e2f2); --hy-hover-bg-color:var(--hy-input-bg-color,#121822);
 --hy-focus-border-color:var(--hy-focus-ring-color,#8177f2); --hy-dialog-radius:var(--hy-radius,8px); }
button, input, select { font:inherit; min-height:2em; border-radius:var(--hy-radius,4px); }
/* The semantic host owns the touch target. Its actual interactive element
   must fill it too; otherwise a 44px portable Button still paints at 28px. */
:host(hy-button), :host(hy-input), :host(hy-select) { display:inline-flex; }
:host(hy-button) button, :host(hy-input) input, :host(hy-select) select {
 box-sizing:border-box; width:100%; min-height:inherit; height:100%; padding-inline:12px;
}
:host(hy-select) .wrap, :host(hy-input) .control { width:100%; min-height:inherit; height:100%; box-sizing:border-box; }
:host(hy-input) input { min-height:0; }
select { height:auto; padding-block:4px; }
:host(hy-input) input { height:auto; align-self:stretch; padding-block:0; border-radius:0; outline:none; }
.box, .box::after, .handle { transition:var(--hy-portable-transition,background .12s ease); }
:host(hy-checkbox) { width:auto; }
:host(hy-checkbox) label, :host(hy-checkbox) .label { white-space:normal; }
:host(hy-checkbox) input { min-height:0; }
:host(hy-tabs) { height:auto; grid-template-rows:auto minmax(0,1fr); }
:host(hy-tabs) .tabs { align-items:stretch; }
:host(hy-tabs) button { height:auto; white-space:normal; }
:host(hy-range) .handle { min-height:0; }
:host(hy-dialog) .header { padding:16px 20px; }
:host(hy-dialog) h2 { font-size:calc(var(--hy-font-size,14px) + 6px); }
:host(hy-dialog) .body { display:flex; flex-direction:column; gap:var(--hy-gap,8px); padding:20px; }
:host(hy-dialog) .body > slot { display:contents; }
:host(hy-dialog) .footer { box-sizing:border-box; min-height:0; padding:12px 20px; }

/* Portable variants leave individual Web Component APIs unchanged. */
:host(hy-button) button { border:1px solid var(--hy-border-color); background:var(--hy-surface-color); color:var(--hy-text-color); border-radius:var(--hy-radius,8px); transition:background .12s ease; }
:host(hy-button[data-hy-variant=primary]) button { background:var(--hy-accent-color); border-color:transparent; color:var(--hy-on-accent-color,#fff); }
:host(hy-button[data-hy-variant=danger]) button { background:var(--hy-invalid-border-color); border-color:transparent; color:var(--hy-on-accent-color,#fff); }
:host(hy-button[data-hy-variant=quiet]) button { background:transparent; border-color:transparent; }
:host(hy-button) button:hover:not(:disabled), :host(hy-button) button:active:not(:disabled) { background:var(--hy-pressed-bg-color,var(--hy-selected-bg-color)); }
:host(hy-button) button:disabled { opacity:.45; }
:host(hy-button[data-hy-size=compact]) button { padding-inline:8px; }
:host(hy-button[icon-only]) button { padding:0; width:100%; }
:host(hy-tabs) button { min-height:44px; padding:8px 14px; border:0; border-radius:0; background:transparent; color:var(--hy-secondary-text-color); border-bottom:2px solid transparent; }
:host(hy-tabs) button[aria-selected=true] { color:var(--hy-text-color); border-bottom-color:var(--hy-accent-color); }
:host(hy-tabs[data-hy-variant=segmented]) .tabs { padding:4px; gap:4px; border-radius:var(--hy-radius,8px); background:var(--hy-input-bg-color); }
:host(hy-tabs[data-hy-variant=segmented]) button { border:0; border-radius:var(--hy-radius,8px); }
:host(hy-tabs[data-hy-variant=segmented]) button[aria-selected=true] { background:var(--hy-selected-bg-color,var(--hy-accent-color)); }
button:focus-visible, select:focus-visible { outline:2px solid var(--hy-focus-ring-color,#8177f2); outline-offset:1px; }
[aria-invalid=true] { border-color:var(--hy-invalid-border-color,#d65c7c); }
`;
