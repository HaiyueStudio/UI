import type { HYCapabilities, HYComponentKind, HYComponentProps, HYDiagnosticCode, HYDiagnosticContext, HYFeature, HYNode, HYSourceLocation } from './types.js';
import { isSnapshot, snapshot } from './data.js';

export class HYUIError extends Error {
  readonly code: HYDiagnosticCode;
  readonly context: Readonly<HYDiagnosticContext>;
  constructor(code: HYDiagnosticCode, message: string, context: HYDiagnosticContext = {}, cause?: unknown) {
    const place = [context.source && `${context.source.file}:${context.source.line ?? 1}`, context.key, context.property,
      context.operation, context.revision === undefined ? undefined : `revision=${context.revision}`].filter(Boolean).join(' ');
    super(`${message}${place ? ` [${place}]` : ''}`, cause === undefined ? undefined : { cause });
    this.name = 'HYUIError'; this.code = code; this.context = Object.freeze({ ...context });
  }
}

export const HY_FEATURES: readonly HYFeature[] = Object.freeze([
  'text.composition', 'text.selection', 'text.secure', 'accessibility', 'icons.system', 'layout.rtl', 'theme.highContrast', 'motion.reduced',
]);
type Check = (value: unknown, context: HYDiagnosticContext) => void;
const fail = (message: string, context: HYDiagnosticContext): never => { throw new HYUIError('invalid-props', message, context); };
const field = (context: HYDiagnosticContext, key: string): HYDiagnosticContext => ({ ...context, property: context.property ? `${context.property}.${key}` : key });
function check(test: (value: unknown) => boolean, message: string): Check {
  return (value, context) => { if (!test(value)) fail(message, context); };
}
const string = check(v => typeof v === 'string', 'Expected string');
const name = check(v => typeof v === 'string' && v.trim().length > 0, 'Expected non-empty identifier');
const boolean = check(v => typeof v === 'boolean', 'Expected boolean');
const number = check(v => typeof v === 'number' && Number.isFinite(v), 'Expected finite number');
const positive = check(v => typeof v === 'number' && Number.isFinite(v) && v > 0, 'Expected positive finite number');
const size = check(v => typeof v === 'number' && Number.isFinite(v) && v >= 0, 'Expected non-negative finite number');
const integer = check(v => Number.isSafeInteger(v) && (v as number) >= 0, 'Expected non-negative integer');
const choice = (...values: readonly unknown[]): Check => check(v => values.includes(v), `Expected one of ${values.join(', ')}`);
const length: Check = (v, c) => { if (v !== 'auto') size(v, c); };
function record(value: unknown, context: HYDiagnosticContext): Record<string, unknown> {
  if (!value || typeof value !== 'object' || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) fail('Expected plain data object', context);
  return value as Record<string, unknown>;
}
function shape(fields: Record<string, Check>, required: readonly string[] = []): Check {
  return (v, c) => {
    const obj = record(v, c);
    for (const key of required) if (!Object.hasOwn(obj, key)) fail('Missing required property', field(c, key));
    for (const key of Object.keys(obj)) {
      if (!Object.hasOwn(fields, key)) fail('Unknown property', field(c, key));
      const descriptor = Object.getOwnPropertyDescriptor(obj, key)!;
      if (!('value' in descriptor)) fail('Accessors are not protocol data', field(c, key));
      fields[key]!(descriptor.value, field(c, key));
    }
  };
}
const list = (item: Check): Check => (v, c) => {
  if (!Array.isArray(v)) fail('Expected array', c);
  for (let i = 0; i < (v as unknown[]).length; i++) item((v as unknown[])[i], field(c, String(i)));
};
const track: Check = (v, c) => typeof v === 'object' && v !== null ? shape({ grow: positive }, ['grow'])(v, c) : length(v, c);
const layout: Check = (v, c) => {
  shape({ width: length, height: length, minWidth: size, maxWidth: size, minHeight: size, maxHeight: size,
    padding: (p, ctx) => { list(size)(p, ctx); if ((p as unknown[]).length !== 4) fail('Expected four padding values', ctx); },
    gap: size, grow: size, align: choice('start', 'center', 'end', 'stretch'), columns: list(track), rows: list(track),
    row: integer, column: integer, clip: boolean })(v, c);
  const p = v as Record<string, number>;
  for (const dimension of ['Width', 'Height']) if (p[`min${dimension}`]! > p[`max${dimension}`]!) fail('Minimum exceeds maximum', c);
};
const common = {
  visible: boolean, layout,
  a11y: shape({ label: string, description: string, error: string,
    role: choice('button','text','textbox','checkbox','tab','dialog','image','slider','list','tree') }, ['label']),
};
const resource = shape({ id: name, alt: string }, ['id', 'alt']);
const selection = { value: string, options: list(shape({ value: string, label: string, disabled: boolean }, ['value', 'label'])), disabled: boolean };
const text = { value: string, disabled: boolean, readOnly: boolean, placeholder: string };
const schemas: Record<HYComponentKind, Check> = {
  Row: shape(common), Column: shape(common), Grid: shape(common), Overlay: shape(common),
  Scroll: shape({ ...common, axis: choice('horizontal', 'vertical') }, ['axis']),
  Text: shape({ ...common, text: string, wrap: boolean }, ['text']),
  Image: shape({ ...common, resource, fit: choice('contain','cover') }, ['resource']),
  Icon: shape({ ...common, resource, systemName: name }, ['resource']),
  Button: shape({ ...common, text: string, disabled: boolean, busy: boolean }, ['text']),
  Toggle: shape({ ...common, checked: boolean, disabled: boolean }, ['checked']),
  Select: shape({ ...common, ...selection }, ['value','options']), Tabs: shape({ ...common, ...selection }, ['value','options']),
  TextInput: shape({ ...common, ...text, secure: boolean }, ['value']), TextArea: shape({ ...common, ...text }, ['value']),
  Slider: shape({ ...common, value: number, min: number, max: number, step: positive, disabled: boolean }, ['value','min','max','step']),
  Dialog: shape({ ...common, open: boolean, title: string, dismissible: boolean }, ['open','title']),
  FormGroup: shape({ ...common, label: string, error: string }, ['label']),
  PlatformView: shape({ ...common, slot: name, resourceId: name }, ['slot','resourceId']),
};
export const HY_COMPONENTS: readonly HYComponentKind[] = Object.freeze(Object.keys(schemas) as HYComponentKind[]);

