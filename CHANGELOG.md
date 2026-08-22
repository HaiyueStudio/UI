# Changelog

## Unreleased

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
