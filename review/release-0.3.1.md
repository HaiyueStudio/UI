# UI 0.3.1 发布候选

日期：2026-11-24。版本号与锁文件已准备为 `0.3.1`，变更日志已归档。本记录对应发布前准备，不表示已上传 npm 或创建发布标签。

## 发布范围

- 关闭 [技术债审查](../TECH_DEBT_AUDIT.md) 的 F01–F23：修复嵌套控件键盘事件、数据重连、Upload 表单失效、缺省数值、禁用状态、焦点与弹层生命周期。
- Table 一次操作复用筛选/排序结果；Anchor/Table/VirtualList 保留可复用 DOM；Tree 支持批量删除和超宽分支移动；页面事务使用局部 draft。
- VirtualKeyboard 按字素处理移动/删除，限定支持选区 API 的目标类型；portable RadioGroup 补齐方向键、RTL、受控回填及单一 Tab 停靠点。
- 补齐 Checkbox/RadioGroup/Rate 模态初始焦点与错误描述，统一安全不可变协议快照，保留 PlatformView 初始化与清理的双重失败。
- API 门禁升级为可达声明签名比较；无新增公开入口、运行时、peer 或 optional 依赖。73 个类型化入口保持隔离。

## 行为兼容说明

- Dialog 每次有效关闭同步发送一次 `dialog-close`，关闭事件监听器可立即重新打开；旧原生 close 事件不会撤销新会话。
- Tour 保留高亮目标可交互的现有设计，明确为非模态引导；打开时清空步骤会以 `programmatic` 关闭并清理监听。
- core/portable 拒绝访问器、不可枚举字段、符号键及稀疏/带额外属性数组；在同一不可变快照上验证，调用方后续修改不影响已接受状态。
- 以上行为以及 VirtualKeyboard 支持类型、VirtualList 焦点行退出策略已写入 README。数据校验收紧针对不符合既有普通数据协议的输入。

## 验证与候选产物

本机 0.3.1 候选检查：

| 检查 | 结果 |
| --- | --- |
| `npm run verify:package` | 通过，包含类型、构建、138 项 Node 测试、73 个入口 API 门禁和实际 tarball 校验 |
| `npm run check:pages` | 通过，7 个示例页面 |
| npm 发布预演 | 对实际 0.3.1 tarball 执行 `npm publish --dry-run --ignore-scripts`，通过，无上传 |
| 组件浏览器回归 | 同一组件实现已通过 Chromium 274/274、新增 WebKit 17/17；最终 Table 相关 9 项 Chromium 和 1 项 WebKit 复测通过 |
| Web 适配层回归 | 同一实现已通过 Chromium 32/32、WebKit 32/32；本次候选仅调整版本和发布文档 |
| 依赖审计 | 发布准备前只读查询报告 0 个已知漏洞；无 runtime/peer/optional 依赖 |
| 候选包 | 216 个文件，309,969 B packed / 1,382,124 B unpacked |
| Button 独立消费者 | gzip 1,950 B，保持独立入口隔离 |

候选文件：`.artifacts/packages/haiyue-ui-0.3.1.tgz`。

SHA-256：`3a8ccb79adcb17fd86ec0bbbb68e45cfb8a53c9f77047116237edc4dc5882bdd`。

日志：`.artifacts/release-0.3.1-package.log`、`release-0.3.1-pages.log`、`release-0.3.1-publish-preview.json` 和 `release-0.3.1-publish-preview.log`；机器可读包记录见 `.artifacts/package-check.json`。上述浏览器结果对应审查修复后的组件实现，日志位于 `.artifacts/tech-debt-audit/remaining-*.log`。

## 提交与 CI

候选分支为 `release/0.3.1`。推送该分支触发 [UI release checks](https://github.com/HaiyueStudio/UI/actions/workflows/check.yml?query=branch%3Arelease%2F0.3.1)，在 Ubuntu / Node 22 上执行完整 `npm run release:check`，重新验证候选版本、全部 Node/浏览器测试、包和示例站。正式发布应核对对应候选提交的工作流为 success；最终提交 SHA 与运行链接同时保存在本机 `.artifacts/release-0.3.1-manifest.json`。

该准备分支不触发仅面向 master 的示例站部署，发布前工作不创建 npm 版本或 Git 版本标签。

## 正式发布步骤

1. 确认候选提交的 CI 通过，以及候选 tarball SHA-256 与本记录一致。
2. 正式发布时使用已校验的 tarball：`npm publish .artifacts/packages/haiyue-ui-0.3.1.tgz --access public --tag latest --registry=https://registry.npmjs.org`。
3. 校验 registry 的版本、dist-tag 与安装入口，再创建 `v0.3.1` 标签和发布记录。

如需回退，由发布人员将 npm `latest` 指回 `0.3.0`，消费者固定旧版本；不覆盖已发布版本，后续修复另发新版本。
