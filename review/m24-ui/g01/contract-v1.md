# M24 portable UI 契约 v1

契约标识 `haiyue-portable-ui/1`。类型规范位于 [contract/index.d.ts](contract/index.d.ts)；这是经过 G01 验证后供 G03 实施的规范，当前 @haiyue/ui 的公开 exports 不变。选择器探针包是私有验证产物，不发布。

## 冻结接口

1. 应用实现 `HYStore<S,A>`，负责只读快照、同步 dispatch、selector 订阅、事务与释放。subscribe 不立即回调，装配先读取快照再订阅；默认用 Object.is 判等，批量事务结束只通知最终变化。UI 不提供产品 store，不在订阅中隐式写业务状态。
2. `HYNode` 是带稳定 key 的可辨别联合，使用类型化 props、children 和命名 slots。18 个基础 kind 是 v1 必需范围；VirtualList/Tree 在 G09 以兼容扩展补入。匿名 children 可由工具生成稳定 key，不能用随机数或当前索引替代数据身份。
3. `HYRenderer` 在 UI 线程接收有 revision 的批量 mutation。create 只创建实例，随后 insert 确定父级/位置；update 按相同 kind 完整替换 props 并移除已删字段；更改 kind 必须 remove/create。remove 连同子树解绑并释放，禁止重复 dispose 子树。移动不销毁实例。
4. mount 仅一次；dispose 幂等。commit 成功才记录 revision。失败须抛出含节点 key/操作/revision 的诊断并将该渲染根标记为 faulted，由入口显式重建；不声称有跨系统控件的原子回滚。业务状态保留，重建从最新快照恢复。
5. 布局为逻辑单位、auto、有限数值、grow、padding/gap、align、受限 Grid 行列及裁剪。v1 不含百分比、CSS 选择器、定位表达式或 grid span。按内容测量归后端，尺寸变化只使相关布局变脏。
6. 一次离散选择发 valueChange 后发 commit，共用 transaction；应用只在 commit 修改持久业务值。连续输入/Slider 发多次 valueChange，提交时发 commit。程序回填不发用户事件。未知/禁用值不提交，相同已接受值不重复提交。
7. 合成输入顺序为 compositionStart → compositionUpdate（零或多次）→ compositionEnd → 最终 valueChange。合成确认键不同时作为业务 commit；之后的显式提交/blur 才 commit。多行 Enter 插入换行，不隐式提交；业务快捷键由应用定义。平台不提供原生合成状态时必须报告能力缺口。
8. 输入的本地草稿不等于持久业务值。props 回填同一已接受版本不打断合成/选区；外部修改到达合成期间先排队，结束后按应用 revision 处理冲突。校验失败显示错误并保留草稿，不能循环重置输入。
9. 焦点命令使用 key。隐藏/删除焦点节点先回到所属 dialog 的有效节点，再回到打开者，最后回到页面默认焦点；无目标允许根接管。系统返回只由一个 owner 转为 cancel/路由操作。
10. PlatformView 由后端工厂创建；资源数据与 native/GPU/DOM handle 不进入状态。mount/layout/update/visible/focus/dispose 时序明确，surface acquire/present 仍由渲染宿主唯一持有。

## 回调与取消

`HYSelectionView.listen` 只能通知用户行为。native property changed 之类无来源信息的通知先经过写入 revision/来源过滤；探针验证同步 setter 回调抑制，不证明某个原生 SDK 已能识别异步回调。G06 必须另外覆盖延迟回调、重挂载与原生对象重建。

异步打开选择器记录实例 generation。返回 null、取消、打开新选择器、状态从外部更新、dispose 均使旧结果失效；异常进入应用错误端口，不伪装成取消。只允许当前选择器的有效结果产生一次业务 commit。

一般异步 effect 使用 `HYRequestContext`（session/revision/request/cancel signal）。保存完成只确认保存开始时的 revision，不能清除之后编辑产生的 dirty。编译结果、错误和资源释放均绑定同一请求身份。

## 能力、主题与版本

`HYCapabilities.contract=1`，组件集合与 features 是明确白名单。冻结 features：`text.composition`、`text.selection`、`text.secure`、`accessibility`、`icons.system`、`layout.rtl`、`theme.highContrast`、`motion.reduced`。平台后端不能用缺省 true 声明未验证能力。静态节点构建时检查，动态节点更新时检查；通过显式 capability 分支选回退。

主题语义值映射现有 Web `--hy-text-color`、`--hy-secondary-text-color`、`--hy-surface-color`、`--hy-input-bg-color`、`--hy-accent-color`、`--hy-invalid-border-color`、`--hy-border-color`、`--hy-focus-ring-color`；若旧组件未消费该 token，由适配器内部补映射，不擅改旧主题含义。原生按颜色/尺寸数据应用，安全区不混入主题。

G03/G05/G06 可增加实现内部类型；改变规范语义须先修订契约和所有消费探针。新公开入口预留 `@haiyue/ui/core`、`@haiyue/ui/portable`、`@haiyue/ui/adapters/web`；主题先属于 core 类型与 portable 资源生成，无额外根 barrel 自动导出。依赖与构建详见 Native ADR。

## 探针边界

[selection.mjs](contract/selection.mjs) 仅覆盖选择器流程，JSON 比较用于小型探针断言，不是生产增量更新设计。类型检查覆盖全部基础 kind 和平台接口可脱离 DOM；不意味着全部组件、布局或渲染器已实现。完整更新、布局、输入与平台验证分别属于 G03–G09。
