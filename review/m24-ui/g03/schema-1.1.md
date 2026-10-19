# haiyue-portable-ui/1.1 实施冻结

2026-10-16。G03 对 G01 v1 的可选字段补充；`HYCapabilities.contract` 保持 1。G01 文件、探针和 freeze 哈希不改写。

| 增量 | 默认和语义 | 消费方 |
| --- | --- | --- |
| HYNode.source? | `{file,line?}`，仅诊断，无运行时平台句柄 | G05/G06/G08 透传定位；G07 页面可声明 |
| HYNode.requires? | features 白名单中的必要能力；缺失时显式报错 | G07 输入页面；G05/G06/G08 能力声明 |
| insert/move.slot? | 缺省为匿名 children；提供时路由到该命名插槽，parent 不变 | G05/G06/G08 必须保留命名插槽语义 |

字段和方法的最终类型以 [core](../../../src/core/types.ts)、[page](../../../src/portable/page.ts) 为准，公开符号以 [API 基线](../../api-surface.json) 为准。G01 类型到新类型的兼容性由 [类型探针](../../../test/portable/fixtures/g01-compatibility.ts) 检查。选择器的 9 个冻结情景在 [生产测试](../../../test/portable/selection.test.mjs) 复跑。

补足 v1 未规定的路径编码：key 在父级内唯一，包括全部命名插槽。`hyKey()` 以 `/` 分隔祖先路径，段内 `~` → `~0`，`/` → `~1`。后端事件和 focus 使用完整 scoped key，create/update 只带浅节点，insert/move 提供插槽定位。改变 kind 或父级会重建；排序和同父级跨插槽移动保持实例。

新增公开 helper/controller 为兼容增加；根 Web 和所有旧组件入口没有新增或删除符号。应用依然拥有 HYStore；页面以一次 bind 组合一个 store 的全部 selector，避免多订阅把应用事务拆为多个原生提交。

主题保留 v1 八个颜色 token，并冻结尺寸 token `--hy-font-size`、`--hy-line-height`、`--hy-gap`、`--hy-radius`；完整映射见 [theme.ts](../../../src/portable/theme.ts)。转换只返回数据；旧 WebComponent 的内部 token 消费由 G05 映射。颜色只转换可跨后端的六位/八位 hex；不扩散旧 Web CSS 表达式到原生。

G02 ShaderLab 应用状态无需变化。G05/G06/G08 采用本版本的类型与记录后端用例；G07 使用 scoped key、一次 store 绑定、revision 化文本草稿。没有在 G03 增加任何产品对 UI 的实际依赖，也没有宣布真实后端可用。
