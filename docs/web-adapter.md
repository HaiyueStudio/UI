# WebComponent 适配器（M24 G05）

当前为未发布的开发能力，沿用 `haiyue-portable-ui/1.1`。`@haiyue/ui/adapters/web` 是只供浏览器装配的独立入口；`core` / `portable` 仍不需要 DOM、NativeScript 或 Engine。应用状态、业务操作和共享页面不引用 HTMLElement。

## 最小接入

```ts
import { hyNode, hyKey } from '@haiyue/ui/core';
import { HYPage } from '@haiyue/ui/portable';
import { HYWebRenderer, definePortableWebComponents } from '@haiyue/ui/adapters/web';

definePortableWebComponents(); // 幂等；导入本身不会注册组件
const host = document.querySelector<HTMLElement>('#app')!;
const renderer = new HYWebRenderer(host, {
  environment: { direction: 'ltr', safeArea: 'environment' },
});
let title = '未命名作品';
const view = () => hyNode('FormGroup', 'name', { label: '作品名称' }, {
  children: [hyNode('TextInput', 'input', { value: title })],
});
const page = new HYPage(renderer, {
  onEvent(event) {
    if (event.key === hyKey('name', 'input') && event.type === 'commit') {
      title = String(event.value); // 实际产品在此 dispatch 共享应用操作
      page.render(view());
    }
  },
});
page.mount(view());
// 页面后台/恢复：page.suspend() / page.resume()
// 页面退出：page.dispose()，业务 store 仍由应用拥有。
```

宿主必须已接入当前浏览器 document，不支持跨 iframe realm。一个 renderer 只能 mount 一次；每个页面拥有独立根包装，不修改宿主已有子节点。移除宿主前先 dispose。

## 公开 API 与映射

| API | 用途 |
| --- | --- |
| `HYWebRenderer(host, options?)` | 实现 HYRenderer，交给 HYPage 管理提交与生命期 |
| `definePortableWebComponents()` | 仅注册下表复用的 7 类组件；不注册全库 |
| `setEnvironment(environment)` | 替换当前环境配置；保留节点/草稿/资源，不是增量 merge |
| `diagnostics` | 累计提交、创建、更新、移动、移除、布局测量及当前节点/资源/适配层监听数 |
| `HYWebEnvironment` | theme、fontScale、direction、reducedMotion、safeArea |
| `HYWebRendererOptions` | environment、resolveResource、platformViews、onError |
| `HYWebPlatformContext` | 工厂对应的 scoped key 与 slot |
| `HYWebDiagnostics` | 只读计数快照；不代表内存堆或 GPU 性能数据 |

| 共享种类 | Web 实现 | 关键行为 |
| --- | --- | --- |
| Row / Column | flex div | 横/纵向、gap、grow、对齐 |
| Grid / Overlay | grid div | 显式行列；Overlay 子节点默认占同一格 |
| Scroll | 可聚焦 div | 指定轴滚动，保持内容及 scrollTop |
| Text | span | 安全文本，自动换行/保留换行 |
| Image / Icon | img | 注入资源 URL；alt；Image contain/cover |
| Button | hy-button | click → activate；键盘与可访问性点击共用一条路径 |
| Toggle | hy-checkbox | checked-change → valueChange + commit |
| Select / Tabs | hy-select / hy-tabs | 共享选择控制器；权威值回填；RTL 标签方向键 |
| TextInput | hy-input | 文本/密码、只读、禁用、草稿、合成输入 |
| TextArea | textarea | 多行输入；Enter 换行，失焦提交 |
| Slider | hy-range | 拖动 valueChange；结束/键盘 commit；应用拒绝后恢复权威值 |
| Dialog | hy-dialog | 原生 modal top layer；取消请求、Tab 环绕和焦点恢复 |
| FormGroup | fieldset + legend | label/error 映射到子输入的实际可访问节点 |
| PlatformView | div + 应用工厂 | 特殊编辑器、canvas 等资源的独立生命期 |

保留传统 `hy-*` 入口、根注册、事件 detail/bubbles/composed。仅新增 `HYInputType` 的 password，以及 Tabs/Range/Dialog 的可选 controlled 属性（默认 false）。适配器开启受控模式，传统页面无需修改。受控 Range 另发 value-cancel，将浏览器 pointercancel 映射为共享 cancel 并恢复权威值；不误作提交。`dialog-close` 仍是旧 API，应用共享页面接收的是 HYUIEvent `cancel`，不能同时把两套事件接到同一个业务 action。

## 值、输入与焦点

