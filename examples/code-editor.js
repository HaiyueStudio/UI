import { EditorView, minimalSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';
import { HighlightStyle, LanguageSupport, syntaxHighlighting } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { css } from '@codemirror/lang-css';
import { tags } from '@lezer/highlight';
import { parseMixed } from '@lezer/common';

const syntaxTheme = HighlightStyle.define([
  { tag: [tags.keyword, tags.operatorKeyword], class: 'hy-code-keyword' },
  { tag: tags.tagName, class: 'hy-code-tag' },
  { tag: [tags.string, tags.attributeValue, tags.regexp, tags.color, tags.atom], class: 'hy-code-string' },
  { tag: [tags.number, tags.bool, tags.null, tags.unit], class: 'hy-code-number' },
  { tag: [tags.function(tags.variableName), tags.className, tags.typeName], class: 'hy-code-function' },
  { tag: [tags.attributeName, tags.propertyName, tags.variableName], class: 'hy-code-property' },
  { tag: [tags.comment, tags.meta], class: 'hy-code-comment' },
  { tag: [tags.bracket, tags.punctuation, tags.operator], class: 'hy-code-punctuation' },
  { tag: tags.invalid, class: 'hy-code-invalid' },
]);

const editorTheme = EditorView.theme({
  '&': {
    height: 'auto',
    color: 'var(--ink)',
    backgroundColor: 'transparent',
    fontSize: 'var(--hy-font-size-sm, 12px)',
  },
  '.cm-scroller': {
    overflow: 'auto',
    maxHeight: 'min(420px, 60vh)',
    fontFamily: 'var(--hy-font-family-mono, ui-monospace, SFMono-Regular, Consolas, monospace)',
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
  '&.cm-focused': { outline: '2px solid var(--hy-focus-border-color)', outlineOffset: '-2px' },
});

const htmlSupport = html();
const javascriptSupport = javascript();
const cssSupport = css();

function mixedHtml(nested) {
  // Gallery snippets place setup code next to HTML without script/style wrappers.
  // Parse only top-level text as code; preserve text inside elements and HTML's
  // built-in support for actual <script> and <style> elements.
  const language = htmlSupport.language.configure({
    wrap: parseMixed(node => node.name === 'Text' && node.node.parent?.name === 'Document'
      ? { parser: nested.language.parser }
      : null),
  });
  return new LanguageSupport(language, [htmlSupport.support, nested.support]);
}

const htmlJavascriptSupport = mixedHtml(javascriptSupport);
const htmlCssSupport = mixedHtml(cssSupport);

function languageFor(label, source) {
  const normalized = label.toLocaleLowerCase();
  const hasMarkup = /^\s*<(?:[a-z][\w:-]*(?:\s|\/?>)|!--|!doctype\b)/im.test(source);
  if (hasMarkup) {
    if (normalized.includes('javascript')) return { name: 'html-javascript', support: htmlJavascriptSupport };
    if (normalized.includes('css')) return { name: 'html-css', support: htmlCssSupport };
    return { name: 'html', support: htmlSupport };
  }
  if (normalized.includes('css') && !normalized.includes('javascript')) return { name: 'css', support: cssSupport };
  return { name: 'javascript', support: javascriptSupport };
}

function createEditor(details) {
  if (details.dataset.codeMirrorReady === 'true') return;
  const fallback = details.querySelector('pre');
  const code = fallback?.querySelector('code');
  if (!fallback || !code) return;

  const source = code.textContent ?? '';
  const languageLabel = details.querySelector('summary span')?.textContent ?? 'Code';
  const language = languageFor(languageLabel, source);
  const host = document.createElement('div');
  host.className = 'code-editor-host';
  host.dataset.codeLanguage = language.name;
  host.setAttribute('aria-label', `${languageLabel} 示例代码`);
  fallback.replaceWith(host);

  const view = new EditorView({
    parent: host,
    // Split uses slots. Styles must live with the editor's actual DOM, rather
    // than the ShadowRoot reached by following its ancestor's assigned slot.
    root: host.getRootNode(),
    doc: source,
    extensions: [
      minimalSetup,
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorView.contentAttributes.of({ tabindex: '0', role: 'textbox', 'aria-readonly': 'true', 'aria-label': `${languageLabel} 只读示例代码` }),
      EditorView.lineWrapping,
      editorTheme,
      syntaxHighlighting(syntaxTheme),
      language.support,
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
