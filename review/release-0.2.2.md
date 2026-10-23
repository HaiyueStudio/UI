# UI 0.2.2 发布候选

日期：2026-10-23。按用户指定，`package.json`、锁文件与 CHANGELOG 已准备为 `0.2.2`；尚未发布、提交、推送或创建标签。

## 发布范围

- 新增 `Masonry`、`Carousel`、`QR Code`、`Modal`，分别提供独立子路径、根导出与显式注册。组件示例按类别内字母顺序排列。
- Collapse 支持可配置的展开/收起动画。二维码支持中央图片或插槽图标，修复示例纠错等级无法选择的问题，显式选择的 L/M/Q/H 均实际生效。
- 收录已提交但尚未发布的 portable/core 与 Web 适配器扩展：呈现样式、图标、文字排版、主题字体缩放、FormGroup 帮助文字与响应式布局辅助函数。
- 修正二维码用法示例中的占位图片引用，确保 GitHub Pages 构建检查通过。同步纠正 portable/Web 入口尚未发布的过期文档描述。
- 不增加运行时、peer 或 optional 依赖。二维码编码器保留上游 MIT 版权声明，扫码解码器仅为开发依赖。

## 版本依据

只读查询 npm registry：当前 `latest` 为 `0.2.1`，其 `gitHead` 为 `a023cd58fdef72b774ad199b2c86e26072d0fa6c`；候选版本按用户指定使用 `0.2.2`。

远端 `master` 与本地 HEAD 均为 `957a7da106a76cf646dcad6d87a2404149ece60e`。发布候选还包含本地未提交的新组件与版本准备改动。

## 本机验证

环境：Windows，Node 24.21.0，npm 11.19.0。同一实现此前以 0.3.0 候选执行 `npm run release:check` 完整通过，退出码为 0；原始日志保存在 `.artifacts/release-0.3.0-check.log`。本次仅修改候选版本及发布文档，0.2.2 的包检查结果另存于 `.artifacts/release-0.2.2-package-check.log`。

| 检查 | 结果 |
| --- | --- |
| 类型检查、构建、119 项 Node 测试 | 通过 |
| 142 项组件浏览器测试（Chromium） | 通过 |
| 52 项 Web 适配器测试（Chromium/WebKit） | 全部通过，两个引擎各 26 项 |
| API | 49 个代码入口符合本库基线 |
| GitHub Pages | 7 个页面通过 |
| npm 发布预演 | 已对实际候选 tarball 执行 `--dry-run`，通过，无上传 |
| 包内容、体积与独立消费者 | 通过，148 个文件，压缩 218,891 B，展开 966,088 B |
| 独立 Button bundle | gzip 1,894 B，上限 5,000 B |

首次完整检查发现本机缺少 WebKit，已安装项目指定版本；发现二维码用法示例中的 `/brand.svg` 占位引用导致 Pages 校验失败，已改为内联 SVG 插槽示例。

候选文件：`.artifacts/packages/haiyue-ui-0.2.2.tgz`。

SHA-256：`eee9c6d1ab1e069c98162fa0518ed01d1617e014718d731eacf22a1944d5995a`。

机器可读包检查：`.artifacts/package-check.json`。完整发布检查日志：`.artifacts/release-0.3.0-check.log`。
新增 Web Components 的交互检查覆盖 Chromium；Chromium/WebKit 双引擎检查覆盖 Web 适配器，不代表所有组件均完成双引擎验收。

## 实际发布前

1. 本机完整发布检查已通过；提交候选改动并确认对应提交的远端 CI。排除浏览器生成的 `debug.log`。
2. 本机 `npm whoami` 返回 `ENEEDAUTH`，需要发布人员完成 npm 登录并确认 `@haiyue/ui` 的发布权限。发布预演不验证账号权限或 OTP。
3. 获得实际发布授权后，核对候选包 SHA-256，发布已校验的 tarball：`npm publish .artifacts/packages/haiyue-ui-0.2.2.tgz --access public --tag latest --registry=https://registry.npmjs.org`。
4. 验证 registry 版本和入口后，再创建对应 Git 标签与发布记录。推送 master 会按现有流程部署示例站点。

如需回退，由发布人员将 npm `latest` 指回 `0.2.1`，消费者固定旧版本；不覆盖已发布版本，后续修复另发新版本。
