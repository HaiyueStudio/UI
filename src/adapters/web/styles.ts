/** Only the renderer-owned wrapper and owned ShadowRoots receive these rules. */
export const rootCSS = `
[data-hy-portable-root] { box-sizing:border-box; min-width:0; min-height:0; width:100%; height:100%;
 color:var(--hy-text-color,#d8e2f2); background:var(--hy-surface-color,#171d28);
 font:var(--hy-font-size,14px)/var(--hy-line-height,22px) system-ui,sans-serif; }
[data-hy-portable-root] [data-hy-key] { box-sizing:border-box; min-width:0; min-height:0; }
[data-hy-portable-root] [data-hy-key][hidden] { display:none !important; }
[data-hy-portable-root] [data-hy-kind=Row] { display:flex; flex-direction:row; }
[data-hy-portable-root] [data-hy-kind=Column] { display:flex; flex-direction:column; }
[data-hy-portable-root] [data-hy-kind=Grid], [data-hy-portable-root] [data-hy-kind=Overlay] { display:grid; }
[data-hy-portable-root] [data-hy-kind=Text] { display:block; overflow-wrap:anywhere; white-space:pre-wrap; }
[data-hy-portable-root] [data-hy-kind=Icon] { width:1.25em; height:1.25em; object-fit:contain; }
[data-hy-portable-root] [data-hy-kind=FormGroup] { border:0; margin:0; padding:0; display:flex; flex-direction:column; gap:var(--hy-gap,8px); }
[data-hy-portable-root] [data-hy-kind=FormGroup] > legend { padding:0; }
[data-hy-portable-root] [data-hy-error] { color:var(--hy-invalid-border-color,#d65c7c); font-size:.9em; }
[data-hy-portable-root] textarea { box-sizing:border-box; width:100%; min-height:5em; resize:vertical; padding:8px;
 color:var(--hy-text-color,#d8e2f2); background:var(--hy-input-bg-color,#121822); border:1px solid var(--hy-border-color,#303746);
 border-radius:var(--hy-radius,4px); font:inherit; }
[data-hy-portable-root] textarea:focus-visible { outline:2px solid var(--hy-focus-ring-color,#8177f2); outline-offset:1px; }
[data-hy-portable-root] [data-hy-slot-group] { display:contents; }
[data-hy-portable-root][data-hy-reduced-motion] { --hy-portable-transition:none; }
@media(prefers-reduced-motion:reduce) { [data-hy-portable-root] { --hy-portable-transition:none; } }
`;
export const componentCSS = `
:host { --hy-input-font:var(--hy-font-size,14px)/var(--hy-line-height,22px) system-ui,sans-serif; font:inherit;
 --hy-panel-bg-color:var(--hy-surface-color,#171d28); --hy-surface-elevated-color:var(--hy-surface-color,#171d28);
 --hy-menu-bg-color:var(--hy-surface-color,#171d28); --hy-dialog-bg-color:var(--hy-surface-color,#171d28);
 --hy-dialog-body-color:var(--hy-text-color,#d8e2f2); --hy-dialog-footer-bg-color:var(--hy-surface-color,#171d28);
 --hy-accent-strong-color:var(--hy-accent-color,#8177f2); --hy-selected-bg-color:var(--hy-accent-color,#8177f2);
 --hy-active-text-color:var(--hy-text-color,#d8e2f2); --hy-hover-bg-color:var(--hy-input-bg-color,#121822);
 --hy-focus-border-color:var(--hy-focus-ring-color,#8177f2); --hy-dialog-radius:var(--hy-radius,8px); }
button, input, select { font:inherit; min-height:2em; border-radius:var(--hy-radius,4px); }
select { height:auto; padding-block:4px; }
input { height:var(--hy-input-height,auto); padding-block:4px; }
.box, .box::after, .handle { transition:var(--hy-portable-transition,background .12s ease); }
:host(hy-checkbox) { width:auto; }
:host(hy-checkbox) label, :host(hy-checkbox) .label { white-space:normal; }
:host(hy-checkbox) input { min-height:0; }
:host(hy-tabs) { height:auto; grid-template-rows:auto minmax(0,1fr); }
:host(hy-tabs) .tabs { align-items:stretch; }
:host(hy-tabs) button { height:auto; white-space:normal; }
:host(hy-range) .handle { min-height:0; }
button:focus-visible, select:focus-visible, input:focus-visible { outline:2px solid var(--hy-focus-ring-color,#8177f2); outline-offset:1px; }
[aria-invalid=true] { border-color:var(--hy-invalid-border-color,#d65c7c); }
`;
