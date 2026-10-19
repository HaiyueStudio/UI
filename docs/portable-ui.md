# 通用组件与页面核心

G03 实现纯逻辑层。公开入口为 `@haiyue/ui/core` 和 `@haiyue/ui/portable`；已有根入口仍是 WebComponent。无需 Engine、NativeScript、DOM 全局或自动注册，也没有产品 store、布局引擎或定时渲染循环。

## 页面、数据与更新

[类型化示例](../test/portable/fixtures/settings-page.ts) 展示受限页面组合、能力回退、事件到 action、一个 store 的多 selector 绑定。应用实现 `HYStore`：同步 dispatch；subscribe 不立即通知；默认 Object.is；嵌套事务只通知最终选中值一次。所有 state/selector 结果必须为只读数据，不在原对象上修改。

`hyNode(kind, key, props, {children, slots, source, requires})` 同时提供类型约束、运行时校验和不可变快照。能力在 mount/render/setProps 时再次检查。源文件定位可传 `{file, line}`。布局用逻辑单位和受限 Grid，不接受 CSS 百分比、选择器或绝对定位表达式。

作者 key 在同一父节点下唯一，包含匿名 children 和命名 slots。后端 key 是祖先路径，`hyKey('page','toolbar','save')` 生成 `/page/toolbar/save`；`/` 和 `~` 转义，不用数组索引代替身份。移动到同父级的其他位置或插槽保留实例，换父级或 kind 重建。

`HYPage.mount()` 一次；`setProps(key,kind,props)` 完整替换属性，省略字段即删除；`render(root)` 替换树结构。同步 `transaction()` 在最外层完成时提交一次最终差异，参数校验失败则在平台提交前丢弃本次页面事务。它不回滚应用 store，也不接受异步函数。

`bind(store, bindings)` 组合所有 selector 为一个订阅，支持每个 selector 自定义 equal（缺省结构判等）。同一 page/store 只允许一次绑定调用，防止一次应用事务被拆成多个平台提交；动态页面需先调用返回的解绑函数再重新绑定。删节点前解绑指向它的 binding；目标缺失时报错，不丢弃业务更新。业务状态变化只更新选中节点；没有隐含逐帧轮询。`page.dispose()` 自动解绑，但应用 store 的寿命由应用决定。

## 后端实现协议

后端显式声明 contract=1、18 种基础组件中已实现的组件集合，以及冻结的 features 白名单。使用 `hySupports()` 显式选择回退，例如没有 `icons.system` 时只传 resource，不静默忽略 systemName。需要 IME 的输入节点声明 `requires:['text.composition']`；不能因为测试后端支持就声明真实平台已具备能力。

`commit(revision, mutations)` 在 UI 线程执行；create 只分配浅节点，insert 确定 parent/before/可选 slot。update 完整替换 props；move 保留实例；remove 递归解绑和释放整棵子树（页面不会再对子孙发送重复 remove）。后端不能自行遍历作者 children 创建第二套节点。未挂载节点也必须在失败后的 dispose 中释放。

只有成功 commit 才接受 revision。后端失败应抛 `HYUIError('renderer', message, {key,operation,revision},cause)`；page 标记 faulted，停止写入并保留最新待提交数据。调用 `rebuild(freshRenderer)` 显式释放旧后端，再从最新数据恢复，已有订阅保留。无法声称系统控件操作能原子回滚。dispose 继续尝试所有清理，多个异常用 AggregateError 报告。

`suspend()` 阻止事件并积累状态，`resume()` 一次提交最终差异。旧后端/已释放页面的迟到事件被 epoch 忽略。同步属性回调在提交期间被抑制；异步原生 property-change 回声仍必须由适配器识别写入来源/revision，G06 单独验收。

## 行为控制器与输入

Select/Tabs 用 `HYSelectionController`；Button/Toggle/Slider 各有控制器。Button 的 `activate(reason, gestureId)` 要由后端给 tap/click 的同一次手势相同 ID。离散值先 valueChange 再 commit，共用 transaction；应用只在 commit 保存值。Slider 多次 change、一次 commit，范围与步进在核心归一化。程序 update 不产生用户事件。

选择器在 attach 前允许设值，attach 后一次写入最新值。异步 pick 以 generation 隔离取消、被新 picker 替代、外部更新和 dispose；异常保留为 rejected Promise 交给应用错误端口。选择值被应用拒绝时恢复受控值。

`HYTextController` 持有编辑草稿，`update(props, applicationRevision)` 持有权威值。外部更改 accepted value 必须提高 revision；旧 revision 忽略；同 accepted value 回填不丢弃未提交草稿。应用校验拒绝后可更新 FormGroup/a11y.error，草稿保留。

IME 顺序为 start → update* → end → 最终 valueChange；确认输入法的 Enter 不提交，后续显式提交或 blur 才 commit。后端调用 `enter(wasComposing)`，必须提供真实事件里的合成确认信息；多行 Enter 不提交。合成期间外部修改排队，结束后先报告用户最终值，再应用最新权威 revision；更晚被应用接受的输入可取代排队值。原生输入事件、选区、撤销栈和候选框由适配器持有，不能用此纯逻辑测试代替真机 IME 验收。

焦点由 page 使用 scoped key 管理。打开 Dialog 聚焦其中首个有效目标；隐藏/移除当前目标优先留在有效 Dialog，再恢复打开者，最后默认焦点/页面根。活跃 modal 阻止后台控件动作。shell 选择唯一的返回键 owner，调用 `back()`；非 dismissible modal 也消费返回键，但不发送 cancel。平台 Tab 环绕、实际无障碍焦点与物理输入属于后端验收。

## 特殊视图和主题

`PlatformView` 只传 slot、resourceId、布局；资源句柄留在后端工厂。后端可用 `HYPlatformViewController` 处理挂载前更新、layout、visible、suspend/resume、focus 和幂等 dispose。GPU acquire/present 继续由渲染宿主唯一持有；核心不会创建 WebView、GPU surface 或代码编辑器。

`hyNativeTheme()` 返回不可变语义数据；`hyThemeVariables()` 输出 8 个既有颜色 token 与字体/行高/间距/圆角 token。可移植颜色限定 `#RRGGBB` / `#RRGGBBAA`；旧 Web CSS 的任意表达式仍属于 Web 层。尺寸为逻辑单位，CSS 输出 px；fontScale 只放大字号/行高，safe area 不属于主题。浅深色由应用提供不同数据，highContrast/reducedMotion/RTL 的真实实现仍需后端声明和验收。

## 验证和交接

运行 `npm run verify:portable`。包含无 DOM 的源码/类型检查、G01 选择器同场景回归、记录后端、50 次挂载释放、故障恢复、独立 tarball 离线安装/编译/import。`npm test` 同时保留旧 Web API 回归。记录后端在 `test/portable/recording.mjs`，示例和证据不进入 npm 包。

平台映射：G05 Web；G06 iOS/Android；G08 桌面。G07 将 ShaderLab G02 共享业务接到这套页面核心。G10 再决定发布版本及完整支持范围。
