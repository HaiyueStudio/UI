# G05 WebComponent 适配验收

2026-10-16：**G05 完成**：实现、兼容与统一检查全部通过。范围是通用 Web 后端；Safari 应用、真实输入法和系统读屏交接 G07/G10，ShaderLab 产品页面迁移交接 G07。没有 npm 发布、标签或产品依赖升级。

## 交付

- 独立 `@haiyue/ui/adapters/web`：HYWebRenderer、显式注册函数及四个装配/环境/诊断类型。全部 18 种共享语义已有映射，复用 7 个现有 WebComponent，其余使用必要的原生浏览器元素。
- [示例](../../../examples/portable-ui/index.html)、[接入与 API 对照](../../../docs/web-adapter.md)、[ADR](../../../docs/for-ai/adr/2026-10-16-g05-web-adapter.md)。环境包含主题、字号、RTL、减少动画和安全区；支持独立特殊视图工厂。
- 共享选择/文本/动作控制器映射到浏览器。普通属性更新保留输入、选区、草稿与预览；取消拖动恢复权威值，modal 支持受控取消、键盘环绕、关闭重开及返回焦点。
- 旧 API 保留。新增 Input password 和 Tabs/Range/Dialog 的可选 controlled（默认 false）；受控 Range 增加 value-cancel。修复输入属性重复写入打断撤销分组、过期 dialog close 关闭新弹窗，以及隐藏 Tabs 内 modal 占用焦点的问题。没有变更 core 协议字段，继续使用 schema 1.1。

## 可复现结果

| 检查 | 结果与证据 |
| --- | --- |
| 类型 / 全库单测 / 构建 / API / 包 / 示例 | 统一入口 `npm run release:check`，[原始日志](release-check.log) |
| 全库单测 | 94 项，包括全新目录离线安装、无 DOM 核心类型和 Web consumer 类型/依赖图 |
| 旧组件浏览器回归 | Chromium 61 项 |
| 新 Web 适配回归 | Chromium 19 项 + WebKit 19 项，[结构化结果](web-tests.json) |
| API | G03 的 38 个带类型入口符号保持不变，只增加 Web 入口，[对照](api-compatibility.json) |
| 包边界 | 零运行依赖；示例/测试/证据不入包；独立 button gzip 仍为 949 bytes；[增长记录](package-growth.json) |
| 展示检查 | 桌面、modal、窄屏大字号截图已检查；修正浅色主题选中标签对比度，见下方截图 |
| 生命周期 / 内存观察 | 两种浏览器分别 50 次清理测试；另在 Chromium 预热 10 次后，观察连续两轮各 50 次完整组件挂载/更新/暂停/恢复/卸载，[环境及数据](browser-environment.json) |

正式源码快照、工具版本、日志和 tarball SHA-256 见 [verification.json](verification.json)。manifest 的 0.2.0 仅标识本地包，不表示重新发布；包增长预留保持原先 3,000 / 12,000 bytes 和 4 files，未放宽文件白名单或引入平台运行依赖。

测试覆盖程序回填无用户提交、离散交互单一事务、中文/emoji 合成事件顺序、确认 Enter 不提交、失焦提交去重、校验失败保留草稿、新 revision 与合成冲突、密码/只读、父布局/重排保留输入、普通编辑撤销重做、滚动/RTL、FormGroup 可访问标签/错误描述、不可关闭 modal、立即重开、资源失败诊断与显式重建。中文测试是浏览器合成事件，不是实体输入法候选验收。

[同一语义序列](../../../test/web-adapter/scenario.js) 同时运行记录后端与真实 Web 后端：相同 props 零 DOM 写入；事务中 100 次改同一字段只产生 1 次 commit / 1 次 update；重排保持资源；暂停后恢复应用新值；预览始终 mount 一次。50 次进出后适配器节点/资源/监听为零，已取消调度/observer，迟到事件不进入业务。

额外的 Chromium GC 后观测中，DOM 节点和监听器计数两轮均回到预热基线；JS/浏览器附属堆及 backing storage 一并保存。堆允许运行时缓存，不能据此宣称整个应用长期零泄漏或原生平台内存通过。示例 canvas 没有真实 GPU 工作负载，不是 GPU 性能报告。

## 运行与截图

```sh
npm run release:check > review/m24-ui/g05/release-check.log 2>&1
# 另一终端保持示例服务运行；浏览器二进制需预先安装。
HAIYUE_EXAMPLES_PORT=4187 npm run examples
node review/m24-ui/g05/browser-evidence.mjs > review/m24-ui/g05/browser-evidence.log 2>&1
node review/m24-ui/g05/capture-evidence.mjs
```

浏览器测试入口已接入 release:check，CI 安装 Chromium + WebKit；本轮记录来自 Intel macOS，本轮没有触发远端 CI。示例地址 `/examples/portable-ui/`。包测试使用独立临时目录/空缓存离线安装，不从相邻 ShaderLab、Native 或 Engine 补充依赖。

- [Chromium 桌面](chromium-desktop.png) / [弹窗](chromium-modal.png) / [窄屏](chromium-narrow.png)
- [WebKit 桌面](webkit-desktop.png) / [弹窗](webkit-modal.png) / [窄屏](webkit-narrow.png)

## 明确交接的待验收项

| Owner | 待完成 | 当前证据与继续方式 |
| --- | --- | --- |
| G07/G10 | Safari 应用、系统中文候选窗/选字、VoiceOver、系统剪贴板授权 | 当前仅 Chromium/WebKit 自动化、ARIA 与浏览器键盘；使用相同源快照及示例页在实际 Safari 验收，不将 WebKit UA 当成 Safari 实机结果 |
| G07/G10 | iPhone/iPad/Android 软键盘、安全区、旋转、前后台、读屏 | 当前仅显式 inset 与窄视口；接入 G06 原生适配及 G07 产品后重新按目标设备验收 |
| G07 | ShaderLab 75% 等真实共享业务切片、旧/新页面 UI p95 和 GPU 帧时间对照 | 保留 G01 的 110% / 10% 预算，不以组件页操作数替代同工程同设备测试 |
| G10 | 独立候选版本及完整发布矩阵 | 本轮没有发包；当前入口与 opt-in 扩展需列入未来版本与兼容说明 |

G03/G01 的历史快照未覆盖。共同 exports、API snapshot、包预算、CI 与 milestone 元数据由本轮同一集成 owner 串行更新。
