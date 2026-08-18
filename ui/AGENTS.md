# UI workspace instructions

## Boundary

- `@haiyue/ui` is a dependency-free Web Components library. Do not import engine, extensions, editor domain, or application state.
- Components own presentation and local interaction only. Product workflows, persistence, scene state, and GPU behavior remain in consuming applications.
- Preserve the public custom-element/tag, attribute, property, event, keyboard, focus, and disposal contracts. Avoid global listeners; if required, remove them on disconnect.

## Structure and quality

- Keep model/state algorithms separate from DOM rendering when they can be tested independently. For tree changes, prefer the existing `tree-model`, node, and type responsibilities rather than growing `tree.ts` back into a monolith.
- Follow accessible keyboard and focus behavior and use semantic ARIA relationships where the component represents menus, dialogs, tabs, trees, selects, or tooltips.
- Do not expose editor-specific types through the UI package surface.
- Public surface changes require an explicit export decision and contract test; do not update snapshots to accept accidental symbols.

## Validation

```bash
npm run typecheck -w ./ui
npm test -w ./ui
npm run build -w ./ui
```

- Add focused DOM/interaction coverage for lifecycle, keyboard, event, or accessibility changes.

