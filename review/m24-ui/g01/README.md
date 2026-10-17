# M24 G01 UI 契约验收入口

本目录冻结 portable UI v1 并提供最小选择器探针；没有修改现有组件源码和公开 exports。契约、矩阵与最终接受记录由里程碑集成 owner 串行维护。

- [组件对照](component-matrix.md)：现有 props/events、共享逻辑、Web 专有实现与平台缺口。
- [v1 契约](contract-v1.md) 与 [类型](contract/index.d.ts)：节点、组件、事件、状态订阅、更新、主题和后端接口。
- [选择器探针](contract/selection.mjs)：挂载前属性、受控值、事件回填与取消代次。
- [ADR](../../../docs/for-ai/adr/2026-10-16-portable-ui-core.md)：包归属与兼容决定。

在 UI 根目录运行：

```sh
node --test review/m24-ui/g01/contract/selection.test.mjs
node node_modules/typescript/bin/tsc -p review/m24-ui/g01/contract/tsconfig.json
npm run typecheck
npm test
npm run api:check
```

类型探针使用 `lib: ES2022`、`types: []`，不带 DOM/Node 环境类型；运行探针确认没有 window/document/HTMLElement/customElements。它只实现选择器，完整组件运行时仍由 G03 完成。

UI 0.2.0 产包与 probe 私有包通过 npm pack 交付给 ShaderLab，生产包 allowlist 不包含本目录。产包记录在 `results/ui-pack.json`、`results/contract-pack.json`；source 身份在 `results/identity.json`。浏览器与业务消费证据由 ShaderLab 保管，不在本仓复制性能数字。
