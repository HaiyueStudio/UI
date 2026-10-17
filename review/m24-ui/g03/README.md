# G03 通用组件语义与页面核心验收

2026-10-16：**G03 完成**。实现与验收范围是无平台依赖的核心和记录型后端；真实 Web/native/desktop 控件尚由 G05/G06/G08 实施。没有发布 npm，也没有给新 UI 能力指定版本。

## 已交付

- `@haiyue/ui/core`：18 种基础组件的类型、属性/能力诊断、稳定 key、选择器、Button/Toggle/Slider/Text 行为、特殊视图生命周期。
- `@haiyue/ui/portable`：类型化页面组合、命名插槽、selector 订阅、同步事务、差异提交、焦点/模态返回策略、故障重建、主题数据。
- [记录后端](../../../test/portable/recording.mjs) 与 [类型化设置页](../../../test/portable/fixtures/settings-page.ts)。这两项只在源码仓库，未装入 npm 包。
- [接入文档](../../../docs/portable-ui.md)、[ADR](../../../docs/for-ai/adr/2026-10-16-g03-component-core.md)、[schema 1.1 补充](schema-1.1.md) 与 [冻结哈希](freeze.json)。G01 历史契约与探针不改写。

## 验证

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| 无平台源码与类型、核心行为 | 48 项通过 | [portable-tests.log](portable-tests.log) |
| 全库行为/旧 Web API + 类型/构建/API gate | 91 项通过 | [package-check.log](package-check.log) |
| 独立包安装 | 新目录离线安装 tarball，JS import 不访问平台全局；声明在无 DOM lib 下编译 | 同上；[包测试](../../../test/portable/package.test.mjs) |
| 公开入口 | 原有 36 个带类型入口符号不变，仅新增 core/portable | [verification.json](verification.json) |
| 包边界 | 零运行依赖；既有文件白名单；无游戏、示例、测试后端、证据文件；button 单入口 gzip 949 bytes | [包检查](package-check.log) |

记录型后端的操作验证：1,001 节点页面修改单个文本只发 1 次 update，相同 props 零写入；事务内 100 次修改两个节点，最终 1 次 commit、2 次 update；dispose 后活动节点为 0。随机重排 100 轮保持 surviving key 的实例身份，50 次页面进入退出没有订阅残留。以上证明提交行为，不代表平台 CPU/帧率测量。

测试还覆盖 G01 的 9 个选择器场景、IME 事件顺序/草稿冲突/禁用后迟到回调、程序赋值抑制、未知能力和非法布局定位、同父插槽移动、递归释放、失败后保留业务状态并重建。记录后端主动在第二条 mutation 注入异常，确认原生可能已经部分更新时不错误推进 revision。

最终源码工作区快照、日志哈希、工具版本和 tarball SHA-256 在 [verification.json](verification.json)；包当前 manifest 为 0.2.0，仅作为本地 G03 产物身份，不代表重新发布 0.2.0。包体积增长与 unchanged reserve 记录在 [package-growth.json](package-growth.json)。

复跑：

```sh
npm run verify:portable > review/m24-ui/g03/portable-tests.log 2>&1
npm run verify:package > review/m24-ui/g03/package-check.log 2>&1
node review/m24-ui/g03/capture-evidence.mjs
```

这两个入口包含独立类型检查、build、测试和包检查；无需联网下载依赖（已安装锁定开发工具）。新消费者使用独立空缓存离线安装，不能从相邻 ShaderLab、Native、Engine 源码补齐运行依赖。

## 后续目标的验收责任

| 目标 | 继续内容 |
| --- | --- |
| G05 Web | 复用旧 WebComponent；保留原有事件；验证 named slots、IME/选区、真实焦点/可访问性与主题映射 |
| G06 Mobile | 原生控件 factory、延迟属性回声过滤、控件重建；iPhone/iPad/Android 输入法、读屏、键盘与生命周期 |
| G07 ShaderLab | 把 G02 的共享业务接入本核心；同设备旧/新页面与预览性能比较；75% 预览等真机回归 |
| G08 Desktop | 在 G04 获接受后接实际桌面后端，验证目标 Windows x64/macOS arm64 输入和呈现 |
| G10 | 多仓独立安装、完整设备矩阵、版本与正式发布候选 |

G03 不产生物理设备通过声明，也不以记录后端的 `backend: 'web'` 测试标签冒充真实 Web 适配。ShaderLab 页面、Engine 与 Native 运行代码未被改动。
