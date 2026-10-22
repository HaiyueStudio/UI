import type { HYTheme } from '../core/types.js';
import { HYUIError } from '../core/validation.js';
import { snapshot } from '../core/data.js';

export const HY_THEME_TOKENS = Object.freeze({
  text: '--hy-text-color', muted: '--hy-secondary-text-color', surface: '--hy-surface-color', input: '--hy-input-bg-color',
  accent: '--hy-accent-color', danger: '--hy-invalid-border-color', border: '--hy-border-color', focus: '--hy-focus-ring-color',
  selected:'--hy-selected-bg-color', pressed:'--hy-pressed-bg-color', disabled:'--hy-disabled-text-color', elevated:'--hy-surface-elevated-color', onAccent:'--hy-on-accent-color',
  fontSize: '--hy-font-size', lineHeight: '--hy-line-height', gap: '--hy-gap', radius: '--hy-radius',
} as const);
export type HYThemeVariables = Readonly<Record<(typeof HY_THEME_TOKENS)['text'|'muted'|'surface'|'input'|'accent'|'danger'|'border'|'focus'|'fontSize'|'lineHeight'|'gap'|'radius'],string> & Partial<Record<(typeof HY_THEME_TOKENS)[keyof typeof HY_THEME_TOKENS],string>> & Record<string,string>>;

export function hyNativeTheme(theme: HYTheme, fontScale = 1): HYTheme {
  const bad = (property: string): never => { throw new HYUIError('invalid-props', 'Invalid portable theme value', { property }); };
  if (!theme || typeof theme !== 'object') bad('theme');
  for (const key of Object.keys(theme)) if (!['color','fontSize','lineHeight','gap','radius','typography'].includes(key)) bad(key);
  if (!Number.isFinite(fontScale) || fontScale <= 0) bad('fontScale');
  for (const key of ['fontSize','lineHeight','gap','radius'] as const) {
    if (!Number.isFinite(theme[key]) || theme[key] < 0 || ((key === 'fontSize' || key === 'lineHeight') && theme[key] === 0)) bad(key);
  }
  for (const key of ['text','muted','surface','input','accent','danger','border','focus'] as const) {
    if (typeof theme.color?.[key] !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(theme.color[key])) bad(`color.${key}`);
  }
  for (const key of Object.keys(theme.color)) if (!['text','muted','surface','input','accent','danger','border','focus','selected','pressed','disabled','elevated','onAccent'].includes(key)) bad(`color.${key}`);
  for (const [key, value] of Object.entries(theme.color)) if (typeof value !== 'string' || !/^#[\da-f]{6}([\da-f]{2})?$/i.test(value)) bad(`color.${key}`);
  const typography: Record<string, {fontSize:number;lineHeight:number;weight?:'normal'|'medium'|'bold'}> = {};
  if (theme.typography !== undefined) {
    if (!theme.typography || typeof theme.typography !== 'object' || Array.isArray(theme.typography)) bad('typography');
    for (const [key, value] of Object.entries(theme.typography)) {
      if (!['title','body','caption'].includes(key) || !value || typeof value !== 'object') bad(`typography.${key}`);
      for (const field of Object.keys(value)) if (!['fontSize','lineHeight','weight'].includes(field)) bad(`typography.${key}.${field}`);
      if (![value.fontSize, value.lineHeight].every(v => Number.isFinite(v) && v > 0 && Number.isFinite(v * fontScale)) || (value.weight !== undefined && !['normal','medium','bold'].includes(value.weight))) bad(`typography.${key}`);
      typography[key] = {...value, fontSize:value.fontSize * fontScale, lineHeight:value.lineHeight * fontScale};
    }
  }
  if (!Number.isFinite(theme.fontSize * fontScale) || !Number.isFinite(theme.lineHeight * fontScale)) bad('fontScale');
  return snapshot({ color: { ...theme.color }, fontSize: theme.fontSize * fontScale, lineHeight: theme.lineHeight * fontScale, gap: theme.gap, radius: theme.radius, ...(theme.typography ? {typography} : {}) });
}
/** Returns data for an adapter to apply; importing it never creates a stylesheet. */
export function hyThemeVariables(theme: HYTheme, fontScale = 1): HYThemeVariables {
  const data = hyNativeTheme(theme, fontScale);
  return Object.freeze(Object.fromEntries([
    ...Object.entries(data.color).map(([key, value]) => [HY_THEME_TOKENS[key as keyof HYTheme['color']], value]),
    ...(['fontSize','lineHeight','gap','radius'] as const).map(key => [HY_THEME_TOKENS[key], `${data[key]}px`]),
    ...Object.entries(data.typography ?? {}).flatMap(([key, value]) => [[`--hy-${key}-font-size`, `${value.fontSize}px`], [`--hy-${key}-line-height`, `${value.lineHeight}px`], [`--hy-${key}-font-weight`, value.weight === 'bold' ? '700' : value.weight === 'medium' ? '500' : '400']]),
  ])) as HYThemeVariables;
}