export function hyValidateCapabilities(capabilities: HYCapabilities): void {
  const context = { property: 'capabilities' };
  shape({ contract: choice(1), backend: choice('web','nativescript','desktop'), components: list(choice(...HY_COMPONENTS)),
    features: list((v, c) => { if (!HY_FEATURES.includes(v as HYFeature)) throw new HYUIError('capability', 'Unknown capability', c); }) },
  ['contract','backend','components','features'])(capabilities, context);
  if (new Set(capabilities.components).size !== capabilities.components.length || new Set(capabilities.features).size !== capabilities.features.length) {
    throw new HYUIError('capability', 'Duplicate capability declaration', context);
  }
}
export function hySupports(capabilities: HYCapabilities, feature: HYFeature): boolean {
  hyValidateCapabilities(capabilities);
  if (!HY_FEATURES.includes(feature)) throw new HYUIError('capability', 'Unknown capability', { property: feature });
  return capabilities.features.includes(feature);
}
const validatedSnapshots = new WeakMap<object, Set<HYComponentKind>>();
function remember(props:object,kind:HYComponentKind):void {
  let kinds=validatedSnapshots.get(props);if(!kinds){kinds=new Set();validatedSnapshots.set(props,kinds);}kinds.add(kind);
}
/** Internal immutable hand-off. Mutable and merely shallow-frozen inputs are always validated. */
export function snapshotValidatedProps<K extends HYComponentKind>(kind:K,props:HYComponentProps[K],context:HYDiagnosticContext,capabilities:HYCapabilities):HYComponentProps[K] {
  hyValidateProps(kind,props,context,capabilities);
  const result=snapshot(props);remember(result,kind);return result;
}
export function hyValidateProps<K extends HYComponentKind>(kind: K, props: HYComponentProps[K], context: HYDiagnosticContext = {}, capabilities?: HYCapabilities): void {
  if (!Object.hasOwn(schemas, kind)) fail('Unknown component kind', context);
  if (!validatedSnapshots.get(props)?.has(kind)) {
  schemas[kind](props, context);
  if (kind === 'Select' || kind === 'Tabs') {
    const p = props as HYComponentProps['Select'];
    if (new Set(p.options.map(o => o.value)).size !== p.options.length) fail('Duplicate option value', field(context, 'options'));
    if (!p.options.some(o => o.value === p.value)) fail('Unknown controlled value', field(context, 'value'));
  }
  if (kind === 'Slider') {
    const p = props as HYComponentProps['Slider'];
    if (p.min > p.max || p.value < p.min || p.value > p.max) fail('Slider value/range is invalid', context);
  }
  if (kind !== 'Grid' && (props.layout?.rows || props.layout?.columns)) fail('Track definitions require Grid', field(context, 'layout'));
  if (isSnapshot(props)) remember(props,kind);
  }
  if (capabilities) {
    if (!capabilities.components.includes(kind)) throw new HYUIError('capability', `Unsupported component ${kind}`, context);
    const needs: HYFeature[] = [];
    if (props.a11y) needs.push('accessibility');
    if (kind === 'TextInput' && (props as HYComponentProps['TextInput']).secure) needs.push('text.secure');
    if (kind === 'Icon' && (props as HYComponentProps['Icon']).systemName) needs.push('icons.system');
    for (const feature of needs) if (!capabilities.features.includes(feature)) throw new HYUIError('capability', `Missing capability ${feature}`, context);
  }
}

