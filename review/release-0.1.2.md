# UI 0.1.2 发布候选

日期：2026-09-23。版本号和锁文件已准备为 `0.1.2`；尚未发布、推送或打标签。

## 变更

- 新增独立 `@haiyue/ui/expandable` 入口及画廊、独立交互示例。
- 修复外层 Shadow DOM 中 Escape 不恢复的问题。组件在自身接收冒泡键盘事件，内部菜单和内层容器可以先处理 Escape。
- 保持输入内容、焦点恢复、事件次数和重连生命周期契约。
- 收录已有 Tabs 横向滚动调整。完整记录见 [CHANGELOG](../CHANGELOG.md)。
- UI 自行维护 API、包内容/体积、消费者及浏览器门禁，不读取 Engine 仓库。

## 本机验证

`npm run release:check` 最终完整重跑通过（Node 24.19.0、Playwright Chromium）。此前一次 Chromium 启动超时，测试尚未进入页面；独立重跑后 6 项浏览器测试全部通过。

| 检查 | 结果 |
| --- | --- |
| 类型检查、构建 | 通过 |
| Node 单元/契约测试 | 25 项通过，含独立 API 漂移拒绝测试 |
| 浏览器交互 | 6 项通过：普通/嵌套 Shadow DOM、内部 Escape 消费、嵌套容器、重连、键盘与按钮 |
| API | 20 个代码入口符合本库基线 |
| Pages | 6 个页面通过 |
| 实际 tarball | 54,934 B，展开 264,229 B，54 个文件 |
| 独立 button bundle | gzip 949 B；上限 5,000 B |
| 运行时依赖 | dependencies / peerDependencies / optionalDependencies 均为空 |

原有包预算保持 55,000 B / 280,000 B / 60 文件。CHANGELOG 一并入包；精简 README 后满足预算。新增 CI 使用 Node 22，从本库独立安装和检查；远程 CI 尚未执行。

候选 SHA-256：`69a3b120ffcfd39898931d68df196f0a67d9ec807a82c74f0caf69789924b2e8`。
机器可读包检查记录：`.artifacts/package-check.json`。

## 发布步骤（本次未执行）

1. 合并/提交候选，确认干净提交上的 CI；发布人员确认 npm 身份和权限。
2. `npm ci`、`npx playwright install chromium`、`npm run release:check`。
3. 检查 `.artifacts/packages/haiyue-ui-0.1.2.tgz` 与验证结果。
4. 确认后发布该 tarball：`npm publish .artifacts/packages/haiyue-ui-0.1.2.tgz --access public --tag latest`。
5. 验证 registry 版本、exports 和 gallery 后创建对应发布记录。

浏览器组件仍要求支持 Popover API。当前新增浏览器回归覆盖 Chromium；不宣称完成所有浏览器矩阵。
若发布后需回退，消费者固定 `0.1.1`，发布人员将 npm `latest` 指回 `0.1.1`；不要覆盖已发布的 `0.1.2`。后续修复使用新版本。
