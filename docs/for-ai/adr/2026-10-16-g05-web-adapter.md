# G05 WebComponent 适配

日期：2026-10-16。状态：已实施，验证见 G05 证据。沿用 `haiyue-portable-ui/1.1`；G03 冻结文件不覆盖。

新增独立 `@haiyue/ui/adapters/web` 子路径，导出 HYWebRenderer、显式注册函数和 Web 装配类型。它只消费 UI 内部的基础组件与核心，不导入根 barrel、NativeScript、Engine 或产品。导入不会注册 custom elements，宿主先显式调用 definePortableWebComponents()。不提前发布或调整产品依赖。

Row/Column/Grid/Overlay/Scroll/Text/Image/Icon/FormGroup 使用必要的浏览器元素；Button/Toggle/Select/Tabs/TextInput/Slider/Dialog 复用 hy-button/checkbox/select/tabs/input/range/dialog；没有旧组件的 TextArea 使用原生 textarea。特定 DOM 编辑器由 PlatformView 工厂接入。所有资源均由装配入口显式解析，页面状态不含 DOM handle。

## 兼容决策与消费方

HYInputType 增加 password（原 text/number/color 行为保留），满足 TextInput.secure；HYTabs、HYRange、HYDialog 增加可选 controlled 属性。默认 false 保留旧组件的自主选择/规范化/关闭行为，只有共享适配器开启受控模式。受控 Tabs 可以显示已禁用的权威选中值，Range 保留权威数值但用户操作仍按步进规范化，Dialog 用户动作只请求关闭，由应用回填 open。Dialog 的迟到 close 回调不得关闭已经重开的弹窗。旧事件名、detail、bubbles/composed 的默认行为用兼容 fixture 回归。

新入口能力由浏览器实测决定：声明 text.composition/selection/secure、accessibility、layout.rtl、motion.reduced；不声明 icons.system 或 theme.highContrast。Web 读取 open Shadow DOM 是同包适配实现细节，不导出私有控件引用。对旧组件补充的字体/主题样式只注入适配器拥有的实例，不修改独立组件默认外观。

HYPage 保留业务与模态焦点策略；HYWebRenderer 管理实际 DOM 焦点、Tab 环绕、原生 dialog top layer 和程序回填抑制。文本接受应用值时使用 renderer commit revision；同值回填不覆盖草稿/选区。父节点布局更新不能重建输入。浏览器有 moveBefore 时使用保留状态的移动；兼容路径在同一批次保留实际焦点、选区及滚动，并拦截程序移动产生的 blur。

命名插槽：Dialog 支持 footer；Tabs 名称对应 options.value，需显式 slot；结构容器支持命名分组，Button 仅默认内容。未知插槽抛带 key/operation/revision 的诊断，不丢弃节点。PlatformView 工厂按 props.slot 注入，挂载成功并接入 DOM 后才初始化；ResizeObserver 只观察资源宿主，无常驻帧循环。

宿主边距与主题通过 renderer environment 更新：safeArea 只应用于适配器根包装一次；支持显式逻辑边距或 CSS env，字体缩放、RTL、reduced-motion 独立配置。颜色/字体从 G03 语义 token 继承，可选 theme 仅覆盖本页面。图像 URL 不由 UI 猜测，工厂失败和未知资源显式报错。

G07 消费新增 Web 后端接 ShaderLab 业务。G06/G08 不导入 Web 代码，继续消费同一 core/portable。真实中文输入法候选操作、Safari/VoiceOver 和设备输入保留给 G07/G10 的物理验收，浏览器合成事件不宣称等同系统输入法验收。

实施补记：真实 Tabs 映射发现 HYPage 原本把非选中 slot 内的节点也判为可用，导致隐藏 modal 可占用返回/焦点策略。现按父 Tabs 的 value 排除非当前插槽；这是既定可见性语义修复，没有新增协议字段。G06/G08 继承此修复，记录后端和真实浏览器均有回归。资源 layout/mount 失败保留具体节点及源文件信息；异步失败由 onError 交还应用重建。Window/VisualViewport 的滚动、尺寸变化也触发合并后的资源布局。

输入回归补记：HYInput 原有同步逻辑会反复写入相同 placeholder，在 Chromium 中打断连续输入的撤销分组。属性/布尔值同步现仅写变化值；Web 适配器在旧组件完成原生 input 同步后读取草稿。保留公开事件与默认值语义，Chromium/WebKit 的连续输入、单次撤销、重做均验证。

受控 Slider 的 pointercancel 新增 value-cancel 事件（detail 与既有值事件一致），映射共享 cancel 并恢复权威值；默认 controlled=false 的旧事件路径不变。
