# Changelog

## Unreleased

## 0.2.3 - 2026-10-27

- 新增可按需导入的 `HYAnchor` / `<hy-anchor>`、`HYAlert` / `<hy-alert>` 与 `HYSegmented` / `<hy-segmented>`：分别提供滚动锚点导航与当前项跟踪、四种语义反馈及可取消关闭、可访问的分段单选与禁用项键盘导航；Anchor 在点击触发的平滑滚动期间会锁定目标高亮，避免途经区块造成闪烁；同步加入根导出、独立子路径、主题化示例和浏览器回归。

- Windows 下 API 隔离门禁改用目录 junction，避免普通 symlink 权限导致的间歇性 `EPERM`，不影响发布包内容或组件运行时。

## 0.2.2 - 2026-10-23

- 新增 `HYModal` / `<hy-modal>` 及独立 `@haiyue/ui/modal` 入口：支持原生模态层、标题/正文/页脚插槽、确认与取消按钮、可阻止的操作事件、异步确认加载态、独立遮罩/Esc/关闭按钮控制、受控状态、焦点恢复、滚动锁与隐藏内容卸载。

- 新增 `HYQRCode` / `<hy-qr-code>` 二维码组件及独立 `@haiyue/ui/qr-code` 入口，支持本地 SVG 编码、Unicode、尺寸/颜色/纠错等级、中央图片或 icon 插槽及留白配置；带图标时默认采用 H 级纠错，允许显式选择其他等级并限制遮挡面积，提供空值/超容量/图标加载失败状态。修复示例中带图标时纠错等级下拉框无法选择的问题。

- Collapse 新增 `animated` 与 `animation-duration` / `animationDuration`，支持可配置时长和缓动的展开/收起动画、快速反向切换、内容尺寸变化、减少动态效果偏好与断开清理；收起时立即同步无障碍状态，`destroyOnHidden` 延迟到动画完成后销毁内容。

- 新增 `HYCarousel` / `<hy-carousel>` 轮播组件及独立 `@haiyue/ui/carousel` 入口：支持自定义指示点样式/位置/渲染、自动播放与暂停、拖拽、循环、水平/垂直切换、键盘导航、非活动面板 inert、减少动态效果偏好与完整生命周期清理。

- 新增可按需导入的 `HYMasonry` / `<hy-masonry>` 瀑布流组件：支持最短列布局、自动或固定列数、最小列宽、间距、动态内容与容器尺寸响应、RTL、布局事件及断开清理；组件示例按类别内字母顺序排列。

- 扩展 portable/core 与 Web 适配器的呈现契约：按钮样式/尺寸/矢量图标、文字样式与色调、Tabs 分段模式、Select 呈现配置及字体缩放主题；新增 FormGroup 帮助文字、响应式布局辅助函数，并保持控件焦点、输入与选择状态。

## 0.2.1 - 2026-10-20

