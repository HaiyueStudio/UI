# M24 G01 组件对照与迁移边界

基线为 UI 0.2.0 源码；精确 revision、文件哈希和包身份见本目录验收记录。下表是源码核对结果，原生与桌面列表示后续实施要求，不表示后端已存在。

| 共享种类 | 现有 Web API / 事件 | 可共享逻辑 | Web 专有部分 | iOS/Android 映射与缺口 | 桌面要求 |
| --- | --- | --- | --- | --- | --- |
| Button | `hy-button`；label/disabled/icon-only/title/aria-label；原生 click，无自定义 activate | enabled/busy、一次激活 | Shadow DOM、slot、SVG、鼠标/键盘 click | Button + tap；busy 与激活抑制由适配器提供 | GUI button + 输入/语义树 |
| Select | `hy-select`；options/value/disabled/searchable/label；`value-change {value,option}` | 选项身份、禁用/无效项、受控值 | HTMLSelectElement、搜索框、option DOM | action sheet/ListPicker 由适配器选用；取消映射 null，选项以 value 标识 | 选择弹层、键盘、可访问选项 |
| Toggle | `hy-checkbox`；checked/indeterminate/disabled/label/value/name；`checked-change` 后还有 `change` | 布尔值、禁用 | input checkbox、indeterminate、slot | Switch；v1 Toggle 不含三态，不能默默丢弃 indeterminate | GUI toggle + checked 语义 |
| Tabs | `hy-tabs`；options/value、选中回退；`tab-change {value,option}` | 选项、选中项、disabled 回退规则 | panel DOM、按键焦点、自动生成 aria id | SegmentedBar/自定义布局；disabled 选项可能需要自定义呈现 | 键盘顺序、焦点与选中分离 |
| TextInput | `hy-input`；text/number/color、value、约束、readOnly、focus/select；input 时同步属性，仅 change 发 `value-change {value,valueAsNumber,valid}` | 草稿/提交、业务校验、禁用 | HTMLInput validity、selection、浏览器 input/composition | TextField；IME/选区/secure 需专门映射 | 系统文本服务，不能只接字符回调 |
| TextArea | 当前无独立多行 WebComponent | 草稿/提交、合成期间保留输入 | 原生 textarea 或后续专用组件 | TextView；与代码编辑器能力区分 | 多行系统输入/选择 |
| Slider | `hy-range`；min/max/step/value、range/lowerValue/upperValue；`value-input`、`value-change` | 限制、步长、编辑/提交 | pointer capture、getBoundingClientRect、两 handle | Slider；v1 只单值，双 handle 留旧 Web API | 拖动/键盘/可访问数值 |
| Dialog | `hy-dialog`；open/heading/dismissible、showModal/close；可取消 `dialog-cancel`、`dialog-close {reason}` | 开关状态、原因、取消语义 | HTMLDialog、top layer、focus restore、slot/footer | 原生 modal + 共享按钮区；不是只返回 Promise 的 alert | modal 栈、键盘与语义树 |
| Text / Image / Icon | 普通 HTML、CSS、SVG 与现有 slot，无统一这三类 portable API | 文案/资源标识、语义标签、回退 | DOM 测量、SVG/URL 加载、CSS | Label/Image；系统图标有能力声明与资源回退 | 字体/图集/资源释放与读屏 |
| Row / Column / Grid | 现有 CSS flex/grid/普通容器，`hy-split` 是专用分割布局 | 约束和稳定节点身份 | 完整 CSS、盒模型、测量 | StackLayout/GridLayout；受控子集 | 适配受控约束，缺口由 G04 实测 |
| Scroll / Overlay / FormGroup | 普通 DOM 容器、label、overflow、定位 | 滚动意图、层级、错误关联 | 浏览器 overflow/top-layer/layout | ScrollView、布局/表单分组 | 裁剪/命中/键盘滚动 |
| PlatformView | ShaderLab CodeMirror 与 canvas | 资源标识、生命周期、布局/可见/焦点请求 | CodeMirror DOM、HTMLCanvasElement | TextView/原生 Canvas；系统对象留在后端 | 系统编辑视图/GPU surface，明确 GPU 所有权 |
| VirtualList（G09） | items/renderItem/itemHeight/height/overscan；renderItem 返回 DOM | 窗口索引、稳定 key、数据变化 | ResizeObserver、滚动、DOM renderer | 原生回收列表或受控虚拟化 | 裁剪与可访问滚动；renderItem 改为 portable 节点回调 |
| Tree（G09） | data/selectedId/selectedIds/allowDrag；selection-change、data-change、node-context-menu | 复用无 DOM 的 HYTreeModel | 节点渲染、DND、contextmenu | 先单选/展开/键盘语义，保留旧 Web 多选/DND | 稳定 key、树语义、虚拟化 |

现有 Web 的属性、事件和子路径不改名。portable 适配器只订阅一条语义来源：checkbox 不同时处理 checked-change 和 change，select/tabs 将一次离散选择映射为同 transaction 的 valueChange/commit，业务提交只绑定 commit。

TextInput 不能把目前的 value-change 当作“每次输入”事件。G05 需补充可用的编辑/合成事件适配并回归旧行为；secure/multiline 需要新内部实现，不扩大现有 HYInputType 的含义。searchable、三态、双值 Slider 和 DOM renderItem 不是 v1 可移植子集；传入不支持属性必须明确报错。

跨端对齐语义和业务结果，允许系统控件外观、弹层呈现与辅助功能实现不同。布局全量 CSS、任意 DOM 插槽和完整 CodeMirror 不属于自动转换范围。