- 用户值变化先发 `valueChange`，离散选择同事务再发 `commit`；应用通过新 props 接受结果。程序设值不发业务事件。选择/开关/滑杆拒绝后恢复权威值。
- 文本草稿由组件控制器持有；commit 后应用可保留旧值并呈现 FormGroup.error，草稿/焦点不被覆盖。不同权威值按新 revision 接管草稿，合成中更新延迟到 compositionEnd。
- 合成开始/更新/结束映射到共享事件，确认候选的 Enter 不提交；单行普通 Enter/失焦提交，多行 Enter 只换行。change/blur 去重。
- 稳定 key 保持真实控件实例；父布局更新或重排保护输入焦点/选区。浏览器支持 moveBefore 时使用保留状态的移动；否则批次内恢复。删除节点/切换控件种类会释放旧实例。
- 隐藏节点、非当前 Tabs 插槽、禁用/忙碌祖先、暂停页面不向业务传递交互。隐藏插槽内的 modal 也不占用共享返回/焦点策略。
- Dialog 标题、内容、footer 保持原生语义。dismissible=false 时隐藏内置关闭按钮、忽略 Escape/遮罩/系统返回取消，应用可通过按钮显式更新 open。焦点目标由 HYPage 选择，浏览器 Tab 限定在当前 modal 中。

`a11y.label/description/error` 传到 shadow 内实际 input/select/button/slider/dialog 等节点；描述引用位于相同 ShadowRoot。FormGroup 提供默认标签/校验信息。原生控件角色不被任意覆盖。ARIA 自动化不等同 VoiceOver 实机验收。

## 布局、插槽、主题

尺寸为 CSS 像素；支持协议中的固定/auto、min/max、四边 padding、gap、grow、align、Grid 行列及 clip，不接受任意 CSS 字符串。安全区只在根包装应用一次，四元组为 top/right/bottom/left，或使用 CSS env。全屏页面应自行提供 viewport-fit=cover。

结构容器的命名 slot 用 display:contents 分组，不附加布局盒。Dialog 仅支持默认内容及 footer；Tabs 的 slot 名必须匹配 options.value；Button 仅支持默认内容。叶节点禁止子内容，未知 slot 抛明确诊断。

默认继承宿主 `--hy-*` 语义 token，可直接使用已有浅/深主题。传入 HYTheme 时只覆盖当前页面；字体缩放使用主题 fontSize/lineHeight 或宿主继承值。减少动画遵循环境参数或 prefers-reduced-motion。样式只作用于适配器拥有的节点和 ShadowRoot，不改变独立旧组件外观。

声明能力：text.composition、text.selection、text.secure、accessibility、layout.rtl、motion.reduced。没有声明 icons.system / theme.highContrast；需要这些能力的页面应显式选择替代资源或能力分支，不能静默回退。

## 图片与特殊视图

`resolveResource(resource, {key, kind})` 同步把应用资源 ID 解析成 URL；没有解析器或返回空值会报错。UI 不猜测文件路径、不持有对象 URL 的撤销权。图片加载/授权策略由资源服务管理。

`platformViews[slot](host, {key, slot})` 返回 HYPlatformView，应用在该 host 内挂载 CodeMirror/canvas 等。工厂 slot 对已存在节点不可变；换工厂用新 key。resourceId 更新只调用 update，不重新 mount。资源初始可见性会考虑祖先、Tabs 和 Dialog。

资源在节点接入 DOM 后 mount；同批 DOM 写入结束后测量边界。ResizeObserver、窗口/VisualViewport 尺寸与滚动事件触发合并布局，没有自建持续帧循环。每次 layout 收到 viewport 相对 CSS 坐标、尺寸和 DPR；重复边界不会向资源重复提交。suspend/resume 控制 visible，dispose 清理 observer、监听、调度和资源，失败初始化也释放已获得的资源。

同步提交错误带 key/operation/revision（资源错误保留 source），HYPage 进入 faulted；修正页面后用新的 renderer 调用 page.rebuild。异步布局失败通过 options.onError 通知宿主并停止该 renderer；宿主应保存共享状态、dispose 旧 page 并创建新实例。没有 onError 时错误会在微任务中抛出，不会被静默吞掉。

## 验证与后续

启动 `npm run examples`，访问 `/examples/portable-ui/`；示例包含全部 18 种语义、浅深色、字号、RTL、预览及 modal。示例/测试不进入 npm。

- `npm run test:web-adapter`：Chromium、WebKit 的真实 DOM/键盘/交互；运行前需要安装对应 Playwright 浏览器。
- `npm run verify:package`：类型、全库单测、API、打包边界；全新临时目录离线安装测试同时检查 Web 类型和独立依赖图。
- `npm run test:browser`：原有组件浏览器回归。
- [G05 验收记录](../review/m24-ui/g05/README.md)：版本、日志、快照和限制。

Safari 应用、系统中文输入法候选操作、VoiceOver、剪贴板授权和设备尺寸/软键盘由 G07/G10 继续实机验收。ShaderLab 的真实共享页面迁移及旧/新路径同设备 p95、GPU 帧时间比较属于 G07；示例的 canvas 只验证资源生命周期，不构成 GPU 性能结论。