- 新增可按需导入的 `HYTag` / `<hy-tag>` 标签组件，支持语义与自定义配色、三种尺寸、文字或 icon 插槽、可取消的关闭事件、可选择状态、键盘操作和禁用状态；新增 `HYToast` / `<hy-toast>` 轻提示组件，支持五种状态、上/中/下位置、自动或持久显示、最大数量、手动关闭/清空、生命周期事件与完整计时器清理。
- M24 G05 新增独立 `adapters/web` 子路径：18 种共享语义映射、显式注册、受控输入/选择/弹窗、主题/安全区、预览资源生命周期与基础组件示例。新增可选 `controlled` 属性（Tabs/Range/Dialog）和 Input `password` 类型；旧默认 API 保留。修复关闭后立即重开的过期回调，以及共享页面把隐藏标签页误判为可聚焦的问题。Chromium/WebKit 自动化已通过，物理输入与读屏验收范围单独记录。
- M24 G03 新增独立 `core` / `portable` 子路径：18 种组件语义、交互 controller、受限页面组合、selector 订阅、稳定节点差异、事务、生命周期与主题数据；无 DOM/NativeScript/Engine 依赖。仅完成核心及记录型后端验证，真实平台适配分别由 G05/G06/G08 交付，旧 Web API 保持不变。
- 扩展 `HYVirtualKeyboard` / `<hy-virtual-keyboard>`：默认 QWERTY 布局补齐上、下方向键及多行文本纵向光标移动；新增 `qwerty` / `numeric` 模式切换和可复用的 `HY_VIRTUAL_KEYBOARD_NUMERIC_LAYOUT` 内置数字键盘。
- 扩展 `HYButton` / `<hy-button>`：支持 `icon` 属性或 `icon` 插槽、`icon-position` 前后位置、会阻止重复点击并带无障碍忙碌状态的 `loading` 旋转图标；新增可按需导入的 `HYButtonGroup` / `<hy-button-group>`，支持横向和纵向组合按钮。
- 示例页外壳改为使用 Haiyue UI 自身搭建：主题按钮、组件搜索、命令面板、状态徽标和演示操作均复用公开 Web Components；导航/内容和演示/参数区域使用 `HYSplit` 调节尺寸，用法代码通过只读 CodeMirror 提供 HTML、JavaScript 与 CSS 语法高亮，并为 `HYButton` 暴露 `button` part 与 pressed 状态转发。
- 新增可按需导入的 `HYResizable` / `<hy-resizable>` 调整框组件，支持四个角点与四条边缩放、内容拖动、位置尺寸 API、父容器/视口/元素边界、网格吸附、宽高比、尺寸限制、键盘控制和生命周期事件。
- 扩展 `HYInput` / `<hy-input>`：新增 prefix/suffix 属性与同名插槽、`search` 输入类型、可访问的搜索按钮、回车/API 搜索和组合 `search` 事件。
- 新增可按需导入的 `HYDraggable` / `<hy-draggable>` 拖拽容器，支持手柄与排除选择器、双轴/单轴移动、父容器/视口/元素边界、网格吸附、键盘控制、位置 API、生命周期事件与主题样式钩子。
- 新增可按需导入的 `HYVirtualKeyboard` / `<hy-virtual-keyboard>` 虚拟键盘，提供默认 QWERTY 与自定义布局、输入目标绑定、Shift/Caps、编辑和光标按键、物理键盘同步、按键播放 API、组合事件与主题样式钩子。
- 新增可按需导入的 `HYCollapse` / `<hy-collapse>` 折叠面板组件，支持多项或手风琴展开、默认/当前展开项、禁用面板、图标位置、触发区域、边框/幽灵样式、隐藏内容销毁和无障碍键盘操作。
- 新增可按需导入的 `HYBadge` / `<hy-badge>` 徽标组件，支持计数上限、零值显隐、圆点、小尺寸、语义状态、自定义颜色、偏移、标题和无障碍状态播报。
- 新增可按需导入的 `HYAffix` / `<hy-affix>` 固钉组件，支持窗口或自定义滚动容器、顶部/底部偏移、布局占位、禁用、层级和吸附状态事件。
- 新增可按需导入的 `HYTour` / `<hy-tour>` 漫游式引导组件，支持目标定位、四向或居中浮层、聚光遮罩、自动滚动、键盘/遮罩关闭、步骤控制和生命周期事件。
- 新增可按需导入的 `HYSteps` / `<hy-steps>` 步骤条组件，支持横向/纵向、当前步骤、自动及显式状态、自定义图标、描述、副标题、紧凑尺寸、点击导航与禁用步骤。
- 新增可按需导入的 `HYDivider` / `<hy-divider>` 分割线组件，支持横向/纵向、实线/虚线/点线/双线、粗细、颜色、间距，以及插槽或属性文字和三种文字位置。
- 新增可按需导入的 `HYRate` / `<hy-rate>` 星级评分组件，支持通过 `allow-half` 属性选择半星，并提供星数、清空、自定义字符、提示、只读/禁用、键盘控制及组合事件。
- 新增可按需导入的 `HYTimeline` / `<hy-timeline>` 时间轴组件，支持状态与自定义颜色/节点、左右和交替布局、倒序、Pending、响应式单列及内容渲染钩子。
- 新增可按需导入的 `HYWatermark` / `<hy-watermark>` 水印组件，支持单行或多行文字、图片、旋转、间距、偏移、尺寸、字体、颜色、透明度与层级配置，并保持底层内容可交互。
- 新增可按需导入的 `HYSkeleton` / `<hy-skeleton>` 骨架屏，支持内容自动切换、头像、标题、段落行数与宽度、尺寸、圆角、加载动画、无障碍状态及减少动态效果偏好。
- 新增可按需导入的 `HYDatePicker` / `<hy-date-picker>` 日期选择器，支持 ISO 日期、范围限制、周起始日、Today、清空、月历键盘导航与组合事件。
- 新增可按需导入的 `HYTimePicker` / `<hy-time-picker>` 时间选择器，支持时分秒、分秒步长、时间范围、Now、确认、清空、列键盘导航与组合事件。
- 新增可按需导入的 `HYCascader` / `<hy-cascader>` 级联下拉，支持树形选项、受控路径、父级选择、禁用与清空、点击外部或 Esc 关闭、方向键导航及组合事件。
- 新增可按需导入的 `HYBreadcrumb` / `<hy-breadcrumb>` 面包屑导航，兼容 `title` / `label` 项文本，支持链接、动作项、禁用项、当前页语义、自定义分隔符与内容渲染，以及可取消的 `breadcrumb-click` 事件。
- 新增可按需导入的 `HYTable` / `<hy-table>` 数据表格，支持本地分页、标题旁漏斗过滤菜单、全局与列级过滤入口显隐、稳定排序、自定义单元格渲染，以及 `table-change` / `row-click` 组合事件。
- 新增可按需导入的 `HYVirtualMouse` / `<hy-virtual-mouse>` 固定定位虚拟鼠标，支持状态图片与 CSS 定制、动画移动、按下/抬起、左中右键点击 API，以及组合事件和生命周期清理。

