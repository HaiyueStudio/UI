import { EditorView, minimalSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { tags } from '@lezer/highlight';

const syntaxTheme = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword, tags.tagName], color: 'var(--hy-accent-strong-color)' },
  { tag: [tags.string, tags.attributeValue, tags.regexp], color: 'var(--hy-success-color, #76d6a5)' },
  { tag: [tags.number, tags.bool, tags.null], color: 'var(--hy-theme-highlight-color)' },
  { tag: [tags.function(tags.variableName), tags.className, tags.typeName], color: 'var(--hy-accent-color)' },
  { tag: [tags.attributeName, tags.propertyName], color: 'color-mix(in srgb, var(--hy-accent-color) 72%, var(--ink))' },
  { tag: [tags.comment, tags.meta], color: 'var(--muted-2)', fontStyle: 'italic' },
  { tag: [tags.bracket, tags.punctuation, tags.operator], color: 'var(--muted)' },
  { tag: tags.invalid, color: 'var(--hy-danger-color, #ef7189)', textDecoration: 'underline' },
]);

const editorTheme = EditorView.theme({
  '&': {
    height: '100%',
    color: 'var(--ink)',
    backgroundColor: 'transparent',
    fontSize: '11px',
  },
  '.cm-scroller': {
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    lineHeight: '1.75',
  },
  '.cm-content': { padding: '14px 0' },
  '.cm-line': { padding: '0 16px' },
  '.cm-gutters': {
    color: 'var(--muted-2)',
    backgroundColor: 'color-mix(in srgb, var(--panel-2) 72%, transparent)',
    borderRight: '1px solid var(--line-soft)',
  },
  '.cm-activeLine, .cm-activeLineGutter': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 7%, transparent)',
  },
  '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
    backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent) !important',
  },
  '&.cm-focused': { outline: 'none' },
});

function languageFor(label, source) {
  const normalized = label.toLocaleLowerCase();
  if (normalized.includes('html') || source.trimStart().startsWith('<')) return html();
  if (normalized.includes('css') && !normalized.includes('javascript')) return css();
  return javascript();
}

function createEditor(details) {
  if (details.dataset.codeMirrorReady === 'true') return;
  const fallback = details.querySelector('pre');
  const code = fallback?.querySelector('code');
  if (!fallback || !code) return;

  const source = code.textContent ?? '';
  const languageLabel = details.querySelector('summary span')?.textContent ?? 'Code';
  const host = document.createElement('div');
  host.className = 'code-editor-host';
  host.setAttribute('aria-label', `${languageLabel} 示例代码`);
  fallback.replaceWith(host);

  const view = new EditorView({
    parent: host,
    doc: source,
    extensions: [
      minimalSetup,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.lineWrapping,
      editorTheme,
      syntaxHighlighting(syntaxTheme),
      languageFor(languageLabel, source),
    ],
  });
  view.contentDOM.setAttribute('aria-label', `${languageLabel} 只读示例代码`);
  details.dataset.codeMirrorReady = 'true';
}

export function installCodeEditors(root = document) {
  for (const details of root.querySelectorAll('details.code')) {
    if (details.open) createEditor(details);
    details.addEventListener('toggle', () => {
      if (details.open) createEditor(details);
    });
  }
}
