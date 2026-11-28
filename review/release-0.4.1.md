# UI 0.4.1 发布候选

日期：2026-11-28。版本、锁文件、变更日志和示例页版本标识已更新为 `0.4.1`。

## 发布范围

- Badge 新增可取消的拖拽移除与恢复状态，使用原位圆、拖动圆／计数胶囊和平滑连接呈现液态黏连、拉伸、断开与重新融合；示例阈值从 10px 起调整。
- Button / ButtonGroup 新增颜色动效开关与时长，Button 提供纯色／描边风格，子按钮可覆盖组配置。
- AutoComplete 新增可反向切换的面板动效；Tree 新增分支展开／收拢及独立箭头旋转配置。
- Drag Source 新增原样、自定义、文本与真实组件移动预览；Sortable 新增排序让位动效、真实组件移动与半透明占位。
- Split 新增禁用状态、分隔条／手柄样式参数、CSS parts 与自定义手柄插槽。
- 修复 Button 空图标插槽导致的文案偏移、Switch 文本垂直对齐，并改进示例页混合代码高亮及移动端布局。
- 保留 76 个类型化入口、显式注册、按需导入隔离和零运行时／peer／optional 依赖。

## 发布前验证

- `npm run verify:package` 已通过：类型、构建、138 项 Node 测试、76 个入口 API 基线和实际 tarball 校验。
- 相同组件实现的 Badge 最终检查通过 19 项 Chromium 回归和 4 项 WebKit 回归；此前各组件的独立动效、拖拽和示例回归均已通过。
- 完整 CI 暴露的两个测试断言已修正并通过本地复测：减少动态效果检查暂停动画并等待异步偏好事件；短代码布局检查使用固定短样本，不依赖不断扩展的 Button 示例内容。
- 本次候选推送后必须核对 [release/0.4.1 完整发布检查](https://github.com/HaiyueStudio/UI/actions/workflows/check.yml?query=branch%3Arelease%2F0.4.1) 为 success，覆盖全部组件浏览器测试、Chromium / WebKit 适配层测试及 7 个示例页面。

## 候选产物

- 文件：`.artifacts/packages/haiyue-ui-0.4.1.tgz`。
- 包含 234 个文件，343,569 B packed / 1,519,141 B unpacked。
- Button 独立消费者 gzip：3,104 B。
- SHA-256：`35fe65059b75c52d393d4c668e989aafcfba47ccbf598f56416d443e147be00f`。
- 完整本机日志：`.artifacts/release-0.4.1-package.log`，回归复测：`.artifacts/release-0.4.1-ci-regressions.log`。

正式发布使用上述经过验证的 tarball，并在上传后核对 npm `latest`、registry tarball 的哈希与安装入口。Git 标签 `v0.4.1`、GitHub Release 和 npm 均应对应同一候选提交；最终 CI 链接、发布状态和哈希记录在本机 `.artifacts/release-0.4.1-manifest.json`。
