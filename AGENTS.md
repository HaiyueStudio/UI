# HaiyueStudio UI repository instructions

- Node.js 22 or newer is required.
- `@haiyue/ui` must remain free of Haiyue runtime and product dependencies.
- The package lives directly at the repository root; do not recreate a nested `ui/` workspace.
- Preserve custom-element names, attributes, properties, events, keyboard/focus behavior, accessibility, and cleanup.
- Public changes require an explicit export decision and focused contract tests.
- Keep per-component subpath exports isolated. Component modules must not import the root barrel or register themselves at module evaluation time.
- `defineHaiyueUI()` is the deliberate all-components registration path. Product code optimizing bundle size should import and register focused subpaths such as `@haiyue/ui/button`.
- Run `npm run typecheck`, `npm test`, and `npm run build`.