/** Escaped, stable backend key. Author keys are unique across all slots of one parent. */
export function hyKey(...parts: readonly string[]): string {
  for (const key of parts) name(key, { key });
  if (!parts.length) throw new HYUIError('invalid-props', 'A node path needs at least one key');
  return '/' + parts.map(key => key.replace(/~/g, '~0').replace(/\//g, '~1')).join('/');
}

export function hyValidateNode(node: HYNode, capabilities?: HYCapabilities): HYNode {
  if (capabilities) hyValidateCapabilities(capabilities);
  const ancestors = new Set<unknown>();
  const walk = (value: HYNode, parent: readonly string[]): void => {
    const raw = record(value, { property: 'node' });
    for (const key of Object.keys(raw)) if (!('value' in Object.getOwnPropertyDescriptor(raw, key)!)) fail('Accessors are not protocol data', { property: `node.${key}` });
    name(raw.key, { property: 'key' });
    const path = [...parent, raw.key as string];
    const context: HYDiagnosticContext = { key: hyKey(...path), ...(value.source ? { source: value.source } : {}) };
    if (ancestors.has(value)) fail('Cyclic node tree', context);
    ancestors.add(value);
    for (const key of Object.keys(raw)) if (!['key','kind','props','children','slots','source','requires'].includes(key)) fail('Unknown node property', field(context,key));
    if (value.source !== undefined) shape({ file: name, line: check(v => Number.isSafeInteger(v) && (v as number) > 0, 'Expected positive line number') }, ['file'])(value.source, field(context, 'source'));
    hyValidateProps(value.kind, value.props, context, capabilities);
    if (value.requires !== undefined) {
      list((v, c) => { if (!HY_FEATURES.includes(v as HYFeature)) throw new HYUIError('capability', 'Unknown capability', c); })(value.requires, field(context, 'requires'));
      for (const feature of value.requires) if (capabilities && !capabilities.features.includes(feature)) throw new HYUIError('capability', `Missing capability ${feature}`, context);
    }
    const siblings = new Set<string>();
    const visit = (children: readonly HYNode[], property: string): void => {
      if (!Array.isArray(children)) fail('Expected children array', field(context, property));
      for (const child of children) {
        record(child, field(context,property));
        if (siblings.has(child.key)) throw new HYUIError('duplicate-key', `Duplicate key ${child.key}`, { ...context, property });
        siblings.add(child.key); walk(child, path);
      }
    };
    if (value.children !== undefined) visit(value.children, 'children');
    if (value.slots !== undefined) {
      record(value.slots, field(context,'slots'));
      for (const [slot, children] of Object.entries(value.slots)) { name(slot, context); visit(children, `slots.${slot}`); }
    }
    if ((value.children?.length || Object.values(value.slots ?? {}).some(a => a.length))
        && !['Row','Column','Grid','Overlay','Scroll','Dialog','FormGroup','Tabs','Button'].includes(value.kind)) fail('Leaf component cannot contain children; use a container or PlatformView', context);
    ancestors.delete(value);
  };
  walk(node, []);
  return snapshot(node);
}

export function hyNode<K extends HYComponentKind>(kind: K, key: string, props: HYComponentProps[K],
  content: { readonly children?: readonly HYNode[]; readonly slots?: Readonly<Record<string, readonly HYNode[]>>; readonly source?: HYSourceLocation; readonly requires?: readonly HYFeature[] } = {}): Extract<HYNode, { kind: K }> {
  return hyValidateNode({ kind, key, props, ...content } as HYNode) as Extract<HYNode, { kind: K }>;
}