## 0.1.2 - 2026-09-03

- 修复 `<hy-virtual-list>` 快速滚动时 light DOM slot 异步分发旧行的问题；虚拟窗口现在完全在 Shadow DOM 内同步替换，避免上一范围的条目再次闪现。
- 新增 `HYExpandable` / `<hy-expandable>`：保持内容挂载的非模态展开容器，提供独立子入口、尺寸与按钮位置配置、自定义图标、事件和主题变量。
- 修复展开容器位于嵌套 Shadow DOM 时 Escape 无法恢复的问题；内部菜单可优先消费 Escape，嵌套展开容器每次只关闭内层。
- Tabs 支持横向溢出滚动，并保持标签文字不换行。
- 补充展开容器示例和浏览器交互回归，覆盖键盘、焦点、事件、内容保留及断开重连。
- API 基线、包体积与消费者验证由 UI 仓库独立维护，不再由 Engine 发布门禁管理。

## 0.1.1 - 2026-08-22

- 新增可按需导入的 `HYRange` / `<hy-range>` 数值滑块，支持单值和双拖拽点区间、步进与键盘操作、实时/提交事件，以及拖拽点和轨道样式定制。
- 新增可按需导入的 `HYBorderBeam` / `<hy-border-beam>` 响应式边框流光组件，支持粗细、速度倍率、颜色和多流光错相配置。
- 新增可按需导入的 `HYNotification` / `<hy-notification>` 通知中心，提供 success/info/warning/error 语义配色和图标、六向 placement、自动关闭、Z 轴堆叠及可选倒计时进度条。
- 新增可按需导入的 `HYDrawer` / `<hy-drawer>` 抽屉组件，支持四向 placement、可选蒙层、Esc/蒙层关闭、焦点管理及 `destroyOnHidden` 内容卸载。
- 新增可按需导入的 `HYVirtualList` / `<hy-virtual-list>` 固定行高虚拟列表，仅渲染可视区与 overscan 缓冲项，并提供内部滚动条、范围事件、点击事件和 `scrollToIndex()`。
- 组件品牌前缀从 `GE/ge` 统一迁移为 `HY/hy`，不保留旧标签、类名或 CSS token alias；新增可独立导入的 Moonlight 淡蓝亮色和 Nightfall 深蓝紫暗色皮肤。
- 独立 UI 仓库移除重复的 `ui/` workspace 层级，并为全部组件新增 `@haiyue/ui/<component>` 独立、无副作用的公开入口；根入口继续提供显式全量注册。

## 0.1.0 - 2026-07-13

- 建立海月 3D 优先的稳定包边界、生命周期、编辑器工作流、可观测性、资产管线和脚本 runtime。
- 用 `simple` / `batched` / `gpu-driven` / `diagnostic` RenderProfile 替换公开渲染布尔开关，并加入显式设备降级报告。
- 加入原生 glTF metallic-roughness PBR、directional shadow map、environment IBL、material variants 和可扩展材质 shader contract。
- examples/games 改为 manifest 驱动，统一 build policy、能力覆盖矩阵、真实 WebGPU 像素基线和 release gate。
